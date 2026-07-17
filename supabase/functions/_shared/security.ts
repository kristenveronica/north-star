// ============================================================================
// Shared security utilities: event logging + lightweight rate limiting.
// Backed by public.security_events (service-role only). Logging must NEVER
// break a request — every failure here is swallowed.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const env = (k: string) => Deno.env.get(k) || "";
const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

/** Best-effort client IP from proxy headers. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  return (xff.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim() || "unknown";
}

export async function logSecurityEvent(
  event_type: string,
  opts: { ip?: string; identifier?: string; meta?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    await admin.from("security_events").insert({
      event_type,
      ip: opts.ip ?? null,
      identifier: opts.identifier ?? null,
      meta: opts.meta ?? {},
    });
  } catch (_e) {
    // Never let logging failure affect the caller.
  }
}

// Anthropic per-1M-token pricing. Extend when we add models.
const AI_PRICING: Record<string, { in: number; out: number; cacheRead: number; cacheWrite: number }> = {
  "claude-sonnet-4-6": { in: 3, out: 15, cacheRead: 0.30, cacheWrite: 3.75 },
};

/**
 * Persist one AI call's token usage + computed cost. Best-effort: a logging
 * failure must never affect the caller. Skips when there was no real API call
 * (usage null). See public.ai_usage_log / docs/ai-cost-audit.md.
 */
export async function logAiUsage(opts: {
  action: string;
  familyId?: string | null;
  model?: string;
  usage: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } | null;
  durationMs?: number | null;
}): Promise<void> {
  try {
    if (!opts.usage) return; // no API call happened (e.g. empty-input shortcut)
    const u = opts.usage;
    const model = opts.model || "claude-sonnet-4-6";
    const inTok = u.input_tokens ?? 0;
    const outTok = u.output_tokens ?? 0;
    const cacheRead = u.cache_read_input_tokens ?? 0;
    const cacheWrite = u.cache_creation_input_tokens ?? 0;
    const p = AI_PRICING[model] || AI_PRICING["claude-sonnet-4-6"];
    const cost = (inTok * p.in + outTok * p.out + cacheRead * p.cacheRead + cacheWrite * p.cacheWrite) / 1_000_000;
    await admin.from("ai_usage_log").insert({
      action: opts.action,
      family_id: opts.familyId ?? null,
      model,
      input_tokens: inTok,
      output_tokens: outTok,
      cache_read_tokens: cacheRead,
      cache_creation_tokens: cacheWrite,
      cost_usd: Number(cost.toFixed(6)),
      duration_ms: opts.durationMs ?? null,
    });
  } catch (_e) {
    // Never let telemetry break a request.
  }
}

/** Count events of a type for an ip/identifier within the last windowSecs. */
export async function recentCount(
  event_type: string,
  key: { ip?: string; identifier?: string },
  windowSecs: number,
): Promise<number> {
  try {
    const sinceIso = new Date(Date.now() - windowSecs * 1000).toISOString();
    let q = admin.from("security_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", event_type)
      .gte("created_at", sinceIso);
    if (key.ip) q = q.eq("ip", key.ip);
    if (key.identifier) q = q.eq("identifier", key.identifier);
    const { count } = await q;
    return count ?? 0;
  } catch (_e) {
    return 0; // fail open on the counter; the request itself is still authorized elsewhere
  }
}

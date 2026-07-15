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

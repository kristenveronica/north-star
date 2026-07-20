// ============================================================================
// North Star — Child portal lookup (verify_jwt: OFF — see config.toml)
//
// A child opening their portal on THEIR OWN device has no parent session and
// no local family data. This function looks a child up by their access code in
// the cloud and returns ONLY that child's data (their profile + projects +
// milestones), so the portal can render anywhere.
//
// Security: returns exactly one child (matched by access_code) and only that
// child's projects/milestones — never the rest of the family. Uses the service
// role to read past RLS, but the response is tightly scoped to the access code.
// (The optional PIN is a same-device convenience gate and is not stored in the
// cloud, so it isn't enforced here; the access code is the credential.)
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-provided).
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { clientIp, logSecurityEvent, recentCount } from "../_shared/security.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const env = (k: string) => Deno.env.get(k) || "";
const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

// This endpoint is unauthenticated, so the response must never carry a child's
// PII. Strip the date of birth and any sensitive keys from the profile blob.
const SENSITIVE_PROFILE_KEYS = ["pin", "birthData", "gender"];
// deno-lint-ignore no-explicit-any
function sanitizeChild(child: any): any {
  const c = { ...child };
  delete c.birthday;
  if (c.learning_profile && typeof c.learning_profile === "object") {
    const lp = { ...c.learning_profile };
    for (const k of SENSITIVE_PROFILE_KEYS) delete lp[k];
    c.learning_profile = lp;
  }
  return c;
}

const normCode = (code: string) => (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// Shared: resolve a child by access code and load their projects + milestones.
// Returns null (not found) or "ambiguous" on a code collision (fail closed).
// deno-lint-ignore no-explicit-any
async function lookupChild(norm: string): Promise<{ child: any; projects: any[]; milestones: any[] } | null | "ambiguous"> {
  const { data: kids } = await admin
    .from("children").select("*").eq("access_code", norm).limit(2);
  if (!kids || kids.length === 0) return null;
  if (kids.length > 1) return "ambiguous";
  const child = kids[0];
  const { data: projects } = await admin.from("projects").select("*").eq("child_id", child.id);
  const projectIds = (projects || []).map((p: any) => p.id);
  let milestones: any[] = [];
  if (projectIds.length) {
    const { data: ms } = await admin.from("milestones").select("*").in("project_id", projectIds);
    milestones = ms || [];
  }
  return { child, projects: projects || [], milestones };
}

async function login(code: string, ip: string) {
  // Normalize to the code alphabet only (kills LIKE-wildcard injection like "%").
  const norm = normCode(code);
  if (!norm) return json({ error: "missing_code" }, 400);

  // Brute-force throttle: at most 10 attempts per IP per 5 minutes.
  if (await recentCount("portal_login_attempt", { ip }, 300) >= 10) {
    await logSecurityEvent("portal_login_throttled", { ip, identifier: norm });
    return json({ error: "too_many_attempts" }, 429);
  }
  await logSecurityEvent("portal_login_attempt", { ip, identifier: norm });

  const found = await lookupChild(norm);
  if (found === null) {
    await logSecurityEvent("portal_login_fail", { ip, identifier: norm });
    return json({ error: "not_found" }, 404);
  }
  if (found === "ambiguous") return json({ error: "ambiguous" }, 409);

  return json({ child: sanitizeChild(found.child), projects: found.projects, milestones: found.milestones });
}

// ---------------------------------------------------------------------------
// Daily Guide line — ONE warm, honest line, generated ≤ 1×/child/local-day and
// cached in `daily_guide`. Never throws into the portal: any failure (no key,
// API error, cache miss + generation error) resolves to { line: null } and the
// dashboard simply shows its evergreen greeting.
// ---------------------------------------------------------------------------
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const GUIDE_MODEL = "claude-sonnet-4-6";
const arr = (v: unknown): string[] => Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()) : [];

const GUIDE_SYSTEM = `You are a child's trusted Guide in North Star — a warm mentor (like a favourite camp leader), never a chatbot or a cheerleader.

Write ONE short line to greet this child on their dashboard today. Rules:
- ONE sentence, at most ~16 words, plain words a child their age reads easily.
- It must be TRUE from the facts given — reference something real: an interest they have, what they made recently, or today's adventure. Never invent facts.
- Warm and specific, NOT flattery. Do not praise their character ("you're so talented"); notice something real instead.
- Never manufacture progress ("you're almost a master"). Never pressure. It's fine to simply welcome them.
- No emoji. No exclamation-mark spam. No question that demands they answer.
Return JSON: { "line": "<the sentence>" }.`;

const GUIDE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { line: { type: "string" } },
  required: ["line"],
};

// deno-lint-ignore no-explicit-any
async function generateGuideLine(ctx: any, apiKey: string): Promise<string | null> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: GUIDE_MODEL,
      max_tokens: 200,
      system: [{ type: "text", text: GUIDE_SYSTEM }],
      output_config: { format: { type: "json_schema", schema: GUIDE_SCHEMA } },
      messages: [{ role: "user", content: JSON.stringify(ctx) }],
    }),
  });
  const data = await res.json();
  if (!res.ok || data.stop_reason === "refusal") return null;
  const textBlock = (data.content || []).find((b: any) => b.type === "text");
  const line = (JSON.parse(textBlock?.text || "{}").line || "").toString().trim();
  return line || null;
}

async function dailyGuide(code: string, localDateRaw: string, ip: string) {
  const norm = normCode(code);
  if (!norm) return json({ line: null });
  const localDate = /^\d{4}-\d{2}-\d{2}$/.test(localDateRaw || "")
    ? localDateRaw
    : new Date().toISOString().slice(0, 10);

  // Light abuse guard on the AI path (cache means real children hit this ~1×/day).
  if (await recentCount("portal_login_attempt", { ip }, 300) >= 40) return json({ line: null });

  const found = await lookupChild(norm);
  if (!found || found === "ambiguous") return json({ line: null });
  const { child, projects, milestones } = found;

  // Return the cached line if one already exists for this child + local day.
  const { data: cached } = await admin
    .from("daily_guide").select("line").eq("child_id", child.id).eq("local_date", localDate).maybeSingle();
  if (cached?.line) return json({ line: cached.line });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ line: null });

  // Build a compact, honest context from what we already loaded — no PII.
  const projById = new Map((projects || []).map((p: any) => [p.id, p]));
  const completed = (milestones || []).filter((m: any) => m.completed);
  const recentDone = completed
    .sort((a: any, b: any) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime())
    .slice(0, 3).map((m: any) => m.title).filter(Boolean);
  const nextMs = (milestones || [])
    .filter((m: any) => !m.completed && projById.get(m.project_id)?.status !== "completed")
    .sort((a: any, b: any) => new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime())[0];
  const nextProj = nextMs ? projById.get(nextMs.project_id) : null;
  const lastDoneAt = completed[0]?.completed_at ? new Date(completed[0].completed_at) : null;
  const daysSinceLast = lastDoneAt ? Math.floor((Date.now() - lastDoneAt.getTime()) / 86400000) : null;

  const ctx = {
    name: child.name || "",
    age: child.age ?? null,
    interests: arr(child.interests).slice(0, 5),
    strengths: arr(child.strengths).slice(0, 3),
    todaysAdventure: nextMs ? { title: nextMs.title, role: nextProj?.quest_role || null } : null,
    recentlyMade: recentDone,
    lightsEarned: completed.length,
    daysSinceLastLight: daysSinceLast,
    isFirstEver: completed.length === 0,
  };

  let line: string | null = null;
  try { line = await generateGuideLine(ctx, apiKey); } catch { line = null; }
  if (!line) return json({ line: null });

  // Cache (best-effort). Ignore a race where another request wrote first.
  await admin.from("daily_guide").upsert({ child_id: child.id, local_date: localDate, line }, { onConflict: "child_id,local_date" });
  return json({ line });
}

// ---------------------------------------------------------------------------
// Read to me — warm AI narration (OpenAI gpt-4o-mini-tts) for the mission page.
// One request narrates several short chunks (title, story, each step) so the
// client can highlight each line as it plays. Cached per (model|voice|text) so
// replays cost nothing. Gated on a valid child access code + IP throttle so the
// paid TTS endpoint can't be abused. Any failure → { chunks: [] } and the client
// falls back to the (robotic but free) browser voice.
// ---------------------------------------------------------------------------
const OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech";
const TTS_MODEL = "gpt-4o-mini-tts";
const TTS_VOICE = "coral"; // warm, friendly
const TTS_INSTRUCTIONS =
  "You are a child's warm, gentle Guide. Read aloud like a favourite grown-up reading a story to a young child: warm, unhurried, encouraging, natural and conversational — never robotic. Soft, kind energy.";

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}
async function ttsOne(text: string, apiKey: string): Promise<string | null> {
  const res = await fetch(OPENAI_TTS_URL, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: TTS_MODEL, voice: TTS_VOICE, input: text, instructions: TTS_INSTRUCTIONS, response_format: "mp3" }),
  });
  if (!res.ok) return null;
  return bufToBase64(await res.arrayBuffer());
}

// deno-lint-ignore no-explicit-any
async function tts(code: string, chunks: any[], ip: string) {
  const norm = normCode(code);
  if (!norm) return json({ chunks: [] });
  if (await recentCount("portal_login_attempt", { ip }, 300) >= 60) return json({ chunks: [] });
  const found = await lookupChild(norm);
  if (!found || found === "ambiguous") return json({ chunks: [] });

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return json({ chunks: [], error: "tts_unconfigured" });

  const items = (Array.isArray(chunks) ? chunks : []).slice(0, 14);
  const out = await Promise.all(items.map(async (c: any) => {
    const id = c?.id;
    const text = (c?.text || "").toString().trim().slice(0, 600);
    if (!text) return { id, audio: null };
    const hash = await sha256Hex(`${TTS_MODEL}|${TTS_VOICE}|${text}`);
    const { data: cached } = await admin.from("tts_cache").select("audio").eq("hash", hash).maybeSingle();
    if (cached?.audio) return { id, audio: cached.audio };
    const audio = await ttsOne(text, apiKey);
    if (audio) await admin.from("tts_cache").upsert({ hash, audio });
    return { id, audio };
  }));
  return json({ chunks: out });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const { action, payload } = await req.json();
    if (action === "login") return await login((payload?.code || "").toString(), clientIp(req));
    if (action === "daily-guide") {
      return await dailyGuide((payload?.code || "").toString(), (payload?.localDate || "").toString(), clientIp(req));
    }
    if (action === "tts") {
      return await tts((payload?.code || "").toString(), payload?.chunks, clientIp(req));
    }
    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("[child-portal] error:", e);
    return json({ error: (e as Error).message || "Request failed" }, 500);
  }
});

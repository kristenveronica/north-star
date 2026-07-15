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

async function login(code: string, ip: string) {
  // Normalize to the code alphabet only (kills LIKE-wildcard injection like "%").
  const norm = (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!norm) return json({ error: "missing_code" }, 400);

  // Brute-force throttle: at most 10 attempts per IP per 5 minutes.
  if (await recentCount("portal_login_attempt", { ip }, 300) >= 10) {
    await logSecurityEvent("portal_login_throttled", { ip, identifier: norm });
    return json({ error: "too_many_attempts" }, 429);
  }
  await logSecurityEvent("portal_login_attempt", { ip, identifier: norm });

  // EXACT match — the access code is the credential; no partial/wildcard matching.
  const { data: kids } = await admin
    .from("children").select("*").eq("access_code", norm).limit(2);
  if (!kids || kids.length === 0) {
    await logSecurityEvent("portal_login_fail", { ip, identifier: norm });
    return json({ error: "not_found" }, 404);
  }
  // Fail safe: if a code somehow collides, open NEITHER portal.
  if (kids.length > 1) return json({ error: "ambiguous" }, 409);
  const child = kids[0];

  const { data: projects } = await admin
    .from("projects").select("*").eq("child_id", child.id);
  const projectIds = (projects || []).map((p: any) => p.id);

  let milestones: any[] = [];
  if (projectIds.length) {
    const { data: ms } = await admin
      .from("milestones").select("*").in("project_id", projectIds);
    milestones = ms || [];
  }

  return json({ child: sanitizeChild(child), projects: projects || [], milestones });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const { action, payload } = await req.json();
    if (action === "login") return await login((payload?.code || "").toString(), clientIp(req));
    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("[child-portal] error:", e);
    return json({ error: (e as Error).message || "Request failed" }, 500);
  }
});

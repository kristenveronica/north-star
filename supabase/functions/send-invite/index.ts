// ============================================================
// send-invite — email a contributor invitation link (best-effort).
//
// Sends via Resend if RESEND_API_KEY is set; otherwise returns
// { sent: false, reason: "no_provider" } so the client falls back to the
// copyable invite link. Never throws to the caller.
//
// Authorization: the caller must be a family OWNER and must already own a
// PENDING invitation in their family for the target email. This prevents the
// endpoint being used as an open, brand-backed email relay to arbitrary
// recipients. Rate-limited + logged.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { resolveCaller, isOwner } from "../_shared/authz.ts";
import { clientIp, logSecurityEvent, recentCount } from "../_shared/security.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { email, link, familyName } = await req.json();
    if (!email || !link) return json({ sent: false, reason: "missing_fields" }, 400);

    // Only a family owner who actually invited this email may trigger the send.
    const caller = await resolveCaller(req);
    if (!isOwner(caller)) return json({ sent: false, reason: "not_authorized" }, 403);
    const { data: invs } = await admin.from("invitations")
      .select("email").eq("family_id", caller!.familyId).eq("status", "pending");
    const owns = (invs || []).some((i: { email: string }) => (i.email || "").toLowerCase() === String(email).toLowerCase());
    if (!owns) {
      await logSecurityEvent("invite_send_denied", { ip: clientIp(req), identifier: caller!.familyId, meta: { email } });
      return json({ sent: false, reason: "no_matching_invitation" }, 403);
    }
    if (await recentCount("invite_send", { identifier: caller!.familyId }, 3600) >= 20) {
      return json({ sent: false, reason: "rate_limited" }, 429);
    }
    await logSecurityEvent("invite_send", { ip: clientIp(req), identifier: caller!.familyId, meta: { email } });

    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) return json({ sent: false, reason: "no_provider" });

    const from = Deno.env.get("INVITE_FROM") || "North Star <onboarding@resend.dev>";
    const fam = familyName ? `the ${familyName}` : "a family";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `You're invited to join ${familyName || "a family"} on North Star`,
        html: `
          <div style="font-family:Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;color:#20242c">
            <h2 style="font-weight:600">You've been invited to North Star</h2>
            <p>You've been invited to help support ${fam}'s learning journey. Click below to create your account and join — use the email this was sent to.</p>
            <p style="margin:24px 0">
              <a href="${link}" style="background:#C97B4E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Accept your invitation</a>
            </p>
            <p style="font-size:13px;color:#6e7480">Or paste this link into your browser:<br>${link}</p>
          </div>`,
      }),
    });
    return json({ sent: res.ok, reason: res.ok ? null : "send_failed" });
  } catch (_e) {
    return json({ sent: false, reason: "error" });
  }
});

// ============================================================
// send-invite — email a contributor invitation link (best-effort).
//
// Sends via Resend if RESEND_API_KEY is set; otherwise returns
// { sent: false, reason: "no_provider" } so the client falls back to the
// copyable invite link. Never throws to the caller — invitations are created
// client-side (RLS-guarded to owners); this only delivers the link.
// ============================================================

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

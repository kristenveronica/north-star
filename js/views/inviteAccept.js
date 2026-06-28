/* ============================================================
   inviteAccept.js — the /invite/:token landing + accept screen.

   Remembers the token (so it survives a signup/login round-trip), then:
     • logged in  → "Accept invitation" redeems it immediately.
     • logged out → prompts account creation / sign-in with the invited email;
       the pending token is redeemed automatically on the next hydrate
       (repo.acceptPendingInviteIfAny), so they join the inviter's family.
   ============================================================ */

import { esc, toast } from "../components/ui.js";
import { isLoggedIn } from "../auth.js";
import { setPendingInvite, acceptInvite, ensureFamilyAndHydrate } from "../lib/repo.js";
import { navigate } from "../router.js";
import { rerender } from "../app.js";

export function renderInviteAccept(container, params) {
  const token = params.token;
  setPendingInvite(token);   // survive the signup/login round-trip
  const logged = isLoggedIn();

  container.innerHTML = `
    <div class="welcome">
      <div class="welcome-card center" style="max-width:540px">
        <div class="t-eyebrow">North Star invitation</div>
        <h1 style="margin:.4rem 0 0">You've been invited to a family's learning journey</h1>
        <p class="text-muted" style="margin-top:10px">${logged
          ? "Accept below to join the family with the access the owner has set for you."
          : "Create an account (or sign in) using the email address your invitation was sent to, and you'll join the family automatically."}</p>
        <div class="row" style="gap:10px;justify-content:center;margin-top:20px;flex-wrap:wrap">
          ${logged
            ? `<button class="btn btn-primary btn-lg" id="accept">Accept invitation →</button>`
            : `<a class="btn btn-primary btn-lg" href="#/signup">Create account →</a>
               <a class="btn btn-lg" href="#/login">Sign in</a>`}
        </div>
        <p class="small text-muted" id="accept-status" style="margin-top:14px" aria-live="polite"></p>
      </div>
    </div>
  `;

  container.querySelector("#accept")?.addEventListener("click", async () => {
    const status = container.querySelector("#accept-status");
    const btn = container.querySelector("#accept");
    btn.disabled = true;
    status.textContent = "Joining the family…";
    try {
      await acceptInvite(token);
      setPendingInvite(null);
      await ensureFamilyAndHydrate();
      toast("Welcome — you've joined the family!", { type: "success" });
      navigate("/");
      rerender();
    } catch (e) {
      btn.disabled = false;
      const msg = /email_mismatch/i.test(e?.message || "")
        ? "This invitation was sent to a different email. Sign in with the invited address."
        : (e?.message || "That invitation couldn't be accepted — it may have expired.");
      status.textContent = msg;
    }
  });
}

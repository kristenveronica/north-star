/* ============================================================
   inviteAccept.js — the /invite/:token landing + accept screen.

   An invited person is NOT creating their own account from scratch — they're
   joining a family that already exists. So we never send them to the generic
   signup/login (which made people think "I must already have a login"). Instead
   this is ONE guided screen, framed as accepting an invitation:

     • logged out → "Set up your login" form. We preview the invite to greet
       them by family name and PRE-FILL + LOCK the invited email, so they can't
       pick the wrong address. They only choose a password. (If that email turns
       out to already have an account, we flip to a one-field sign-in.)
     • logged in  → a single "Join the family" button.

   The pending token is redeemed automatically on the next hydrate
   (repo.acceptPendingInviteIfAny), so they land inside the inviter's family.
   ============================================================ */

import { esc, toast } from "../components/ui.js";
import { isLoggedIn, signup, login } from "../auth.js";
import { setPendingInvite, acceptInvite, ensureFamilyAndHydrate } from "../lib/repo.js";
import { supabase } from "../lib/supabase.js";
import { navigate } from "../router.js";
import { rerender } from "../app.js";

const ROLE_LABEL = { co_architect: "a co-owner", contributor: "a contributor" };

async function previewInvite(token) {
  try {
    const { data, error } = await supabase.rpc("preview_invitation", { p_token: token });
    if (error) return null;
    return Array.isArray(data) ? data[0] : data;
  } catch { return null; }
}

export function renderInviteAccept(container, params) {
  const token = params.token;
  setPendingInvite(token);   // survive the signup/login round-trip

  if (isLoggedIn()) return renderAcceptButton(container, token);
  return renderSetup(container, token);
}

/* ---- Already signed in: a single accept button ---- */
function renderAcceptButton(container, token) {
  container.innerHTML = `
    <div class="welcome">
      <div class="welcome-card center" style="max-width:540px">
        <div class="t-eyebrow">You're invited ✦</div>
        <h1 style="margin:.4rem 0 0">Join the family</h1>
        <p class="text-muted" style="margin-top:10px">Accept below to join with the access the owner has set for you.</p>
        <div class="row" style="gap:10px;justify-content:center;margin-top:20px">
          <button class="btn btn-primary btn-lg" id="accept">Join the family →</button>
        </div>
        <p class="small text-muted" id="status" style="margin-top:14px" aria-live="polite"></p>
      </div>
    </div>`;
  container.querySelector("#accept").addEventListener("click", async () => {
    const status = container.querySelector("#status");
    const btn = container.querySelector("#accept");
    btn.disabled = true; status.textContent = "Joining the family…";
    try {
      await acceptInvite(token);
      setPendingInvite(null);
      await ensureFamilyAndHydrate();
      toast("Welcome — you've joined the family!", { type: "success" });
      navigate("/"); rerender();
    } catch (e) {
      btn.disabled = false;
      status.textContent = /email_mismatch/i.test(e?.message || "")
        ? "This invitation was sent to a different email. Sign in with the invited address."
        : (e?.message || "That invitation couldn't be accepted — it may have expired.");
    }
  });
}

/* ---- Logged out: guided "set up your login" form ---- */
async function renderSetup(container, token) {
  // Skeleton while we look up who invited them.
  container.innerHTML = `
    <div class="welcome"><div class="welcome-card center" style="max-width:520px">
      <div class="t-eyebrow">You're invited ✦</div>
      <h1 style="margin:.4rem 0 0">Loading your invitation…</h1>
    </div></div>`;

  const invite = await previewInvite(token);

  if (!invite) {
    container.innerHTML = `
      <div class="welcome"><div class="welcome-card center" style="max-width:520px">
        <div class="t-eyebrow">North Star invitation</div>
        <h1 style="margin:.4rem 0 0">This invitation has expired</h1>
        <p class="text-muted" style="margin-top:10px">This link is no longer valid — invitations expire for security. Ask whoever invited you to send a fresh one.</p>
      </div></div>`;
    return;
  }

  const family = invite.family_name || "their family";
  const roleLabel = ROLE_LABEL[invite.intended_role] || "a member";
  const email = invite.email || "";

  // mode: "setup" (new login) | "signin" (email already has an account)
  let mode = "setup";

  function paint() {
    const isSetup = mode === "setup";
    container.innerHTML = `
      <div class="welcome">
        <div class="welcome-card" style="max-width:520px;margin:0 auto">
          <div class="center">
            <div class="t-eyebrow">You're invited ✦</div>
            <h1 style="margin:.4rem 0 0">Join ${esc(family)}</h1>
            <p class="text-muted" style="margin-top:10px">
              You've been invited as ${esc(roleLabel)}. ${isSetup
                ? "Set up your private login below — there's no payment, you're covered by the family's membership."
                : "Looks like you already have a North Star login. Enter your password to join."}
            </p>
          </div>

          <form id="invite-form" style="margin-top:22px;text-align:left" novalidate>
            ${isSetup ? `
            <div class="field">
              <label for="f-name">Your name</label>
              <input class="input" id="f-name" type="text" autocomplete="name" placeholder="e.g. Mikey" />
            </div>` : ``}

            <div class="field">
              <label for="f-email">Your email</label>
              <input class="input" id="f-email" type="email" value="${esc(email)}" readonly
                     style="opacity:.85;cursor:not-allowed" />
              <span class="hint">This is the address your invitation was sent to.</span>
            </div>

            <div class="field">
              <label for="f-pass">${isSetup ? "Create a password" : "Your password"}</label>
              <input class="input" id="f-pass" type="password"
                     autocomplete="${isSetup ? "new-password" : "current-password"}"
                     placeholder="${isSetup ? "At least 8 characters" : "Your password"}" />
            </div>

            <button class="btn btn-primary btn-lg" type="submit" id="f-submit" style="width:100%;margin-top:6px">
              ${isSetup ? "Join the family →" : "Sign in & join →"}
            </button>
            <p class="small text-muted" id="status" style="margin-top:12px;text-align:center" aria-live="polite"></p>
          </form>

          <p class="small text-muted center" style="margin-top:6px">
            ${isSetup
              ? `Already set up a North Star login? <a href="#" id="to-signin">Sign in to accept</a>`
              : `Need to create your login instead? <a href="#" id="to-setup">Set one up</a>`}
          </p>
        </div>
      </div>`;

    container.querySelector("#to-signin")?.addEventListener("click", (e) => { e.preventDefault(); mode = "signin"; paint(); });
    container.querySelector("#to-setup")?.addEventListener("click", (e) => { e.preventDefault(); mode = "setup"; paint(); });
    container.querySelector("#invite-form").addEventListener("submit", onSubmit);
    (container.querySelector("#f-name") || container.querySelector("#f-pass"))?.focus();
  }

  async function onSubmit(e) {
    e.preventDefault();
    const status = container.querySelector("#status");
    const btn = container.querySelector("#f-submit");
    const password = container.querySelector("#f-pass").value;
    const name = container.querySelector("#f-name")?.value?.trim() || "";
    btn.disabled = true; status.textContent = "Joining the family…"; status.style.color = "";

    try {
      if (mode === "setup") {
        let res;
        try {
          res = await signup({ email, password, parentName: name });
        } catch (err) {
          // Email already registered → flip to sign-in instead of confusing them.
          if (/already|registered|exists/i.test(err?.message || "")) {
            mode = "signin"; paint();
            const s = container.querySelector("#status");
            s.textContent = "You already have a login for this email — enter your password to join.";
            return;
          }
          throw err;
        }
        // Email confirmation on → no session yet. The pending invite token is
        // kept in storage and redeemed automatically once they confirm & sign
        // in. Show a clear "check your email" state and stop here.
        if (res?.needsConfirmation) {
          container.innerHTML = `
            <div class="welcome"><div class="welcome-card center" style="max-width:520px">
              <div class="em" style="font-size:34px">✉️</div>
              <h1 style="margin:.4rem 0 0">Confirm your email</h1>
              <p class="text-muted" style="margin-top:10px">We've sent a confirmation link to <span class="kbd">${esc(email)}</span>.
              Click it, then come back and <a href="#/login">sign in</a> — you'll join ${esc(family)} automatically.</p>
            </div></div>`;
          return;
        }
      } else {
        await login({ email, password });
      }

      // signup()/login() already hydrate, which redeems the pending invite first;
      // make sure it's applied even on returning sessions.
      try { await acceptInvite(token); } catch { /* may already be a member */ }
      setPendingInvite(null);
      await ensureFamilyAndHydrate();
      toast(`Welcome — you've joined ${family}!`, { type: "success" });
      navigate("/"); rerender();
    } catch (err) {
      btn.disabled = false;
      status.style.color = "var(--danger, #b3261e)";
      status.textContent = /invalid login|password/i.test(err?.message || "")
        ? "That password didn't match. Try again, or reset it from the sign-in page."
        : (err?.message || "Something went wrong — please try again.");
    }
  }

  paint();
}

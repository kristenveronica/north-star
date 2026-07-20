/* ============================================================
   settings.js — Family-level settings + reset.
   ============================================================ */

import { getState, setFamily, resetAll, setInsightsConfig } from "../store.js";
import { FRAMEWORKS, INSIGHTS_DISCLAIMER } from "../ai/insightsEngine.js";
import { esc, toast, confirmDialog, fmtDate, el, openModal } from "../components/ui.js";
import { navigate } from "../router.js";
import { rerender } from "../app.js";
import { hasAccount, currentUserEmail, attachAccountToExistingFamily, changePassword, logout } from "../auth.js";
import { childProfileLimit, childSeatsUsed } from "../lib/entitlements.js";
import { openBillingPortal, aiSeatCount, syncAiSeats, getSubscription, resumeSubscription, keepSubscription } from "../lib/billing.js";
import { openCancelFlow } from "../components/cancelFlow.js";
import { isOwnerActing } from "../lib/permissions.js";
import { eraseAccount, ERASE_CONFIRM_PHRASE } from "../lib/account.js";

export function renderSettings(container) {
  const s = getState();
  const f = s.family || {};

  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Settings</h1>
        <div class="sub">Family-wide preferences for the OS.</div>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 2fr 1fr; gap:18px">
      <div class="stack">
        <div class="card">
          <h3>Family preferences</h3>
          <div class="grid grid-2 mt-2">
            <div class="field"><label>Parent name</label><input class="input" id="parentName" value="${esc(f.parentName || "")}"/></div>
            <div class="field"><label>Family name</label><input class="input" id="familyName" value="${esc(f.familyName || "")}"/></div>
          </div>
          <p class="hint" style="margin:6px 0 0">Faith Integration, Home Location, Travel and people now live in <a href="#/family-settings">Family</a>.</p>
          <div class="row" style="justify-content:flex-end;align-items:center;gap:12px">
            <span class="small text-muted" id="pref-autosave" aria-live="polite"></span>
            <button class="btn btn-primary" id="save">Save</button>
          </div>
        </div>

        <div class="card">
          <h3>Local login</h3>
          ${hasAccount() ? `
            <p class="text-muted small">Signed in as <span class="kbd">${esc(currentUserEmail())}</span>.</p>
            <h4 class="mt-2">Change password</h4>
            <div class="grid grid-2">
              <div class="field"><label>Current password</label><input class="input" id="cp-current" type="password" autocomplete="current-password"/></div>
              <div class="field"><label>New password</label><input class="input" id="cp-new" type="password" autocomplete="new-password"/></div>
            </div>
            <div class="row" style="gap:10px">
              <button class="btn btn-primary" id="cp-save">Save password</button>
              <button class="btn btn-danger" id="cp-logout">Log out</button>
            </div>
          ` : `
            <p class="text-muted small">No account on this device yet. Add one so you can lock the parent portal and log out between sessions. The MVP stores credentials locally (PBKDF2 hashed) — nothing leaves your device.</p>
            <div class="grid grid-2">
              <div class="field"><label>Email</label><input class="input" id="ac-email" type="email" placeholder="you@example.com"/></div>
              <div class="field"><label>Password</label><input class="input" id="ac-password" type="password" placeholder="8+ chars, letters and a number"/></div>
            </div>
            <button class="btn btn-primary" id="ac-create">Set up local login</button>
          `}
        </div>

        <div class="card">
          <h3>Subscription</h3>
          <p class="text-muted small">Your plan includes <strong>${childProfileLimit(f)} child ${childProfileLimit(f) === 1 ? "profile" : "profiles"}</strong> — ${childSeatsUsed(s)} in use. Add more child profiles from the Children page; manage or cancel your subscription here.</p>
          <div class="divider"></div>
          <div class="row-between" style="align-items:flex-start;gap:10px">
            <div>
              <div class="fw-700 small">Adult contributor seats: ${aiSeatCount(s)}</div>
              <p class="text-muted small" style="margin:4px 0 0;max-width:46ch">Each co-owner, and any contributor you grant <em>Generate AI Projects</em> or <em>Request AI Reports</em>, is a billable seat (the Primary Owner is included in your base plan). Update after changing who can use AI.</p>
            </div>
            <button class="btn btn-sm" id="sync-seats">Update billing seats</button>
          </div>
          <div class="small text-muted" id="sync-seats-status" style="margin-top:6px" aria-live="polite"></div>
          <div class="divider"></div>
          <div id="sub-status" class="small text-muted" style="margin-bottom:10px" aria-live="polite"></div>
          <div class="row" style="gap:10px;flex-wrap:wrap">
            <button class="btn btn-primary" id="manage-billing">Manage payment &amp; invoices</button>
            <button class="btn" id="go-children">Add a child profile</button>
            <button class="btn btn-ghost" id="cancel-sub" style="margin-left:auto;color:var(--text-muted)">Cancel membership</button>
          </div>
        </div>

        <div class="card">
          <h3>Child Insights</h3>
          <p class="text-muted small">${esc(INSIGHTS_DISCLAIMER)}</p>
          <p class="text-muted small mt-2">Child Insights &amp; Developmental Intelligence will arrive with a future plan. There's nothing to configure yet — we'll walk you through it when it's ready.</p>
        </div>

        <div class="card">
          <h3>Notifications</h3>
          <p class="text-muted small">For MVP, in-app notifications are shown on the dashboard and in the child portal. Email/push notifications will be added when this connects to a real backend.</p>
          <div class="stack">
            ${(s.notifications || []).slice(0, 6).map(n => `
              <div class="row" style="gap:10px;padding:8px;border:1px solid var(--border);border-radius:var(--r-md)">
                <span>${n.read ? "🔔" : "🔴"}</span>
                <span style="flex:1">${esc(n.message)}</span>
              </div>
            `).join("") || `<div class="small text-muted">No notifications yet.</div>`}
          </div>
        </div>

        <div class="card" style="border-color: #E8C2B6">
          <h3 style="color:var(--danger)">Danger zone</h3>
          <p class="text-muted small">Reset all family data. Use this if you want to start the onboarding fresh.</p>
          <button class="btn btn-danger" id="reset">Reset all data</button>
          ${f.id && hasAccount() && isOwnerActing(s) ? `
            <div class="divider"></div>
            <h4 style="color:var(--danger)">Close account &amp; erase everything</h4>
            <p class="text-muted small" style="max-width:52ch">Permanently deletes your family's account — every child, project, reflection and <strong>every uploaded photo, audio and video</strong> — from our cloud and storage, and closes the logins. This is your right under our <a href="#/trust">Trust Charter</a>: your work leaves with you, with nothing left behind. <strong>It cannot be undone.</strong></p>
            <button class="btn btn-danger" id="erase-account">Close account &amp; erase everything</button>
          ` : ""}
        </div>
      </div>

      <div class="card">
        <h3>About this MVP</h3>
        <p class="small">This is your family's working prototype. Local-only, no accounts, no payments yet. Everything you do persists in this browser's storage.</p>
        <div class="divider"></div>
        <h4>What's mocked</h4>
        <ul class="text-muted small" style="padding-left:18px">
          <li>AI suggestions (heuristic, not LLM)</li>
          <li>Checkout (no real payment)</li>
          <li>Notifications (in-app only)</li>
          <li>Authentication (no accounts)</li>
        </ul>
        <div class="divider"></div>
        <h4>What's real</h4>
        <ul class="text-muted small" style="padding-left:18px">
          <li>Profiles, projects, milestones, reflections</li>
          <li>Stars + Momentum Points</li>
          <li>Countdown timers (live)</li>
          <li>Domain balancing engine</li>
          <li>Child portals with PIN-style access</li>
        </ul>
        <div class="divider"></div>
        <h4>Build</h4>
        <p class="text-muted small" id="build-id" style="font-variant-numeric:tabular-nums">Checking…</p>
      </div>
    </div>
  `;

  // Which frontend commit is live. Fetched from build-info.json, which is
  // stamped at deploy time (scripts/gen-build-info.mjs). Absent in local dev,
  // so we degrade gracefully. Lets anyone confirm production identity at a glance.
  (async () => {
    const el = container.querySelector("#build-id");
    if (!el) return;
    try {
      const r = await fetch("/build-info.json", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const b = await r.json();
      const when = b.builtAt ? fmtDate(b.builtAt) : "—";
      const ctx = b.context && b.context !== "production" ? ` · ${esc(b.context)}` : "";
      el.innerHTML = `<code>${esc(b.commitShort || "unknown")}</code> · ${esc(b.branch || "—")}${ctx}<br>deployed ${esc(when)}`;
    } catch {
      el.textContent = "local / dev (no deploy stamp)";
    }
  })();

  const savePrefs = () => setFamily({
    parentName: container.querySelector("#parentName").value.trim(),
    familyName: container.querySelector("#familyName").value.trim(),
  });

  // Auto-save the family preferences (safety net) — never lose what you typed.
  // Scoped to these fields only; login/password fields are deliberately excluded.
  const prefStatus = container.querySelector("#pref-autosave");
  let prefTimer;
  const autosavePrefs = () => {
    clearTimeout(prefTimer);
    if (prefStatus) prefStatus.textContent = "Saving…";
    prefTimer = setTimeout(() => {
      savePrefs();
      if (prefStatus) prefStatus.textContent = "✓ Saved automatically";
    }, 700);
  };
  ["#parentName", "#familyName"].forEach(sel =>
    container.querySelector(sel)?.addEventListener("input", autosavePrefs));

  container.querySelector("#save").addEventListener("click", () => {
    clearTimeout(prefTimer);
    savePrefs();
    toast("Settings saved", { type: "success" });
    rerender();
  });

  // Subscription management — portal is for card/invoices only (cancellation is
  // disabled there and routed through our in-app commitment flow instead).
  container.querySelector("#manage-billing")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try { await openBillingPortal(); }
    catch (err) { toast(err.message || "No subscription to manage yet.", { type: "warning" }); btn.disabled = false; }
  });
  container.querySelector("#go-children")?.addEventListener("click", () => navigate("/children"));

  // The 12-month commitment flow: reminder → pause offer → confirm (beta exempt).
  container.querySelector("#cancel-sub")?.addEventListener("click", () =>
    openCancelFlow({ onChange: () => loadSubStatus(container) }));

  // Live subscription status line (commitment / paused / ending), loaded async.
  loadSubStatus(container);

  // Reconcile adult AI seats with current membership (server recomputes the count).
  container.querySelector("#sync-seats")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const status = container.querySelector("#sync-seats-status");
    btn.disabled = true; if (status) status.textContent = "Updating…";
    try {
      const res = await syncAiSeats();
      if (status) {
        status.textContent = res?.ok
          ? `✓ Billing updated — ${res.aiSeats} contributor seat${res.aiSeats === 1 ? "" : "s"}.`
          : res?.reason === "no_active_subscription"
            ? "No active subscription yet — seats will bill once you subscribe."
            : res?.reason === "no_aiseat_price"
              ? "Add the contributor-seat price in Stripe to enable seat billing."
              : "Seats are up to date.";
      }
    } catch (err) {
      if (status) status.textContent = err.message || "Couldn't update seats just now.";
    } finally { btn.disabled = false; }
  });

  // Local login wiring
  container.querySelector("#ac-create")?.addEventListener("click", async () => {
    const email = container.querySelector("#ac-email").value.trim();
    const password = container.querySelector("#ac-password").value;
    try {
      await attachAccountToExistingFamily({ email, password });
      toast("Local login is set up", { type: "success" });
      rerender();
    } catch (e) { toast(e.message || "Could not create account", { type: "warning" }); }
  });
  container.querySelector("#cp-save")?.addEventListener("click", async () => {
    const current = container.querySelector("#cp-current").value;
    const next = container.querySelector("#cp-new").value;
    try {
      await changePassword({ current, next });
      toast("Password updated", { type: "success" });
      container.querySelector("#cp-current").value = "";
      container.querySelector("#cp-new").value = "";
    } catch (e) { toast(e.message, { type: "warning" }); }
  });
  container.querySelector("#cp-logout")?.addEventListener("click", () => {
    logout();
    toast("Logged out");
    navigate("/login");
  });

  // Child Insights is deferred to a future plan (Sprint 1): no self-serve premium grant.

  container.querySelector("#reset").addEventListener("click", async () => {
    const ok = await confirmDialog({
      title: "Reset all family data?",
      message: "This deletes everything — family vision, children, projects, milestones, reflections, materials.",
      confirmLabel: "Yes, reset",
      danger: true,
    });
    if (ok) {
      resetAll();
      toast("All data cleared");
      navigate("/onboarding");
    }
  });

  // Right-to-erasure / account closure (Owner + cloud only). A typed phrase makes
  // it a deliberate act; the server re-checks Owner authorization and does the
  // Storage garbage-collection + full DB delete. See lib/account.js.
  container.querySelector("#erase-account")?.addEventListener("click", () => openEraseFlow());
}

function openEraseFlow() {
  const body = el(`
    <div>
      <p class="text-muted small" style="max-width:52ch">This permanently erases your entire family account from our cloud <strong>and deletes every uploaded photo, audio and video from storage</strong> — then closes the logins. There is no undo and no backup we can restore from. Your data leaves with nothing left behind, exactly as our Trust Charter promises.</p>
      <div class="field mt-2">
        <label>Type <span class="kbd">${esc(ERASE_CONFIRM_PHRASE)}</span> to confirm</label>
        <input class="input" id="erase-confirm" autocomplete="off" autocapitalize="characters" placeholder="${esc(ERASE_CONFIRM_PHRASE)}"/>
      </div>
      <div class="small" id="erase-status" aria-live="polite" style="min-height:18px"></div>
    </div>
  `);
  const foot = document.createElement("div");
  foot.style.cssText = "display:flex;gap:10px;width:100%;justify-content:flex-end";
  foot.innerHTML = `
    <button class="btn" data-cancel>Keep my account</button>
    <button class="btn btn-danger" data-erase disabled>Erase everything</button>
  `;
  const modal = openModal({ title: "Close account & erase everything", body, footer: foot });

  const input = body.querySelector("#erase-confirm");
  const status = body.querySelector("#erase-status");
  const eraseBtn = foot.querySelector("[data-erase]");
  const match = () => input.value.trim().toUpperCase() === ERASE_CONFIRM_PHRASE;
  input.addEventListener("input", () => { eraseBtn.disabled = !match(); });
  foot.querySelector("[data-cancel]").addEventListener("click", () => modal.close());
  setTimeout(() => input.focus(), 60);

  eraseBtn.addEventListener("click", async () => {
    if (!match()) return;
    eraseBtn.disabled = true;
    foot.querySelector("[data-cancel]").disabled = true;
    input.disabled = true;
    status.textContent = "Erasing your account and removing every file… this can take a moment.";
    try {
      await eraseAccount(input.value.trim());
      // Everything is gone server-side. Clear the device and log the person out.
      status.textContent = "✓ Your account and all files have been erased.";
      resetAll();
      try { logout(); } catch { /* ignore */ }
      setTimeout(() => {
        modal.close();
        toast("Your account and all data have been permanently erased.", { type: "success", duration: 6000 });
        navigate("/login");
        rerender();
      }, 900);
    } catch (err) {
      input.disabled = false;
      foot.querySelector("[data-cancel]").disabled = false;
      eraseBtn.disabled = false;
      status.innerHTML = `<span style="color:var(--danger)">${esc(err.message || "Couldn't erase the account just now — nothing was deleted. Please try again.")}</span>`;
    }
  });
}

/* Render the live subscription status line + contextual resume/keep actions.
   Best-effort: silently no-ops if billing isn't configured or reachable. */
async function loadSubStatus(container) {
  const host = container.querySelector("#sub-status");
  const cancelBtn = container.querySelector("#cancel-sub");
  if (!host) return;
  let sub;
  try { sub = await getSubscription(); } catch { host.textContent = ""; return; }

  if (!sub?.hasSubscription) {
    host.textContent = "No active membership on this account yet.";
    if (cancelBtn) cancelBtn.style.display = "none";
    return;
  }

  const period = sub.currentPeriodEnd ? fmtDate(sub.currentPeriodEnd, { short: false }) : null;

  if (sub.cancelAtPeriodEnd) {
    host.innerHTML = `Your membership is set to end${period ? ` on <strong>${esc(period)}</strong>` : ""}.
      <a href="#" id="undo-cancel" style="color:var(--primary);font-weight:600">Keep my membership</a>`;
    if (cancelBtn) cancelBtn.style.display = "none";
    host.querySelector("#undo-cancel")?.addEventListener("click", async (e) => {
      e.preventDefault();
      try { await keepSubscription(); toast("Your membership continues 🎉", { type: "success" }); loadSubStatus(container); }
      catch (err) { toast(err.message || "Couldn't update just now.", { type: "warning" }); }
    });
    return;
  }

  if (sub.isPaused) {
    const until = sub.pausedUntil ? fmtDate(sub.pausedUntil, { short: false }) : null;
    host.innerHTML = `Your membership is paused${until ? ` until <strong>${esc(until)}</strong>` : ""} 🌙 —
      <a href="#" id="resume-sub" style="color:var(--primary);font-weight:600">resume now</a>`;
    if (cancelBtn) cancelBtn.style.display = "none";
    host.querySelector("#resume-sub")?.addEventListener("click", async (e) => {
      e.preventDefault();
      try { await resumeSubscription(); toast("Welcome back — your membership has resumed.", { type: "success" }); loadSubStatus(container); }
      catch (err) { toast(err.message || "Couldn't resume just now.", { type: "warning" }); }
    });
    return;
  }

  if (cancelBtn) cancelBtn.style.display = "";

  if (sub.isBeta) {
    host.innerHTML = `You're on a <strong>beta membership</strong>${period ? ` — renews ${esc(period)}` : ""}. No long-term commitment.`;
  } else if (sub.stillCommitted && sub.committedUntil) {
    host.innerHTML = `You're in your <strong>first 12-month year</strong> together, through <strong>${esc(fmtDate(sub.committedUntil, { short: false }))}</strong>.`;
  } else if (period) {
    host.innerHTML = `Your membership renews on <strong>${esc(period)}</strong>.`;
  } else {
    host.textContent = "Your membership is active.";
  }
}

function frameworkRow(f, enabled) {
  return `
    <div class="row" style="gap:10px;padding:10px;border:1px solid var(--border);border-radius:var(--r-md);background:var(--card-elev)">
      <label class="checkbox" style="flex:1">
        <input type="checkbox" data-framework="${esc(f.id)}" ${enabled ? "checked" : ""}/>
        <div>
          <div class="fw-700">${esc(f.name)}</div>
          <div class="small text-muted">${esc(f.blurb)}</div>
        </div>
      </label>
    </div>
  `;
}

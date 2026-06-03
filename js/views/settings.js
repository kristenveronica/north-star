/* ============================================================
   settings.js — Family-level settings + reset.
   ============================================================ */

import { getState, setFamily, resetAll, setInsightsConfig } from "../store.js";
import { FRAMEWORKS, INSIGHTS_DISCLAIMER } from "../ai/insightsEngine.js";
import { esc, toast, confirmDialog } from "../components/ui.js";
import { navigate } from "../router.js";
import { rerender } from "../app.js";
import { hasAccount, currentUserEmail, attachAccountToExistingFamily, changePassword, logout } from "../auth.js";

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
          <div class="field">
            <label class="checkbox"><input type="checkbox" id="faithEnabled" ${f.faithEnabled ? "checked" : ""}/> Enable Faith Gigs across the family</label>
            <input class="input mt-1 ${f.faithEnabled ? "" : "hidden"}" id="faithTradition" placeholder="Faith tradition" value="${esc(f.faithTradition || "")}"/>
          </div>
          <div class="row" style="justify-content:flex-end">
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
          <h3>Child Insights (premium feature)</h3>
          <p class="text-muted small">${esc(INSIGHTS_DISCLAIMER)}</p>
          <label class="checkbox mt-2"><input type="checkbox" id="premium-toggle" ${s.insightsConfig?.premiumEnabled ? "checked" : ""}/> Enable Child Insights & Developmental Intelligence</label>
          <div id="frameworks-wrap" class="${s.insightsConfig?.premiumEnabled ? "" : "hidden"} mt-2">
            <div class="divider"></div>
            <h4>Framework Marketplace</h4>
            <p class="text-muted small mb-2">Choose which lenses are used to surface observations. Evidence-informed by default; interpretive frameworks are entirely optional and presented as reflective tools, never as objective truth.</p>

            <div class="small text-muted fw-700" style="letter-spacing:0.08em;text-transform:uppercase;margin-top:8px">Evidence-Informed</div>
            <div class="stack mt-1">
              ${FRAMEWORKS.filter(f => f.group === "evidence").map(f => frameworkRow(f, s.insightsConfig?.frameworks?.[f.id])).join("")}
            </div>

            <div class="small text-muted fw-700 mt-3" style="letter-spacing:0.08em;text-transform:uppercase">Interpretive (optional)</div>
            <p class="small text-muted">These frameworks are for reflection and exploration. Never offered as objective truth.</p>
            <div class="stack mt-1">
              ${FRAMEWORKS.filter(f => f.group === "interpretive").map(f => frameworkRow(f, s.insightsConfig?.frameworks?.[f.id])).join("")}
            </div>
          </div>
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
      </div>
    </div>
  `;

  const faithCb = container.querySelector("#faithEnabled");
  const faithIn = container.querySelector("#faithTradition");
  faithCb.addEventListener("change", () => faithIn.classList.toggle("hidden", !faithCb.checked));

  container.querySelector("#save").addEventListener("click", () => {
    setFamily({
      parentName: container.querySelector("#parentName").value.trim(),
      familyName: container.querySelector("#familyName").value.trim(),
      faithEnabled: faithCb.checked,
      faithTradition: faithIn.value.trim(),
    });
    toast("Settings saved", { type: "success" });
    rerender();
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

  // Insights premium toggle
  const premiumCb = container.querySelector("#premium-toggle");
  premiumCb?.addEventListener("change", () => {
    setInsightsConfig({ premiumEnabled: premiumCb.checked, disclaimerAcknowledged: true });
    container.querySelector("#frameworks-wrap").classList.toggle("hidden", !premiumCb.checked);
    toast(premiumCb.checked ? "Child Insights enabled" : "Child Insights disabled", { type: "success" });
    rerender();
  });
  container.querySelectorAll("[data-framework]").forEach(cb => {
    cb.addEventListener("change", () => {
      setInsightsConfig({ frameworks: { [cb.dataset.framework]: cb.checked } });
      toast("Frameworks updated");
    });
  });

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

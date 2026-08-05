/* ============================================================
   premiumGate.js — The elegant introduction shown when a family
   opens a feature their current plan doesn't include yet.

   This is NOT a paywall. Premium features stay VISIBLE in the nav;
   opening one lands here — an aspirational product page that explains
   why the feature exists, how it helps, and which plan includes it.
   The family leaves inspired, never blocked. (Spec: "Think Apple
   product pages. Never aggressive sales pages.")

   Content is entirely data-driven from FEATURES in lib/plans.js, so a
   new gated feature needs zero new UI — just a config entry.
   ============================================================ */

import { esc, toast, confirmDialog } from "./ui.js";
import { navigate } from "../router.js";
import { getState } from "../store.js";
import { rerender } from "../app.js";
import { FEATURES, PLANS } from "../lib/plans.js";
import { changePlan } from "../lib/billing.js";

/** Render the introduction page for a locked feature into `container`. */
export function renderFeatureIntro(container, featureKey) {
  const f = FEATURES[featureKey];
  if (!f) { container.innerHTML = `<div class="pg-wrap"><p>Feature coming soon.</p></div>`; return; }

  const plan = PLANS[f.minPlan] || {};
  const soon = f.state === "coming_soon";
  const benefits = f.benefits || [];

  container.innerHTML = `
    <section class="pg-wrap${f.flagship ? " pg-flagship" : ""}">
      <div class="pg-hero">
        <div class="pg-eyebrow">${soon ? "Coming to " : "Included in "}<span class="pg-plan">${esc(plan.name || "")}</span></div>
        <h1 class="pg-title">${esc(f.title || "")}</h1>
        ${f.philosophy ? `<p class="pg-philosophy">${esc(f.philosophy)}</p>` : ""}
      </div>

      <div class="pg-canvas" role="img" aria-label="${esc(f.title || "")} preview">
        <span class="pg-canvas-label">${esc(f.title || "")}</span>
      </div>

      ${f.why ? `
        <div class="pg-why">
          <h2 class="pg-h2">Why this matters</h2>
          <p>${esc(f.why)}</p>
        </div>` : ""}

      ${benefits.length ? `
        <ul class="pg-benefits">
          ${benefits.map((b) => `<li><span class="pg-tick">✦</span><span>${esc(b)}</span></li>`).join("")}
        </ul>` : ""}

      <div class="pg-cta">
        ${soon
          ? `<div class="pg-soon">This experience is part of your <b>${esc(plan.name || "")}</b> relationship and is arriving soon.</div>`
          : `<button class="pg-upgrade" id="pg-upgrade">Upgrade to ${esc(plan.name || "")}</button>`}
        <button class="pg-return" id="pg-return">Return to dashboard</button>
      </div>

      <div class="pg-included">
        <span class="pg-included-label">Included in</span>
        <div class="pg-tiers">
          ${["foundation", "flourish", "legacy"].map((k) => {
            const p = PLANS[k];
            const on = (p.rank >= plan.rank);
            return `<span class="pg-chip ${on ? "on" : "off"}">${esc(p.name)}</span>`;
          }).join("")}
        </div>
      </div>
    </section>

    <style>
      .pg-wrap { max-width: 760px; margin: 0 auto; padding: 40px 22px 64px; text-align: center;
        color: var(--text, #2b2b2b); }
      .pg-eyebrow { font-size: .8rem; letter-spacing: .12em; text-transform: uppercase;
        color: var(--text-muted, #7a7367); font-weight: 700; }
      .pg-plan { color: var(--gold-ink, #8a6d3b); }
      .pg-title { font-size: clamp(2rem, 5vw, 3rem); line-height: 1.05; margin: 12px 0 0;
        text-wrap: balance; font-weight: 700; }
      .pg-philosophy { font-size: 1.2rem; line-height: 1.5; color: var(--text-muted, #6b6459);
        max-width: 30ch; margin: 18px auto 0; }
      .pg-flagship .pg-philosophy { color: var(--text, #2b2b2b); font-weight: 600; }
      .pg-canvas { margin: 34px auto 0; height: 240px; max-width: 640px; border-radius: 20px;
        display: grid; place-items: center; overflow: hidden;
        background:
          radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, var(--gold-soft, #f3e7cf) 70%, transparent), transparent 70%),
          linear-gradient(160deg, var(--card-elev, #faf7f1), var(--card, #fff));
        border: 1px solid var(--border, #ece6da); box-shadow: 0 20px 50px -30px rgba(0,0,0,.4); }
      .pg-canvas-label { font-size: .78rem; letter-spacing: .18em; text-transform: uppercase;
        color: var(--text-muted, #a89f8e); font-weight: 700; }
      .pg-why { margin: 40px auto 0; max-width: 56ch; }
      .pg-h2 { font-size: 1.05rem; letter-spacing: .04em; text-transform: uppercase;
        color: var(--text-muted, #7a7367); margin: 0 0 8px; }
      .pg-why p { font-size: 1.08rem; line-height: 1.65; margin: 0; }
      .pg-benefits { list-style: none; padding: 0; margin: 34px auto 0; max-width: 42ch;
        display: grid; gap: 14px; text-align: left; }
      .pg-benefits li { display: flex; gap: 12px; align-items: flex-start; font-size: 1.02rem;
        line-height: 1.4; }
      .pg-tick { color: var(--gold-ink, #b8923f); flex: 0 0 auto; margin-top: 2px; }
      .pg-cta { margin: 44px auto 0; display: flex; flex-direction: column; align-items: center; gap: 12px; }
      .pg-upgrade { background: var(--gold-ink, #a9822f); color: #fff; border: 0; cursor: pointer;
        padding: 15px 34px; border-radius: 999px; font-size: 1.05rem; font-weight: 700;
        box-shadow: 0 14px 30px -14px color-mix(in srgb, var(--gold-ink, #a9822f) 80%, transparent);
        transition: transform .12s ease, box-shadow .12s ease; }
      .pg-upgrade:hover { transform: translateY(-1px); }
      .pg-return { background: none; border: 0; color: var(--text-muted, #7a7367); cursor: pointer;
        font-size: .95rem; padding: 6px 10px; }
      .pg-return:hover { color: var(--text, #2b2b2b); }
      .pg-soon { color: var(--text-muted, #6b6459); font-size: 1rem; max-width: 44ch; line-height: 1.5; }
      .pg-included { margin: 46px auto 0; }
      .pg-included-label { font-size: .72rem; letter-spacing: .16em; text-transform: uppercase;
        color: var(--text-muted, #a89f8e); font-weight: 700; }
      .pg-tiers { margin: 12px auto 0; display: flex; gap: 8px; justify-content: center; }
      .pg-chip { padding: 6px 16px; border-radius: 999px; font-size: .85rem; font-weight: 700;
        border: 1px solid var(--border, #ece6da); }
      .pg-chip.on { background: var(--gold-soft, #f3e7cf); color: var(--gold-ink, #8a6d3b);
        border-color: transparent; }
      .pg-chip.off { color: var(--text-muted, #b3ab9a); }
      @media (prefers-reduced-motion: reduce) { .pg-upgrade { transition: none; } }
    </style>`;

  container.querySelector("#pg-return")?.addEventListener("click", () => navigate("/"));
  container.querySelector("#pg-upgrade")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const ok = await confirmDialog({
      title: `Upgrade to ${plan.name}?`,
      message: `Your membership moves to ${plan.name} — $${plan.price}/month. It applies now; Stripe prorates the difference for the rest of this cycle.`,
      confirmLabel: `Upgrade to ${plan.name}`,
    });
    if (!ok) return;
    btn.disabled = true; btn.textContent = "Upgrading…";
    try {
      const res = await changePlan(f.minPlan);
      if (res?.needsBase) { navigate(`/pricing?plan=${f.minPlan}`); return; }
      // Optimistic: reflect the new plan locally so the feature unlocks at once
      // (the webhook re-truths family_billing → family_profiles.plan shortly after).
      const st = getState();
      if (st.family?.entitlements) st.family.entitlements.plan = f.minPlan;
      toast(`Welcome to ${plan.name} ✦`, { type: "success" });
      rerender();
    } catch (err) {
      toast(err.message || "Couldn't upgrade just now.", { type: "warning" });
      btn.disabled = false; btn.textContent = `Upgrade to ${plan.name}`;
    }
  });
}

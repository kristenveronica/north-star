/* ============================================================
   cancelFlow.js — The 12-month commitment retention flow.

   North Star asks full-price families to commit to a 12-month rhythm. We don't
   trap anyone in Stripe — instead, leaving passes through a calm, centred
   "gauntlet": a reminder of why a full year matters, a genuine offer to PAUSE,
   and a final reflection on what the family has built. Only after that can a
   committed family confirm cancellation (scheduled at period end, data kept).

   Beta families are EXEMPT (server-decided): they see a single simple confirm.

   Aesthetic: centred orientation "bubbles", one idea at a time, generous space.
   ============================================================ */

import { esc, fmtDate, toast } from "./ui.js";
import { getState, getChildStats } from "../store.js";
import {
  getSubscription, pauseSubscription, cancelSubscription, resumeSubscription, keepSubscription,
} from "../lib/billing.js";

/* ---------- overlay primitive ---------- */
function overlay() {
  const host = document.getElementById("modal-host") || document.body;
  const root = document.createElement("div");
  root.className = "ns-commit-backdrop";
  host.appendChild(root);
  let onClose = null;
  const close = () => { root.remove(); onClose?.(); };
  root.addEventListener("click", (e) => { if (e.target === root) close(); });
  return {
    root,
    close,
    setOnClose(fn) { onClose = fn; },
    render(html) {
      root.innerHTML = `<div class="ns-commit-card" role="dialog" aria-modal="true">${html}</div>`;
      return root.querySelector(".ns-commit-card");
    },
  };
}

const compass = `<div class="ns-commit-mark" aria-hidden="true">🧭</div>`;

/* ---------- progress snapshot (for the final save step) ---------- */
function familyProgress() {
  const s = getState();
  const kids = s.children || [];
  let projects = 0, stars = 0, momentum = 0;
  for (const c of kids) {
    const st = getChildStats(c.id);
    projects += st.completedProjects.length;
    stars += st.totalStars;
    momentum += st.totalMomentum;
  }
  return { childCount: kids.length, names: kids.map(k => k.name).filter(Boolean), projects, stars, momentum };
}

/* ============================================================
   Public entry. Reads live commitment state, then routes:
   beta / no-commitment → simple confirm; committed → full gauntlet.
   `onChange` is called after any state-changing action so the caller
   (settings) can refresh its display.
   ============================================================ */
export async function openCancelFlow({ onChange } = {}) {
  const ov = overlay();
  ov.render(`${compass}<div class="ns-commit-body"><div class="ns-commit-spinner">Loading your membership…</div></div>`);

  let sub;
  try {
    sub = await getSubscription();
  } catch (e) {
    ov.render(`${compass}
      <h2>We couldn't reach billing</h2>
      <p class="ns-commit-lede">${esc(e.message || "Please try again in a moment.")}</p>
      <div class="ns-commit-actions"><button class="btn btn-primary" data-x>Close</button></div>`);
    ov.root.querySelector("[data-x]").addEventListener("click", ov.close);
    return;
  }

  if (!sub?.hasSubscription) {
    ov.render(`${compass}
      <h2>No active membership</h2>
      <p class="ns-commit-lede">There's no subscription to cancel on this account yet.</p>
      <div class="ns-commit-actions"><button class="btn btn-primary" data-x>Close</button></div>`);
    ov.root.querySelector("[data-x]").addEventListener("click", ov.close);
    return;
  }

  // Already scheduled to cancel? Offer to undo instead.
  if (sub.cancelAtPeriodEnd) return stepAlreadyCancelling(ov, sub, onChange);

  const committed = sub.stillCommitted && !sub.isBeta;
  if (committed) return stepReminder(ov, sub, onChange);
  return stepSimpleConfirm(ov, sub, onChange);
}

/* ============================================================
   BETA / uncommitted — a single, respectful confirm. No friction.
   ============================================================ */
function stepSimpleConfirm(ov, sub, onChange) {
  ov.render(`${compass}
    <h2>Cancel your membership?</h2>
    <p class="ns-commit-lede">You're free to leave anytime — no commitment. You'll keep full access until
      <strong>${esc(fmtDate(sub.currentPeriodEnd, { short: false }))}</strong>, and your family's data stays safe
      if you ever return.</p>
    <div class="ns-commit-actions">
      <button class="btn btn-primary btn-lg" data-keep>Keep my membership</button>
      <button class="btn btn-ghost" data-cancel>Cancel membership</button>
    </div>`);
  ov.root.querySelector("[data-keep]").addEventListener("click", ov.close);
  ov.root.querySelector("[data-cancel]").addEventListener("click", () => doCancel(ov, onChange));
}

/* ============================================================
   STEP 1 — the commitment reminder + philosophy.
   ============================================================ */
function stepReminder(ov, sub, onChange) {
  const until = sub.committedUntil ? fmtDate(sub.committedUntil, { short: false }) : null;
  ov.render(`${compass}
    <div class="ns-commit-eyebrow">Your 12-month rhythm</div>
    <h2>You're partway through your first year</h2>
    <p class="ns-commit-lede">When your family joined North Star, you chose a <strong>full year</strong> together —
      and there's a reason we ask for that.</p>
    <p class="ns-commit-lede">A single term isn't long enough to feel the difference. A year gives your children time to
      explore the platform deeply, and gives North Star time to truly get to know your family — so everything it
      suggests grows more personal, more attuned, the longer you stay.</p>
    ${until ? `<p class="ns-commit-note">Your committed year runs through <strong>${esc(until)}</strong>.</p>` : ""}
    <div class="ns-commit-actions">
      <button class="btn btn-primary btn-lg" data-stay>Stay the course</button>
      <button class="btn btn-ghost" data-next>I'd still like to leave</button>
    </div>`);
  ov.root.querySelector("[data-stay]").addEventListener("click", ov.close);
  ov.root.querySelector("[data-next]").addEventListener("click", () => stepPause(ov, sub, onChange));
}

/* ============================================================
   STEP 2 — offer a PAUSE instead (the real save).
   ============================================================ */
function stepPause(ov, sub, onChange) {
  ov.render(`${compass}
    <div class="ns-commit-eyebrow">Before you decide</div>
    <h2>Life gets busy. Pause instead?</h2>
    <p class="ns-commit-lede">If now isn't the right season, you don't have to leave. <strong>Pause your membership</strong> —
      keep everything you've built, pay nothing while you're away, and pick up exactly where you left off.</p>
    <div class="ns-commit-pause">
      <button class="ns-commit-pausebtn" data-pause="1"><span class="n">1</span><span class="u">month</span></button>
      <button class="ns-commit-pausebtn" data-pause="2"><span class="n">2</span><span class="u">months</span></button>
      <button class="ns-commit-pausebtn" data-pause="3"><span class="n">3</span><span class="u">months</span></button>
    </div>
    <div class="ns-commit-actions">
      <button class="btn btn-ghost" data-next>No thanks — continue</button>
    </div>`);
  ov.root.querySelectorAll("[data-pause]").forEach(b =>
    b.addEventListener("click", () => doPause(ov, Number(b.dataset.pause), onChange)));
  ov.root.querySelector("[data-next]").addEventListener("click", () => stepFinal(ov, sub, onChange));
}

/* ============================================================
   STEP 3 — what they've built / what stays (final reflection).
   ============================================================ */
function stepFinal(ov, sub, onChange) {
  const p = familyProgress();
  const who = p.names.length === 1 ? p.names[0]
    : p.names.length === 2 ? `${p.names[0]} and ${p.names[1]}`
    : p.names.length > 2 ? `${p.names.slice(0, -1).join(", ")} and ${p.names[p.names.length - 1]}`
    : "your family";
  const built = (p.projects > 0 || p.stars > 0);
  ov.render(`${compass}
    <div class="ns-commit-eyebrow">One last thing</div>
    <h2>Look how far you've come</h2>
    ${built ? `
      <p class="ns-commit-lede">Together, ${esc(who)} have completed
        <strong>${p.projects} project${p.projects === 1 ? "" : "s"}</strong> and earned
        <strong>${p.stars} star${p.stars === 1 ? "" : "s"}</strong> on North Star. That's real growth — and it's
        only beginning to compound.</p>
    ` : `
      <p class="ns-commit-lede">Your family's journey on North Star is just getting started — the most meaningful
        growth tends to come in the months after families find their rhythm.</p>
    `}
    <p class="ns-commit-note">Whatever you decide, nothing is erased. If you leave, you keep full access until the end of
      your current period, and your family's data stays safe should you ever return.</p>
    <div class="ns-commit-actions">
      <button class="btn btn-primary btn-lg" data-keep>Keep my place</button>
      <button class="btn btn-ghost ns-commit-leave" data-cancel>Cancel my membership</button>
    </div>`);
  ov.root.querySelector("[data-keep]").addEventListener("click", ov.close);
  ov.root.querySelector("[data-cancel]").addEventListener("click", () => doCancel(ov, onChange));
}

/* ============================================================
   Already scheduled to cancel — offer to undo.
   ============================================================ */
function stepAlreadyCancelling(ov, sub, onChange) {
  ov.render(`${compass}
    <h2>Your membership is set to end</h2>
    <p class="ns-commit-lede">It will end on <strong>${esc(fmtDate(sub.currentPeriodEnd, { short: false }))}</strong>.
      You still have full access until then. Changed your mind?</p>
    <div class="ns-commit-actions">
      <button class="btn btn-primary btn-lg" data-undo>Keep my membership after all</button>
      <button class="btn btn-ghost" data-x>Leave it ending</button>
    </div>`);
  ov.root.querySelector("[data-x]").addEventListener("click", ov.close);
  ov.root.querySelector("[data-undo]").addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    try { await keepSubscription(); toast("Welcome back — your membership continues.", { type: "success" }); onChange?.(); ov.close(); }
    catch (err) { toast(err.message || "Couldn't update just now.", { type: "warning" }); e.currentTarget.disabled = false; }
  });
}

/* ---------- actions ---------- */
async function doPause(ov, months, onChange) {
  const card = ov.root.querySelector(".ns-commit-card");
  if (card) card.classList.add("is-busy");
  try {
    const res = await pauseSubscription(months);
    const until = res?.pausedUntil ? fmtDate(res.pausedUntil, { short: false }) : null;
    ov.render(`${compass}
      <h2>Your membership is paused 🌙</h2>
      <p class="ns-commit-lede">No charges until ${until ? `<strong>${esc(until)}</strong>` : "you return"}. Everything you've
        built is right here waiting. We'll see you soon.</p>
      <div class="ns-commit-actions"><button class="btn btn-primary btn-lg" data-x>Done</button></div>`);
    ov.root.querySelector("[data-x]").addEventListener("click", ov.close);
    onChange?.();
  } catch (err) {
    if (card) card.classList.remove("is-busy");
    toast(err.message || "Couldn't pause just now.", { type: "warning" });
  }
}

async function doCancel(ov, onChange) {
  const card = ov.root.querySelector(".ns-commit-card");
  if (card) card.classList.add("is-busy");
  try {
    const res = await cancelSubscription();
    const ends = res?.endsAt ? fmtDate(res.endsAt, { short: false }) : null;
    ov.render(`${compass}
      <h2>Your membership will end</h2>
      <p class="ns-commit-lede">${ends ? `You'll keep full access until <strong>${esc(ends)}</strong>.` : "You'll keep access until the end of your current period."}
        Your family's data stays safe — if you ever come back, it's all still here.</p>
      <p class="ns-commit-note">Thank you for the time you spent with us. We hope North Star made a difference.</p>
      <div class="ns-commit-actions"><button class="btn btn-primary btn-lg" data-x>Done</button></div>`);
    ov.root.querySelector("[data-x]").addEventListener("click", ov.close);
    onChange?.();
  } catch (err) {
    if (card) card.classList.remove("is-busy");
    toast(err.message || "Couldn't cancel just now.", { type: "warning" });
  }
}

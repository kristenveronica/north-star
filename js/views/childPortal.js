/* ============================================================
   childPortal.js — Simplified kid-facing dashboard.
   No email login: parent-issued access code or direct link.
   ============================================================ */

import {
  getState, getChildByCode, getChildStats, getActiveMilestonesForChild,
  completeMilestone, addReflection, updateProject, addChildSelfAssessment,
  getProject, getMilestonesForProject, getReflectionsForProject,
  addMilestoneSubmission, removeMilestoneEvidence,
} from "../store.js";
import { REFLECTION_PROMPTS } from "../seed.js";
import { childPortalLogin } from "../lib/childPortalCloud.js";
import { esc, icon, nsIcon, renderCountdown, fmtDate, toast, openModal, DOMAIN_COLOR_CLASS } from "../components/ui.js";
import { celebrateMilestone, celebrateProject, isSoundOn, toggleSound } from "../components/celebrate.js";
import { openSubmissionModal } from "../components/submission.js";
import { renderSky, earnedLightSVG, lightLayout } from "../components/sky.js";
import { playSettleTone } from "../components/skySound.js";
import { openProjectPdfModal } from "../components/pdfModal.js";

/* ============================================================
   handleMilestoneTap — shared milestone interaction.
   - Tap an INCOMPLETE star  → open submission modal
       - "Skip & mark done"  → instant completion (lightning path)
       - "Submit & earn star" → save evidence + complete
     Either path fires the celebration.
   - Tap a COMPLETED star    → instant uncomplete (no modal)
   ============================================================ */
/* Mission detail — child taps a mission to see exactly what to do. */
function openMissionDetail(milestoneId) {
  const s = getState();
  const m = s.milestones.find(x => x.id === milestoneId);
  if (!m) return;
  const project = getProject(m.projectId);
  const steps = m.instructions || [];
  const body = document.createElement("div");
  body.innerHTML = `
    ${project?.questRole ? `<div class="small text-sage fw-700" style="letter-spacing:0.1em;text-transform:uppercase">${esc(project.questRole)}</div>` : ""}
    <h2 style="font-family:var(--font-serif);margin:4px 0 8px">${esc(m.title)}</h2>
    ${m.description ? `<p class="text-muted" style="margin-bottom:10px">${esc(m.description)}</p>` : ""}
    ${steps.length ? `
      <div class="small text-muted fw-700" style="text-transform:uppercase;letter-spacing:0.1em">Your steps</div>
      <ol class="stack mt-1" style="padding-left:20px;line-height:1.5">
        ${steps.map(st => `<li style="margin-bottom:8px">${esc(st)}</li>`).join("")}
      </ol>` : `<p class="text-muted small">No extra steps — go for it, then tap the star to mark it done!</p>`}
    <div class="card mt-2" style="background:var(--card-elev)">
      <div class="small text-muted">${m.momentumPoints} momentum points${m.reflectionRequired ? " · writing a reflection unlocks your star" : ""}${m.dueDate ? " · due " + fmtDate(m.dueDate, { short: false }) : ""}</div>
    </div>`;
  const foot = document.createElement("div");
  foot.style.cssText = "display:flex;gap:10px;width:100%;justify-content:flex-end";
  foot.innerHTML = `<button class="btn btn-primary" data-close>Got it ✦</button>`;
  openModal({ title: "Your mission", body, footer: foot });
}

function handleMilestoneTap(milestoneId, targetEl, afterChange) {
  const s = getState();
  const m = s.milestones.find(x => x.id === milestoneId);
  if (!m) return;

  // Toggle-off path: tap a completed star to undo (mistake recovery)
  if (m.completed) {
    completeMilestone(milestoneId);
    toast("Star removed");
    setTimeout(() => afterChange?.(), 250);
    return;
  }

  const project = getProject(m.projectId);
  openSubmissionModal({
    milestone: m, project,
    onSkip: () => {
      completeMilestone(milestoneId);
      celebrateMilestone(targetEl);
      const after = getState().milestones.find(x => x.id === milestoneId);
      toast(`Star earned! +${after?.momentumPoints || 0} Momentum Points`, { type: "success", duration: 3000 });
      const proj = getProject(m.projectId);
      if (proj?.status === "ready-for-reflection") {
        // All milestones done — bigger celebration if this tap was the last one
        setTimeout(() => celebrateProject(targetEl), 400);
      }
      setTimeout(() => afterChange?.(), 350);
    },
    onSubmit: (payload) => {
      addMilestoneSubmission(milestoneId, payload);
      completeMilestone(milestoneId);
      celebrateMilestone(targetEl);
      const after = getState().milestones.find(x => x.id === milestoneId);
      const evCount = (payload.evidence || []).length;
      toast(`Star earned! +${after?.momentumPoints || 0} pts${evCount ? ` · ${evCount} piece${evCount === 1 ? "" : "s"} added to portfolio` : ""}`, { type: "success", duration: 3500 });
      const proj = getProject(m.projectId);
      if (proj?.status === "ready-for-reflection") {
        setTimeout(() => celebrateProject(targetEl), 400);
      }
      setTimeout(() => afterChange?.(), 350);
    },
  });
}

function soundToggleHTML() {
  return `<button class="btn btn-ghost btn-sm" id="sound-toggle" title="${isSoundOn() ? "Sound on (click to mute)" : "Sound off (click to enable)"}" aria-label="Toggle sound">${isSoundOn() ? "🔊" : "🔇"}</button>`;
}
function wireSoundToggle(container, importRerender) {
  container.querySelector("#sound-toggle")?.addEventListener("click", () => {
    const on = toggleSound();
    toast(on ? "Sound on" : "Sound off");
    importRerender();
  });
}
import { navigate } from "../router.js";
import { rerender } from "../app.js";

/* ====== Login (when no code in URL) ====== */
export function renderChildLogin(container) {
  container.innerHTML = `
    <div class="welcome" style="background: radial-gradient(ellipse at top, #FBE3D0 0%, var(--bg) 60%);">
      <div class="welcome-card">
        <h1>Open your portal</h1>
        <p class="lede">Enter the access code your parent gave you.</p>
        <div class="field">
          <label>Access code</label>
          <input class="input" id="code" placeholder="e.g. sunny-otter-47" autocapitalize="none" autocomplete="off" spellcheck="false" style="font-size:18px;letter-spacing:0.04em;text-align:center"/>
        </div>
        <div class="field">
          <label>PIN <span class="text-muted small">(if your parent set one)</span></label>
          <input class="input" id="pin" inputmode="numeric" maxlength="4" placeholder="optional" style="font-size:18px;letter-spacing:0.4em;text-align:center;max-width:160px"/>
        </div>
        <button class="btn btn-primary btn-lg" id="go" style="width:100%;justify-content:center;white-space:nowrap">Open my portal →</button>
        <div style="text-align:center;margin-top:12px"><a href="#/welcome" class="text-muted small">← Back to home</a></div>
        <div class="divider"></div>
        <div class="small text-muted">Don't have a code? Ask the parent in this household to add you in <span class="kbd">Children</span>.</div>
      </div>
    </div>
  `;
  const goBtn = () => container.querySelector("#go");
  const go = async () => {
    const code = container.querySelector("#code").value.trim().toUpperCase();
    const pin = container.querySelector("#pin").value.trim();
    if (!code) { toast("Enter your access code", { type: "warning" }); return; }
    let child = getChildByCode(code);     // same-device fast path
    if (!child) {
      // Cross-device: look the child up in the cloud by their access code.
      const b = goBtn(); b.disabled = true; b.textContent = "Checking…";
      try {
        child = await childPortalLogin(code);
      } catch (e) {
        b.disabled = false; b.textContent = "Open my portal →";
        toast(/not_found/i.test(e.message) ? "Code not recognised"
          : /ambiguous/i.test(e.message) ? "This code needs resetting — ask your parent."
          : "Couldn't open your portal — try again", { type: "warning" });
        return;
      }
    }
    if (child.pin && child.pin !== pin) {
      const b = goBtn(); b.disabled = false; b.textContent = "Open my portal →";
      toast("That PIN doesn't match", { type: "warning" });
      return;
    }
    navigate("/kid/" + child.accessCode);
  };
  container.querySelector("#go").addEventListener("click", go);
  container.querySelector("#code").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  container.querySelector("#pin").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
}

/* ====== Child Dashboard V2 — shell (PR1) ======
   Structure + feel only: the Sky backdrop, three-zone layout, Guide greeting,
   Today Hero and Latest Light are in place; their DATA and wiring arrive in
   later PRs (controls carry a [data-todo] marker and are inert by design).
   Gated behind a flag so `main` stays shippable through the rebuild — enable in
   a browser console with:  localStorage.setItem('ns_child_dashboard_v2','1')
   The legacy dashboard body is deleted once the V2 series completes. */
function childDashboardV2Enabled() {
  try { return localStorage.getItem("ns_child_dashboard_v2") === "1"; }
  catch { return false; }
}

// Warm, evergreen greeting. Also the fallback shown until the personal daily
// Guide line (PR5) is ready, so arrival is never blocked on the network.
function shellGreeting(name) {
  const who = esc(name || "friend");
  const h = new Date().getHours();
  if (h < 5) return `The stars are still out, ${who}.`;
  if (h < 12) return `Good morning, ${who}.`;
  if (h < 17) return `Good afternoon, ${who}.`;
  if (h < 20) return `Good evening, ${who}.`;
  return `Evening, ${who}.`;
}

// Today's adventure = the child's earliest-due incomplete mission (one, never a list).
function resolveTodayMission(child) {
  const active = (getActiveMilestonesForChild(child.id) || []).filter(m => !m.completed);
  active.sort((a, b) => {
    const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return da - db;
  });
  return active[0] || null;
}

// First sentence of a description, clamped — the hero's one-line hook.
function firstSentence(text, max = 140) {
  const t = (text || "").trim();
  if (!t) return "";
  const s = t.split(/(?<=[.!?])\s/)[0];
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

const cdReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

// The accessible equivalent of the light rising — a quiet, non-visual note for
// screen-reader users. Never a number, never "+points".
function cdAnnounce(container, msg) {
  const el = container.querySelector(".cd-sr");
  if (el) el.textContent = msg;
}

// One light rises from the finished work up into the sky and fades as the sky
// settles with its new, permanent light. Campfire, not casino: no burst, no
// number — just a small ember the child can watch find its place. Lives on
// <body> so the surgical hero refresh underneath never removes it mid-flight.
// Returns a promise that resolves the instant the ember ARRIVES (a beat before
// it finishes fading), so the permanent light blooms in one continuous handoff.
function cdRiseLight(targetEl, id) {
  const sky = document.querySelector(".cd-sky");
  const start = targetEl.getBoundingClientRect();
  const sx = start.left + start.width / 2;
  const sy = start.top + start.height / 2;
  const p = lightLayout(id);
  const skyRect = sky ? sky.getBoundingClientRect() : null;
  const ex = skyRect ? skyRect.left + (p.x / 100) * skyRect.width : sx;
  const ey = skyRect ? skyRect.top + (p.y / 100) * skyRect.height : Math.max(24, sy - window.innerHeight * 0.4);
  const dx = Math.round(ex - sx), dy = Math.round(ey - sy);
  const dot = document.createElement("div");
  dot.className = "cd-risinglight";
  dot.style.left = `${sx}px`;
  dot.style.top = `${sy}px`;
  document.body.appendChild(dot);

  if (typeof dot.animate !== "function") {         // ancient-browser fallback
    return new Promise((res) => setTimeout(() => { dot.remove(); res(); }, 200));
  }
  // An ember floating up, then curving over into place — an arc, not a straight
  // line, so it reads as alive rather than mechanical. Same every time (year
  // five must feel like week one): calm, unhurried, watchable.
  const anim = dot.animate([
    { transform: "translate(0,0) scale(1)", opacity: 0.9, offset: 0 },
    { transform: `translate(${Math.round(dx * 0.18)}px, ${Math.round(dy * 0.34 - 20)}px) scale(0.95)`, opacity: 1, offset: 0.28 },
    { transform: `translate(${Math.round(dx * 0.82)}px, ${Math.round(dy * 0.82)}px) scale(0.78)`, opacity: 1, offset: 0.72 },
    { transform: `translate(${dx}px, ${dy}px) scale(0.62)`, opacity: 0, offset: 1 },
  ], { duration: 1350, easing: "cubic-bezier(.22,.61,.30,1)", fill: "forwards" });

  return new Promise((res) => {
    let handed = false;
    const hand = () => { if (!handed) { handed = true; res(); } };
    setTimeout(hand, 1180);                          // ≈ arrival, before the last fade
    anim.finished.then(() => { hand(); dot.remove(); }).catch(() => { hand(); dot.remove(); });
  });
}

// Append the child's new permanent light to their sky — it blooms softly into
// place, and (unless motion is reduced) a single faint ring ripples out once,
// the way a star settles into the night. No confetti, no repeat.
function cdAddSettledLight(container, id) {
  const g = container.querySelector(".cd-lights");
  if (!g) return;
  g.insertAdjacentHTML("beforeend", earnedLightSVG(id, { settling: true }));
  if (cdReducedMotion()) return;
  const p = lightLayout(id);
  g.insertAdjacentHTML(
    "beforeend",
    `<circle class="cd-light-ripple" cx="${p.x}%" cy="${p.y}%" r="${p.r}" style="transform-box:fill-box;transform-origin:center"/>`,
  );
  const ripple = g.lastElementChild;
  setTimeout(() => ripple && ripple.remove(), 1300);
}

// The Guide is silent while the light rises — it must never interrupt the
// moment. Afterwards it offers ONE quiet, honest observation, but only when the
// moment is genuinely singular, and at most once per portal session (so words
// stay rare and precious, like the gold reserved for achievement). Everything
// richer — remembering yesterday, connecting to an interest — is the AI daily
// line's job (PR5); this is the honest, offline floor.
let cdGuideSpokenThisSession = false;
function cdEarnedGuideLine(childId) {
  const completed = getChildStats(childId).milestones.filter((m) => m.completed);
  if (completed.length === 0) return "That's your first light.";        // once in a lifetime
  const today = new Date().toDateString();
  const days = completed.map((m) => m.completedAt).filter(Boolean).map((t) => new Date(t).toDateString());
  if (days.length && !days.includes(today)) return "Welcome back.";      // first light after a day away
  return null;                                                           // otherwise, let the light speak
}

// One warm serif line beneath the greeting, on the sky. Fades itself away.
function cdGuideNote(container, text) {
  const header = container.querySelector(".cd-header");
  if (!header) return;
  header.querySelector(".cd-guide-note")?.remove();
  const p = document.createElement("p");
  p.className = "cd-guide-note";
  p.textContent = text;
  header.appendChild(p);
  setTimeout(() => p.remove(), 6200);
}

// Swap the hero to the next adventure WITHOUT a full re-render, so the arrival
// animations never replay. Re-wires Begin for the new mission.
function cdRefreshHero(container, child) {
  const hero = container.querySelector(".cd-hero");
  if (!hero) return;
  hero.innerHTML = renderTodayHero(resolveTodayMission(child));
  cdWireBegin(container, child);
}

function cdWireBegin(container, child) {
  const beginEl = container.querySelector(".cd-begin[data-ms]");
  if (!beginEl) return;
  const mission = resolveTodayMission(child);
  if (mission) beginEl.addEventListener("click", () => cdOpenMission(container, child, mission, beginEl));
}

// Begin opens the REAL mission (reused submission flow). On completion the light
// rises into the sky. Momentum is Light, never a number — so NO "+points" toast.
function cdOpenMission(container, child, m, beginEl) {
  const project = getProject(m.projectId);
  // Decide whether the Guide has anything genuinely earned to say — computed
  // from the ledger BEFORE this milestone completes (so "first light" is true).
  const candidate = cdEarnedGuideLine(child.id);

  const settle = () => {
    const speak = candidate && !cdGuideSpokenThisSession;
    if (speak) cdGuideSpokenThisSession = true;
    cdAnnounce(container, speak ? candidate : "Your sky is growing.");
    const land = () => {
      cdAddSettledLight(container, m.id);
      cdRefreshHero(container, child);
      if (speak) setTimeout(() => cdGuideNote(container, candidate), 650);
    };
    if (cdReducedMotion()) { land(); return; }       // still, functional — no rise, no tone
    cdRiseLight(beginEl, m.id).then(() => {
      if (isSoundOn()) playSettleTone();              // the star, quietly joining the sky
      land();
    });
  };
  openSubmissionModal({
    milestone: m, project,
    onSkip: () => { completeMilestone(m.id); settle(); },
    onSubmit: (payload) => { addMilestoneSubmission(m.id, payload); completeMilestone(m.id); settle(); },
  });
}

// The Today Hero — one card, one primary action. No image/ghost actions in V1
// (real art → later; read-aloud/ask arrive with their own PRs).
function renderTodayHero(mission) {
  if (!mission) {
    return `
      <article class="cd-hero-card">
        <p class="cd-hero-eyebrow">Today's adventure</p>
        <h1 class="cd-hero-title">Nothing waiting right now.</h1>
        <p class="cd-hero-hook">Your next adventure will appear here soon.</p>
      </article>`;
  }
  const hook = firstSentence(mission.description);
  return `
    <article class="cd-hero-card">
      <p class="cd-hero-eyebrow">Today's adventure</p>
      <h1 class="cd-hero-title">${esc(mission.title)}</h1>
      ${hook ? `<p class="cd-hero-hook">${esc(hook)}</p>` : ""}
      <button class="cd-begin" type="button" data-ms="${esc(mission.id)}">Begin</button>
    </article>`;
}

function renderDashboardShell(container, child) {
  const hour = new Date().getHours();
  const mission = resolveTodayMission(child);
  // Earned Light = one per completed milestone; seeds the child's own sky.
  const earnedIds = getChildStats(child.id).milestones.filter(m => m.completed).map(m => m.id);
  container.innerHTML = `
    <div class="cd">
      ${renderSky(hour, earnedIds)}
      <p class="cd-sr" role="status" aria-live="polite"></p>

      <a href="#/" class="cd-parentlink">Parent view</a>

      <header class="cd-header">
        <div class="cd-guide">
          <span class="cd-guide-avatar" aria-hidden="true">${nsIcon("spark", { size: 26 })}</span>
          <p class="cd-greeting" role="status">${shellGreeting(child.name)}</p>
        </div>
      </header>

      <main class="cd-home">
        <section class="cd-hero" aria-label="Today's adventure">
          ${renderTodayHero(mission)}
        </section>

        <section class="cd-lookback" aria-label="Look back">
          <p class="cd-lookback-label">Look back</p>
          <div class="cd-light-tile cd-light-tile--empty">
            The first thing you make will glow here.
          </div>
        </section>
      </main>
    </div>
  `;

  // The one primary action: Begin opens the real mission; on completion the light
  // rises and the hero advances — surgically, so the arrival animations never replay.
  cdWireBegin(container, child);
}

/* ====== Portal ====== */
export function renderChildPortal(container, params) {
  const child = getChildByCode((params.code || "").toUpperCase());

  if (!child) {
    container.innerHTML = `
      <div class="welcome">
        <div class="welcome-card center">
          <h1>Hmm — that code doesn't work.</h1>
          <p class="text-muted">Double-check the code with the parent in your household.</p>
          <a href="#/kid" class="btn btn-primary mt-2">Try again</a>
        </div>
      </div>
    `;
    return;
  }
  // PIN gate (per-session in this tab)
  if (child.pin && sessionStorage.getItem("kid-pin-ok::" + child.id) !== "1") {
    container.innerHTML = `
      <div class="welcome" style="background: radial-gradient(ellipse at top, #FBE3D0 0%, var(--bg) 60%);">
        <div class="welcome-card">
          <h1>Hi ${esc(child.name)}!</h1>
          <p class="lede">Enter your PIN to open your portal.</p>
          <div class="field">
            <input class="input" id="pin" inputmode="numeric" maxlength="4" placeholder="4-digit PIN" style="font-size:22px;letter-spacing:0.5em;text-align:center;max-width:200px;margin:0 auto"/>
          </div>
          <div class="row-between">
            <a href="#/kid" class="text-muted small">← Use a different code</a>
            <button class="btn btn-primary btn-lg" id="go">Open my portal →</button>
          </div>
        </div>
      </div>
    `;
    const go = () => {
      const pin = container.querySelector("#pin").value.trim();
      if (pin === child.pin) {
        sessionStorage.setItem("kid-pin-ok::" + child.id, "1");
        renderChildPortal(container, params);
      } else {
        toast("That PIN doesn't match", { type: "warning" });
      }
    };
    container.querySelector("#go").addEventListener("click", go);
    container.querySelector("#pin").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    setTimeout(() => container.querySelector("#pin")?.focus(), 50);
    return;
  }

  // Child Dashboard V2 shell (flagged; structure + feel only — see PR1 above).
  if (childDashboardV2Enabled()) { renderDashboardShell(container, child); return; }

  const s = getState();
  const stats = getChildStats(child.id);
  const activeMs = getActiveMilestonesForChild(child.id);
  const dueSoon = activeMs.filter(m => {
    if (!m.dueDate) return true;
    const due = new Date(m.dueDate);
    const today = new Date(); today.setHours(23, 59, 59, 999);
    return due <= addDays(today, 3); // due within 3 days
  });
  // Always give the child something to act on. If nothing is due in the next few
  // days (e.g. a freshly planned term), show their next missions across active
  // projects so Mark-Complete is always reachable from the home — not buried in HQ.
  const homeMissions = (dueSoon.length ? dueSoon : activeMs).slice(0, 5);
  const missionsHeading = dueSoon.length ? "Today's missions" : "Your next missions";
  const activeProjects = stats.activeProjects;

  container.innerHTML = `
    <div class="topbar-kid">
      <div class="row" style="gap:12px">
        <div class="child-card-avatar avatar-${child.avatarIndex}" style="width:48px;height:48px;font-size:20px">${initials(child.name)}</div>
        <div>
          <div class="kid-hello">Hi, ${esc(child.name)}!</div>
          <div class="small text-muted">${dayGreeting()}</div>
        </div>
      </div>
      <div class="row" style="gap:8px">
        <span class="points-pill">⭐ ${stats.totalStars}</span>
        <span class="points-pill" style="background:var(--primary-soft);color:var(--primary-ink)">${stats.totalMomentum} pts</span>
        ${soundToggleHTML()}
        <a href="#/" class="btn btn-ghost btn-sm">Parent view</a>
      </div>
    </div>

    <div class="kid-content">
      <div class="grid grid-4 mb-3">
        <div class="metric"><div class="v">⭐ ${stats.totalStars}</div><div class="l">Stars</div></div>
        <div class="metric"><div class="v">${stats.totalMomentum}</div><div class="l">Momentum Points</div></div>
        <div class="metric"><div class="v">🏅 ${stats.badges}</div><div class="l">Badges</div></div>
        <div class="metric"><div class="v">${stats.completedMilestones}/${stats.totalMilestones}</div><div class="l">Milestones done</div></div>
      </div>

      <h2 class="mb-2">${missionsHeading}</h2>
      ${homeMissions.length === 0
        ? `<div class="empty">${activeProjects.length ? "All missions done — open a project below to review or write a reflection." : "No missions yet. Ask a parent to set up your first project."}</div>`
        : `<div class="stack mb-3">${homeMissions.map(m => missionRow(m, s)).join("")}</div>`}

      <h2 class="mb-2">Your projects</h2>
      ${activeProjects.length === 0
        ? `<div class="empty">No active projects.</div>`
        : `<div class="grid grid-auto mb-3">${activeProjects.map(p => projectTile(p, s, child)).join("")}</div>`}

      <div class="card mb-3" style="background:linear-gradient(135deg, var(--sky-soft), var(--card-elev))">
        <div class="row" style="gap:14px;align-items:center;flex-wrap:wrap">
          <div style="font-size:32px">📅</div>
          <div style="flex:1;min-width:240px">
            <h3 style="font-family:var(--font-serif)">Your calendar</h3>
            <p class="small text-muted">See when your missions and projects are due — and start planning your own week. Learning to see your time is a real superpower.</p>
          </div>
          <button class="btn" id="open-kid-cal">Open my calendar →</button>
        </div>
      </div>

      ${activeProjects.length ? `
        <h2 class="mb-2">Rewards you're working toward</h2>
        <div class="grid grid-auto mb-3">
          ${activeProjects.map(p => `
            <div class="card" style="background:linear-gradient(135deg, var(--gold-soft), var(--card-elev))">
              <div class="small text-muted fw-700" style="letter-spacing:0.08em;text-transform:uppercase">${esc(p.title)}</div>
              <div class="fw-700 mt-1" style="font-size:18px;font-family:var(--font-serif)">🎉 ${esc(p.reward || "No reward set")}</div>
              <div class="small text-muted mt-1">Toll: ${esc(p.toll || "—")}</div>
              <div class="divider"></div>
              <div class="small">Due ${fmtDate(p.dueDate, { short: false })}</div>
              <div data-countdown="${p.dueDate}" class="mt-1">${renderCountdown(p.dueDate)}</div>
            </div>
          `).join("")}
        </div>
      ` : ""}

      <h2 class="mb-2">Reflections to write</h2>
      ${renderReflectionsToDo(child, s)}

      <div class="card mt-3" style="background:linear-gradient(135deg, var(--sage-soft), var(--card-elev))">
        <div class="row" style="gap:14px;align-items:center;flex-wrap:wrap">
          <div style="font-size:32px">🎙️</div>
          <div style="flex:1;min-width:240px">
            <h3 style="font-family:var(--font-serif)">How are things going?</h3>
            <p class="small text-muted">A quick check-in — what you're proud of, what's been hard, what you want next. You can type, or tap the microphone and speak.</p>
          </div>
          <button class="btn btn-sage" id="open-self-assess">Open check-in</button>
        </div>
      </div>

      <h2 class="mt-3 mb-2">Completed</h2>
      ${renderCompleted(child, s)}
    </div>
  `;

  /* ----- wiring ----- */
  container.querySelectorAll("[data-complete-ms]").forEach(b => {
    b.addEventListener("click", () => handleMilestoneTap(b.dataset.completeMs, b, rerender));
  });
  container.querySelectorAll("[data-ms-detail]").forEach(el => {
    el.addEventListener("click", () => openMissionDetail(el.dataset.msDetail));
  });
  wireSoundToggle(container, rerender);
  container.querySelectorAll("[data-add-refl]").forEach(b => {
    b.addEventListener("click", () => openKidReflection(child, b.dataset.addRefl));
  });
  container.querySelectorAll("[data-open-hq]").forEach(b => {
    b.addEventListener("click", () => navigate(`/kid/${child.accessCode}/project/${b.dataset.openHq}`));
  });
  container.querySelector("#open-self-assess")?.addEventListener("click", () => openSelfAssessment(child));
  container.querySelector("#open-kid-cal")?.addEventListener("click", () => navigate(`/kid/${child.accessCode}/calendar`));
}

/* ====== Calendar (child-facing) ======
   A gentle month view scoped to this child's own projects + missions, so they
   can start to see time, notice what's coming up, and learn to plan a week.
   Tapping an event opens that project's HQ. */
let _kidCalDate = new Date();

export function renderChildCalendar(container, params) {
  const child = getChildByCode((params.code || "").toUpperCase());
  if (!child) {
    container.innerHTML = `<div class="welcome"><div class="welcome-card center"><h1>That code doesn't work.</h1><a href="#/kid" class="btn btn-primary mt-2">Try again</a></div></div>`;
    return;
  }
  // Honour the same PIN gate the rest of the portal uses.
  if (child.pin && sessionStorage.getItem("kid-pin-ok::" + child.id) !== "1") {
    location.hash = `#/kid/${child.accessCode}`;
    return;
  }

  const s = getState();
  const year = _kidCalDate.getFullYear();
  const month = _kidCalDate.getMonth();
  const first = new Date(year, month, 1);
  const startWeekday = (first.getDay() + 6) % 7; // Mon-start
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const events = collectKidEvents(s, child, year, month);
  const monthCount = Object.values(events).reduce((n, arr) => n + arr.length, 0);

  container.innerHTML = `
    <div class="topbar-kid">
      <a href="#/kid/${child.accessCode}" class="row" style="gap:10px;align-items:center;text-decoration:none;color:inherit">
        <div class="child-card-avatar avatar-${child.avatarIndex}" style="width:36px;height:36px;font-size:14px">${initials(child.name)}</div>
        <span class="small text-muted">← Back to my portal</span>
      </a>
      <div class="btn-row">
        <button class="btn btn-sm" id="kc-prev" aria-label="Previous month">←</button>
        <span class="fw-700" style="min-width:150px;text-align:center">${first.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
        <button class="btn btn-sm" id="kc-next" aria-label="Next month">→</button>
        <button class="btn btn-sm" id="kc-today">Today</button>
      </div>
    </div>

    <div class="kid-content">
      <div class="row" style="gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
        <div style="font-size:30px">📅</div>
        <div style="flex:1;min-width:240px">
          <h1 class="kid-hello" style="margin:0">Your calendar</h1>
          <p class="small text-muted" style="margin:2px 0 0">${monthCount ? `You have ${monthCount} thing${monthCount === 1 ? "" : "s"} happening this month. Tap any one to open it.` : "Nothing due this month — a good time to plan ahead. Use ← → to look around."}</p>
        </div>
      </div>

      <div class="cal-grid">
        ${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => `<div class="cal-head">${d}</div>`).join("")}
        ${renderKidCells(year, month, daysInMonth, startWeekday, events)}
      </div>

      <p class="small text-muted" style="margin-top:12px">⭐ = a project is due · the other stars are your missions. Seeing them here helps you plan when to do each one.</p>
    </div>
  `;

  container.querySelector("#kc-prev").addEventListener("click", () => { _kidCalDate = new Date(year, month - 1, 1); rerender(); });
  container.querySelector("#kc-next").addEventListener("click", () => { _kidCalDate = new Date(year, month + 1, 1); rerender(); });
  container.querySelector("#kc-today").addEventListener("click", () => { _kidCalDate = new Date(); rerender(); });
  container.querySelectorAll("[data-open-hq]").forEach(b => b.addEventListener("click", () => navigate(`/kid/${child.accessCode}/project/${b.dataset.openHq}`)));
}

function collectKidEvents(s, child, year, month) {
  const out = {};
  const add = (date, ev) => {
    if (!date) return;
    const d = new Date(date);
    if (d.getFullYear() !== year || d.getMonth() !== month) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    (out[key] ||= []).push(ev);
  };
  const myProjects = s.projects.filter(p => p.childId === child.id);
  myProjects.forEach(p => add(p.dueDate, {
    projectId: p.id, domain: p.domains?.[0], label: `★ ${p.title}`, tooltip: `${p.title} is due`,
  }));
  s.milestones.forEach(m => {
    const proj = myProjects.find(p => p.id === m.projectId);
    if (!proj) return;
    add(m.dueDate, { projectId: proj.id, domain: proj.domains?.[0], label: m.title, tooltip: `${m.title} (${proj.title})` });
  });
  return out;
}

function renderKidCells(year, month, daysInMonth, startWeekday, events) {
  const today = new Date();
  const cells = [];
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = startWeekday; i > 0; i--) {
    cells.push(`<div class="cal-cell muted"><div class="d">${prevMonthDays - i + 1}</div></div>`);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
    const dayKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayEvents = events[dayKey] || [];
    cells.push(`
      <div class="cal-cell ${isToday ? "today" : ""}">
        <div class="d">${day}</div>
        ${dayEvents.slice(0, 3).map(e => `<span class="cal-event dom-${e.domain || "brain"}" data-open-hq="${e.projectId}" style="cursor:pointer" title="${esc(e.tooltip)}">${esc(e.label)}</span>`).join("")}
        ${dayEvents.length > 3 ? `<span class="cal-event" style="background:var(--bg-2);color:var(--text-muted)">+${dayEvents.length - 3} more</span>` : ""}
      </div>
    `);
  }
  while (cells.length % 7 !== 0 || cells.length < 35) {
    cells.push(`<div class="cal-cell muted"></div>`);
  }
  return cells.join("");
}

function openSelfAssessment(child) {
  const body = document.createElement("div");
  body.innerHTML = `
    <p class="text-muted small">Take your time. Skip anything you don't want to answer. Tap the microphone to speak instead of typing.</p>
    ${saField("proudOf", "What am I proud of?")}
    ${saField("hardThing", "What has been hard?")}
    ${saField("wantToGetBetterAt", "What do I want to get better at?")}
    ${saField("favouriteProject", "What project did I enjoy most?")}
    ${saField("wantToLearnNext", "What do I want to learn next?")}
  `;
  const foot = document.createElement("div");
  foot.style.cssText = "display:flex;gap:10px;width:100%;justify-content:flex-end";
  foot.innerHTML = `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="sa-save">Save check-in ✨</button>`;
  const m = openModal({ title: `${child.name}'s check-in`, body, footer: foot });
  foot.querySelector("#sa-save").addEventListener("click", () => {
    const data = {};
    body.querySelectorAll("[data-sa]").forEach(t => { data[t.dataset.sa] = t.value.trim(); });
    if (!Object.values(data).some(v => v)) { toast("Add at least one answer", { type: "warning" }); return; }
    addChildSelfAssessment({ childId: child.id, ...data });
    toast("Saved — your parent will see this in your next growth report.", { type: "success", duration: 3000 });
    m.close();
  });
}
function saField(key, label) {
  return `
    <div class="field">
      <label>${label}</label>
      <textarea class="textarea" data-sa="${key}" data-voice data-voice-label="Tap and tell me" rows="3" placeholder="Type or tap the mic to speak..."></textarea>
    </div>
  `;
}

function missionRow(m, s) {
  const proj = s.projects.find(p => p.id === m.projectId);
  return `
    <div class="mission-card">
      <button class="star-btn ${m.completed ? "earned" : ""}" data-complete-ms="${m.id}" style="width:48px;height:48px">
        ${icon(m.completed ? "star" : "starOutline")}
      </button>
      <div style="flex:1;cursor:pointer" data-ms-detail="${m.id}">
        <div class="fw-700" style="font-size:16px">${esc(m.title)}</div>
        <div class="small text-muted">${proj ? esc(proj.title) : ""}${(m.instructions || []).length ? ` · <span class="text-sage fw-600">tap to see your steps →</span>` : ""}</div>
      </div>
      <div class="stack-tight" style="align-items:flex-end">
        <span class="points-pill">+${m.momentumPoints} pts</span>
        <span data-countdown="${m.dueDate}" class="compact">${renderCountdown(m.dueDate, { compact: true })}</span>
      </div>
    </div>
  `;
}

/* ====== Project HQ (child-facing) ====== */
export function renderChildProjectHQ(container, params) {
  const child = getChildByCode((params.code || "").toUpperCase());
  if (!child) {
    container.innerHTML = `<div class="welcome"><div class="welcome-card center"><h1>That code doesn't work.</h1><a href="#/kid" class="btn btn-primary mt-2">Try again</a></div></div>`;
    return;
  }
  // Honour the same PIN gate the main portal uses.
  if (child.pin && sessionStorage.getItem("kid-pin-ok::" + child.id) !== "1") {
    location.hash = `#/kid/${child.accessCode}`;
    return;
  }
  const project = getProject(params.projectId);
  if (!project || project.childId !== child.id) {
    container.innerHTML = `
      <div class="welcome">
        <div class="welcome-card center">
          <h1>Project HQ not found.</h1>
          <a href="#/kid/${child.accessCode}" class="btn btn-primary mt-2">← Back to your portal</a>
        </div>
      </div>
    `;
    return;
  }
  const ms = getMilestonesForProject(project.id);
  const done = ms.filter(m => m.completed).length;
  const pct = ms.length ? Math.round((done / ms.length) * 100) : 0;
  const nextMs = ms.find(m => !m.completed);
  const refs = getReflectionsForProject(project.id);

  container.innerHTML = `
    <div class="topbar-kid">
      <a href="#/kid/${child.accessCode}" class="row" style="gap:10px;align-items:center;text-decoration:none;color:inherit">
        <div class="child-card-avatar avatar-${child.avatarIndex}" style="width:36px;height:36px;font-size:14px">${initials(child.name)}</div>
        <span class="small text-muted">← Back to my portal</span>
      </a>
      <div class="row" style="gap:8px">
        <span class="points-pill"><span class="ns-icon">${nsIcon("star", { size: 12 })}</span> ${project.starsEarned}/${project.starsAvailable}</span>
        <span class="points-pill" style="background:var(--primary-soft);color:var(--primary-ink)">${project.momentumPointsEarned}/${project.momentumPointsAvailable} pts</span>
        ${(child.printPermission || "approval") !== "disabled"
          ? `<button class="btn btn-ghost btn-sm" id="kid-print" title="Print this project">🖨️ Print</button>` : ""}
        ${soundToggleHTML()}
      </div>
    </div>

    <div class="kid-content">
      <div class="hq-cover">
        <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px">
          ${(project.domains || []).map(d => `<span class="tag ${DOMAIN_COLOR_CLASS[d] || ""}">${esc(d)}</span>`).join("")}
          ${project.passionConnection ? `<span class="tag tag-gold">Passion · ${esc(project.passionConnection)}</span>` : ""}
        </div>
        <div class="small text-muted" style="letter-spacing:0.16em;text-transform:uppercase">Project HQ</div>
        <h1 class="kid-hello" style="margin:4px 0 8px">${esc(project.title)}</h1>
        ${project.description ? `<p class="kid-mood" style="margin-bottom:18px;max-width:760px">${esc(project.description)}</p>` : ""}

        <div class="grid grid-4 mb-3">
          <div class="metric"><div class="v">${pct}%</div><div class="l">Adventure progress</div></div>
          <div class="metric"><div class="v">${done}/${ms.length}</div><div class="l">Missions done</div></div>
          <div class="metric"><div class="v">${project.starsEarned}</div><div class="l">Stars earned</div></div>
          <div class="metric"><div class="v">${project.momentumPointsEarned}</div><div class="l">Momentum Points</div></div>
        </div>
      </div>

      ${nextMs ? `
        <div class="card mb-3" style="background:linear-gradient(135deg, var(--primary-soft), var(--card-elev));border-color:var(--primary-soft)">
          <div class="row" style="gap:14px;align-items:center;flex-wrap:wrap">
            <span class="ns-icon-wrap warm">${nsIcon("arrow", { size: 22 })}</span>
            <div style="flex:1;min-width:240px">
              <div class="small text-muted fw-700" style="letter-spacing:0.12em;text-transform:uppercase">Next step</div>
              <div class="fw-700" style="font-size:18px;font-family:var(--font-serif)">${esc(nextMs.title)}</div>
              <div class="small text-muted">Due ${fmtDate(nextMs.dueDate, { short: false })} · ${nextMs.momentumPoints} pts</div>
            </div>
            <span data-countdown="${nextMs.dueDate}">${renderCountdown(nextMs.dueDate)}</span>
            <button class="btn btn-primary" data-complete-ms="${nextMs.id}">Mark this step done</button>
          </div>
        </div>
      ` : ""}

      <h2 class="mb-2">All missions</h2>
      <div class="stack mb-3">
        ${ms.map(m => {
          const evCount = (m.evidence || []).length;
          return `
          <div class="mission-card-wrap">
            <div class="mission-card">
              <button class="star-btn ${m.completed ? "earned" : ""}" data-complete-ms="${m.id}" style="width:48px;height:48px">
                ${icon(m.completed ? "star" : "starOutline")}
              </button>
              <div style="flex:1;cursor:pointer" data-ms-detail="${m.id}">
                <div class="fw-700" style="${m.completed ? "text-decoration:line-through;color:var(--text-muted)" : ""}">${esc(m.title)}</div>
                ${m.description ? `<div class="small">${esc(m.description)}</div>` : ""}
                <div class="small text-muted">${m.dueDate ? "Due " + fmtDate(m.dueDate, { short: false }) : ""} · ${m.momentumPoints} pts${m.reflectionRequired ? " · reflection" : ""}${evCount ? ` · ${evCount} ${evCount === 1 ? "submission" : "submissions"}` : ""}${(m.instructions || []).length ? ` · <span class="text-sage fw-600">tap to see your steps →</span>` : ""}</div>
              </div>
              <div class="stack-tight" style="align-items:flex-end">
                <span class="points-pill" style="font-size:11px">+${m.momentumPoints}</span>
                ${m.dueDate ? `<span data-countdown="${m.dueDate}" class="compact">${renderCountdown(m.dueDate, { compact: true })}</span>` : ""}
              </div>
            </div>
            ${evCount || m.submission?.text ? `
              <div class="mission-evidence">
                ${m.submission?.text ? `
                  <div class="submission-note">
                    <div class="small text-muted fw-700" style="letter-spacing:0.1em;text-transform:uppercase">My answer</div>
                    <p style="margin:4px 0 0">${esc(m.submission.text)}</p>
                  </div>
                ` : ""}
                ${(m.evidence || []).filter(e => e.kind !== "note").length ? `
                  <div class="evidence-grid">
                    ${m.evidence.filter(e => e.kind !== "note").map(e => renderEvidenceTile(e, m.id)).join("")}
                  </div>
                ` : ""}
              </div>
            ` : ""}
          </div>
          `;
        }).join("")}
      </div>

      <div class="grid grid-2 mb-3">
        <div class="card" style="background:linear-gradient(135deg, var(--gold-soft), var(--card-elev))">
          <div class="small text-muted fw-700" style="letter-spacing:0.12em;text-transform:uppercase">Reward</div>
          <p style="font-family:var(--font-serif);font-size:18px;margin:6px 0 0">${esc(project.reward || "Not set yet.")}</p>
        </div>
        <div class="card">
          <div class="small text-muted fw-700" style="letter-spacing:0.12em;text-transform:uppercase">Toll</div>
          <p style="font-family:var(--font-serif);font-size:18px;margin:6px 0 0">${esc(project.toll || "Not set yet.")}</p>
          <div class="small text-muted mt-1">A toll is the natural consequence of unfinished work — it's not a punishment.</div>
        </div>
      </div>

      <div class="card mb-3">
        <div class="row-between mb-2">
          <h3>Reflections</h3>
          <button class="btn btn-primary btn-sm" data-add-refl="proj:${project.id}">Write a reflection</button>
        </div>
        ${refs.length ? `
          <div class="stack">
            ${refs.map(r => `
              <div class="card" style="background:var(--card-elev);padding:14px">
                <div class="small text-muted">${fmtDate(r.createdAt, { short: false })}</div>
                <div class="fw-700">${esc(r.prompt)}</div>
                <p class="mt-1">${esc(r.response)}</p>
              </div>
            `).join("")}
          </div>
        ` : `<div class="small text-muted">No reflections yet. The reflection prompts are: What did I do? What did I learn? What was hard? What surprised me?</div>`}
      </div>

      ${(() => {
        const allEv = ms.flatMap(m => (m.evidence || []).filter(e => e.kind !== "note").map(e => ({ ev: e, milestoneId: m.id, milestoneTitle: m.title })));
        if (allEv.length === 0) {
          return `
            <div class="card mb-3" style="background:var(--card-elev)">
              <div class="row" style="gap:14px;align-items:center;flex-wrap:wrap">
                <span class="ns-icon-wrap sage">${nsIcon("book", { size: 22 })}</span>
                <div style="flex:1;min-width:240px">
                  <div class="fw-700" style="font-family:var(--font-serif);font-size:18px">Portfolio evidence</div>
                  <p class="small text-muted" style="margin:4px 0 0">Photos, written work, audio, video and PDFs you upload while completing missions will collect here — and roll into your portfolio and year-end review.</p>
                </div>
              </div>
            </div>`;
        }
        return `
          <div class="card mb-3">
            <div class="row-between mb-2">
              <h3>Portfolio evidence (${allEv.length})</h3>
              <span class="small text-muted">Auto-collected from your submitted work</span>
            </div>
            <div class="evidence-grid">
              ${allEv.map(({ ev, milestoneId, milestoneTitle }) => renderEvidenceTile(ev, milestoneId, milestoneTitle)).join("")}
            </div>
          </div>
        `;
      })()}
    </div>
  `;

  // Wiring
  container.querySelectorAll("[data-complete-ms]").forEach(b => {
    b.addEventListener("click", () => handleMilestoneTap(b.dataset.completeMs, b, rerender));
  });
  container.querySelectorAll("[data-ms-detail]").forEach(el => {
    el.addEventListener("click", () => openMissionDetail(el.dataset.msDetail));
  });
  container.querySelectorAll("[data-add-refl]").forEach(b => {
    b.addEventListener("click", () => openKidReflection(child, b.dataset.addRefl));
  });
  container.querySelectorAll("[data-remove-ev]").forEach(b => {
    b.addEventListener("click", () => {
      const [mid, eid] = b.dataset.removeEv.split("::");
      removeMilestoneEvidence(mid, eid);
      toast("Evidence removed");
      setTimeout(rerender, 200);
    });
  });
  container.querySelector("#kid-print")?.addEventListener("click", () => {
    const perm = child.printPermission || "approval";
    if (perm === "allow") openProjectPdfModal(project, child);
    else toast("Ask a parent to print this project from the parent dashboard.", { duration: 3200 });
  });
  wireSoundToggle(container, rerender);
}

function projectTile(p, s, child) {
  const ms = s.milestones.filter(m => m.projectId === p.id);
  const done = ms.filter(m => m.completed).length;
  const pct = ms.length ? Math.round((done / ms.length) * 100) : 0;
  const nextMs = ms.find(m => !m.completed);
  return `
    <div class="card card-hover" data-open-hq="${p.id}" style="cursor:pointer">
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px">
        ${(p.domains || []).map(d => `<span class="tag ${DOMAIN_COLOR_CLASS[d] || ""}">${esc(d)}</span>`).join("")}
      </div>
      <h3 style="font-family:var(--font-serif);font-size:18px">${esc(p.title)}</h3>
      <div class="progress-bar mt-1"><span style="width:${pct}%"></span></div>
      <div class="small text-muted mt-1"><span class="ns-icon" style="color:var(--gold)">${nsIcon("star", { size: 12 })}</span> ${p.starsEarned}/${p.starsAvailable} · ${p.momentumPointsEarned}/${p.momentumPointsAvailable} pts</div>
      ${nextMs ? `<div class="divider"></div><div class="small text-muted">Next step:</div><div class="fw-600">${esc(nextMs.title)}</div>` : ""}
      <div class="row mt-2" style="gap:6px;flex-wrap:wrap;justify-content:space-between">
        <span data-countdown="${p.dueDate}" class="compact">${renderCountdown(p.dueDate, { compact: true })}</span>
        <span class="small text-primary fw-700">Open Project HQ →</span>
      </div>
    </div>
  `;
}

function renderReflectionsToDo(child, s) {
  // Milestones that are completed + require reflection + no reflection saved.
  const todos = s.milestones.filter(m => {
    if (!m.completed || !m.reflectionRequired) return false;
    const proj = s.projects.find(p => p.id === m.projectId);
    if (!proj || proj.childId !== child.id) return false;
    return !s.reflections.some(r => r.milestoneId === m.id);
  });
  // Plus: projects in ready-for-reflection state with no final reflection.
  const projectsReady = s.projects.filter(p => p.childId === child.id && p.status === "ready-for-reflection" && !s.reflections.some(r => r.projectId === p.id && !r.milestoneId));

  if (todos.length === 0 && projectsReady.length === 0)
    return `<div class="empty">No reflections waiting. Nice.</div>`;

  return `
    <div class="stack mb-3">
      ${todos.map(m => {
        const proj = s.projects.find(p => p.id === m.projectId);
        return `
          <div class="card row" style="gap:12px;align-items:center">
            <div>📝</div>
            <div style="flex:1">
              <div class="fw-700">Reflect on: ${esc(m.title)}</div>
              <div class="small text-muted">${esc(proj?.title || "")}</div>
            </div>
            <button class="btn btn-primary btn-sm" data-add-refl="ms:${m.id}">Write reflection</button>
          </div>`;
      }).join("")}
      ${projectsReady.map(p => `
        <div class="card row" style="gap:12px;align-items:center;background:linear-gradient(135deg, var(--gold-soft), var(--card-elev))">
          <div>🏅</div>
          <div style="flex:1">
            <div class="fw-700">Final reflection: ${esc(p.title)}</div>
            <div class="small text-muted">All milestones done — write your final reflection to earn the badge.</div>
          </div>
          <button class="btn btn-primary btn-sm" data-add-refl="proj:${p.id}">Write final reflection</button>
        </div>`).join("")}
    </div>
  `;
}

function renderCompleted(child, s) {
  const done = s.projects.filter(p => p.childId === child.id && p.status === "completed");
  if (done.length === 0) return `<div class="empty">Completed projects and badges show up here.</div>`;
  return `
    <div class="grid grid-auto">
      ${done.map(p => `
        <div class="card" style="background:linear-gradient(135deg, var(--gold-soft), var(--card-elev))">
          <div style="font-size:32px">🏅</div>
          <div class="fw-700 mt-1" style="font-family:var(--font-serif)">${esc(p.title)}</div>
          <div class="small text-muted">${fmtDate(p.dueDate)} · ⭐ ${p.starsEarned}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function openKidReflection(child, refKey) {
  const [kind, id] = refKey.split(":");
  const isProject = kind === "proj";
  const proj = isProject
    ? getState().projects.find(p => p.id === id)
    : getState().projects.find(p => p.id === getState().milestones.find(m => m.id === id)?.projectId);
  const ms = isProject ? null : getState().milestones.find(m => m.id === id);

  const body = document.createElement("div");
  body.innerHTML = `
    <p class="text-muted small">${isProject ? "Final reflection for the whole project." : `Reflection for "${esc(ms?.title)}"`}</p>
    <div class="chip-group mb-2" id="r-prompts">
      ${REFLECTION_PROMPTS.map((p, i) => `<button class="chip ${i === 0 ? "selected" : ""}" data-prompt="${esc(p)}">${esc(p)}</button>`).join("")}
    </div>
    <div class="field"><label>Prompt</label><input class="input" id="r-prompt" value="${esc(REFLECTION_PROMPTS[0])}"/></div>
    <div class="field">
      <label>Your answer</label>
      <textarea class="textarea" id="r-resp" rows="6" data-voice data-voice-label="Tap and tell me" placeholder="Type, or tap the microphone to speak..."></textarea>
      <span class="hint">Tip: tap the microphone next to the box and speak your answer.</span>
    </div>
  `;
  const foot = document.createElement("div");
  foot.style.cssText = "display:flex;gap:10px;width:100%;justify-content:flex-end";
  foot.innerHTML = `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="r-save">Save reflection ✨</button>`;
  const modal = openModal({ title: "Write a reflection", body, footer: foot });

  body.querySelectorAll("[data-prompt]").forEach(b => {
    b.addEventListener("click", () => {
      body.querySelectorAll("[data-prompt]").forEach(x => x.classList.remove("selected"));
      b.classList.add("selected");
      body.querySelector("#r-prompt").value = b.dataset.prompt;
    });
  });

  foot.querySelector("#r-save").addEventListener("click", () => {
    const prompt = body.querySelector("#r-prompt").value.trim();
    const response = body.querySelector("#r-resp").value.trim();
    if (!response) { toast("Write a few words first", { type: "warning" }); return; }
    addReflection({
      childId: child.id, projectId: proj?.id, milestoneId: ms?.id || null,
      prompt, response,
    });
    if (isProject && proj) {
      updateProject(proj.id, { status: "completed" });
      toast("🏅 Project complete! Badge earned.", { type: "success", duration: 3000 });
    } else {
      toast("Reflection saved ✨", { type: "success" });
    }
    modal.close();
    setTimeout(rerender, 200);
  });
}

/* Renders one piece of evidence as a small tile (image, audio, video, PDF, etc.) */
function renderEvidenceTile(ev, milestoneId, captionTitle = null) {
  const removeAttr = milestoneId ? `data-remove-ev="${milestoneId}::${ev.id}"` : "";
  if (ev.kind === "note") {
    return `
      <div class="evidence-tile evidence-note">
        <div class="small text-muted" style="letter-spacing:0.1em;text-transform:uppercase">Note</div>
        <p style="margin:4px 0 0">${esc(ev.text || "")}</p>
        ${milestoneId ? `<button class="btn btn-ghost btn-sm" ${removeAttr}>Remove</button>` : ""}
      </div>
    `;
  }
  const isImage = ev.fileType?.startsWith("image/");
  const isAudio = ev.fileType?.startsWith("audio/");
  const isVideo = ev.fileType?.startsWith("video/");
  const isPdf = ev.fileType === "application/pdf";

  let preview = "";
  if (isImage && ev.dataUrl) {
    preview = `<a href="${ev.dataUrl}" target="_blank" rel="noopener"><img src="${ev.dataUrl}" alt="${esc(ev.fileName || "")}" /></a>`;
  } else if (isAudio && ev.dataUrl) {
    preview = `<audio controls src="${ev.dataUrl}" style="width:100%"></audio>`;
  } else if (isVideo && ev.dataUrl) {
    preview = `<video controls src="${ev.dataUrl}" style="width:100%;max-height:240px;border-radius:8px"></video>`;
  } else if (isPdf && ev.dataUrl) {
    preview = `<a href="${ev.dataUrl}" target="_blank" rel="noopener" class="evidence-pdf">📄 Open ${esc(ev.fileName || "PDF")}</a>`;
  } else if (ev.dataUrl) {
    preview = `<a href="${ev.dataUrl}" target="_blank" rel="noopener" download="${esc(ev.fileName || "file")}" class="evidence-pdf">📎 Download ${esc(ev.fileName || "file")}</a>`;
  } else {
    preview = `<div class="small text-muted">[${esc(ev.fileType || "file")}]</div>`;
  }

  const sizeLine = ev.fileSize
    ? `${ev.fileSize < 1024 ? ev.fileSize + " B" : ev.fileSize < 1024 * 1024 ? (ev.fileSize / 1024).toFixed(0) + " KB" : (ev.fileSize / (1024*1024)).toFixed(1) + " MB"}`
    : "";

  return `
    <div class="evidence-tile">
      ${preview}
      <div class="evidence-tile-foot">
        <div style="flex:1;min-width:0">
          <div class="small fw-700" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(ev.fileName || "Evidence")}</div>
          <div class="small text-muted">${sizeLine}${captionTitle ? ` · ${esc(captionTitle)}` : ""}</div>
        </div>
        ${milestoneId ? `<button class="btn btn-ghost btn-sm" ${removeAttr}>Remove</button>` : ""}
      </div>
    </div>
  `;
}

function dayGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "Up early — let's go.";
  if (h < 12) return "Good morning. Today's missions are below.";
  if (h < 17) return "Good afternoon. Pick something and dive in.";
  return "Good evening. Reflect on the day before you log off.";
}
function initials(name) { return (name || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase(); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

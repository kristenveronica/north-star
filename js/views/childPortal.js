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
          <input class="input" id="code" placeholder="e.g. NOAH12" style="font-size:18px;letter-spacing:0.1em;text-transform:uppercase;text-align:center"/>
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

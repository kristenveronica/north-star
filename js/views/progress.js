/* ============================================================
   progress.js — Parent's view of progress per child.
   ============================================================ */

import { getState, getChildStats } from "../store.js";
import { DOMAIN_CATALOG } from "../seed.js";
import { esc, DOMAIN_COLOR_CLASS } from "../components/ui.js";

export function renderProgress(container) {
  const s = getState();
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Progress Dashboard</h1>
        <div class="sub">Honest tracking — momentum, stars, badges, and what's been earned this week.</div>
      </div>
    </div>

    ${s.children.map(c => childBlock(c, s)).join("") || `<div class="empty">Add children first.</div>`}
  `;
}

function childBlock(c, s) {
  const stats = getChildStats(c.id);
  const weekStart = startOfWeek();
  const weekMs = s.milestones.filter(m => {
    const proj = s.projects.find(p => p.id === m.projectId);
    return proj && proj.childId === c.id && m.completedAt && new Date(m.completedAt) >= weekStart;
  });
  const weekPoints = weekMs.reduce((sum, m) => sum + (m.momentumPoints || 0), 0);
  const weekStars = weekMs.length;

  // Domain breakdown across all projects
  const domainPoints = {};
  s.projects.filter(p => p.childId === c.id).forEach(p => {
    (p.domains || []).forEach(d => { domainPoints[d] = (domainPoints[d] || 0) + (p.momentumPointsEarned || 0); });
  });
  const maxDomain = Math.max(1, ...Object.values(domainPoints));

  return `
    <div class="card mb-3">
      <div class="row" style="gap:14px;margin-bottom:14px">
        <div class="child-card-avatar avatar-${c.avatarIndex}">${initials(c.name)}</div>
        <div>
          <h3 style="font-family:var(--font-serif);font-size:20px">${esc(c.name)}</h3>
          <div class="small text-muted">${c.age != null ? "Age " + c.age : ""}</div>
        </div>
      </div>

      <div class="grid grid-4 mb-2">
        <div class="metric"><div class="v">⭐ ${stats.totalStars}</div><div class="l">Total stars</div></div>
        <div class="metric"><div class="v">${stats.totalMomentum}</div><div class="l">Momentum Points</div></div>
        <div class="metric"><div class="v">${stats.completedMilestones}/${stats.totalMilestones}</div><div class="l">Milestones</div></div>
        <div class="metric"><div class="v">🏅 ${stats.badges}</div><div class="l">Project badges</div></div>
      </div>

      <div class="grid grid-2">
        <div>
          <h4>This week</h4>
          <div class="card mt-1" style="background:var(--card-elev)">
            <div class="row" style="gap:18px">
              <div class="stack-tight"><span class="small text-muted">Stars earned</span><span class="fw-700" style="font-size:22px">⭐ ${weekStars}</span></div>
              <div class="stack-tight"><span class="small text-muted">Points earned</span><span class="fw-700" style="font-size:22px">${weekPoints}</span></div>
              <div class="stack-tight"><span class="small text-muted">Milestones</span><span class="fw-700" style="font-size:22px">${weekMs.length}</span></div>
            </div>
          </div>
        </div>
        <div>
          <h4>Domain balance</h4>
          <div class="stack mt-1" style="gap:8px">
            ${Object.keys(domainPoints).length === 0
              ? `<div class="small text-muted">No earned points yet.</div>`
              : DOMAIN_CATALOG.filter(d => domainPoints[d.id]).map(d => `
                <div class="row" style="gap:10px">
                  <span class="tag ${DOMAIN_COLOR_CLASS[d.id] || ""}" style="min-width:80px">${esc(d.short)}</span>
                  <div class="progress-bar" style="flex:1"><span style="width:${(domainPoints[d.id] / maxDomain) * 100}%"></span></div>
                  <span class="small fw-700" style="width:50px;text-align:right">${domainPoints[d.id]}</span>
                </div>
              `).join("")}
          </div>
        </div>
      </div>
    </div>
  `;
}

function startOfWeek() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // Mon-start
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}
function initials(name) { return (name || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase(); }

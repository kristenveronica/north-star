/* ============================================================
   dashboard.js — Parent home view.
   At-a-glance: each child's status, upcoming events, vision recap.
   ============================================================ */

import { getState, getChildStats, getActiveMilestonesForChild, getAllUpcomingEvents } from "../store.js";
import { esc, renderCountdown, icon, DOMAIN_COLOR_CLASS, fmtDate } from "../components/ui.js";
import { navigate } from "../router.js";

export function renderDashboard(container) {
  const s = getState();
  const family = s.family;
  const upcoming = getAllUpcomingEvents().slice(0, 6);

  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Welcome back, ${esc(family.parentName || "Parent")}.</h1>
        <div class="sub">${esc(family.familyName)} · ${esc(family.motto || "Your family's North Star.")}</div>
      </div>
      <div class="btn-row">
        <button class="btn" data-go="/calendar">${icon("calendar")} Calendar</button>
        <button class="btn btn-sage" data-go="/reports">${icon("report")} Generate Growth Report</button>
        <button class="btn btn-primary" data-go="/projects">${icon("plus")} New Project</button>
      </div>
    </div>

    ${family.coreWord ? `
      <div class="card mb-3" style="background:linear-gradient(120deg, #FCEBD8, #FFFCF6); border-color: var(--primary-soft);">
        <div class="row" style="gap:18px; align-items:flex-start; flex-wrap:wrap">
          <div>
            <div class="small text-muted" style="letter-spacing:0.1em;text-transform:uppercase">Core Word</div>
            <div style="font-family:var(--font-serif); font-size:46px; font-weight:600; color:var(--primary-ink); letter-spacing:0.03em">${esc(family.coreWord)}</div>
          </div>
          <div class="grid" style="grid-template-columns: repeat(${family.acronym?.length || 5}, minmax(0,1fr)); gap:10px; flex:1; min-width: 320px">
            ${(family.acronym || []).map(a => `
              <div style="text-align:center">
                <div class="brand-mark" style="margin:0 auto 6px">${esc(a.letter)}</div>
                <div class="fw-600">${esc(a.meaning)}</div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    ` : ""}

    <div class="grid grid-auto mb-3">
      ${s.children.map(c => childStatCard(c)).join("")}
    </div>

    <div class="grid" style="grid-template-columns: 1.5fr 1fr; gap:18px">
      <div class="card">
        <div class="row-between mb-2">
          <h3>What's coming up</h3>
          <button class="btn btn-ghost btn-sm" data-go="/calendar">View calendar →</button>
        </div>
        ${upcoming.length === 0
          ? `<div class="empty"><div class="emoji">🌅</div>Nothing on the horizon. Add a project to get started.</div>`
          : `<div class="stack">${upcoming.map(eventRow).join("")}</div>`}
      </div>

      <div class="card">
        <h3 class="mb-2">Family Vision</h3>
        ${family.mission ? `<p class="fw-600" style="font-family:var(--font-serif);font-size:16px">"${esc(family.mission)}"</p>` : ""}
        ${family.motto ? `<p class="text-muted">${esc(family.motto)}</p>` : ""}
        <div class="divider"></div>
        <div class="small text-muted fw-600 mb-1">Desired outcomes</div>
        <ul style="padding-left:18px;margin:0;color:var(--text-muted)">
          ${(family.desiredOutcomes || []).map(o => `<li>${esc(o)}</li>`).join("") ||
            `<li class="text-soft">Visit <a href="#/vision">Family Vision</a> to add yours.</li>`}
        </ul>
      </div>
    </div>
  `;

  container.querySelectorAll("[data-go]").forEach(b => {
    b.addEventListener("click", () => navigate(b.dataset.go));
  });
}

function childStatCard(c) {
  const stats = getChildStats(c.id);
  const milestones = getActiveMilestonesForChild(c.id).slice(0, 2);
  const totalAvailable = stats.activeProjects.reduce((s, p) => s + (p.momentumPointsAvailable || 0), 0) || 1;
  const pct = Math.min(100, Math.round((stats.totalMomentum / totalAvailable) * 100));

  return `
    <div class="card card-hover" style="cursor:pointer" data-go="/children/${c.id}">
      <div class="row" style="gap:14px;margin-bottom:14px">
        <div class="child-card-avatar avatar-${c.avatarIndex}">${initials(c.name)}</div>
        <div>
          <div class="fw-700" style="font-size:17px">${esc(c.name)}</div>
          <div class="text-muted small">${esc(c.age != null ? `Age ${c.age}` : "")} ${c.grade ? "· " + esc(c.grade) : ""}</div>
        </div>
        <div class="progress-ring" style="--p:${pct};--size:54px;margin-left:auto">
          <span class="ring-label">${pct}%</span>
        </div>
      </div>
      <div class="row" style="gap:14px;flex-wrap:wrap;margin-bottom:14px">
        <div class="stack-tight"><span class="small text-muted">Stars</span><span class="fw-700">⭐ ${stats.totalStars}</span></div>
        <div class="stack-tight"><span class="small text-muted">Momentum</span><span class="fw-700">${stats.totalMomentum} pts</span></div>
        <div class="stack-tight"><span class="small text-muted">Projects</span><span class="fw-700">${stats.activeProjects.length} active</span></div>
      </div>
      ${milestones.length ? `
        <div class="small text-muted fw-600 mb-1">Next milestones</div>
        <div class="stack" style="gap:6px">
          ${milestones.map(m => `
            <div class="row" style="gap:8px;font-size:13px">
              <span style="flex:1">${esc(m.title)}</span>
              <span data-countdown="${m.dueDate}" class="compact">${renderCountdown(m.dueDate, { compact: true })}</span>
            </div>
          `).join("")}
        </div>
      ` : `<div class="small text-muted">No active milestones yet.</div>`}
      <div class="divider"></div>
      <a class="btn btn-ghost btn-sm" href="#/kid/${c.accessCode}">${icon("child")} Open ${esc(c.name)}'s view →</a>
    </div>
  `;
}

function eventRow(ev) {
  const isMile = ev.type === "milestone-due";
  const title = isMile ? ev.milestone.title : ev.project.title;
  const tagCls = DOMAIN_COLOR_CLASS[ev.project.domains?.[0]] || "tag";
  return `
    <div class="row" style="gap:12px;padding:8px 0;border-bottom:1px solid var(--divider)">
      <div class="child-card-avatar avatar-${ev.child.avatarIndex}" style="width:36px;height:36px;font-size:14px">${initials(ev.child.name)}</div>
      <div style="flex:1;min-width:0">
        <div class="row" style="gap:6px;flex-wrap:wrap">
          <span class="tag ${tagCls}">${isMile ? "Milestone" : "Project due"}</span>
          <span class="fw-600" style="overflow:hidden;text-overflow:ellipsis">${esc(title)}</span>
        </div>
        <div class="small text-muted">${esc(ev.child.name)} · ${fmtDate(ev.date, { short: false })}</div>
      </div>
      <span data-countdown="${ev.date}" class="compact">${renderCountdown(ev.date, { compact: true })}</span>
    </div>
  `;
}

function initials(name) {
  return (name || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

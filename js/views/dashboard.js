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
  const onboarded = !!s.meta?.onboarded;

  container.innerHTML = `
    ${!onboarded ? `
      <div class="card mb-3" style="background:linear-gradient(135deg, var(--midnight, #1F355D), #16284A); color:var(--starlight, #F3EBD9); border:none">
        <div class="row" style="gap:18px; align-items:center; flex-wrap:wrap">
          <div style="flex:1; min-width:260px">
            <div class="small" style="letter-spacing:0.12em;text-transform:uppercase;opacity:.8;margin-bottom:4px">Your North Star is waiting</div>
            <h3 style="font-family:var(--font-serif);font-size:23px;margin:0 0 6px;color:#fff">Finish setting up your family's North Star</h3>
            <p style="margin:0;opacity:.9;font-size:14px;max-width:46ch">Look around as much as you like — but the magic begins once you've clarified your family's vision. Pick up exactly where you left off; nothing you've entered is lost.</p>
          </div>
          <button class="btn btn-primary btn-lg" data-go="/onboarding">Complete setup →</button>
        </div>
      </div>
    ` : ""}
    <div class="topbar">
      <div>
        <h1>Welcome back, ${esc(family.parentName || "Parent")}.</h1>
      </div>
      ${s.children.length ? `
        <div class="btn-row">
          <button class="btn" data-go="/calendar">${icon("calendar")} Calendar</button>
          <button class="btn btn-sage" data-go="/reports">${icon("report")} Generate Growth Report</button>
          <button class="btn btn-primary" data-go="/projects">${icon("plus")} New Project</button>
        </div>
      ` : ""}
    </div>

    ${family.coreWord ? `
      <div class="card mb-3" style="background:linear-gradient(120deg, #FCEBD8, #FFFCF6); border-color: var(--primary-soft);">
        <div class="row" style="gap:18px; align-items:flex-start; flex-wrap:wrap">
          <div>
            <div class="small text-muted" style="letter-spacing:0.1em;text-transform:uppercase">Core Word</div>
            <div style="font-family:var(--font-serif); font-size:clamp(32px,11vw,46px); font-weight:600; color:var(--primary-ink); letter-spacing:0.03em">${esc(family.coreWord)}</div>
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

    ${s.children.length ? `
      <div class="grid grid-auto mb-3">
        ${s.children.map(c => childStatCard(c)).join("")}
      </div>

      <div class="card">
        <div class="row-between mb-2">
          <h3>What's coming up</h3>
          <button class="btn btn-ghost btn-sm" data-go="/calendar">View calendar →</button>
        </div>
        ${upcoming.length === 0
          ? `<div class="empty"><div class="emoji">🌅</div>Nothing on the horizon yet — generate a project to get started.</div>`
          : `<div class="stack">${upcoming.map(eventRow).join("")}</div>`}
      </div>
    ` : `
      <div class="empty" style="padding:52px 24px">
        <div class="emoji">🧭</div>
        <h3 style="font-family:var(--font-serif);font-size:22px;margin-bottom:6px">Add your first child to begin</h3>
        <p class="text-muted small" style="max-width:440px;margin:0 auto 18px">North Star is built around each child. Create a profile and their learning workspace appears right here.</p>
        <button class="btn btn-primary" data-go="/children">${icon("plus")} Add a child</button>
      </div>
    `}
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
      <a class="btn-portal avatar-${c.avatarIndex}" href="#/kid/${c.accessCode}">${icon("child")} Open ${esc(c.name)}'s view →</a>
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

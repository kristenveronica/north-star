/* ============================================================
   dashboard.js — Parent home view.
   At-a-glance: each child's status, upcoming events, vision recap.
   ============================================================ */

import { getState, update, getChildStats, getActiveMilestonesForChild, getAllUpcomingEvents } from "../store.js";
import { esc, renderCountdown, icon, DOMAIN_COLOR_CLASS, fmtDate } from "../components/ui.js";
import { navigate } from "../router.js";
import { aiCoreWordLiving } from "../lib/ai.js";
import { rerender } from "../app.js";

export function renderDashboard(container) {
  const s = getState();
  const family = s.family;
  const upcoming = getAllUpcomingEvents().slice(0, 6);
  // Living Core Word: refresh in the background when there's new activity.
  maybeRefreshLiving(s);
  const living = (family.coreWordLiving?.connections) || [];
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
        ${living.length ? `
          <div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--primary-soft)">
            <div class="small text-muted" style="letter-spacing:0.1em;text-transform:uppercase;margin-bottom:10px">Recently brought to life</div>
            <div class="stack" style="gap:9px">
              ${living.map(c => `
                <div class="row" style="gap:10px;align-items:flex-start">
                  <span class="brand-mark" style="width:24px;height:24px;font-size:13px;flex-shrink:0;margin-top:1px">${esc(c.letter)}</span>
                  <div style="font-size:14px"><span class="fw-700">${esc(c.quality)}</span> — ${esc(c.evidence)}</div>
                </div>
              `).join("")}
            </div>
          </div>
        ` : ""}
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

/* ---------- Living Core Word ----------
   Surface which Core Word qualities have GENUINELY been demonstrated in recent
   work — judged by the AI, which is told to return nothing rather than force a
   connection. Cached on the family and only recomputed when project activity
   actually changes (signature), so it's not an AI call on every dashboard load.
   The cache is local-only (derived/recomputable; never synced or migrated). */
let _livingInFlight = false;

function livingSignature(s) {
  const projects = s.projects || [];
  const completed = projects.filter(p => p.status === "completed");
  const latest = completed.reduce((m, p) => Math.max(m, new Date(p.completedAt || p.dueDate || 0).getTime() || 0), 0);
  const active = projects.filter(p => p.status === "active" || p.status === "ready-for-reflection").length;
  return `${completed.length}:${latest}:${active}`;
}

function buildLivingSummary(s) {
  const now = Date.now();
  const recent = (s.projects || []).filter(p =>
    p.status === "completed"
      ? (now - new Date(p.completedAt || p.dueDate || 0).getTime() <= 120 * 86400000)
      : (p.status === "active" || p.status === "ready-for-reflection"));
  const nameById = Object.fromEntries((s.children || []).map(c => [c.id, c.name]));
  const projects = recent.slice(0, 12).map(p => ({
    childName: nameById[p.childId] || "",
    title: p.title, status: p.status,
    capabilities: (p.capabilitiesDeveloped || []).slice(0, 4),
    domains: p.domains || [],
    passion: p.passionConnection || "",
  }));
  const reflectionSnippets = (s.reflections || []).slice(-5).map(r => (r.response || "").slice(0, 140)).filter(Boolean);
  return { projects, reflectionSnippets };
}

function maybeRefreshLiving(s) {
  const fam = s.family || {};
  if (!fam.coreWord || !(fam.acronym || []).some(a => a.meaning)) return;
  const sig = livingSignature(s);
  if (fam.coreWordLiving?.signature === sig) return;   // already current for this activity
  if (_livingInFlight) return;
  const summary = buildLivingSummary(s);
  if (!summary.projects.length) return;                // no real work to draw from — show nothing, no AI call
  _livingInFlight = true;
  aiCoreWordLiving(fam, summary)
    .then(res => {
      update(st => {
        if (st.family) st.family.coreWordLiving = { signature: sig, computedAt: Date.now(), connections: (res?.connections || []).slice(0, 3) };
      });
      rerender();
    })
    .catch(e => console.warn("[dashboard] core-word living unavailable:", e?.message))
    .finally(() => { _livingInFlight = false; });
}

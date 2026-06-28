/* ============================================================
   termPlanner.js — High-level planner per child + balance view.
   ============================================================ */

import { getState, updateChild } from "../store.js";
import { availableDomains, domainShort } from "../seed.js";
import { suggestWellRoundedNudges } from "../ai/suggestions.js";
import { esc, fmtDate, renderCountdown, icon, toast, DOMAIN_COLOR_CLASS } from "../components/ui.js";
import { navigate } from "../router.js";
import { rerender } from "../app.js";

export function renderTermPlanner(container) {
  const s = getState();
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Term Planner</h1>
        <div class="sub">A bird's-eye view of each child's term — projects, milestones, due dates, balance.</div>
      </div>
      <div class="btn-row">
        <button class="btn" data-go="/calendar">${icon("calendar")} Calendar view</button>
        <button class="btn btn-primary" data-go="/projects">${icon("plus")} New project</button>
      </div>
    </div>

    ${s.children.length === 0 ? `<div class="empty">Add children first.</div>` : ""}

    ${s.children.map(c => childPlanCard(c, s)).join("")}
  `;

  container.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => navigate(b.dataset.go)));
  container.querySelectorAll("[data-open-proj]").forEach(b => b.addEventListener("click", () => navigate("/projects/" + b.dataset.openProj)));
}

function childPlanCard(c, s) {
  const projects = s.projects.filter(p => p.childId === c.id && p.status !== "completed");
  const milestones = s.milestones.filter(m => projects.some(p => p.id === m.projectId));
  const domainCount = {};
  projects.forEach(p => (p.domains || []).forEach(d => { domainCount[d] = (domainCount[d] || 0) + 1; }));
  const nudges = suggestWellRoundedNudges(c.domains || [], projects);

  return `
    <div class="card mb-3">
      <div class="row" style="gap:14px;margin-bottom:14px">
        <div class="child-card-avatar avatar-${c.avatarIndex}">${initials(c.name)}</div>
        <div>
          <h3 style="font-family:var(--font-serif);font-size:20px">${esc(c.name)}'s Term</h3>
          <div class="small text-muted">${projects.length} projects · ${milestones.filter(m => !m.completed).length} milestones open</div>
        </div>
      </div>

      <div class="grid grid-2" style="gap:18px">
        <div>
          <div class="small text-muted fw-700 mb-1">Projects</div>
          ${projects.length === 0 ? `<div class="empty" style="padding:18px">No projects yet</div>` : projects.map(p => `
            <div class="card mb-2" data-open-proj="${p.id}" style="cursor:pointer;padding:14px">
              <div class="row-between">
                <div>
                  <div class="fw-700">${esc(p.title)}</div>
                  <div class="small text-muted">${(p.domains || []).map(d => domainName(d)).join(" · ")}</div>
                </div>
                <span data-countdown="${p.dueDate}" class="compact">${renderCountdown(p.dueDate, { compact: true })}</span>
              </div>
            </div>
          `).join("")}
        </div>

        <div>
          <div class="small text-muted fw-700 mb-1">Capability balance</div>
          <div class="stack" style="gap:8px">
            ${availableDomains(s.family).map(d => {
              const n = domainCount[d.id] || 0;
              return `
                <div class="row" style="gap:10px">
                  <span class="tag ${DOMAIN_COLOR_CLASS[d.id] || ""}" style="min-width:90px">${esc(d.short)}</span>
                  <div class="progress-bar" style="flex:1"><span style="width:${Math.min(100, n * 33)}%"></span></div>
                  <span class="fw-700 small" style="width:50px;text-align:right">${n} ${n === 1 ? "project" : "projects"}</span>
                </div>
              `;
            }).join("")}
          </div>

          ${nudges.length ? `
            <div class="suggestion-banner mt-2">
              <div class="label">Balance nudges</div>
              ${nudges.map(n => `<div class="mt-1 small">${esc(n.text)}</div>`).join("")}
            </div>
          ` : `<div class="suggestion-banner mt-2"><div class="label">Looking balanced ✨</div><div class="small">A nice mix of domains for this term.</div></div>`}
        </div>
      </div>
    </div>
  `;
}

function initials(name) { return (name || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase(); }
function domainName(id) { return domainShort(id); }

/* ============================================================
   portfolio.js — Each child's portfolio of completed work, reflections.
   ============================================================ */

import { getState, getChildStats } from "../store.js";
import { esc, fmtDate, DOMAIN_COLOR_CLASS, openModal, toast } from "../components/ui.js";

let _selectedChildId = null;

export function renderPortfolio(container) {
  const s = getState();
  if (!_selectedChildId && s.children[0]) _selectedChildId = s.children[0].id;
  const child = s.children.find(c => c.id === _selectedChildId);

  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Portfolio</h1>
        <div class="sub">A growing record of real work, reflections and milestones.</div>
      </div>
    </div>

    ${s.children.length > 1 ? `
      <div class="row mb-2" style="gap:8px">
        ${s.children.map(c => `<button class="chip ${c.id === _selectedChildId ? "selected" : ""}" data-child="${c.id}">${esc(c.name)}</button>`).join("")}
      </div>
    ` : ""}

    ${child ? portfolioBlock(child, s) : `<div class="empty">Add a child first.</div>`}
  `;

  container.querySelectorAll("[data-child]").forEach(b => {
    b.addEventListener("click", () => { _selectedChildId = b.dataset.child; renderPortfolio(container); });
  });

  container.querySelectorAll("[data-view-proj]").forEach(b => {
    b.addEventListener("click", () => viewProjectSummary(b.dataset.viewProj));
  });
}

function portfolioBlock(child, s) {
  const stats = getChildStats(child.id);
  const projects = s.projects.filter(p => p.childId === child.id);
  const completed = projects.filter(p => p.status === "completed");
  const reflections = s.reflections.filter(r => r.childId === child.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return `
    <div class="grid grid-4 mb-3">
      <div class="metric"><div class="v">${completed.length}</div><div class="l">Completed projects</div></div>
      <div class="metric"><div class="v">⭐ ${stats.totalStars}</div><div class="l">Stars earned</div></div>
      <div class="metric"><div class="v">${stats.totalMomentum}</div><div class="l">Momentum Points</div></div>
      <div class="metric"><div class="v">${reflections.length}</div><div class="l">Reflections</div></div>
    </div>

    <h3 class="mb-2">Completed projects</h3>
    ${completed.length === 0 ? `<div class="empty"><div class="emoji">📔</div>Nothing here yet. Completed projects appear here as badges.</div>` : `
      <div class="grid grid-auto mb-3">
        ${completed.map(p => `
          <div class="card card-hover" data-view-proj="${p.id}" style="cursor:pointer;background:linear-gradient(135deg, var(--gold-soft), var(--card-elev))">
            <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px">
              ${(p.domains || []).map(d => `<span class="tag ${DOMAIN_COLOR_CLASS[d] || ""}">${esc(d)}</span>`).join("")}
            </div>
            <h3 style="font-family:var(--font-serif)">🏅 ${esc(p.title)}</h3>
            <p class="small text-muted">${fmtDate(p.dueDate)} · ⭐ ${p.starsEarned} · ${p.momentumPointsEarned} pts</p>
          </div>
        `).join("")}
      </div>
    `}

    <h3 class="mb-2">Active projects</h3>
    ${projects.filter(p => p.status !== "completed").length === 0 ? `<div class="empty">No active projects.</div>` : `
      <div class="grid grid-auto mb-3">
        ${projects.filter(p => p.status !== "completed").map(p => `
          <div class="card" data-view-proj="${p.id}" style="cursor:pointer">
            <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px">
              ${(p.domains || []).map(d => `<span class="tag ${DOMAIN_COLOR_CLASS[d] || ""}">${esc(d)}</span>`).join("")}
            </div>
            <h4 style="font-family:var(--font-serif)">${esc(p.title)}</h4>
            <div class="progress-bar mt-1"><span style="width:${pct(p, s)}%"></span></div>
            <div class="small text-muted mt-1">⭐ ${p.starsEarned}/${p.starsAvailable} · ${p.momentumPointsEarned}/${p.momentumPointsAvailable} pts</div>
          </div>
        `).join("")}
      </div>
    `}

    <h3 class="mb-2">Reflections</h3>
    ${reflections.length === 0 ? `<div class="empty">No reflections yet.</div>` : `
      <div class="stack">
        ${reflections.map(r => {
          const proj = projects.find(p => p.id === r.projectId);
          return `
            <div class="card" style="background:var(--card-elev)">
              <div class="row-between mb-1">
                <span class="small text-muted">${fmtDate(r.createdAt, { short: false })}${proj ? " · " + esc(proj.title) : ""}</span>
              </div>
              <div class="fw-700" style="font-family:var(--font-serif)">${esc(r.prompt)}</div>
              <p class="mt-1">${esc(r.response)}</p>
            </div>
          `;
        }).join("")}
      </div>
    `}

    <div class="card mt-3" style="background:var(--card-elev)">
      <h4>Evidence uploads</h4>
      <p class="text-muted small">In a future version this is where photos, audio, video and writing samples will live. For now, you can attach evidence as notes inside reflections.</p>
    </div>
  `;
}

function pct(p, s) {
  const ms = s.milestones.filter(m => m.projectId === p.id);
  if (!ms.length) return 0;
  return Math.round((ms.filter(m => m.completed).length / ms.length) * 100);
}

function viewProjectSummary(id) {
  const s = getState();
  const p = s.projects.find(x => x.id === id);
  if (!p) return;
  const child = s.children.find(c => c.id === p.childId);
  const ms = s.milestones.filter(m => m.projectId === id);
  const refs = s.reflections.filter(r => r.projectId === id);

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="small text-muted">${esc(child?.name || "")} · ${fmtDate(p.dueDate, { short: false })}</div>
    <div class="row mb-2 mt-1" style="gap:8px;flex-wrap:wrap">
      ${(p.domains || []).map(d => `<span class="tag ${DOMAIN_COLOR_CLASS[d] || ""}">${esc(d)}</span>`).join("")}
    </div>
    <p>${esc(p.description)}</p>
    ${p.learningOutcomes?.length ? `<div class="divider"></div><div class="fw-700 small text-muted">Learning outcomes</div><ul>${p.learningOutcomes.map(o => `<li>${esc(o)}</li>`).join("")}</ul>` : ""}
    <div class="divider"></div>
    <div class="fw-700 small text-muted mb-1">Milestones</div>
    <ul>${ms.map(m => `<li>${m.completed ? "⭐" : "○"} ${esc(m.title)}</li>`).join("")}</ul>
    ${refs.length ? `
      <div class="divider"></div>
      <div class="fw-700 small text-muted mb-1">Reflections</div>
      ${refs.map(r => `<div class="card" style="background:var(--card-elev);padding:12px;margin-bottom:8px"><div class="fw-700">${esc(r.prompt)}</div><p class="mt-1">${esc(r.response)}</p></div>`).join("")}
    ` : ""}
  `;
  openModal({ title: p.title, body });
}

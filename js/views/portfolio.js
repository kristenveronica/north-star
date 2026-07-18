/* ============================================================
   portfolio.js — Each child's portfolio of completed work, reflections.
   ============================================================ */

import { getState, getChildStats, getMilestoneEvidenceForChild } from "../store.js";
import { esc, fmtDate, DOMAIN_COLOR_CLASS, openModal, toast } from "../components/ui.js";
import { hydrateEvidenceMedia } from "../lib/storage.js";

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

  // Resolve stored-media placeholders (evidence files in Storage) to signed URLs.
  hydrateEvidenceMedia(container);
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

    ${(() => {
      const ev = getMilestoneEvidenceForChild(child.id);
      if (!ev.length) return `
        <div class="card mt-3" style="background:var(--card-elev)">
          <h4>Submitted evidence</h4>
          <p class="text-muted small">Photos, audio, video, written work and PDFs the child uploads while completing missions will collect here. Optional — the child portal still works without uploads if your family prefers off-screen work only.</p>
        </div>
      `;
      return `
        <h3 class="mt-3 mb-2">Submitted evidence (${ev.length})</h3>
        <div class="evidence-grid">
          ${ev.map(item => renderParentEvidenceTile(item)).join("")}
        </div>
      `;
    })()}
  `;
}

function renderParentEvidenceTile(item) {
  const ev = item;
  const isImage = ev.fileType?.startsWith("image/");
  const isAudio = ev.fileType?.startsWith("audio/");
  const isVideo = ev.fileType?.startsWith("video/");
  const isPdf = ev.fileType === "application/pdf";
  // Source attribute: prefer a Storage path (resolved to a signed URL after render
  // via hydrateEvidenceMedia); fall back to a legacy inline dataUrl if present.
  const sp = ev.storagePath;
  const srcAttr = sp ? `data-sp="${esc(sp)}" data-sp-kind="src"` : (ev.dataUrl ? `src="${ev.dataUrl}"` : "");
  const hrefAttr = sp ? `data-sp="${esc(sp)}" data-sp-kind="href"` : (ev.dataUrl ? `href="${ev.dataUrl}"` : "");
  const hasFile = !!(sp || ev.dataUrl);
  let preview = "";
  if (ev.kind === "note") preview = `<div class="small">${esc((ev.text || "").slice(0, 200))}${(ev.text || "").length > 200 ? "…" : ""}</div>`;
  else if (isImage && hasFile) preview = `<a ${hrefAttr} target="_blank" rel="noopener"><img ${srcAttr} alt="${esc(ev.fileName || "")}"/></a>`;
  else if (isAudio && hasFile) preview = `<audio controls ${srcAttr} style="width:100%"></audio>`;
  else if (isVideo && hasFile) preview = `<video controls ${srcAttr} style="width:100%;max-height:200px;border-radius:8px"></video>`;
  else if (isPdf && hasFile) preview = `<a ${hrefAttr} target="_blank" rel="noopener" class="evidence-pdf">📄 ${esc(ev.fileName || "PDF")}</a>`;
  else if (hasFile) preview = `<a ${hrefAttr} target="_blank" rel="noopener" download="${esc(ev.fileName || "file")}" class="evidence-pdf">📎 ${esc(ev.fileName || "Download")}</a>`;
  return `
    <div class="evidence-tile">
      ${preview}
      <div class="evidence-tile-foot">
        <div style="flex:1;min-width:0">
          <div class="small fw-700" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(ev.fileName || (ev.kind === "note" ? "Written answer" : "Evidence"))}</div>
          <div class="small text-muted">${ev.project?.title ? esc(ev.project.title) + " · " : ""}${ev.milestone?.title ? esc(ev.milestone.title) : ""}</div>
        </div>
      </div>
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

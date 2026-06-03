/* ============================================================
   projects.js — Project list, generator, builder, detail.
   ============================================================ */

import {
  getState, getProject, addProject, updateProject, removeProject,
  addMilestone, updateMilestone, completeMilestone, getMilestonesForProject,
  addReflection, getReflectionsForProject, uid,
} from "../store.js";
import { suggestProjectsForChild } from "../ai/suggestions.js";
import { DOMAIN_CATALOG, REFLECTION_PROMPTS } from "../seed.js";
import { esc, icon, toast, openModal, confirmDialog, renderCountdown, fmtDate, sparkle, DOMAIN_COLOR_CLASS } from "../components/ui.js";
import { navigate } from "../router.js";
import { rerender } from "../app.js";

/* ====== List view ====== */

let _childFilter = "all";

export function renderProjects(container) {
  const s = getState();
  const projects = _childFilter === "all" ? s.projects : s.projects.filter(p => p.childId === _childFilter);
  const active = projects.filter(p => p.status === "active" || p.status === "ready-for-reflection");
  const done = projects.filter(p => p.status === "completed");

  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Projects</h1>
        <div class="sub">Real work, real deadlines, real reflection. The lifeblood of the OS.</div>
      </div>
      <div class="btn-row">
        <button class="btn" id="generate">✨ Generate ideas</button>
        <button class="btn btn-primary" id="new-project">${icon("plus")} New project</button>
      </div>
    </div>

    <div class="row mb-2" style="gap:8px">
      <button class="chip ${_childFilter === "all" ? "selected" : ""}" data-filter="all">All children</button>
      ${s.children.map(c => `<button class="chip ${_childFilter === c.id ? "selected" : ""}" data-filter="${c.id}">${esc(c.name)}</button>`).join("")}
    </div>

    <h3 class="mt-2 mb-2">Active</h3>
    <div class="grid grid-auto">
      ${active.length === 0
        ? `<div class="empty"><div class="emoji">🎒</div>No active projects. Generate ideas or create one.</div>`
        : active.map(p => projectCard(p, s)).join("")}
    </div>

    ${done.length ? `
      <h3 class="mt-3 mb-2">Completed</h3>
      <div class="grid grid-auto">${done.map(p => projectCard(p, s)).join("")}</div>
    ` : ""}
  `;

  container.querySelector("#generate").addEventListener("click", openGeneratorModal);
  container.querySelector("#new-project").addEventListener("click", () => openProjectBuilder());
  container.querySelectorAll("[data-filter]").forEach(b => {
    b.addEventListener("click", () => { _childFilter = b.dataset.filter; rerender(); });
  });
  container.querySelectorAll("[data-open]").forEach(b => {
    b.addEventListener("click", () => navigate("/projects/" + b.dataset.open));
  });
}

function projectCard(p, state) {
  const child = state.children.find(c => c.id === p.childId);
  const ms = getMilestonesForProject(p.id);
  const done = ms.filter(m => m.completed).length;
  const pct = ms.length ? Math.round((done / ms.length) * 100) : 0;
  return `
    <div class="card card-hover" data-open="${p.id}" style="cursor:pointer">
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px">
        ${(p.domains || []).map(d => `<span class="tag ${DOMAIN_COLOR_CLASS[d] || ""}">${esc(domainName(d))}</span>`).join("")}
      </div>
      <h3 style="font-family:var(--font-serif);font-size:18px">${esc(p.title)}</h3>
      <div class="small text-muted mb-2">${child ? esc(child.name) : ""} ${p.passionConnection ? "· " + esc(p.passionConnection) : ""}</div>
      <p class="small">${esc((p.description || "").slice(0, 140))}${(p.description || "").length > 140 ? "…" : ""}</p>
      <div class="divider"></div>
      <div class="row-between mb-1">
        <span class="small">⭐ ${p.starsEarned}/${p.starsAvailable} · ${p.momentumPointsEarned}/${p.momentumPointsAvailable} pts</span>
        <span data-countdown="${p.dueDate}" class="compact">${renderCountdown(p.dueDate, { compact: true })}</span>
      </div>
      <div class="progress-bar"><span style="width:${pct}%"></span></div>
      ${p.status === "ready-for-reflection" ? `<div class="tag tag-gold mt-2">✨ Ready for final reflection</div>` : ""}
      ${p.status === "completed" ? `<div class="tag tag-sage mt-2">✓ Completed</div>` : ""}
    </div>
  `;
}

/* ====== Generator modal ====== */

function openGeneratorModal() {
  const s = getState();
  if (!s.children.length) { toast("Add a child first", { type: "warning" }); return; }

  const body = document.createElement("div");
  body.innerHTML = `
    <p class="text-muted small">Pick a child to generate project ideas tuned to their age, passions, learning style and current domains.</p>
    <div class="chip-group mb-2" id="kids">
      ${s.children.map(c => `<button class="chip" data-kid="${c.id}">${esc(c.name)}</button>`).join("")}
    </div>
    <div id="generator-output"></div>
  `;
  const foot = document.createElement("div");
  foot.style.cssText = "display:flex;gap:10px;width:100%;justify-content:flex-end";
  foot.innerHTML = `<button class="btn" data-close>Close</button>`;
  openModal({ title: "✨ Project idea generator", body, footer: foot });

  body.querySelectorAll("[data-kid]").forEach(b => {
    b.addEventListener("click", () => {
      body.querySelectorAll("[data-kid]").forEach(x => x.classList.remove("selected"));
      b.classList.add("selected");
      const child = s.children.find(c => c.id === b.dataset.kid);
      const suggestions = suggestProjectsForChild(child);
      body.querySelector("#generator-output").innerHTML = suggestions.length
        ? suggestions.map((t, i) => generatedCard(t, i)).join("")
        : `<div class="empty">No suggestions yet — try selecting more domains for ${esc(child.name)}.</div>`;
      body.querySelectorAll("[data-accept]").forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = +btn.dataset.accept;
          createProjectFromTemplate(suggestions[idx], child);
          toast(`"${suggestions[idx].title}" added`, { type: "success" });
        });
      });
    });
  });
}

function generatedCard(t, i) {
  return `
    <div class="card mb-2" style="background:var(--card-elev)">
      <div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:6px">
        ${t.domains.map(d => `<span class="tag ${DOMAIN_COLOR_CLASS[d] || ""}">${esc(domainName(d))}</span>`).join("")}
      </div>
      <h4>${esc(t.title)}</h4>
      <p class="small">${esc(t.description)}</p>
      <div class="small text-sage fw-600 mt-1">Why: ${esc(t.reasonSuggested)}</div>
      <div class="small text-muted">Duration: ${t.durationDays} days · ${t.milestones.length} milestones · ${t.momentumPointsAvailable} pts available</div>
      <div class="row mt-2" style="gap:8px">
        <button class="btn btn-primary btn-sm" data-accept="${i}">Accept this project →</button>
      </div>
    </div>
  `;
}

/* Create real Project + Milestones from a generated template. */
function createProjectFromTemplate(t, child) {
  const start = new Date(); start.setHours(17, 0, 0, 0);
  const due = new Date(start); due.setDate(due.getDate() + t.durationDays);
  const project = addProject({
    childId: child.id,
    title: t.title,
    description: t.description,
    domains: t.domains,
    passionConnection: t.passionConnection,
    learningOutcomes: t.learningOutcomes,
    materials: [],
    startDate: start.toISOString(),
    dueDate: due.toISOString(),
    momentumPointsAvailable: t.momentumPointsAvailable,
    starsAvailable: t.starsAvailable,
    reward: t.reward,
    toll: t.toll,
    status: "active",
  });
  t.milestones.forEach((m, i) => {
    const md = new Date(start); md.setDate(md.getDate() + m.dueOffsetDays);
    addMilestone({
      projectId: project.id, title: m.title, dueDate: md.toISOString(),
      momentumPoints: m.momentumPoints, reflectionRequired: !!m.reflectionRequired, order: i,
    });
  });
  rerender();
}

/* ====== Manual project builder ====== */

function openProjectBuilder(existingId = null) {
  const s = getState();
  const existing = existingId ? getProject(existingId) : null;
  const draft = existing ? { ...existing } : {
    childId: s.children[0]?.id || null,
    title: "", description: "",
    domains: [], passionConnection: "",
    learningOutcomes: [],
    startDate: new Date().toISOString().slice(0, 10),
    dueDate: addDaysISO(28),
    momentumPointsAvailable: 100,
    starsAvailable: 5,
    reward: "",
    toll: "",
    status: "active",
  };
  const dStart = (draft.startDate || "").slice(0, 10);
  const dDue = (draft.dueDate || "").slice(0, 10);

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="grid grid-2">
      <div class="field"><label>Title</label><input class="input" id="b-title" value="${esc(draft.title)}"/></div>
      <div class="field"><label>Child</label>
        <select class="select" id="b-child">${s.children.map(c => `<option value="${c.id}" ${c.id === draft.childId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
      </div>
    </div>
    <div class="field"><label>Description</label><textarea class="textarea" id="b-desc" data-voice data-voice-label="Describe the project">${esc(draft.description)}</textarea></div>
    <div class="field">
      <label>Domains</label>
      <div class="chip-group" id="b-domains">
        ${DOMAIN_CATALOG.filter(d => !d.optional || s.family.faithEnabled).map(d =>
          `<button class="chip ${(draft.domains || []).includes(d.id) ? "selected" : ""}" data-domain="${d.id}">${esc(d.short)}</button>`
        ).join("")}
      </div>
    </div>
    <div class="field"><label>Passion connection</label><input class="input" id="b-passion" value="${esc(draft.passionConnection || "")}" placeholder="e.g. skiing + business"/></div>
    <div class="field"><label>Learning outcomes (one per line)</label><textarea class="textarea" id="b-outcomes" data-voice data-voice-label="Speak learning outcomes">${esc((draft.learningOutcomes || []).join("\n"))}</textarea></div>
    <div class="grid grid-2">
      <div class="field"><label>Start date</label><input class="input" type="date" id="b-start" value="${dStart}"/></div>
      <div class="field"><label>Due date</label><input class="input" type="date" id="b-due" value="${dDue}"/></div>
      <div class="field"><label>Momentum Points available</label><input class="input" type="number" id="b-pts" value="${draft.momentumPointsAvailable}"/></div>
      <div class="field"><label>Stars available</label><input class="input" type="number" id="b-stars" value="${draft.starsAvailable}"/></div>
    </div>
    <div class="field"><label>Reward</label><input class="input" id="b-reward" value="${esc(draft.reward)}" placeholder="e.g. Extra ski day with Dad"/></div>
    <div class="field"><label>Toll (natural consequence, not a punishment)</label><input class="input" id="b-toll" value="${esc(draft.toll)}" placeholder="e.g. Finish incomplete milestones first"/></div>
  `;
  const foot = document.createElement("div");
  foot.style.cssText = "display:flex;gap:10px;width:100%;justify-content:flex-end";
  foot.innerHTML = `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="b-save">${existing ? "Save" : "Create project"}</button>`;
  const modal = openModal({ title: existing ? "Edit project" : "New project", body, footer: foot });

  body.querySelectorAll("[data-domain]").forEach(b => {
    b.addEventListener("click", () => b.classList.toggle("selected"));
  });

  foot.querySelector("#b-save").addEventListener("click", () => {
    const data = {
      title: body.querySelector("#b-title").value.trim(),
      childId: body.querySelector("#b-child").value,
      description: body.querySelector("#b-desc").value.trim(),
      domains: Array.from(body.querySelectorAll("[data-domain].selected")).map(b => b.dataset.domain),
      passionConnection: body.querySelector("#b-passion").value.trim(),
      learningOutcomes: body.querySelector("#b-outcomes").value.split("\n").map(s => s.trim()).filter(Boolean),
      startDate: new Date(body.querySelector("#b-start").value).toISOString(),
      dueDate: new Date(body.querySelector("#b-due").value).toISOString(),
      momentumPointsAvailable: parseInt(body.querySelector("#b-pts").value, 10) || 0,
      starsAvailable: parseInt(body.querySelector("#b-stars").value, 10) || 0,
      reward: body.querySelector("#b-reward").value.trim(),
      toll: body.querySelector("#b-toll").value.trim(),
    };
    if (!data.title || !data.childId) { toast("Title and child required", { type: "warning" }); return; }
    if (existing) {
      updateProject(existing.id, data);
      toast("Project updated", { type: "success" });
    } else {
      const p = addProject({ ...data, status: "active" });
      toast("Project created", { type: "success" });
      navigate("/projects/" + p.id);
    }
    modal.close();
    rerender();
  });
}

/* ====== Project detail ====== */

export function renderProjectDetail(container, params) {
  const project = getProject(params.id);
  if (!project) {
    container.innerHTML = `<div class="empty"><div class="emoji">🔍</div>Project not found.</div>`;
    return;
  }
  const child = getState().children.find(c => c.id === project.childId);
  const ms = getMilestonesForProject(project.id);
  const refs = getReflectionsForProject(project.id);
  const doneCount = ms.filter(m => m.completed).length;
  const pct = ms.length ? Math.round((doneCount / ms.length) * 100) : 0;

  container.innerHTML = `
    <div class="topbar">
      <div>
        <a href="#/projects" class="small text-muted">← All projects</a>
        <h1>${esc(project.title)}</h1>
        <div class="sub">${child ? esc(child.name) : ""} ${project.passionConnection ? "· " + esc(project.passionConnection) : ""}</div>
      </div>
      <div class="btn-row">
        <button class="btn" id="edit-proj">Edit</button>
        <button class="btn btn-danger" id="del-proj">Delete</button>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 2fr 1fr; gap:18px">
      <div class="stack">
        <div class="card">
          <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px">
            ${(project.domains || []).map(d => `<span class="tag ${DOMAIN_COLOR_CLASS[d] || ""}">${esc(domainName(d))}</span>`).join("")}
            ${project.status === "completed" ? `<span class="tag tag-sage">✓ Completed</span>` : project.status === "ready-for-reflection" ? `<span class="tag tag-gold">Ready for final reflection</span>` : ""}
          </div>
          <p>${esc(project.description)}</p>
          ${project.learningOutcomes?.length ? `
            <div class="divider"></div>
            <div class="fw-700 small text-muted mb-1">Learning outcomes</div>
            <ul style="padding-left:18px;margin:0">${project.learningOutcomes.map(o => `<li>${esc(o)}</li>`).join("")}</ul>
          ` : ""}
        </div>

        <div class="card">
          <div class="row-between mb-2">
            <h3>Milestones</h3>
            <button class="btn btn-sm" id="add-ms">${icon("plus")} Add milestone</button>
          </div>
          <div class="stack" id="ms-list">
            ${ms.length === 0
              ? `<div class="empty">No milestones yet. Add the steps.</div>`
              : ms.map(m => milestoneRow(m)).join("")}
          </div>
        </div>

        <div class="card">
          <div class="row-between mb-2">
            <h3>Reflections</h3>
            <button class="btn btn-sm" id="add-refl">${icon("plus")} Add reflection</button>
          </div>
          ${refs.length === 0
            ? `<div class="empty">No reflections yet.</div>`
            : refs.map(r => `
              <div class="card mb-2" style="background:var(--card-elev);padding:14px">
                <div class="small text-muted">${fmtDate(r.createdAt, { short: false })}</div>
                <div class="fw-700">${esc(r.prompt)}</div>
                <p class="mt-1">${esc(r.response)}</p>
              </div>
            `).join("")}
        </div>
      </div>

      <div class="stack">
        <div class="card" style="background:var(--card-elev)">
          <h3 class="mb-2">Progress</h3>
          <div class="row" style="gap:14px">
            <div class="progress-ring" style="--p:${pct};--size:80px"><span class="ring-label">${pct}%</span></div>
            <div class="stack-tight">
              <div><span class="fw-700">⭐ ${project.starsEarned}</span> <span class="text-muted small">of ${project.starsAvailable}</span></div>
              <div><span class="fw-700">${project.momentumPointsEarned} pts</span> <span class="text-muted small">of ${project.momentumPointsAvailable}</span></div>
              <div class="small text-muted">${doneCount}/${ms.length} milestones</div>
            </div>
          </div>
          <div class="divider"></div>
          <div class="small text-muted">Due date</div>
          <div class="fw-700">${fmtDate(project.dueDate, { short: false })}</div>
          <div data-countdown="${project.dueDate}" class="mt-1">${renderCountdown(project.dueDate)}</div>
        </div>

        <div class="card">
          <h3 class="mb-1">Reward</h3>
          <p>${esc(project.reward || "No reward set.")}</p>
          <div class="divider"></div>
          <h3 class="mb-1">Toll</h3>
          <p class="text-muted small">Not a punishment — a natural consequence of unfinished work.</p>
          <p>${esc(project.toll || "No toll set.")}</p>
          <div class="divider"></div>
          <label class="checkbox"><input type="checkbox" id="child-agreed" ${project.childAgreed ? "checked" : ""}/> Child has agreed to reward + toll</label>
        </div>

        ${project.status === "ready-for-reflection" ? `
          <div class="card" style="background:linear-gradient(135deg, var(--gold-soft), var(--card-elev))">
            <h3>🎉 Almost done!</h3>
            <p class="small">All milestones are complete. Add a final reflection to lock in the badge and unlock the reward.</p>
            <button class="btn btn-primary mt-1" id="complete-project">Complete project</button>
          </div>
        ` : ""}
      </div>
    </div>
  `;

  container.querySelector("#edit-proj").addEventListener("click", () => openProjectBuilder(project.id));
  container.querySelector("#del-proj").addEventListener("click", async () => {
    const ok = await confirmDialog({ title: "Delete project?", message: "This deletes milestones and reflections too.", confirmLabel: "Delete", danger: true });
    if (ok) { removeProject(project.id); navigate("/projects"); }
  });
  container.querySelector("#add-ms").addEventListener("click", () => openMilestoneModal(project.id));
  container.querySelector("#add-refl").addEventListener("click", () => openReflectionModal(project));
  container.querySelector("#child-agreed").addEventListener("change", (e) => {
    updateProject(project.id, { childAgreed: e.target.checked });
    toast("Saved");
  });

  // milestone interactions
  container.querySelectorAll("[data-toggle-ms]").forEach(b => {
    b.addEventListener("click", (e) => {
      completeMilestone(b.dataset.toggleMs);
      const m = getState().milestones.find(x => x.id === b.dataset.toggleMs);
      if (m?.completed) {
        sparkle(b);
        toast(`⭐ Star earned! +${m.momentumPoints} pts`, { type: "success" });
      }
      setTimeout(rerender, 300);
    });
  });
  container.querySelectorAll("[data-edit-ms]").forEach(b => {
    b.addEventListener("click", () => openMilestoneModal(project.id, b.dataset.editMs));
  });

  const completeBtn = container.querySelector("#complete-project");
  if (completeBtn) {
    completeBtn.addEventListener("click", () => {
      const open = openReflectionModal(project, null, () => {
        updateProject(project.id, { status: "completed" });
        toast("🏅 Project complete!", { type: "success", duration: 3500 });
        rerender();
      });
    });
  }
}

function milestoneRow(m) {
  return `
    <div class="row" style="gap:14px;padding:10px;border:1px solid var(--border);border-radius:var(--r-md);background:${m.completed ? "var(--card-elev)" : "var(--card)"}">
      <button class="star-btn ${m.completed ? "earned" : ""}" data-toggle-ms="${m.id}" title="${m.completed ? "Click to undo" : "Click to mark complete"}">
        ${icon(m.completed ? "star" : "starOutline")}
      </button>
      <div style="flex:1">
        <div class="fw-700 ${m.completed ? "" : ""}" style="${m.completed ? "text-decoration:line-through;color:var(--text-muted)" : ""}">${esc(m.title)}</div>
        <div class="small text-muted">Due ${fmtDate(m.dueDate, { short: false })} · ${m.momentumPoints} pts ${m.reflectionRequired ? "· reflection required" : ""}</div>
      </div>
      <span data-countdown="${m.dueDate}" class="compact">${renderCountdown(m.dueDate, { compact: true })}</span>
      <button class="btn btn-ghost btn-sm" data-edit-ms="${m.id}">Edit</button>
    </div>
  `;
}

function openMilestoneModal(projectId, milestoneId = null) {
  const existing = milestoneId ? getState().milestones.find(m => m.id === milestoneId) : null;
  const draft = existing || { title: "", dueDate: addDaysISO(7), momentumPoints: 15, reflectionRequired: false };

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field"><label>Title</label><input class="input" id="m-title" value="${esc(draft.title)}"/></div>
    <div class="grid grid-2">
      <div class="field"><label>Due date</label><input class="input" type="date" id="m-date" value="${(draft.dueDate || "").slice(0, 10)}"/></div>
      <div class="field"><label>Momentum Points</label><input class="input" type="number" id="m-pts" value="${draft.momentumPoints}"/></div>
    </div>
    <div class="field"><label class="checkbox"><input type="checkbox" id="m-refl" ${draft.reflectionRequired ? "checked" : ""}/> Reflection required to complete this milestone</label></div>
  `;
  const foot = document.createElement("div");
  foot.style.cssText = "display:flex;gap:10px;width:100%;justify-content:flex-end";
  foot.innerHTML = `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="m-save">${existing ? "Save" : "Add"}</button>`;
  const m = openModal({ title: existing ? "Edit milestone" : "New milestone", body, footer: foot });

  foot.querySelector("#m-save").addEventListener("click", () => {
    const data = {
      title: body.querySelector("#m-title").value.trim(),
      dueDate: new Date(body.querySelector("#m-date").value).toISOString(),
      momentumPoints: parseInt(body.querySelector("#m-pts").value, 10) || 0,
      reflectionRequired: body.querySelector("#m-refl").checked,
    };
    if (!data.title) { toast("Title required", { type: "warning" }); return; }
    if (existing) {
      updateMilestone(existing.id, data);
      // adjust project counts: if pts changed and completed, sync
    } else {
      addMilestone({ projectId, ...data });
      // bump available points/stars on the project
      const proj = getProject(projectId);
      updateProject(projectId, {
        momentumPointsAvailable: proj.momentumPointsAvailable + data.momentumPoints,
        starsAvailable: proj.starsAvailable + 1,
      });
    }
    toast("Saved", { type: "success" });
    m.close();
    rerender();
  });
}

function openReflectionModal(project, milestoneId = null, onSaved = null) {
  const body = document.createElement("div");
  body.innerHTML = `
    <p class="text-muted small">Pick a prompt — or write your own.</p>
    <div class="chip-group mb-2" id="r-prompts">
      ${REFLECTION_PROMPTS.map((p, i) => `<button class="chip ${i === 0 ? "selected" : ""}" data-prompt="${esc(p)}">${esc(p)}</button>`).join("")}
    </div>
    <div class="field"><label>Prompt</label><input class="input" id="r-prompt" value="${esc(REFLECTION_PROMPTS[0])}"/></div>
    <div class="field"><label>Response</label><textarea class="textarea" id="r-resp" rows="5" data-voice data-voice-label="Speak your reflection" placeholder="Take your time..."></textarea></div>
  `;
  const foot = document.createElement("div");
  foot.style.cssText = "display:flex;gap:10px;width:100%;justify-content:flex-end";
  foot.innerHTML = `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="r-save">Save reflection</button>`;
  const m = openModal({ title: "New reflection", body, footer: foot });

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
    if (!response) { toast("Add a response", { type: "warning" }); return; }
    addReflection({
      childId: project.childId, projectId: project.id, milestoneId,
      prompt, response,
    });
    toast("Reflection saved", { type: "success" });
    m.close();
    if (onSaved) onSaved();
    rerender();
  });
  return m;
}

function domainName(id) { return DOMAIN_CATALOG.find(d => d.id === id)?.short || id; }
function addDaysISO(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

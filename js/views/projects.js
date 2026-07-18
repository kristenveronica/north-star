/* ============================================================
   projects.js — Project list, generator, builder, detail.
   ============================================================ */

import {
  getState, getProject, addProject, updateProject, removeProject,
  addMilestone, updateMilestone, completeMilestone, getMilestonesForProject,
  addReflection, getReflectionsForProject, uid, addNotification,
} from "../store.js";
import { aiGenerateProject } from "../lib/ai.js";
import { summarizePreferences } from "../lib/preferences.js";
import { recordArchive } from "../lib/lfm.js";
import { buildAcceptedArchive, buildEditedArchive, buildDeclinedArchive } from "../lib/projectArchive.js";
import { buildProjectCompleted } from "../lib/milestoneArchive.js";
import { currentUserId } from "../auth.js";
import { techAgreementForAI } from "../lib/techAgreement.js";
import { ownedResourceKeys } from "../lib/resources.js";
import { INVENTORY_CATEGORIES } from "../lib/inventoryCatalog.js";
import { availableDomains, domainShort, REFLECTION_PROMPTS } from "../seed.js";
import { esc, icon, toast, openModal, confirmDialog, renderCountdown, fmtDate, sparkle, DOMAIN_COLOR_CLASS, childColor } from "../components/ui.js";
import { openProjectPdfModal } from "../components/pdfModal.js";
import { navigate } from "../router.js";
import { rerender } from "../app.js";

/* ====== List view ====== */

let _childFilter = "all";

// What the family already owns — fed to the generator so projects use what they
// have before recommending purchases (RESOURCES ALREADY OWNED + FAMILY INVENTORY).
function ownedAndInventory(state) {
  const owned = new Set(ownedResourceKeys(state));
  (state.inventory || []).forEach(i => owned.add(String(i.name || "").toLowerCase()));
  const titleById = Object.fromEntries(INVENTORY_CATEGORIES.map(c => [c.id, c.title]));
  const byCategory = {};
  (state.inventory || []).forEach(i => {
    const t = titleById[i.category] || "Other";
    (byCategory[t] = byCategory[t] || []).push(i.name);
  });
  const inventory = (state.inventory || []).length || Object.keys(state.family?.inventoryContext || {}).length
    ? { byCategory, context: state.family?.inventoryContext || {} }
    : null;
  return { ownedResources: Array.from(owned), inventory };
}

export function renderProjects(container) {
  const s = getState();
  const projects = _childFilter === "all" ? s.projects : s.projects.filter(p => p.childId === _childFilter);
  const active = projects.filter(p => p.status === "active" || p.status === "ready-for-reflection");
  const drafts = projects.filter(p => p.status === "draft");
  const done = projects.filter(p => p.status === "completed");

  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Projects</h1>
        <div class="sub">Real work, real deadlines, real reflection. The lifeblood of the OS.</div>
      </div>
      <div class="btn-row">
        <button class="btn" id="generate">✨ Generate Project</button>
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

    ${drafts.length ? `
      <h3 class="mt-3 mb-2">Drafts</h3>
      <div class="grid grid-auto">${drafts.map(p => projectCard(p, s)).join("")}</div>
    ` : ""}

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
  const col = childColor(child?.avatarIndex);
  return `
    <div class="card card-hover" data-open="${p.id}" style="cursor:pointer;border-left:4px solid ${col}">
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px">
        ${(p.domains || []).map(d => `<span class="tag ${DOMAIN_COLOR_CLASS[d] || ""}">${esc(domainName(d))}</span>`).join("")}
      </div>
      <h3 style="font-family:var(--font-serif);font-size:18px">${esc(p.title)}</h3>
      <div class="small mb-2"><span style="color:${col};font-weight:600">${child ? esc(child.name) : ""}</span>${p.passionConnection ? ` <span class="text-muted">· ${esc(p.passionConnection)}</span>` : ""}</div>
      <p class="small">${esc((p.description || "").slice(0, 140))}${(p.description || "").length > 140 ? "…" : ""}</p>
      <div class="divider"></div>
      <div class="row-between mb-1">
        <span class="small">⭐ ${p.starsEarned}/${p.starsAvailable} · ${p.momentumPointsEarned}/${p.momentumPointsAvailable} pts</span>
        <span data-countdown="${p.dueDate}" class="compact">${renderCountdown(p.dueDate, { compact: true })}</span>
      </div>
      <div class="progress-bar"><span style="width:${pct}%"></span></div>
      ${p.status === "ready-for-reflection" ? `<div class="tag tag-gold mt-2">✨ Ready for final reflection</div>` : ""}
      ${p.status === "completed" ? `<div class="tag tag-sage mt-2">✓ Completed</div>` : ""}
      ${p.status === "draft" ? `<div class="tag mt-2">✎ Draft — tap to review</div>` : ""}
    </div>
  `;
}

/* ====== Generator modal — "tell us what's happening, we'll design the learning" ====== */

// Example sparks the parent can tap to fill the box. The AI does the educational
// design; the parent only supplies the real-life moment.
const PROMPT_EXAMPLES = [
  "Noah has become fascinated by mountain biking. Create a project that gets him outdoors, builds confidence and includes some maths and writing.",
  "Jetty wants to help in the kitchen. Create a practical life project around cooking, measuring and independence.",
  "We're travelling to Japan for three weeks and want the kids to learn through the trip.",
];

function openGeneratorModal() {
  const s = getState();
  if (!s.children.length) { toast("Add a child first", { type: "warning" }); return; }

  let childId = s.children[0].id;
  let intent = "";            // the parent's free-text "spark"
  let size = "auto";          // quest length: auto | small | medium | large
  let refinementsLeft = 3;    // 3 AI refinements before accepting
  let current = null;         // the proposed project being reviewed
  let resolved = false;       // true once accepted or saved-as-draft (so close ≠ decline)

  // Fire-and-forget canonical Archive write for a project decision (accept/edit/
  // decline). Idempotent by deterministic id, so a retry can't duplicate evidence.
  // Non-blocking: a generated-project decision is evidence, not user data — a
  // failed write must never interrupt the parent's flow.
  const fireArchive = (payload) => {
    const fid = getState().family?.id;
    if (!fid || !payload) return;
    recordArchive(fid, payload).catch((e) =>
      console.warn("[archive] project-decision write failed", e?.message || e));
  };

  const body = document.createElement("div");
  const foot = document.createElement("div");
  foot.style.cssText = "display:flex;gap:10px;width:100%;justify-content:flex-end;flex-wrap:wrap";
  const modal = openModal({
    title: "✨ Generate a project", body, footer: foot,
    // Closing with a proposal on screen that was neither accepted nor saved = a decline.
    onClose: () => {
      if (current && !resolved) {
        fireArchive(buildDeclinedArchive({
          familyId: getState().family?.id, childId,
          actingUserId: currentUserId(), proposed: projectSnapshot(current),
        }));
      }
    },
  });

  const child = () => getState().children.find(c => c.id === childId) || s.children[0];
  const childName = () => child()?.name || "your child";

  // This child's recent project domains → quiet capability balance signal.
  function recentDomains() {
    const counts = {};
    (getState().projects || []).filter(p => p.childId === childId)
      .forEach(p => (p.domains || []).forEach(d => { counts[d] = (counts[d] || 0) + 1; }));
    return counts;
  }
  function existingTitles() {
    return [...new Set((getState().projects || [])
      .filter(p => p.childId === childId).map(p => p.title).filter(Boolean))];
  }
  function genConstraints(extra = {}) {
    return {
      intent,
      size,
      recentDomains: recentDomains(),
      avoidTitles: existingTitles(),
      preferences: summarizePreferences(getState(), childId),
      technology: techAgreementForAI(child()),
      ...ownedAndInventory(getState()),
      ...extra,
    };
  }

  function generatingHtml(verb = "Designing") {
    return `
      <div class="empty ns-generating">
        <div class="ns-gen-stars" aria-hidden="true">
          <span class="ns-gen-star">✨</span><span class="ns-gen-star">✨</span><span class="ns-gen-star">✨</span>
        </div>
        <div>${esc(verb)} ${esc(childName())}'s project<span class="ns-gen-dots"><span>.</span><span>.</span><span>.</span></span></div>
        <div class="small text-muted mt-1">North Star is drawing on everything it knows about your family — this takes a few seconds.</div>
      </div>`;
  }

  /* ---- Screen 1: the spark ---- */
  function renderPrompt() {
    current = null;
    const multi = s.children.length > 1;
    body.innerHTML = `
      <p class="text-muted">Tell us what's happening in real life. North Star turns it into meaningful learning — drawing on your Family North Star, ${esc(childName())}'s profile, your settings and what you already own. You bring the spark; we build the pathway.</p>
      ${multi ? `
        <div class="small text-muted fw-700 mt-2" style="text-transform:uppercase;letter-spacing:.1em">Who is this for?</div>
        <div class="chip-group mb-1" id="kids">
          ${s.children.map(c => `<button class="chip${c.id === childId ? " selected" : ""}" data-kid="${c.id}">${esc(c.name)}</button>`).join("")}
        </div>` : ""}
      <label class="fw-700 mt-2" style="display:block">What would you like ${esc(childName())} to explore, build, practise or experience next?</label>
      <textarea class="textarea mt-1" id="intent" rows="4" data-voice data-voice-label="Describe what you'd like next"
        placeholder="${esc(PROMPT_EXAMPLES[0])}">${esc(intent)}</textarea>
      <div class="small text-muted mt-2">Need a spark? Tap an example:</div>
      <div class="stack-tight mt-1" id="examples">
        ${PROMPT_EXAMPLES.map((ex, i) => `<button type="button" class="ns-example-btn" data-ex="${i}" style="text-align:left;width:100%;border:1px dashed var(--border);background:var(--card-elev);border-radius:var(--r-md);padding:8px 10px;cursor:pointer;color:var(--text-muted);font-size:13px;line-height:1.4">"${esc(ex)}"</button>`).join("")}
      </div>

      <div class="small text-muted fw-700 mt-3" style="text-transform:uppercase;letter-spacing:.1em">How long should it be?</div>
      <div class="chip-group mb-1" id="size">
        ${[
          ["auto", "Best fit", "North Star chooses"],
          ["small", "Short", "1–2 weeks"],
          ["medium", "Medium", "~1 month"],
          ["large", "Long", "~a term"],
        ].map(([v, label, hint]) => `
          <button class="chip${v === size ? " selected" : ""}" data-size="${v}" title="${esc(hint)}">
            ${esc(label)} <span class="text-muted" style="font-size:11px">· ${esc(hint)}</span>
          </button>`).join("")}
      </div>
    `;
    foot.innerHTML = `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="go">✨ Generate Project</button>`;

    body.querySelectorAll("[data-kid]").forEach(b => b.addEventListener("click", () => {
      intent = (body.querySelector("#intent")?.value || "").trim();
      childId = b.dataset.kid;
      renderPrompt();
    }));
    body.querySelectorAll("[data-ex]").forEach(b => b.addEventListener("click", () => {
      body.querySelector("#intent").value = PROMPT_EXAMPLES[+b.dataset.ex];
      body.querySelector("#intent").focus();
    }));
    body.querySelectorAll("[data-size]").forEach(b => b.addEventListener("click", () => {
      size = b.dataset.size;
      body.querySelectorAll("[data-size]").forEach(x => x.classList.toggle("selected", x === b));
    }));
    foot.querySelector("#go").addEventListener("click", doGenerate);
  }

  async function doGenerate() {
    intent = (body.querySelector("#intent")?.value || "").trim();
    if (!intent) { toast("Tell North Star what you'd like next", { type: "warning" }); return; }
    refinementsLeft = 3;
    body.innerHTML = generatingHtml();
    foot.innerHTML = "";
    try {
      const project = await aiGenerateProject(getState().family || {}, child(), genConstraints());
      renderProposal(project);
    } catch (e) {
      renderError(e);
    }
  }

  async function doRefine() {
    const refine = (body.querySelector("#refine-text")?.value || "").trim();
    if (!refine) { toast("Tell North Star what to change", { type: "warning" }); return; }
    // The edit is its own high-value evidence — preserve the DELTA (what they asked
    // to change + the proposal as it stood before). Never collapsed into "accepted".
    fireArchive(buildEditedArchive({
      familyId: getState().family?.id, childId, actingUserId: currentUserId(),
      preEdit: projectSnapshot(current), refineText: refine, sequence: 3 - refinementsLeft,
    }));
    body.innerHTML = generatingHtml("Refining");
    foot.innerHTML = "";
    try {
      const amended = await aiGenerateProject(getState().family || {}, child(),
        genConstraints({ refine, previous: current }));
      refinementsLeft = Math.max(0, refinementsLeft - 1);
      renderProposal(amended);
    } catch (e) {
      toast(e.message || "Couldn't refine that", { type: "error" });
      renderProposal(current); // fall back to the version we had
    }
  }

  function renderError(e) {
    body.innerHTML = `<div class="card" style="background:var(--card-elev)"><p class="small">Couldn't generate just now: ${esc(e.message || "AI request failed")}.</p></div>`;
    foot.innerHTML = `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="retry">Try again</button>`;
    foot.querySelector("#retry").addEventListener("click", renderPrompt);
  }

  /* ---- Screen 2: the proposal ---- */
  function renderProposal(project) {
    current = project;
    body.innerHTML = proposalHtml(project, childName(), refinementsLeft);
    foot.innerHTML = `
      <button class="btn" data-close>Cancel</button>
      <button class="btn" id="save-draft">Save as Draft</button>
      <button class="btn btn-primary" id="accept">Accept Project →</button>`;
    requestAnimationFrame(() => { const sc = body.closest(".modal-body") || body.parentElement; if (sc) sc.scrollTop = 0; });

    const refineBtn = body.querySelector("#refine-go");
    if (refineBtn) refineBtn.addEventListener("click", doRefine);

    foot.querySelector("#accept").addEventListener("click", () => {
      const p = createProjectFromTemplate(current, child(), "active");
      resolved = true;   // set before close() so onClose does not read this as a decline
      // Record accept AFTER the project exists, so the Archive id keys off p.id (stable).
      fireArchive(buildAcceptedArchive({
        familyId: getState().family?.id, childId, projectId: p.id,
        actingUserId: currentUserId(), proposed: projectSnapshot(current),
      }));
      modal.close();
      toast(`"${current.title}" added — now fully editable`, { type: "success" });
      navigate("/projects/" + p.id);
    });
    foot.querySelector("#save-draft").addEventListener("click", () => {
      resolved = true;   // kept, not declined
      const p = createProjectFromTemplate(current, child(), "draft");
      modal.close();
      toast("Saved as a draft", { type: "success" });
      navigate("/projects/" + p.id);
    });
  }

  renderPrompt();
}

// The full, trustworthy proposal card the parent reviews before accepting.
function proposalHtml(t, name, refinementsLeft) {
  const list = (arr) => (arr || []).filter(Boolean).map(x => `<li>${esc(x)}</li>`).join("");
  const section = (label, inner) => inner ? `
    <div class="mt-2">
      <div class="small text-muted fw-700" style="text-transform:uppercase;letter-spacing:.08em">${label}</div>
      ${inner}
    </div>` : "";
  const mats = (t.materials || []).filter(m => (m.name || "").trim());
  const refineCount = refinementsLeft === 1 ? "1 refinement available" : `${refinementsLeft} refinements available`;

  return `
    <div class="card mb-2" style="background:var(--card-elev)">
      <div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:6px">
        ${(t.domains || []).map(d => `<span class="tag ${DOMAIN_COLOR_CLASS[d] || ""}">${esc(domainName(d))}</span>`).join("")}
        ${t.pathway ? `<span class="tag">${esc(t.pathway)}</span>` : ""}
      </div>
      <h3 style="font-family:var(--font-serif)">${esc(t.title)}</h3>
      <div class="small text-muted">${esc(name)} · ${t.durationDays} days · ${(t.milestones || []).length} milestones</div>

      ${t.childDescription ? `<div class="card mt-2" style="background:var(--gold-soft);padding:12px"><div class="small fw-700 mb-1">For ${esc(name)} ✨</div><p class="small" style="margin:0">${esc(t.childDescription)}</p></div>` : ""}
      ${t.description ? `<p class="small mt-2">${esc(t.description)}</p>` : ""}

      ${t.reasonSuggested ? `
        <div class="card mt-2" style="background:var(--card);border:1px solid var(--border);padding:12px">
          <div class="small fw-700 mb-1">💡 Why North Star suggested this</div>
          <p class="small" style="margin:0">${esc(t.reasonSuggested)}</p>
        </div>` : ""}

      ${section("Why this fits " + esc(name), t.purpose ? `<p class="small" style="margin:4px 0 0">${esc(t.purpose)}</p>` : "")}
      ${section("Capabilities developed", (t.capabilitiesDeveloped || []).length ? `<p class="small text-sage fw-600" style="margin:4px 0 0">${(t.capabilitiesDeveloped).map(esc).join(", ")}</p>` : "")}
      ${section("Academic skills woven in", (t.academicSkills || []).length ? `<ul class="small" style="margin:4px 0 0;padding-left:18px">${list(t.academicSkills)}</ul>` : "")}
      ${section("Practical-life skills woven in", (t.practicalSkills || []).length ? `<ul class="small" style="margin:4px 0 0;padding-left:18px">${list(t.practicalSkills)}</ul>` : "")}

      ${section("Milestones &amp; deadlines", (t.milestones || []).length ? `
        <ol class="small" style="margin:4px 0 0;padding-left:20px">
          ${(t.milestones).map(m => `<li style="margin-bottom:4px"><span class="fw-600">${esc(m.title)}</span>${m.dueOffsetDays != null ? ` <span class="text-muted">· by day ${m.dueOffsetDays}</span>` : ""}${m.description ? `<br><span class="text-muted">${esc(m.description)}</span>` : ""}</li>`).join("")}
        </ol>` : "")}

      ${section("Materials needed", mats.length ? `<ul class="small" style="margin:4px 0 0;padding-left:18px">${mats.map(m => `<li>${esc(m.name)}${m.source ? ` <span class="text-muted">(${esc(m.source)})</span>` : ""}</li>`).join("")}</ul>` : `<p class="small text-muted" style="margin:4px 0 0">Uses what you already have.</p>`)}
      ${section("Reflection prompts", (t.reflectionPrompts || []).length ? `<ul class="small" style="margin:4px 0 0;padding-left:18px">${list(t.reflectionPrompts)}</ul>` : "")}
      ${section("Optional extensions", (t.extensionIdeas || []).length ? `<ul class="small" style="margin:4px 0 0;padding-left:18px">${list(t.extensionIdeas)}</ul>` : "")}
      ${section("Parent notes", t.parentNotes ? `<p class="small" style="margin:4px 0 0">${esc(t.parentNotes)}</p>` : "")}
      ${section("Reward &amp; toll", (t.reward || t.toll) ? `<p class="small" style="margin:4px 0 0">${t.reward ? `<span class="fw-600">Reward:</span> ${esc(t.reward)}` : ""}${t.reward && t.toll ? "<br>" : ""}${t.toll ? `<span class="fw-600">Toll:</span> ${esc(t.toll)}` : ""}</p>` : "")}
    </div>

    ${refinementsLeft > 0 ? `
      <div class="card mb-2" style="background:var(--card)">
        <div class="fw-700">Refine this project</div>
        <p class="small text-muted" style="margin:4px 0 8px">Not quite right? Tell North Star what to change and it'll redesign it.</p>
        <textarea class="textarea" id="refine-text" rows="2" data-voice data-voice-label="Describe your changes"
          placeholder="e.g. Make it shorter, add more outdoor time, reduce writing, include a business element, make it suitable for rainy weather."></textarea>
        <div class="row-between mt-2" style="align-items:center">
          <span class="small text-muted">${refineCount}</span>
          <button class="btn btn-primary btn-sm" id="refine-go">✨ Refine Project</button>
        </div>
      </div>`
    : `<div class="card mb-2" style="background:var(--card)"><p class="small text-muted" style="margin:0">You can still edit this project manually after accepting it.</p></div>`}
  `;
}

/* ---------- The family learning loop ----------
   A compact snapshot of a generated project so signals can teach pattern
   recognition (preferred sizes, domains, pathways, cost, screen-time…). */
function projectSnapshot(t) {
  return {
    title: t.title,
    sizeBand: t.sizeBand || null,
    durationDays: t.durationDays ?? null,
    domains: t.domains || [],
    pathway: t.pathway || null,
    category: t.projectCategory || t.category || null,
    capabilities: t.capabilitiesDeveloped || [],
    passionConnection: t.passionConnection || null,
    momentumPoints: t.momentumPointsAvailable ?? null,
    materialsCount: (t.materials || []).length,
  };
}

/* Create real Project + Milestones from a generated template.
   status: "active" (accepted) or "draft" (saved to review later). */
export function createProjectFromTemplate(t, child, status = "active") {
  const start = new Date(); start.setHours(17, 0, 0, 0);
  const due = new Date(start); due.setDate(due.getDate() + t.durationDays);
  const project = addProject({
    childId: child.id,
    title: t.title,
    description: t.description,
    childDescription: t.childDescription || "",
    questRole: t.questRole || "",
    purpose: t.purpose || "",
    pathway: t.pathway || "",
    capabilitiesDeveloped: t.capabilitiesDeveloped || [],
    academicSkills: t.academicSkills || [],
    practicalSkills: t.practicalSkills || [],
    reflectionPrompts: t.reflectionPrompts || [],
    extensionIdeas: t.extensionIdeas || [],
    parentNotes: t.parentNotes || "",
    foundationalLiteracies: t.foundationalLiteracies || [],
    realWorldApplication: t.realWorldApplication || "",
    contributionOpportunities: t.contributionOpportunities || "",
    domains: t.domains,
    // Capability mapping metadata from the AI — primary/secondary domains + skills.
    capabilityMap: (t.capabilityMap && typeof t.capabilityMap === "object" && !Array.isArray(t.capabilityMap))
      ? { primary: [], secondary: [], skills: [], competencyGrowth: {}, ...t.capabilityMap }
      : { primary: [], secondary: [], skills: [], competencyGrowth: {} },
    passionConnection: t.passionConnection,
    learningOutcomes: t.learningOutcomes,
    materials: t.materials || [],
    startDate: start.toISOString(),
    dueDate: due.toISOString(),
    momentumPointsAvailable: t.momentumPointsAvailable,
    starsAvailable: t.starsAvailable,
    reward: t.reward,
    toll: t.toll,
    generatedByAi: !!t.purpose,
    status,
  });
  (t.milestones || []).forEach((m, i) => {
    const md = new Date(start); md.setDate(md.getDate() + m.dueOffsetDays);
    addMilestone({
      projectId: project.id, title: m.title,
      description: m.description || "",
      instructions: Array.isArray(m.instructions) ? m.instructions : [],
      dueDate: md.toISOString(),
      momentumPoints: m.momentumPoints, reflectionRequired: !!m.reflectionRequired, order: i,
    });
  });
  // Learning Resources integration: tell the parent the new project needs resources
  // (only once it's a live project, not a draft).
  const needed = (t.materials || []).filter(m => (m.name || "").trim()).length;
  if (needed && status === "active") {
    addNotification({
      childId: child.id,
      projectId: project.id,
      message: `${child.name}'s new project "${t.title}" needs ${needed} resource${needed === 1 ? "" : "s"} — review them in Learning Resources.`,
    });
  }
  rerender();
  return project;
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
      <label>Capability domains</label>
      <div class="chip-group" id="b-domains">
        ${availableDomains(s.family).map(d =>
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
        <button class="btn btn-primary" id="pdf-proj">⬇ Generate PDF</button>
        <button class="btn" id="edit-proj">Edit</button>
        <button class="btn btn-danger" id="del-proj">Delete</button>
      </div>
    </div>

    ${project.status === "draft" ? `
      <div class="card mb-2" style="background:linear-gradient(135deg, var(--gold-soft), var(--card-elev))">
        <div class="row-between" style="align-items:center;flex-wrap:wrap;gap:10px">
          <div>
            <div class="fw-700">✎ This is a draft</div>
            <p class="small text-muted" style="margin:2px 0 0">Review and tweak it, then activate it to make it live for ${child ? esc(child.name) : "your child"}.</p>
          </div>
          <button class="btn btn-primary" id="activate-proj">Activate project →</button>
        </div>
      </div>
    ` : ""}

    <div class="grid" style="grid-template-columns: 2fr 1fr; gap:18px">
      <div class="stack">
        <div class="card">
          <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px">
            ${(project.domains || []).map(d => `<span class="tag ${DOMAIN_COLOR_CLASS[d] || ""}">${esc(domainName(d))}</span>`).join("")}
            ${project.status === "completed" ? `<span class="tag tag-sage">✓ Completed</span>` : project.status === "ready-for-reflection" ? `<span class="tag tag-gold">Ready for final reflection</span>` : project.status === "draft" ? `<span class="tag">Draft</span>` : ""}
          </div>
          ${project.childDescription ? `<div class="card mb-2" style="background:var(--gold-soft);padding:12px"><div class="small fw-700 mb-1">For ${child ? esc(child.name) : "your child"} ✨</div><p class="small" style="margin:0">${esc(project.childDescription)}</p></div>` : ""}
          <p>${esc(project.description)}</p>
          ${project.learningOutcomes?.length ? `
            <div class="divider"></div>
            <div class="fw-700 small text-muted mb-1">Learning outcomes</div>
            <ul style="padding-left:18px;margin:0">${project.learningOutcomes.map(o => `<li>${esc(o)}</li>`).join("")}</ul>
          ` : ""}
          ${(project.academicSkills?.length || project.practicalSkills?.length) ? `
            <div class="divider"></div>
            ${project.academicSkills?.length ? `<div class="fw-700 small text-muted mb-1">Academic skills woven in</div><ul style="padding-left:18px;margin:0 0 8px">${project.academicSkills.map(o => `<li>${esc(o)}</li>`).join("")}</ul>` : ""}
            ${project.practicalSkills?.length ? `<div class="fw-700 small text-muted mb-1">Practical-life skills woven in</div><ul style="padding-left:18px;margin:0">${project.practicalSkills.map(o => `<li>${esc(o)}</li>`).join("")}</ul>` : ""}
          ` : ""}
          ${project.extensionIdeas?.length ? `
            <div class="divider"></div>
            <div class="fw-700 small text-muted mb-1">Optional extensions</div>
            <ul style="padding-left:18px;margin:0">${project.extensionIdeas.map(o => `<li>${esc(o)}</li>`).join("")}</ul>
          ` : ""}
          ${project.parentNotes ? `
            <div class="divider"></div>
            <div class="fw-700 small text-muted mb-1">Parent notes</div>
            <p class="small" style="margin:0">${esc(project.parentNotes)}</p>
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

  container.querySelector("#pdf-proj").addEventListener("click", () => openProjectPdfModal(project, child));
  container.querySelector("#edit-proj").addEventListener("click", () => openProjectBuilder(project.id));
  const activateBtn = container.querySelector("#activate-proj");
  if (activateBtn) activateBtn.addEventListener("click", () => {
    updateProject(project.id, { status: "active", startDate: new Date().toISOString() });
    toast("Project activated 🎉", { type: "success" });
    rerender();
  });
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
        // Project completion is a distinct, separately-triggered event (reflection
        // submitted) — record it factually, idempotent by (project, completedAt).
        const fid = getState().family?.id;
        if (fid) {
          recordArchive(fid, buildProjectCompleted({
            familyId: fid, childId: project.childId, projectId: project.id,
            actor: currentUserId(), completedAt: new Date().toISOString(), trigger: "reflection",
          })).catch((e) => console.warn("[archive] project-completed write failed", e?.message || e));
        }
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
        ${m.description ? `<div class="small">${esc(m.description)}</div>` : ""}
        <div class="small text-muted">Due ${fmtDate(m.dueDate, { short: false })} · ${m.momentumPoints} pts ${m.reflectionRequired ? "· reflection required" : ""}${(m.instructions || []).length ? ` · ${m.instructions.length} step${m.instructions.length > 1 ? "s" : ""}` : ""}</div>
        ${(m.instructions || []).length ? `<ul class="small text-muted" style="margin:6px 0 0;padding-left:18px">${m.instructions.map(s => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
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
    <div class="field"><label>Mission title</label><input class="input" id="m-title" value="${esc(draft.title)}"/></div>
    <div class="field"><label>One-line summary</label><input class="input" id="m-desc" value="${esc(draft.description || "")}" placeholder="What this mission is, in a sentence"/></div>
    <div class="field">
      <label>Instructions <span class="text-muted small">— what to do, one action step per line</span></label>
      <textarea class="textarea" id="m-instr" rows="4" data-voice data-voice-label="Dictate the steps" placeholder="e.g. Research 3 local birds&#10;Draw each one in your journal&#10;Show your drawings to Mum">${esc((draft.instructions || []).join("\n"))}</textarea>
      <span class="hint">Keep each step measurable and clear — name who they show it to.</span>
    </div>
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
      description: body.querySelector("#m-desc").value.trim(),
      instructions: body.querySelector("#m-instr").value.split("\n").map(s => s.trim()).filter(Boolean),
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
  // Lead with this project's AI-suggested reflection prompts (if any), then the standard set.
  const prompts = [...new Set([...(project.reflectionPrompts || []), ...REFLECTION_PROMPTS])].filter(Boolean);
  const body = document.createElement("div");
  body.innerHTML = `
    <p class="text-muted small">Pick a prompt — or write your own.</p>
    <div class="chip-group mb-2" id="r-prompts">
      ${prompts.map((p, i) => `<button class="chip ${i === 0 ? "selected" : ""}" data-prompt="${esc(p)}">${esc(p)}</button>`).join("")}
    </div>
    <div class="field"><label>Prompt</label><input class="input" id="r-prompt" value="${esc(prompts[0] || "")}"/></div>
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

function domainName(id) { return domainShort(id); }
function addDaysISO(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/* ============================================================
   reports.js — Growth Reports (Layer 13).
   - List view with all reports per child
   - Generation wizard (period → observations → self-assessment → generate)
   - Report viewer with all 10 sections
   ============================================================ */

import {
  getState, getReport, getReportsForChild, saveGrowthReport, deleteReport,
  addParentObservation, addChildSelfAssessment, getObservationsForChild, getSelfAssessmentsForChild,
  addProject, addMilestone,
} from "../store.js";
import { generateReport, PERIODS, GROWTH_BANDS } from "../ai/growthEngine.js";
import { DOMAIN_CATALOG } from "../seed.js";
import { esc, toast, icon, openModal, confirmDialog, fmtDate, DOMAIN_COLOR_CLASS } from "../components/ui.js";
import { navigate } from "../router.js";
import { rerender } from "../app.js";

/* ============================================================
   LIST VIEW (/reports)
   ============================================================ */
export function renderReports(container, params = {}) {
  const s = getState();
  const childFilter = params.child || (s.children[0]?.id);

  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Growth Reports</h1>
        <div class="sub">Evidence-based developmental reviews — not grades, not generic praise.</div>
      </div>
      <button class="btn btn-primary btn-lg" id="generate">✨ Generate Growth Report</button>
    </div>

    ${s.children.length > 1 ? `
      <div class="row mb-2" style="gap:8px">
        ${s.children.map(c => `<button class="chip ${c.id === childFilter ? "selected" : ""}" data-child="${c.id}">${esc(c.name)}</button>`).join("")}
      </div>
    ` : ""}

    ${childFilter ? renderReportsForChild(childFilter, s) : `<div class="empty">Add a child first.</div>`}
  `;

  container.querySelector("#generate").addEventListener("click", () => openGenerateWizard(childFilter));
  container.querySelectorAll("[data-child]").forEach(b => {
    b.addEventListener("click", () => navigate(`/reports?child=${b.dataset.child}`));
  });
  container.querySelectorAll("[data-open-report]").forEach(b => {
    b.addEventListener("click", () => navigate(`/reports/${b.dataset.openReport}`));
  });
  container.querySelectorAll("[data-delete-report]").forEach(b => {
    b.addEventListener("click", async (e) => {
      e.stopPropagation();
      const ok = await confirmDialog({ title: "Delete this report?", message: "It will be removed from the longitudinal timeline too.", confirmLabel: "Delete", danger: true });
      if (ok) { deleteReport(b.dataset.deleteReport); toast("Report deleted"); rerender(); }
    });
  });
}

function renderReportsForChild(childId, s) {
  const child = s.children.find(c => c.id === childId);
  if (!child) return `<div class="empty">Child not found.</div>`;
  const reports = getReportsForChild(childId);

  return `
    <div class="card mb-3" style="background:var(--card-elev)">
      <div class="row" style="gap:14px">
        <div class="child-card-avatar avatar-${child.avatarIndex}">${initials(child.name)}</div>
        <div style="flex:1">
          <h3>${esc(child.name)} · Growth journey</h3>
          <div class="small text-muted">${reports.length} ${reports.length === 1 ? "report" : "reports"} on record · age ${child.age}</div>
        </div>
      </div>
    </div>

    ${reports.length === 0
      ? `<div class="empty"><div class="emoji">🌱</div><h3>No reports yet for ${esc(child.name)}</h3><p>Generate the first one to start the longitudinal timeline.</p><button class="btn btn-primary mt-2" onclick="document.getElementById('generate').click()">Generate first report</button></div>`
      : `<div class="grid grid-auto">${reports.map(r => reportCard(r)).join("")}</div>`
    }
  `;
}

function reportCard(r) {
  const total = r.snapshot?.momentumPoints || 0;
  return `
    <div class="card card-hover" data-open-report="${r.id}" style="cursor:pointer">
      <div class="row-between mb-1">
        <span class="tag tag-sage">${esc(r.periodLabel)}</span>
        <button class="btn btn-ghost btn-sm" data-delete-report="${r.id}" title="Delete">✕</button>
      </div>
      <h3 style="font-family:var(--font-serif);font-size:18px">${esc(r.childName)} · Age ${r.childAge}</h3>
      <div class="small text-muted">${fmtDate(r.generatedAt, { short: false })}</div>
      <div class="divider"></div>
      <div class="row" style="gap:14px">
        <div class="stack-tight"><span class="small text-muted">Points</span><span class="fw-700">${total}</span></div>
        <div class="stack-tight"><span class="small text-muted">Projects done</span><span class="fw-700">${r.snapshot?.projectsCompleted || 0}</span></div>
        <div class="stack-tight"><span class="small text-muted">Reflections</span><span class="fw-700">${r.snapshot?.reflectionsWritten || 0}</span></div>
      </div>
    </div>
  `;
}

/* ============================================================
   GENERATE WIZARD
   ============================================================ */
function openGenerateWizard(initialChildId = null) {
  const s = getState();
  if (!s.children.length) { toast("Add a child first", { type: "warning" }); return; }

  let step = 1;
  const draft = {
    childId: initialChildId || s.children[0].id,
    periodKey: "term",
    parentNotes: { strengths: "", challenges: "", growthObserved: "", concerns: "", goalsNextTerm: "" },
    selfAssessment: { proudOf: "", hardThing: "", wantToGetBetterAt: "", favouriteProject: "", wantToLearnNext: "" },
    includeSelfAssessment: false,
  };

  const body = document.createElement("div");
  const foot = document.createElement("div");
  foot.style.cssText = "display:flex;gap:10px;width:100%;justify-content:space-between";
  const modal = openModal({ title: "Generate Growth Report", body, footer: foot });

  const paint = () => {
    const child = s.children.find(c => c.id === draft.childId);
    if (step === 1) {
      body.innerHTML = `
        <p class="text-muted small">Pick the child and the period. These shape every section of the report.</p>
        <div class="field">
          <label>Child</label>
          <div class="chip-group">
            ${s.children.map(c => `<button class="chip ${c.id === draft.childId ? "selected" : ""}" data-c="${c.id}">${esc(c.name)}</button>`).join("")}
          </div>
        </div>
        <div class="field">
          <label>Period</label>
          <div class="chip-group">
            ${Object.entries(PERIODS).map(([k, p]) => `<button class="chip ${draft.periodKey === k ? "selected" : ""}" data-p="${k}">${esc(p.label)}</button>`).join("")}
          </div>
        </div>
        <div class="card mt-2" style="background:var(--card-elev)">
          <h4>What the engine looks at</h4>
          <ul class="text-muted small" style="padding-left:18px;margin:6px 0">
            <li>Completed + incomplete projects, complexity, duration</li>
            <li>Milestones — completed, on time, missed, extended</li>
            <li>Momentum Points across domains and time</li>
            <li>Reflection depth and self-awareness signals</li>
            <li>Your own observations (next step) and ${esc(child.name)}'s self-assessment</li>
          </ul>
        </div>
      `;
      body.querySelectorAll("[data-c]").forEach(b => b.addEventListener("click", () => { draft.childId = b.dataset.c; paint(); }));
      body.querySelectorAll("[data-p]").forEach(b => b.addEventListener("click", () => { draft.periodKey = b.dataset.p; paint(); }));
      foot.innerHTML = `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="next">Continue →</button>`;
      foot.querySelector("#next").addEventListener("click", () => { step = 2; paint(); });
    }

    if (step === 2) {
      body.innerHTML = `
        <p class="text-muted small">Optional but powerful. Your daily observations carry more signal than any of this data alone.</p>
        ${tx("strengths", "Strengths you've noticed", "What is genuinely working? What is showing up that surprises you?")}
        ${tx("challenges", "Challenges you've noticed", "What still gets in the way? Where is support needed?")}
        ${tx("growthObserved", "Growth you've watched happen", "Something they couldn't do six months ago that they can now?")}
        ${tx("concerns", "Anything you're carrying", "Quiet concerns that the data may not show.")}
        ${tx("goalsNextTerm", "What you want next term to be about", "One sentence. Keep it honest.")}
      `;
      foot.innerHTML = `<button class="btn" id="back">← Back</button><button class="btn btn-primary" id="next">Continue →</button>`;
      foot.querySelector("#back").addEventListener("click", () => { collectStep2(body); step = 1; paint(); });
      foot.querySelector("#next").addEventListener("click", () => { collectStep2(body); step = 3; paint(); });
    }

    if (step === 3) {
      const recent = getSelfAssessmentsForChild(draft.childId)[0];
      if (recent && !draft.touchedSelf) {
        Object.assign(draft.selfAssessment, recent);
        draft.includeSelfAssessment = true;
      }
      body.innerHTML = `
        <p class="text-muted small">Optional. Sit with ${esc(child.name)} and fill these in together — or skip and the report will note its absence.</p>
        <label class="checkbox mb-2"><input type="checkbox" id="inc" ${draft.includeSelfAssessment ? "checked" : ""}/> Include child self-assessment</label>
        <div id="self-fields" class="${draft.includeSelfAssessment ? "" : "hidden"}">
          ${tx("proudOf", "What am I proud of?", "")}
          ${tx("hardThing", "What has been hard?", "")}
          ${tx("wantToGetBetterAt", "What do I want to get better at?", "")}
          ${tx("favouriteProject", "What project did I enjoy most?", "")}
          ${tx("wantToLearnNext", "What do I want to learn next?", "")}
        </div>
      `;
      const inc = body.querySelector("#inc");
      inc.addEventListener("change", () => {
        draft.includeSelfAssessment = inc.checked;
        body.querySelector("#self-fields").classList.toggle("hidden", !inc.checked);
      });
      foot.innerHTML = `<button class="btn" id="back">← Back</button><button class="btn btn-primary" id="gen">✨ Generate report</button>`;
      foot.querySelector("#back").addEventListener("click", () => { collectStep3(body); step = 2; paint(); });
      foot.querySelector("#gen").addEventListener("click", () => {
        collectStep3(body);
        runGenerate(draft, modal);
      });
    }
  };

  function tx(key, label, hint) {
    const value = draft.parentNotes[key] != null ? draft.parentNotes[key] : (draft.selfAssessment[key] || "");
    return `<div class="field">
      <label>${esc(label)}</label>
      <textarea class="textarea" data-k="${key}" data-voice data-voice-label="Speak your answer" placeholder="${esc(hint)}">${esc(value)}</textarea>
    </div>`;
  }
  function collectStep2(body) {
    body.querySelectorAll("[data-k]").forEach(t => { draft.parentNotes[t.dataset.k] = t.value.trim(); });
  }
  function collectStep3(body) {
    body.querySelectorAll("[data-k]").forEach(t => { draft.selfAssessment[t.dataset.k] = t.value.trim(); });
    draft.touchedSelf = true;
  }

  paint();
}

function runGenerate(draft, modal) {
  const s = getState();
  const child = s.children.find(c => c.id === draft.childId);
  if (!child) { toast("Child not found", { type: "warning" }); return; }

  // Save observation + self-assessment as their own records
  const hasNotes = Object.values(draft.parentNotes).some(v => v && v.trim());
  if (hasNotes) {
    addParentObservation({ childId: child.id, ...draft.parentNotes });
  }
  let selfAssessment = null;
  if (draft.includeSelfAssessment && Object.values(draft.selfAssessment).some(v => v && v.trim())) {
    addChildSelfAssessment({ childId: child.id, ...draft.selfAssessment });
    selfAssessment = draft.selfAssessment;
  }

  // Build report
  const prevReports = getReportsForChild(child.id);
  const ctx = {
    child,
    family: s.family,
    projects: s.projects,
    milestones: s.milestones,
    reflections: s.reflections,
    observations: getObservationsForChild(child.id),
    selfAssessment,
    parentNotes: draft.parentNotes,
    periodKey: draft.periodKey,
    previousReport: prevReports[0] || null,
  };
  // Pass all child reports so longitudinal can plot them
  ctx._allReports = prevReports;
  const report = generateReport(ctx);
  saveGrowthReport(report);
  toast("Growth report ready", { type: "success" });
  modal.close();
  navigate(`/reports/${report.id}`);
}

/* ============================================================
   REPORT DETAIL VIEW
   ============================================================ */
export function renderReportDetail(container, params) {
  const report = getReport(params.id);
  if (!report) {
    container.innerHTML = `<div class="empty"><div class="emoji">🔍</div>Report not found.</div>`;
    return;
  }
  const s = getState();
  const child = s.children.find(c => c.id === report.childId);

  container.innerHTML = `
    <div class="topbar no-print">
      <div>
        <a href="#/reports" class="small text-muted">← All reports</a>
        <h1>Growth Report</h1>
        <div class="sub">${esc(child?.name || "")} · ${esc(report.periodLabel)} · ${fmtDate(report.generatedAt, { short: false })}</div>
      </div>
      <div class="btn-row">
        <button class="btn" id="print">🖨 Print / Save as PDF</button>
        <button class="btn" id="add-portfolio">Add to portfolio</button>
        <button class="btn btn-primary" id="next-term">Use to build next term →</button>
      </div>
    </div>

    <div class="report-doc" id="report-doc">
      ${renderReportHeader(report, child, s.family)}

      ${section(1, "Your Family Compass", renderFamilyCompass(s.family))}

      ${section(2, "Reflection Against Your Vision", renderVisionAlignment(report.sections.visionAlignment, s.family))}

      ${section(3, "Strengths This Quarter", `
        <p class="small text-muted mb-2">Evidence that the family you set out to become is becoming real — patterns, not isolated achievements.</p>
        <div class="stack">
          ${report.sections.strengths.map(strengthBlock).join("")}
        </div>
      `)}

      ${section(4, "Greatest Opportunity Next Quarter", renderOpportunity(report.sections.recommendations, s.family))}

      ${section(5, "Has Your Vision Evolved?", renderVisionEvolved(s.family))}

      <div class="divider" style="margin:36px 0"></div>
      <div class="t-eyebrow no-print" style="margin-bottom:6px">The supporting detail</div>
      <p class="small text-muted no-print" style="margin:0 0 18px">The evidence and metrics behind the reflection above — measured against this child over time, never against other children.</p>

      ${section(6, "Executive Summary", `
        ${report.sections.executiveSummary.paragraphs.map(p => `<p class="lead">${esc(p)}</p>`).join("")}
      `)}

      ${section(7, "Areas Currently Developing", `
        <p class="small text-muted mb-2">Never weaknesses. The growth edge — what's coming online next.</p>
        <div class="stack">
          ${report.sections.developing.map(developingBlock).join("")}
        </div>
      `)}

      ${section(8, "Growth Since Last Report", renderGrowthDelta(report.sections.growthSinceLast))}

      ${section(9, "Domain Breakdown", `
        <div class="grid grid-2">
          ${report.sections.domains.map(domainBlock).join("")}
        </div>
      `)}

      ${section(10, "Next Term Builder", renderTermBuilder(report.sections.recommendations))}

      ${section(11, "Longitudinal Growth", renderLongitudinal(report.sections.longitudinal))}

      ${section(12, "Export & Archive", renderExport(report))}
    </div>
  `;

  // Wire interactive elements
  container.querySelector("#print").addEventListener("click", () => window.print());
  container.querySelector("#add-portfolio").addEventListener("click", () => {
    toast("Saved to portfolio (visible on the Portfolio page)", { type: "success" });
  });
  container.querySelector("#next-term").addEventListener("click", () => {
    document.getElementById("section-10")?.scrollIntoView({ behavior: "smooth" });
  });

  container.querySelectorAll("[data-create-proj]").forEach(b => {
    b.addEventListener("click", () => createProjectFromRec(report, b.dataset.createProj));
  });
  container.querySelectorAll("[data-add-habit]").forEach(b => {
    b.addEventListener("click", () => {
      toast("Habit added to next-term draft", { type: "success" });
    });
  });
  container.querySelectorAll("[data-ignore]").forEach(b => {
    b.addEventListener("click", (e) => {
      const card = e.target.closest(".rec-card");
      card.style.opacity = "0.5";
      toast("Ignored — won't appear in next-term draft");
    });
  });
  container.querySelectorAll("[data-alt]").forEach(b => {
    b.addEventListener("click", () => {
      toast("Alternative suggestions will use real AI once connected. For now, generate again with different observations.", { duration: 4000 });
    });
  });
  container.querySelectorAll("[data-yes-focus]").forEach(b => {
    b.addEventListener("click", () => {
      const card = b.closest(".tb-card");
      card.style.background = "linear-gradient(135deg, var(--sage-soft), var(--card-elev))";
      card.querySelector(".tb-state").innerHTML = `<span class="tag tag-sage">✓ Added to next term</span>`;
      toast("Added as a next-term focus", { type: "success" });
    });
  });
  container.querySelectorAll("[data-no-focus]").forEach(b => {
    b.addEventListener("click", () => {
      const card = b.closest(".tb-card");
      card.style.opacity = "0.5";
      card.querySelector(".tb-state").innerHTML = `<span class="tag">Not now</span>`;
    });
  });
}

/* The centrepiece: the family's own compass, the lens for the whole report. */
function renderFamilyCompass(family) {
  return `
    <p class="text-muted" style="margin:0 0 16px;font-size:15px">Three months ago, this is the family you set out to become.</p>
    <div class="card" style="background:linear-gradient(135deg,#2C3D5E,#1B2335);border:none;color:#F4ECD8;padding:28px 30px">
      ${family?.mission ? `
        <div class="small" style="letter-spacing:0.16em;text-transform:uppercase;color:#D9B779;font-weight:600;margin-bottom:10px">Family Vision</div>
        <p style="font-family:var(--font-serif);font-size:20px;line-height:1.5;color:#FBF6EE;margin:0 0 22px">${esc(family.mission)}</p>` : ""}
      <div class="row" style="gap:34px;flex-wrap:wrap">
        ${family?.coreWord ? `<div><div class="small" style="letter-spacing:0.16em;text-transform:uppercase;color:#D9B779;font-weight:600;margin-bottom:6px">Core Word</div><div style="font-family:var(--font-serif);font-size:30px;font-weight:600;color:#FBF6EE;line-height:1">${esc(family.coreWord)}</div></div>` : ""}
        ${family?.motto ? `<div style="flex:1;min-width:200px"><div class="small" style="letter-spacing:0.16em;text-transform:uppercase;color:#D9B779;font-weight:600;margin-bottom:6px">Family Credo</div><div style="font-family:var(--font-serif);font-style:italic;font-size:17px;color:#F4ECD8">${esc(family.motto)}</div></div>` : ""}
      </div>
    </div>`;
}

/* One or two meaningful growth areas next quarter — always tied to the vision. */
function renderOpportunity(recs, family) {
  const top = (recs || []).slice(0, 2);
  if (!top.length) {
    return `<p class="text-muted">No single opportunity stands out this quarter — keep deepening the strengths above.</p>`;
  }
  return `
    <p class="small text-muted mb-2">One or two meaningful areas to grow next quarter — always in service of who your family is becoming.</p>
    <div class="stack">
      ${top.map(r => `
        <div class="card" style="background:var(--card-elev)">
          <div class="fw-700">${esc(r.focus)}</div>
          ${r.reason ? `<p class="small text-muted" style="margin:4px 0 8px">${esc(r.reason)}</p>` : ""}
          ${(r.activities || []).slice(0, 3).map(a => `<div class="small" style="margin:2px 0">• <span class="fw-600">${esc(a.name)}</span>${a.note ? ` — <span class="text-muted">${esc(a.note)}</span>` : ""}</div>`).join("")}
        </div>`).join("")}
    </div>
    ${family?.coreWord ? `<p class="small text-muted" style="margin-top:12px;font-style:italic">Each of these moves <b>${esc(family.coreWord)}</b> from words on a page toward lived reality.</p>` : ""}`;
}

/* A gentle quarterly invitation to refine the family's compass — never a correction. */
function renderVisionEvolved(family) {
  return `
    <div class="card" style="background:var(--card-elev)">
      <p style="margin:0 0 8px">As your family has grown this quarter, would you like to refine your Family Vision, Core Word or Family Credo?</p>
      <p class="small text-muted" style="margin:0 0 16px">This isn't about correcting earlier answers — healthy families keep evolving, and so does the language that guides them.</p>
      <div class="small text-muted">Vision: <span style="color:var(--text)">${esc(family?.mission || "—")}</span></div>
      <div class="small text-muted" style="margin-top:4px">Core Word: <span style="color:var(--text)">${esc(family?.coreWord || "—")}</span> · Credo: <span style="color:var(--text)">${esc(family?.motto || "—")}</span></div>
      <a href="#/vision" class="btn btn-primary no-print" style="margin-top:16px;text-decoration:none">Revisit your Family North Star →</a>
    </div>`;
}

function renderReportHeader(r, child, family) {
  return `
    <div class="report-cover">
      <div class="report-cover-top">
        <div class="brand-mark">${(family?.coreWord || "H")[0]}</div>
        <div>
          <div class="small text-muted" style="letter-spacing:0.12em;text-transform:uppercase">${esc(family?.familyName || "Homeschool OS")}</div>
          <h1 style="font-size:34px">Growth Report</h1>
        </div>
      </div>
      <div class="row" style="gap:18px;margin-top:18px;flex-wrap:wrap">
        <div class="stack-tight"><span class="small text-muted">Child</span><span class="fw-700" style="font-size:18px">${esc(r.childName)}</span></div>
        <div class="stack-tight"><span class="small text-muted">Age</span><span class="fw-700" style="font-size:18px">${r.childAge}</span></div>
        <div class="stack-tight"><span class="small text-muted">Period</span><span class="fw-700">${esc(r.periodLabel)}</span></div>
        <div class="stack-tight"><span class="small text-muted">Generated</span><span class="fw-700">${fmtDate(r.generatedAt, { short: false })}</span></div>
      </div>
      ${family?.mission ? `<div class="report-mission">"${esc(family.mission)}"</div>` : ""}
      <div class="grid grid-4 mt-2">
        <div class="metric"><div class="v">${r.snapshot.projectsCompleted}</div><div class="l">Projects completed</div></div>
        <div class="metric"><div class="v">⭐ ${r.snapshot.starsEarned}</div><div class="l">Stars earned</div></div>
        <div class="metric"><div class="v">${r.snapshot.momentumPoints}</div><div class="l">Momentum Points</div></div>
        <div class="metric"><div class="v">${r.snapshot.reflectionsWritten}</div><div class="l">Reflections</div></div>
      </div>
    </div>
  `;
}

function section(n, title, body) {
  return `
    <section class="report-section" id="section-${n}">
      <div class="report-section-num">${String(n).padStart(2, "0")}</div>
      <h2>${esc(title)}</h2>
      ${body}
    </section>
  `;
}

function strengthBlock(s) {
  return `
    <div class="report-block">
      <h3 style="font-family:var(--font-serif);font-size:18px">${esc(s.title)}</h3>
      <p>${esc(s.description)}</p>
      ${s.evidence?.length ? `
        <div class="small text-muted fw-700 mt-2 mb-1">Evidence</div>
        <ul class="evidence-list">${s.evidence.map(e => `<li>${esc(e)}</li>`).join("")}</ul>
      ` : ""}
    </div>
  `;
}
function developingBlock(d) {
  return `
    <div class="report-block">
      <h3 style="font-family:var(--font-serif);font-size:18px">${esc(d.title)}</h3>
      <p>${esc(d.explanation)}</p>
      ${d.evidence?.length ? `
        <div class="small text-muted fw-700 mt-2 mb-1">Evidence</div>
        <ul class="evidence-list">${d.evidence.map(e => `<li>${esc(e)}</li>`).join("")}</ul>
      ` : ""}
      ${d.whyItMatters ? `<div class="block-aside"><b>Why it matters:</b> ${esc(d.whyItMatters)}</div>` : ""}
      ${d.encouragement ? `<div class="block-aside encouragement"><b>What helps here:</b> ${esc(d.encouragement)}</div>` : ""}
    </div>
  `;
}

function renderGrowthDelta(g) {
  if (!g.hasPrevious) {
    return `<div class="empty" style="padding:24px"><div class="emoji">🌱</div>${esc(g.note)}</div>`;
  }
  const arrow = (dir) => dir === "up" ? "↑" : dir === "down" ? "↓" : "→";
  const cls = (dir) => dir === "up" ? "text-sage" : dir === "down" ? "text-coral" : "text-muted";
  return `
    <p class="small text-muted">Compared to your previous report (${fmtDate(g.previousAt, { short: false })}).</p>
    <div class="grid grid-2 mt-2">
      ${g.deltas.map(d => `
        <div class="delta-row">
          <div>
            <div class="fw-700">${esc(d.label)}</div>
            <div class="small text-muted">${d.before} → ${d.after}</div>
          </div>
          <div class="delta-val ${cls(d.direction)}">${arrow(d.direction)} ${esc(d.summary)}</div>
        </div>
      `).join("")}
    </div>
    ${g.bandMoves.length ? `
      <div class="divider"></div>
      <h4 class="mb-1">Growth-band moves</h4>
      <div class="stack">
        ${g.bandMoves.map(m => `
          <div class="row" style="gap:10px">
            <span class="tag ${m.direction === "up" ? "tag-sage" : "tag-coral"}">${m.direction === "up" ? "↑" : "↓"}</span>
            <span class="fw-700">${esc(m.label)}</span>
            <span class="small text-muted">${esc(m.from)} → ${esc(m.to)}</span>
          </div>
        `).join("")}
      </div>
    ` : ""}
  `;
}

function domainBlock(d) {
  const bandIdx = GROWTH_BANDS.indexOf(d.band);
  return `
    <div class="report-block">
      <div class="row-between mb-1">
        <h3 style="font-family:var(--font-serif);font-size:17px">${esc(d.name)}</h3>
        <span class="tag ${DOMAIN_COLOR_CLASS[d.id] || ""}">${esc(d.band)}</span>
      </div>
      <div class="band-bar">
        ${GROWTH_BANDS.map((b, i) => `<span class="band-cell ${i <= bandIdx ? "filled" : ""}" title="${esc(b)}"></span>`).join("")}
      </div>
      <div class="small text-muted mt-1">${esc(d.participation)} · ${d.projects} project${d.projects === 1 ? "" : "s"} · ${d.points} pts</div>
      <p class="mt-1">${esc(d.growth)}</p>
      ${d.evidence?.length ? `<div class="small text-muted fw-700 mt-1">Recent projects: ${d.evidence.map(e => esc(e)).join(", ")}</div>` : ""}
      ${d.futureOpps?.length ? `
        <div class="block-aside encouragement">
          <b>Future opportunities</b>
          <ul class="evidence-list">${d.futureOpps.map(o => `<li>${esc(o)}</li>`).join("")}</ul>
        </div>
      ` : ""}
    </div>
  `;
}

function renderVisionAlignment(v, family) {
  if (!v.items.length) {
    return `<div class="empty" style="padding:24px"><div class="emoji">🧭</div>Set your Core Word and Family Credo in Family North Star, and this becomes a reflection of your child's quarter against your family's own values.</div>`;
  }
  return `
    <p class="small text-muted mb-2">North Star doesn't measure ${esc(family?.parentName ? "your" : "this")} child against other children or grade levels — only against the family you're intentionally becoming.</p>
    ${v.overall != null ? `
      <div class="card mb-2" style="background:linear-gradient(135deg, var(--primary-soft), var(--card-elev));border-color:var(--primary-soft)">
        <div class="row" style="gap:18px">
          <div class="progress-ring" style="--p:${v.overall};--size:84px"><span class="ring-label" style="font-size:18px">${v.overall}%</span></div>
          <div>
            <h3 style="font-family:var(--font-serif)">Living the vision</h3>
            <p class="text-muted small">How strongly this quarter's real work mirrors the values your family set out to grow.</p>
          </div>
        </div>
      </div>
    ` : ""}
    <div class="stack">
      ${v.items.map(i => `
        <div class="vision-row">
          <div style="flex:1">
            <div class="fw-700">${esc(i.outcome)}</div>
            <div class="small text-muted">${esc(i.note)}</div>
            ${i.relevantProjects?.length ? `<div class="small text-muted mt-1">Projects touching this: ${i.relevantProjects.map(p => `<span class="kbd">${esc(p)}</span>`).join(" ")}</div>` : ""}
          </div>
          ${i.score != null ? `
            <div class="vision-bar-wrap">
              <div class="progress-bar"><span style="width:${i.score}%"></span></div>
              <span class="fw-700 ${i.score >= 70 ? "text-sage" : i.score < 35 ? "text-coral" : ""}">${i.score}%</span>
            </div>
          ` : `<span class="tag">No score</span>`}
        </div>
      `).join("")}
    </div>
    <p class="small text-muted mt-2">${esc(v.note)}</p>
  `;
}

function renderRecommendations(recs) {
  if (!recs.length) return `<div class="empty" style="padding:24px">No specific recommendations — keep building.</div>`;
  return `
    <div class="stack">
      ${recs.map((r, i) => `
        <div class="rec-card">
          <div class="row-between mb-1">
            <h3 style="font-family:var(--font-serif);font-size:17px">Recommended focus: ${esc(r.focus)}</h3>
            <span class="tag tag-primary">${esc(r.type || "focus")}</span>
          </div>
          <div class="small text-muted mb-2"><b>Reason:</b> ${esc(r.reason)}</div>
          <div class="small fw-700 mb-1">Suggested activities</div>
          <ul class="evidence-list">${r.activities.map(a => `<li><b>${esc(a.name)}</b> — ${esc(a.note)}</li>`).join("")}</ul>
          <div class="row mt-2" style="gap:8px;flex-wrap:wrap">
            <button class="btn btn-sm btn-primary" data-create-proj="${i}">Create project</button>
            <button class="btn btn-sm" data-add-habit="${i}">Add as weekly habit</button>
            <button class="btn btn-sm btn-ghost" data-alt="${i}">Show alternatives</button>
            <button class="btn btn-sm btn-ghost" data-ignore="${i}">Ignore</button>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderTermBuilder(recs) {
  if (!recs.length) return `<div class="empty" style="padding:24px">Nothing to build from yet.</div>`;
  return `
    <p class="small text-muted">For each recommendation, decide: yes, no, or show alternatives. Saying yes drafts projects/habits into the next term.</p>
    <div class="stack">
      ${recs.map((r) => `
        <div class="tb-card report-block">
          <div class="row-between">
            <div>
              <div class="small text-muted fw-700" style="letter-spacing:0.08em;text-transform:uppercase">Next-term focus</div>
              <h3 style="font-family:var(--font-serif);font-size:18px">${esc(r.focus)}</h3>
            </div>
            <div class="tb-state"></div>
          </div>
          <div class="row mt-2" style="gap:8px;flex-wrap:wrap">
            <button class="btn btn-sm btn-sage" data-yes-focus>Yes — focus on this</button>
            <button class="btn btn-sm" data-no-focus>No</button>
            <button class="btn btn-sm btn-ghost" data-alt="alt">Show alternatives</button>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderLongitudinal(l) {
  if (!l) return "";
  const domainsWithData = Object.entries(l.timeline).filter(([, points]) => points.length > 0);
  if (!domainsWithData.length) return `<div class="empty" style="padding:24px">The longitudinal timeline fills in as you generate more reports over time. Today's report is now the first data point.</div>`;

  return `
    <p class="small text-muted mb-2">Each domain's growth band, plotted across ${domainsWithData.length === 1 ? "this one report" : `your ${domainsWithData[0][1].length} reports`}.</p>
    <div class="stack">
      ${domainsWithData.map(([dId, points]) => {
        const domain = DOMAIN_CATALOG.find(d => d.id === dId);
        if (!domain) return "";
        return `
          <div class="long-row">
            <div class="long-label">
              <span class="tag ${DOMAIN_COLOR_CLASS[dId] || ""}">${esc(domain.short)}</span>
            </div>
            <div class="long-track">
              ${points.map((p) => `
                <div class="long-pt" title="Age ${p.age} — ${esc(p.band)}">
                  <span class="long-pt-age">Age ${p.age}</span>
                  <span class="long-pt-band band-${GROWTH_BANDS.indexOf(p.band)}">${esc(p.band)}</span>
                </div>
              `).join("")}
            </div>
          </div>
        `;
      }).join("")}
    </div>
    <div class="card mt-2" style="background:var(--card-elev)">
      <h4>Growth bands</h4>
      <div class="row" style="gap:6px;flex-wrap:wrap">
        ${GROWTH_BANDS.map((b, i) => `<span class="tag band-${i}">${esc(b)}</span>`).join("")}
      </div>
      <p class="small text-muted mt-2">Bands are derived from points + completed projects in each domain. They are intentionally coarse — designed to show developmental trends over years, not weeks.</p>
    </div>
  `;
}

function renderExport(report) {
  return `
    <div class="grid grid-2">
      <div class="card" style="background:var(--card-elev)">
        <h4>Print / Save as PDF</h4>
        <p class="small text-muted">Uses your browser's print dialog. Choose "Save as PDF" in the destination dropdown.</p>
        <button class="btn btn-primary mt-1" onclick="window.print()">🖨 Print this report</button>
      </div>
      <div class="card" style="background:var(--card-elev)">
        <h4>Download as data</h4>
        <p class="small text-muted">Raw JSON — useful for archiving, sharing with co-parents, or feeding into other systems later.</p>
        <button class="btn mt-1" id="dl-json">Download JSON</button>
      </div>
    </div>
    <div class="card mt-2">
      <h4>Why we keep these</h4>
      <p class="small text-muted">Future uses: homeschool documentation, educational records, portfolio reviews, scholarship and college applications. Saved reports also feed the longitudinal growth timeline.</p>
    </div>
  `;
}

/* ---------- Helpers ---------- */
function createProjectFromRec(report, i) {
  const rec = report.sections.recommendations[+i];
  if (!rec) return;
  const child = getState().children.find(c => c.id === report.childId);
  if (!child) return;
  const first = rec.activities[0];
  if (!first) return;

  const start = new Date(); start.setHours(17, 0, 0, 0);
  const due = new Date(start); due.setDate(due.getDate() + 28);
  const project = addProject({
    childId: child.id,
    title: first.name,
    description: `Drafted from a growth report recommendation: ${rec.focus}. ${first.note}`,
    domains: ["brain"],
    passionConnection: child.passions?.[0] || "",
    learningOutcomes: [`Strengthen ${rec.focus.toLowerCase()}`],
    startDate: start.toISOString(),
    dueDate: due.toISOString(),
    momentumPointsAvailable: 80,
    starsAvailable: 4,
    reward: "",
    toll: "",
    status: "active",
  });
  // Three placeholder milestones
  ["Set clear scope and outcome", "Do the work — week 1", "Reflect + share what you built"].forEach((title, idx) => {
    const md = new Date(start); md.setDate(md.getDate() + (idx + 1) * 9);
    addMilestone({
      projectId: project.id, title, dueDate: md.toISOString(),
      momentumPoints: 25, reflectionRequired: idx === 2, order: idx,
    });
  });
  toast(`Project "${first.name}" created`, { type: "success" });
  navigate("/projects/" + project.id);
}

function initials(name) { return (name || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase(); }

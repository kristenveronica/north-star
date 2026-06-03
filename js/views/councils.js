/* ============================================================
   councils.js — Family Councils (Layer 15 signature feature).
   ============================================================ */

import {
  getState, saveCouncil, getCouncil, listCouncils, deleteCouncil, setCouncilGoals,
} from "../store.js";
import { generateCouncilGuide, GOAL_TEMPLATES } from "../ai/councilEngine.js";
import { DOMAIN_CATALOG } from "../seed.js";
import { esc, icon, toast, fmtDate, confirmDialog, DOMAIN_COLOR_CLASS } from "../components/ui.js";
import { navigate } from "../router.js";
import { rerender } from "../app.js";

/* ============================================================
   LIST
   ============================================================ */
export function renderCouncils(container) {
  const s = getState();
  const councils = listCouncils();

  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Family Councils</h1>
        <div class="sub">Monthly + termly gatherings to celebrate, reflect, and plan together.</div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary btn-lg" id="gen-month">✨ Generate Monthly Council</button>
        <button class="btn btn-sage" id="gen-term">Generate Termly Council</button>
      </div>
    </div>

    <div class="card mb-3" style="background:linear-gradient(135deg, var(--primary-soft), var(--card-elev));border-color:var(--primary-soft)">
      <div class="row" style="gap:14px;align-items:flex-start">
        <div style="font-size:32px">🪑</div>
        <div style="flex:1">
          <h3 style="font-family:var(--font-serif)">The ritual that keeps a family aligned.</h3>
          <p>Generate the guide. Print it. Light a candle. Sit around the table. Walk through it together. Set the goals at the end. Repeat next month.</p>
        </div>
      </div>
    </div>

    ${councils.length === 0
      ? `<div class="empty"><div class="emoji">🪑</div><h3>No councils yet</h3><p>Generate your first one — the engine pulls together everything that's happened this month.</p></div>`
      : `<div class="grid grid-auto">${councils.map(councilCard).join("")}</div>`}
  `;
  container.querySelector("#gen-month").addEventListener("click", () => generateAndOpen("month"));
  container.querySelector("#gen-term").addEventListener("click", () => generateAndOpen("term"));
  container.querySelectorAll("[data-open-council]").forEach(b => b.addEventListener("click", () => navigate("/councils/" + b.dataset.openCouncil)));
  container.querySelectorAll("[data-del-council]").forEach(b => {
    b.addEventListener("click", async (e) => {
      e.stopPropagation();
      const ok = await confirmDialog({ title: "Delete this council?", message: "Cannot be undone.", confirmLabel: "Delete", danger: true });
      if (ok) { deleteCouncil(b.dataset.delCouncil); rerender(); }
    });
  });
}

function councilCard(c) {
  const total = c.snapshot?.momentumPoints || 0;
  return `
    <div class="card card-hover" data-open-council="${c.id}" style="cursor:pointer">
      <div class="row-between mb-1">
        <span class="tag tag-primary">${esc(c.periodLabel)}</span>
        <button class="btn btn-ghost btn-sm" data-del-council="${c.id}" title="Delete">✕</button>
      </div>
      <h3 style="font-family:var(--font-serif);font-size:18px">${fmtDate(c.generatedAt, { short: false })}</h3>
      <div class="divider"></div>
      <div class="row" style="gap:14px">
        <div class="stack-tight"><span class="small text-muted">Projects</span><span class="fw-700">${c.sections.projectsCompleted.length}</span></div>
        <div class="stack-tight"><span class="small text-muted">Momentum</span><span class="fw-700">${total}</span></div>
        <div class="stack-tight"><span class="small text-muted">Goals set</span><span class="fw-700">${(c.familyGoals || []).length}</span></div>
      </div>
    </div>
  `;
}

function generateAndOpen(periodKey) {
  const s = getState();
  const guide = generateCouncilGuide({
    family: s.family, children: s.children,
    projects: s.projects, milestones: s.milestones,
    reflections: s.reflections,
    observations: s.parentObservations || [],
    periodKey,
  });
  saveCouncil(guide);
  toast("Council guide ready ✨", { type: "success" });
  navigate("/councils/" + guide.id);
}

/* ============================================================
   DETAIL
   ============================================================ */
export function renderCouncilDetail(container, params) {
  const council = getCouncil(params.id);
  if (!council) {
    container.innerHTML = `<div class="empty">Council not found.</div>`;
    return;
  }
  const s = getState();
  const family = s.family;

  container.innerHTML = `
    <div class="topbar no-print">
      <div>
        <a href="#/councils" class="small text-muted">← All councils</a>
        <h1>Family Council</h1>
        <div class="sub">${esc(family?.familyName || "")} · ${esc(council.periodLabel)} · ${fmtDate(council.generatedAt, { short: false })}</div>
      </div>
      <div class="btn-row">
        <button class="btn" onclick="window.print()">🖨 Print / Save as PDF</button>
      </div>
    </div>

    <div class="report-doc">
      <div class="report-cover">
        <div class="report-cover-top">
          <div class="brand-mark">🪑</div>
          <div>
            <div class="small text-muted" style="letter-spacing:0.12em;text-transform:uppercase">Family Council Guide</div>
            <h1 style="font-size:34px">Gather. Celebrate. Plan.</h1>
          </div>
        </div>
        ${family?.motto ? `<div class="report-mission">"${esc(family.motto)}"</div>` : ""}
        <div class="grid grid-4 mt-2">
          <div class="metric"><div class="v">${council.sections.projectsCompleted.length}</div><div class="l">Projects completed</div></div>
          <div class="metric"><div class="v">${council.snapshot.momentumPoints}</div><div class="l">Momentum Points</div></div>
          <div class="metric"><div class="v">${council.snapshot.milestonesCompleted}</div><div class="l">Milestones</div></div>
          <div class="metric"><div class="v">${council.snapshot.reflectionsCount}</div><div class="l">Reflections</div></div>
        </div>
      </div>

      ${section("01", "Wins this period", `
        <div class="stack">
          ${council.sections.wins.map(w => `<div class="report-block"><p>${esc(w.text)}</p></div>`).join("")}
        </div>
      `)}

      ${section("02", "Projects completed", council.sections.projectsCompleted.length === 0
        ? `<div class="small text-muted">No projects finished this period — that's data too.</div>`
        : `<div class="stack">${council.sections.projectsCompleted.map(p => {
            const child = s.children.find(c => c.id === p.childId);
            return `
              <div class="report-block">
                <div class="row-between mb-1">
                  <div class="fw-700" style="font-family:var(--font-serif);font-size:17px">🏅 ${esc(p.title)}</div>
                  <span class="tag tag-sage">${p.points} pts</span>
                </div>
                <div class="small text-muted">${esc(child?.name || "")} · ${(p.domains || []).map(d => `<span class="tag ${DOMAIN_COLOR_CLASS[d] || ""}" style="margin-right:4px">${esc(d)}</span>`).join("")}</div>
              </div>`;
          }).join("")}</div>`)}

      ${section("03", "Strengths emerging", council.sections.strengthsEmerging.length === 0
        ? `<div class="small text-muted">Not enough activity yet to surface strong signals.</div>`
        : `<div class="stack">${council.sections.strengthsEmerging.map(st => `
            <div class="report-block">
              <div class="fw-700">${esc(st.name)}</div>
              <div class="small text-muted">${esc(st.evidence)}</div>
            </div>`).join("")}</div>`)}

      ${section("04", "Challenges developing", council.sections.challengesDeveloping.length === 0
        ? `<div class="small text-muted">Nothing pressing surfacing in the data this period.</div>`
        : `<div class="stack">${council.sections.challengesDeveloping.map(ch => `
            <div class="report-block">
              <div class="fw-700">${esc(ch.name)}</div>
              <div class="small text-muted">${esc(ch.evidence)}</div>
            </div>`).join("")}</div>`)}

      ${section("05", "Momentum earned", `
        <div class="stack">
          ${council.sections.momentumEarned.map(m => `
            <div class="row" style="gap:14px;padding:10px;border-radius:var(--r-md);background:var(--card-elev)">
              <div class="fw-700" style="min-width:120px">${esc(m.name)}</div>
              <div class="progress-bar" style="flex:1"><span style="width:${Math.min(100, m.points / 4)}%"></span></div>
              <span class="fw-700" style="min-width:70px;text-align:right">⭐ ${m.stars} · ${m.points} pts</span>
            </div>
          `).join("")}
        </div>
      `)}

      ${section("06", "Family Vision alignment", renderAlignment(council.sections.familyVisionAlignment, council.id))}

      ${section("07", "Suggested conversation topics", `
        <ol style="padding-left:20px;line-height:1.8">
          ${council.sections.suggestedTopics.map(t => `<li>${esc(t)}</li>`).join("")}
        </ol>
      `)}

      ${section("08", "Discussion questions to go around the table", `
        <ol style="padding-left:20px;line-height:1.8">
          ${council.sections.discussionQuestions.map(q => `<li>${esc(q)}</li>`).join("")}
        </ol>
      `)}

      ${section("09", "Set goals for the next period", renderGoalSetting(council))}
    </div>
  `;

  wireGoalSetting(container, council);
}

function section(n, title, body) {
  return `
    <section class="report-section">
      <div class="report-section-num">${esc(n)}</div>
      <h2>${esc(title)}</h2>
      ${body}
    </section>
  `;
}

function renderAlignment(v, councilId) {
  if (!v.items?.length) return `<div class="small text-muted">${esc(v.note || "Add desired outcomes in Family Vision to populate this section.")}</div>`;
  return `
    ${v.overall != null ? `
      <div class="card mb-2" style="background:var(--card-elev)">
        <div class="row" style="gap:18px">
          <div class="progress-ring" style="--p:${v.overall};--size:80px"><span class="ring-label">${v.overall}%</span></div>
          <div>
            <h4>Overall alignment this period</h4>
            <p class="text-muted small">How closely the family's actual activity reflected your declared vision.</p>
          </div>
        </div>
      </div>
    ` : ""}
    <div class="stack">
      ${v.items.map(i => `
        <div class="vision-row">
          <div style="flex:1">
            <div class="fw-700">${esc(i.outcome)}</div>
            <div class="small text-muted">${i.matchingCount} matching project${i.matchingCount === 1 ? "" : "s"}</div>
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
    ${v.items.some(i => i.score != null && i.score < 35) ? `
      <div class="suggestion-banner mt-2">
        <div class="label">Adjust next period?</div>
        ${v.items.filter(i => i.score != null && i.score < 35).slice(0, 2).map(i => `
          <div class="row mt-1" style="gap:8px;flex-wrap:wrap">
            <span style="flex:1">Would you like next month's projects to place greater emphasis on <b>${esc(i.outcome)}</b>?</span>
            <button class="btn btn-sm btn-sage" data-vision-yes>Yes</button>
            <button class="btn btn-sm" data-vision-no>No</button>
            <button class="btn btn-sm btn-ghost" data-vision-alt>Show alternatives</button>
          </div>
        `).join("")}
      </div>
    ` : ""}
  `;
}

function renderGoalSetting(council) {
  const existing = council.familyGoals || [];
  const byKind = {};
  existing.forEach(g => { (byKind[g.kind] ||= []).push(g); });
  return `
    <p class="small text-muted">Talk through these together. The system can draft projects from the goals you set.</p>
    <div class="stack mt-2">
      ${GOAL_TEMPLATES.map(t => `
        <div class="report-block">
          <div class="row-between mb-1">
            <div class="fw-700">${esc(t.label)}</div>
          </div>
          <textarea class="textarea" data-goal-kind="${t.kind}" data-voice data-voice-label="Speak the goal" placeholder="${esc(t.placeholder)}" rows="2">${esc((byKind[t.kind] || []).map(g => g.text).join("\n"))}</textarea>
        </div>
      `).join("")}
    </div>
    <div class="row mt-2" style="justify-content:flex-end">
      <button class="btn btn-primary" id="save-goals">Save goals</button>
    </div>
  `;
}

function wireGoalSetting(container, council) {
  container.querySelector("#save-goals")?.addEventListener("click", () => {
    const goals = [];
    container.querySelectorAll("[data-goal-kind]").forEach(t => {
      const kind = t.dataset.goalKind;
      t.value.split("\n").map(s => s.trim()).filter(Boolean).forEach(text => goals.push({ kind, text }));
    });
    setCouncilGoals(council.id, goals);
    toast(`${goals.length} goal${goals.length === 1 ? "" : "s"} saved`, { type: "success" });
    rerender();
  });

  container.querySelectorAll("[data-vision-yes]").forEach(b => b.addEventListener("click", () => toast("Logged — next-term draft will weight this outcome", { type: "success" })));
  container.querySelectorAll("[data-vision-no]").forEach(b => b.addEventListener("click", () => toast("OK — keeping the balance as-is")));
  container.querySelectorAll("[data-vision-alt]").forEach(b => b.addEventListener("click", () => toast("Alternatives use real AI once connected.", { duration: 3000 })));
}

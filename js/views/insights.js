/* ============================================================
   insights.js — Child Insights & Developmental Intelligence
   (Layer 14B). Premium feature.
   ============================================================ */

import {
  getState, setInsightsConfig, getObservationsForChild, getSelfAssessmentsForChild,
  saveInsightReport, getInsightReport, getInsightReportsForChild, deleteInsightReport,
  updateChild,
} from "../store.js";
import {
  deriveInsights, INSIGHTS_DISCLAIMER, FRAMEWORKS,
  ACTION_STYLES, ENERGY_STYLES, PROBLEM_STYLES,
} from "../ai/insightsEngine.js";
import { esc, icon, toast, openModal, confirmDialog, fmtDate, DOMAIN_COLOR_CLASS } from "../components/ui.js";
import { navigate } from "../router.js";
import { rerender } from "../app.js";

let _selectedChildId = null;

/* ============================================================
   MAIN VIEW (/insights)
   ============================================================ */
export function renderInsights(container, opts = {}) {
  const s = getState();
  const cfg = s.insightsConfig || {};
  // `opts.childId` scopes to one child (Children-hub tab); `opts.embedded` drops
  // this page's own topbar + child picker (the hub owns the child header).
  const embedded = !!opts.embedded;

  if (!cfg.premiumEnabled) {
    return renderUpgradeGate(container);
  }

  if (opts.childId) _selectedChildId = opts.childId;
  if (!_selectedChildId && s.children[0]) _selectedChildId = s.children[0].id;
  const child = s.children.find(c => c.id === _selectedChildId);

  container.innerHTML = `
    ${embedded ? `
    <div class="btn-row mb-2" style="justify-content:flex-end">
      <button class="btn" data-go="/insights-reports">${icon("report")} Insights Reports</button>
      <button class="btn btn-primary" id="generate-insight">✨ Generate Insights Report</button>
    </div>` : `
    <div class="topbar">
      <div>
        <h1>Child Insights</h1>
        <div class="sub">Developmental intelligence — observations, not labels.</div>
      </div>
      <div class="btn-row">
        <button class="btn" data-go="/insights-reports">${icon("report")} Insights Reports</button>
        <button class="btn btn-primary" id="generate-insight">✨ Generate Insights Report</button>
      </div>
    </div>`}

    <div class="card mb-2" style="background:linear-gradient(135deg, var(--sage-soft), var(--card-elev));border-color:var(--sage-soft)">
      <div class="row" style="gap:12px;align-items:flex-start">
        <div style="font-size:24px">🌱</div>
        <div style="flex:1">
          <div class="fw-700">${esc(INSIGHTS_DISCLAIMER)}</div>
          <div class="small text-muted mt-1">These observations are tools for understanding — for adjusting how you support your child. They do not define who your child is or will become.</div>
        </div>
      </div>
    </div>

    ${!embedded && s.children.length > 1 ? `
      <div class="row mb-2" style="gap:8px">
        ${s.children.map(c => `<button class="chip ${c.id === _selectedChildId ? "selected" : ""}" data-child="${c.id}">${esc(c.name)}</button>`).join("")}
      </div>
    ` : ""}

    ${child ? renderChildInsights(child, s) : `<div class="empty">Add a child first.</div>`}
  `;

  if (!embedded) {
    container.querySelectorAll("[data-child]").forEach(b => {
      b.addEventListener("click", () => { _selectedChildId = b.dataset.child; rerender(); });
    });
  }
  container.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => navigate(b.dataset.go)));
  container.querySelector("#generate-insight")?.addEventListener("click", () => generateAndOpenInsightsReport(child));
  container.querySelector("#save-birth")?.addEventListener("click", () => {
    const date = container.querySelector("#bd-date").value;
    const time = container.querySelector("#bd-time").value;
    const city = container.querySelector("#bd-city").value.trim();
    updateChild(child.id, { birthData: { date, time, city } });
    toast("Birth data saved (stays on this device)", { type: "success" });
    rerender();
  });
}

function renderChildInsights(child, s) {
  const cfg = s.insightsConfig || {};
  const insights = deriveInsights({
    child, family: s.family,
    projects: s.projects, milestones: s.milestones, reflections: s.reflections,
    observations: getObservationsForChild(child.id),
    selfAssessments: getSelfAssessmentsForChild(child.id),
    config: cfg,
  });
  const ss = insights.sections;

  return `
    <div class="grid" style="grid-template-columns: 2fr 1fr; gap:18px">
      <div class="stack">
        ${insightSection("Developmental Patterns", patternsBlock(ss.developmentalPatterns))}
        ${insightSection("Emerging Strengths", strengthsBlock(ss.emergingStrengths, child))}
        ${insightSection("Learning Preferences", prefsBlock(ss.learningPreferences))}
        ${insightSection("Motivational Drivers", driversBlock(ss.motivationalDrivers))}
        ${insightSection("Personality Lenses", lensesBlock(ss.personalityLenses))}
        ${insightSection("Emerging Challenges", challengesBlock(ss.emergingChallenges))}
        ${insightSection("AI Observations", aiBlock(ss.aiObservations))}
        ${ss.interpretive.length ? insightSection("Optional Interpretive Frameworks", interpretiveBlock(ss.interpretive)) : ""}
      </div>
      <div class="stack">
        <div class="card" style="background:var(--card-elev)">
          <h3>About this view</h3>
          <p class="small text-muted">Observations are derived from real behaviour: projects chosen, milestones completed, reflections written. The more your child does, the richer the signal.</p>
          <div class="divider"></div>
          <h4>Frameworks enabled</h4>
          <div class="chip-group">
            ${FRAMEWORKS.filter(f => cfg.frameworks?.[f.id]).map(f => `<span class="chip" style="cursor:default">${esc(f.name)}</span>`).join("") || `<span class="text-muted small">None enabled. Adjust in Settings.</span>`}
          </div>
          <div class="divider"></div>
          <a class="btn btn-sm" href="#/settings">Manage frameworks →</a>
        </div>

        <div class="card">
          <h3>Birth data (optional)</h3>
          <p class="small text-muted">Required only for Astrology / Human Design frameworks. Stored locally.</p>
          <div class="field"><label>Date of birth</label><input class="input" id="bd-date" type="date" value="${esc(child.birthData?.date || child.birthday || "")}"/></div>
          <div class="field"><label>Time of birth</label><input class="input" id="bd-time" type="time" value="${esc(child.birthData?.time || "")}"/></div>
          <div class="field"><label>City of birth</label><input class="input" id="bd-city" value="${esc(child.birthData?.city || "")}" placeholder="e.g. Wanaka, NZ"/></div>
          <button class="btn btn-primary btn-sm" id="save-birth">Save</button>
        </div>

        <div class="card">
          <h3>Growth Over Time</h3>
          ${ss.growthOverTime.snapshots.length === 0
            ? `<div class="small text-muted">Patterns will appear here as more activity accumulates.</div>`
            : `
              <p class="small text-muted">Top signals at age ${ss.growthOverTime.age}:</p>
              <div class="stack mt-1">
                ${ss.growthOverTime.snapshots.map(s => `
                  <div class="row-between">
                    <span class="fw-700">${esc(s.strength)}</span>
                    <span class="tag tag-${s.level === "Strong" ? "sage" : s.level === "Developing" ? "primary" : "sky"}">${esc(s.level)}</span>
                  </div>
                `).join("")}
              </div>
            `}
          <div class="divider"></div>
          <p class="small text-muted">A longitudinal map of these signals builds up across Insights Reports over the years.</p>
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
   UPGRADE GATE
   ============================================================ */
function renderUpgradeGate(container) {
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Child Insights</h1>
        <div class="sub">Developmental intelligence — observations, not labels.</div>
      </div>
    </div>

    <div class="card" style="max-width:780px;background:linear-gradient(135deg, var(--primary-soft), var(--card-elev));border-color:var(--primary-soft)">
      <h2 style="font-family:var(--font-serif)">A premium way to know your child more deeply.</h2>
      <p class="text-muted">${esc(INSIGHTS_DISCLAIMER)}</p>

      <div class="grid grid-2 mt-2">
        ${[
          ["Emerging Strengths", "Curiosity, persistence, creativity, leadership — surfaced from real evidence in their work."],
          ["Learning Preferences", "Hands-on, visual, project-based — observed across projects and reflections."],
          ["Motivational Drivers", "What energises them: autonomy, mastery, contribution, adventure…"],
          ["Personality Lenses", "Action, Energy and Problem-solving styles — original frameworks, never trademark labels."],
          ["Parent + AI Observations", "Your daily notes + behavioural pattern analysis side by side."],
          ["Longitudinal Map", "How this child has developed across years, not weeks."],
        ].map(([t, b]) => `<div><div class="fw-700">${esc(t)}</div><div class="small text-muted">${esc(b)}</div></div>`).join("")}
      </div>

      <div class="divider"></div>
      <h4>Optional interpretive frameworks</h4>
      <p class="small text-muted">Astrology, Human Design, archetypal patterns — fully optional, presented as reflective tools, never as objective truth.</p>

      <div class="row mt-2" style="gap:10px">
        <button class="btn btn-primary btn-lg" id="enable-premium">Enable Child Insights (free for MVP)</button>
        <a class="btn" href="#/">Maybe later</a>
      </div>
    </div>
  `;
  container.querySelector("#enable-premium").addEventListener("click", () => {
    setInsightsConfig({ premiumEnabled: true, disclaimerAcknowledged: true });
    toast("Child Insights enabled", { type: "success" });
    rerender();
  });
}

/* ============================================================
   SECTION BLOCKS
   ============================================================ */
function insightSection(title, body) {
  return `<div class="card"><h3 class="mb-2">${esc(title)}</h3>${body}</div>`;
}

function patternsBlock(items) {
  if (!items.length) return `<div class="small text-muted">Not enough activity to surface patterns yet.</div>`;
  return `<div class="stack">${items.map(i => `
    <div class="report-block">
      <div class="row-between">
        <div class="fw-700">${esc(i.pattern)}</div>
        <span class="tag ${i.confidence === "strong" ? "tag-sage" : i.confidence === "moderate" ? "tag-primary" : ""}">${esc(i.confidence)} signal</span>
      </div>
      ${i.evidence.length ? `<ul class="evidence-list mt-1">${i.evidence.map(e => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
    </div>
  `).join("")}</div>`;
}
function strengthsBlock(items, child) {
  if (!items.length) return `<div class="small text-muted">Strengths will surface as projects and reflections accumulate. Add more of either to enrich this.</div>`;
  return `<div class="stack">${items.map(s => `
    <div class="report-block">
      <div class="row-between mb-1">
        <div class="fw-700" style="font-family:var(--font-serif);font-size:17px">${esc(s.strength)}</div>
        <span class="tag tag-sage">${esc(s.confidence)} · ${s.signal}%</span>
      </div>
      ${s.evidence.length ? `<ul class="evidence-list">${s.evidence.map(e => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
    </div>
  `).join("")}</div>`;
}
function prefsBlock(items) {
  if (!items.length) return `<div class="small text-muted">Not enough variety yet to surface clear learning preferences.</div>`;
  return `<div class="stack">${items.map(p => `
    <div class="row" style="gap:14px">
      <div style="flex:1">
        <div class="fw-700">${esc(prefLabel(p.preference))}</div>
        <div class="small text-muted">${esc(p.evidence)}</div>
      </div>
      <div class="progress-bar" style="width:180px"><span style="width:${p.signal}%"></span></div>
      <span class="fw-700 small" style="width:48px;text-align:right">${p.signal}%</span>
    </div>
  `).join("")}</div>`;
}
function prefLabel(k) {
  const map = {
    "hands-on": "Hands-on",
    "visual": "Visual",
    "discussion-based": "Discussion-based",
    "reading-based": "Reading-based",
    "movement-based": "Movement-based",
    "self-directed": "Self-directed",
    "collaborative": "Collaborative",
    "project-based": "Project-based",
  };
  return map[k] || k;
}
function driversBlock(items) {
  if (!items.length) return `<div class="small text-muted">Drivers will emerge as more projects and reflections accumulate.</div>`;
  return `<div class="stack">${items.map(d => `
    <div class="row" style="gap:14px">
      <div style="flex:1"><span class="fw-700">${esc(cap(d.driver))}</span></div>
      <div class="progress-bar" style="width:180px"><span style="width:${d.signal}%"></span></div>
      <span class="fw-700 small" style="width:48px;text-align:right">${d.signal}%</span>
    </div>
  `).join("")}</div>`;
}
function lensesBlock(l) {
  return `
    ${lensRow("Action Style", l.action)}
    ${lensRow("Energy Style", l.energy)}
    ${lensRow("Problem-Solving Style", l.problem)}
    <p class="small text-muted mt-2">These are platform-owned frameworks. They name observed tendencies — not types. A child can shift across them over weeks and years.</p>
  `;
}
function lensRow(title, lenses) {
  return `
    <div class="mb-2">
      <div class="small text-muted fw-700 mb-1" style="letter-spacing:0.08em;text-transform:uppercase">${esc(title)}</div>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        ${lenses.map(l => `
          <div class="card" style="flex:1;min-width:160px;background:${l.lean === "primary" ? "linear-gradient(135deg, var(--gold-soft), var(--card-elev))" : l.lean === "secondary" ? "var(--card-elev)" : "var(--card)"};padding:12px">
            <div class="row-between mb-1">
              <div class="fw-700">${esc(l.name)}</div>
              <span class="tag ${l.lean === "primary" ? "tag-gold" : l.lean === "secondary" ? "tag-primary" : ""}">${esc(l.lean)}</span>
            </div>
            <div class="small text-muted">${esc(l.blurb)}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}
function challengesBlock(items) {
  if (!items.length) return `<div class="small text-muted">Nothing pressing surfacing from the data.</div>`;
  return `<div class="stack">${items.map(c => `
    <div class="report-block">
      <div class="row-between"><div class="fw-700">${esc(c.challenge)}</div><span class="tag">${esc(c.framing)}</span></div>
      ${c.evidence.length ? `<ul class="evidence-list mt-1">${c.evidence.map(e => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
    </div>
  `).join("")}</div>`;
}
function aiBlock(items) {
  return `<div class="stack">${items.map(n => `<p>${formatMarkdown(esc(n))}</p>`).join("")}</div>`;
}
function interpretiveBlock(blocks) {
  return `<div class="stack">${blocks.map(b => `
    <div class="report-block">
      <div class="fw-700" style="font-family:var(--font-serif);font-size:17px">${esc(b.framework)}</div>
      <p class="mt-1">${esc(b.summary)}</p>
      <div class="block-aside">${esc(b.caveat)}</div>
    </div>
  `).join("")}</div>`;
}
function formatMarkdown(s) {
  return s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ============================================================
   GENERATE + OPEN INSIGHTS REPORT
   ============================================================ */
function generateAndOpenInsightsReport(child) {
  const s = getState();
  const report = deriveInsights({
    child, family: s.family,
    projects: s.projects, milestones: s.milestones, reflections: s.reflections,
    observations: getObservationsForChild(child.id),
    selfAssessments: getSelfAssessmentsForChild(child.id),
    config: s.insightsConfig,
  });
  report.id = "ins_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
  saveInsightReport(report);
  toast("Insights report saved", { type: "success" });
  navigate("/insights-reports/" + report.id);
}

/* ============================================================
   INSIGHTS REPORTS — LIST
   ============================================================ */
export function renderInsightsReports(container) {
  const s = getState();
  if (!s.insightsConfig?.premiumEnabled) {
    navigate("/insights");
    return;
  }
  const reports = s.insightReports || [];

  container.innerHTML = `
    <div class="topbar">
      <div>
        <a href="#/insights" class="small text-muted">← Insights</a>
        <h1>Insights Reports</h1>
        <div class="sub">"What are we noticing about this child?" — saved across time.</div>
      </div>
    </div>

    ${reports.length === 0
      ? `<div class="empty"><div class="emoji">🌱</div>No insights reports yet. Generate one from the Insights view.</div>`
      : `<div class="grid grid-auto">
          ${reports.map(r => `
            <div class="card card-hover" data-open="${r.id}" style="cursor:pointer">
              <span class="tag tag-primary">Insights</span>
              <h3 style="font-family:var(--font-serif);font-size:17px" class="mt-1">${esc(r.childName)} · Age ${r.childAge}</h3>
              <div class="small text-muted">${fmtDate(r.generatedAt, { short: false })}</div>
              <div class="divider"></div>
              <div class="small text-muted">${(r.sections?.emergingStrengths || []).slice(0, 3).map(s => s.strength).join(" · ") || "—"}</div>
              <div class="row mt-2" style="gap:8px">
                <button class="btn btn-ghost btn-sm" data-del="${r.id}">Delete</button>
              </div>
            </div>
          `).join("")}
        </div>`}
  `;
  container.querySelectorAll("[data-open]").forEach(b => b.addEventListener("click", () => navigate("/insights-reports/" + b.dataset.open)));
  container.querySelectorAll("[data-del]").forEach(b => {
    b.addEventListener("click", async (e) => {
      e.stopPropagation();
      const ok = await confirmDialog({ title: "Delete this insights report?", message: "Cannot be undone.", confirmLabel: "Delete", danger: true });
      if (ok) { deleteInsightReport(b.dataset.del); rerender(); }
    });
  });
}

/* ============================================================
   INSIGHTS REPORTS — DETAIL
   ============================================================ */
export function renderInsightReportDetail(container, params) {
  const s = getState();
  const r = getInsightReport(params.id);
  if (!r) {
    container.innerHTML = `<div class="empty">Report not found.</div>`;
    return;
  }
  const ss = r.sections;
  const allReports = getInsightReportsForChild(r.childId);

  container.innerHTML = `
    <div class="topbar no-print">
      <div>
        <a href="#/insights-reports" class="small text-muted">← Insights reports</a>
        <h1>Insights Report</h1>
        <div class="sub">${esc(r.childName)} · Age ${r.childAge} · ${fmtDate(r.generatedAt, { short: false })}</div>
      </div>
      <div class="btn-row">
        <button class="btn" onclick="window.print()">🖨 Print / PDF</button>
      </div>
    </div>

    <div class="report-doc">
      <div class="report-cover">
        <div class="report-cover-top">
          <div class="brand-mark">i</div>
          <div>
            <div class="small text-muted" style="letter-spacing:0.12em;text-transform:uppercase">Child Insights</div>
            <h1 style="font-size:34px">"What are we noticing about ${esc(r.childName)}?"</h1>
          </div>
        </div>
        <div class="report-mission">${esc(r.disclaimer || INSIGHTS_DISCLAIMER)}</div>
      </div>

      ${section("Emerging Strengths", strengthsBlock(ss.emergingStrengths, { name: r.childName }))}
      ${section("Motivational Drivers", driversBlock(ss.motivationalDrivers))}
      ${section("Learning Preferences", prefsBlock(ss.learningPreferences))}
      ${section("Leadership Indicators", leadershipBlock(ss))}
      ${section("Creativity Indicators", creativityBlock(ss))}
      ${section("Communication Patterns", communicationBlock(ss))}
      ${section("Developmental Opportunities", developmentalOpportunitiesBlock(ss))}
      ${section("Parent Reflections", parentRefBlock(ss.parentObservations))}
      ${section("AI Insights", aiBlock(ss.aiObservations))}
      ${section("Personality Lenses", lensesBlock(ss.personalityLenses))}
      ${ss.interpretive.length ? section("Optional Interpretive Frameworks", interpretiveBlock(ss.interpretive)) : ""}
      ${section("Longitudinal Development Map", longitudinalBlock(allReports))}
    </div>
  `;
}

function section(title, body) { return `<section class="report-section"><h2>${esc(title)}</h2>${body}</section>`; }

function leadershipBlock(ss) {
  const ld = (ss.emergingStrengths || []).find(s => /Leadership|Communication|Initiative/i.test(s.strength));
  if (!ld) return `<div class="small text-muted">Not enough signal yet for clear leadership indicators.</div>`;
  return `<div class="report-block"><div class="fw-700">Observed in: ${esc(ld.strength)}</div><ul class="evidence-list">${ld.evidence.map(e => `<li>${esc(e)}</li>`).join("")}</ul></div>`;
}
function creativityBlock(ss) {
  const c = (ss.emergingStrengths || []).find(s => /Creativ|Storytelling|Problem/i.test(s.strength));
  if (!c) return `<div class="small text-muted">Creativity signals will surface as more build/make projects accumulate.</div>`;
  return `<div class="report-block"><div class="fw-700">Observed in: ${esc(c.strength)}</div><ul class="evidence-list">${c.evidence.map(e => `<li>${esc(e)}</li>`).join("")}</ul></div>`;
}
function communicationBlock(ss) {
  const c = (ss.emergingStrengths || []).find(s => /Communic|Storytelling/i.test(s.strength));
  const refSample = (ss.parentObservations || [])[0];
  return `
    ${c ? `<div class="report-block"><div class="fw-700">Observed in: ${esc(c.strength)}</div><ul class="evidence-list">${c.evidence.map(e => `<li>${esc(e)}</li>`).join("")}</ul></div>` : ""}
    ${refSample?.strengths ? `<div class="report-block"><div class="small text-muted fw-700 mb-1">Most recent parent observation</div><p>${esc(refSample.strengths)}</p></div>` : ""}
    ${!c && !refSample ? `<div class="small text-muted">Communication patterns will accumulate as reflections and presentations grow.</div>` : ""}
  `;
}
function developmentalOpportunitiesBlock(ss) {
  if (!(ss.emergingChallenges || []).length) return `<div class="small text-muted">No specific opportunities flagged at this snapshot.</div>`;
  return `<div class="stack">${ss.emergingChallenges.map(c => `
    <div class="report-block">
      <div class="fw-700">${esc(c.challenge)}</div>
      ${c.evidence.length ? `<ul class="evidence-list mt-1">${c.evidence.map(e => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
    </div>
  `).join("")}</div>`;
}
function parentRefBlock(obs) {
  if (!obs || !obs.length) return `<div class="small text-muted">No parent observations yet. Add some via the Growth Report wizard or in Settings.</div>`;
  return `<div class="stack">${obs.slice(0, 5).map(o => `
    <div class="report-block">
      <div class="small text-muted">${fmtDate(o.at, { short: false })}</div>
      ${o.strengths ? `<div><b>Strengths noticed:</b> ${esc(o.strengths)}</div>` : ""}
      ${o.growthObserved ? `<div><b>Growth observed:</b> ${esc(o.growthObserved)}</div>` : ""}
      ${o.challenges ? `<div><b>Challenges noticed:</b> ${esc(o.challenges)}</div>` : ""}
      ${o.concerns ? `<div><b>Concerns:</b> ${esc(o.concerns)}</div>` : ""}
      ${o.goalsNextTerm ? `<div><b>Goals for next term:</b> ${esc(o.goalsNextTerm)}</div>` : ""}
    </div>
  `).join("")}</div>`;
}
function longitudinalBlock(reports) {
  if (!reports || reports.length === 0) return `<div class="small text-muted">Today's report is the first data point. Future reports will plot here.</div>`;
  return `
    <p class="small text-muted">A timeline of top emerging strengths at each report.</p>
    <div class="stack mt-2">
      ${reports.map(r => `
        <div class="report-block">
          <div class="row-between mb-1">
            <div class="fw-700">Age ${r.childAge}</div>
            <div class="small text-muted">${fmtDate(r.generatedAt)}</div>
          </div>
          <div class="row" style="gap:6px;flex-wrap:wrap">
            ${(r.sections?.emergingStrengths || []).slice(0, 4).map(s => `<span class="tag tag-sage">${esc(s.strength)} · ${esc(s.confidence)}</span>`).join("") || `<span class="small text-muted">No strong signals at this snapshot.</span>`}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

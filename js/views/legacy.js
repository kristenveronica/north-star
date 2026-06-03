/* ============================================================
   legacy.js — Family Legacy Timeline (Layer 15).
   Aggregates every meaningful event into a printable family book.
   ============================================================ */

import { getState, listCouncils } from "../store.js";
import { DOMAIN_CATALOG } from "../seed.js";
import { esc, icon, fmtDate, DOMAIN_COLOR_CLASS } from "../components/ui.js";

export function renderLegacy(container) {
  const s = getState();
  const events = collectLegacyEvents(s);
  const totals = computeTotals(s);

  container.innerHTML = `
    <div class="topbar no-print">
      <div>
        <h1>Family Legacy</h1>
        <div class="sub">A growing record of who you became as a family.</div>
      </div>
      <div class="btn-row">
        <button class="btn" onclick="window.print()">🖨 Print Legacy Book</button>
        <button class="btn" id="dl-json">Download JSON</button>
      </div>
    </div>

    <div class="report-doc">
      <div class="report-cover">
        <div class="report-cover-top">
          <div class="brand-mark">${(s.family?.coreWord || "H")[0]}</div>
          <div>
            <div class="small text-muted" style="letter-spacing:0.12em;text-transform:uppercase">${esc(s.family?.familyName || "Our Family")}</div>
            <h1 style="font-size:34px">My Family Learning Journey</h1>
          </div>
        </div>
        ${s.family?.mission ? `<div class="report-mission">"${esc(s.family.mission)}"</div>` : ""}
        <div class="grid grid-4 mt-2">
          <div class="metric"><div class="v">${totals.projects}</div><div class="l">Projects completed</div></div>
          <div class="metric"><div class="v">${totals.points}</div><div class="l">Momentum Points</div></div>
          <div class="metric"><div class="v">${totals.reflections}</div><div class="l">Reflections</div></div>
          <div class="metric"><div class="v">${totals.councils}</div><div class="l">Family Councils</div></div>
        </div>
      </div>

      <section class="report-section">
        <div class="report-section-num">01</div>
        <h2>The family we are becoming</h2>
        ${s.family?.coreWord ? `
          <div class="card" style="background:linear-gradient(135deg, var(--primary-soft), var(--card-elev))">
            <div class="row" style="gap:18px;flex-wrap:wrap">
              <div>
                <div class="small text-muted" style="letter-spacing:0.1em;text-transform:uppercase">Core word</div>
                <div style="font-family:var(--font-serif);font-size:46px;font-weight:600;color:var(--primary-ink)">${esc(s.family.coreWord)}</div>
              </div>
              <div class="grid" style="grid-template-columns: repeat(${(s.family.acronym || []).length || 5}, minmax(0,1fr)); gap:10px; flex:1; min-width: 320px">
                ${(s.family.acronym || []).map(a => `
                  <div style="text-align:center">
                    <div class="brand-mark" style="margin:0 auto 6px">${esc(a.letter)}</div>
                    <div class="fw-600">${esc(a.meaning)}</div>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>
        ` : ""}
        ${(s.family?.desiredOutcomes || []).length ? `
          <div class="card mt-2">
            <h4>Our desired outcomes</h4>
            <ul style="padding-left:18px">${s.family.desiredOutcomes.map(o => `<li>${esc(o)}</li>`).join("")}</ul>
          </div>
        ` : ""}
      </section>

      <section class="report-section">
        <div class="report-section-num">02</div>
        <h2>The children of this family</h2>
        <div class="grid grid-2">
          ${s.children.map(c => `
            <div class="report-block">
              <div class="row" style="gap:12px;align-items:center;margin-bottom:8px">
                <div class="child-card-avatar avatar-${c.avatarIndex}">${initials(c.name)}</div>
                <div>
                  <div class="fw-700" style="font-family:var(--font-serif);font-size:18px">${esc(c.name)}</div>
                  <div class="small text-muted">Age ${c.age}${c.grade ? " · " + esc(c.grade) : ""}</div>
                </div>
              </div>
              ${(c.passions || []).length ? `<div class="chip-group">${c.passions.map(p => `<span class="chip" style="cursor:default">${esc(p)}</span>`).join("")}</div>` : ""}
              ${c.notes ? `<p class="mt-2 small">${esc(c.notes)}</p>` : ""}
            </div>
          `).join("")}
        </div>
      </section>

      <section class="report-section">
        <div class="report-section-num">03</div>
        <h2>The journey, in order</h2>
        ${events.length === 0 ? `<div class="small text-muted">The timeline fills as projects complete, reflections accumulate, and councils are held.</div>` : `
          <div class="legacy-timeline">
            ${events.map(e => legacyEventRow(e, s)).join("")}
          </div>
        `}
      </section>

      ${listCouncils().length ? `
        <section class="report-section">
          <div class="report-section-num">04</div>
          <h2>Family councils held</h2>
          <div class="stack">
            ${listCouncils().map(c => `
              <div class="report-block">
                <div class="row-between">
                  <div class="fw-700" style="font-family:var(--font-serif);font-size:17px">${esc(c.periodLabel)} · ${fmtDate(c.generatedAt, { short: false })}</div>
                  <span class="tag tag-sage">${(c.familyGoals || []).length} goals set</span>
                </div>
                <div class="small text-muted">${c.sections.projectsCompleted.length} projects · ${c.snapshot.momentumPoints} pts · ${c.snapshot.reflectionsCount} reflections</div>
                ${(c.familyGoals || []).length ? `
                  <ul class="evidence-list mt-1">
                    ${c.familyGoals.slice(0, 5).map(g => `<li><b>${esc(g.kind)}:</b> ${esc(g.text)}</li>`).join("")}
                  </ul>
                ` : ""}
              </div>
            `).join("")}
          </div>
        </section>
      ` : ""}

      <section class="report-section">
        <div class="report-section-num">05</div>
        <h2>Closing</h2>
        <p>This document is yours to keep. Future versions will add photos, audio reflections, video evidence and a downloadable book format. For now: print this page, archive it, and start a new chapter next term.</p>
      </section>
    </div>
  `;

  container.querySelector("#dl-json")?.addEventListener("click", () => downloadJSON(s));
}

/* ---------- Event collection ---------- */
function collectLegacyEvents(s) {
  const events = [];

  s.projects.filter(p => p.status === "completed").forEach(p => {
    events.push({
      type: "project", date: p.dueDate || p.createdAt,
      title: `🏅 ${p.title}`,
      child: s.children.find(c => c.id === p.childId),
      detail: p.description,
      domains: p.domains,
      points: p.momentumPointsEarned,
    });
  });

  s.reflections.forEach(r => {
    if ((r.response || "").length < 30) return; // only meaningful reflections in the legacy
    events.push({
      type: "reflection", date: r.createdAt,
      title: `📝 ${r.prompt}`,
      child: s.children.find(c => c.id === r.childId),
      detail: r.response,
    });
  });

  (s.growthReports || []).forEach(g => {
    events.push({
      type: "growth-report", date: g.generatedAt,
      title: `📊 Growth Report — ${g.periodLabel}`,
      child: s.children.find(c => c.id === g.childId),
      detail: g.sections?.executiveSummary?.paragraphs?.[0] || "",
    });
  });

  (s.insightReports || []).forEach(i => {
    events.push({
      type: "insight-report", date: i.generatedAt,
      title: `🔍 Insights Report — Age ${i.childAge}`,
      child: s.children.find(c => c.id === i.childId),
      detail: (i.sections?.emergingStrengths || []).slice(0, 3).map(s => s.strength).join(" · "),
    });
  });

  (s.familyCouncils || []).forEach(c => {
    events.push({
      type: "council", date: c.generatedAt,
      title: `🪑 Family Council — ${c.periodLabel}`,
      detail: c.sections?.wins?.map(w => w.text).join(" "),
    });
  });

  return events.sort((a, b) => new Date(b.date) - new Date(a.date));
}

function legacyEventRow(e, s) {
  const tagCls = e.type === "project" ? "tag-sage" :
                 e.type === "reflection" ? "tag-primary" :
                 e.type === "growth-report" ? "tag-plum" :
                 e.type === "insight-report" ? "tag-sky" :
                 e.type === "council" ? "tag-gold" : "";
  return `
    <div class="legacy-event">
      <div class="legacy-dot"></div>
      <div class="legacy-card">
        <div class="row-between">
          <div class="fw-700" style="font-family:var(--font-serif);font-size:16px">${esc(e.title)}</div>
          <div class="row" style="gap:6px">
            <span class="tag ${tagCls}">${esc(e.type.replace("-", " "))}</span>
            <span class="small text-muted">${fmtDate(e.date, { short: false })}</span>
          </div>
        </div>
        ${e.child ? `<div class="small text-muted">${esc(e.child.name)}</div>` : ""}
        ${e.detail ? `<p class="small mt-1">${esc((e.detail || "").slice(0, 220))}${(e.detail || "").length > 220 ? "…" : ""}</p>` : ""}
        ${e.domains?.length ? `<div class="row mt-1" style="gap:6px;flex-wrap:wrap">${e.domains.map(d => `<span class="tag ${DOMAIN_COLOR_CLASS[d] || ""}">${esc(d)}</span>`).join("")}</div>` : ""}
        ${e.points ? `<div class="small text-muted mt-1">${e.points} Momentum Points</div>` : ""}
      </div>
    </div>
  `;
}

function computeTotals(s) {
  return {
    projects: s.projects.filter(p => p.status === "completed").length,
    points: s.projects.reduce((sum, p) => sum + (p.momentumPointsEarned || 0), 0),
    reflections: s.reflections.length,
    councils: (s.familyCouncils || []).length,
  };
}

function downloadJSON(s) {
  const payload = {
    family: s.family,
    children: s.children,
    projects: s.projects,
    reflections: s.reflections,
    growthReports: s.growthReports,
    insightReports: s.insightReports,
    familyCouncils: s.familyCouncils,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `family-learning-journey-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function initials(name) { return (name || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase(); }

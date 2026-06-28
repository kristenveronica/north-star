/* ============================================================
   reflections.js — Reflections home (Phase 1 placeholder).

   The Reflection System (monthly/quarterly/annual) generates no AI yet.
   This page proves the *infrastructure*: it reads the family's rhythm and
   shows the dynamically-derived school year, quarter, learning budget and
   the upcoming reflection schedule — the dates everything will hang off.
   Real reflections will render here once generation is layered on.
   ============================================================ */

import { getState, getReflectionReports } from "../store.js";
import { esc } from "../components/ui.js";
import { reflectionSchedule, monthName } from "../lib/schoolYear.js";
import { learningCapacity } from "../lib/learningCapacity.js";

const fmt = (d) => d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

export function renderReflections(container) {
  const s = getState();
  const rhythm = s.family?.rhythm || {};
  const sched = reflectionSchedule(rhythm, new Date());
  const cap = learningCapacity(rhythm);
  const children = s.children || [];
  const hasRhythm = !!(rhythm.schoolYearStartMonth && rhythm.daysPerWeek);

  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Reflections</h1>
        <div class="sub">North Star doesn't produce report cards — it produces reflections that notice who your child is becoming.</div>
      </div>
    </div>

    ${!hasRhythm ? `
      <div class="card" style="background:var(--card-elev)">
        <p style="margin:0">Set your <a href="#/family-settings">Family Rhythm</a> first — your school year and learning rhythm set the timing for every monthly, quarterly and annual reflection.</p>
      </div>` : ""}

    <div class="card" style="background:linear-gradient(135deg, var(--midnight-deep), var(--midnight));color:var(--starlight);border-color:transparent;padding:26px 30px">
      <div class="small" style="letter-spacing:0.16em;text-transform:uppercase;opacity:0.75">Your North Star year</div>
      <h2 style="color:var(--starlight);font-family:var(--font-serif);margin:6px 0 14px">${esc(sched.schoolYear.label)} · ${monthName(rhythm.schoolYearStartMonth || sched.schoolYear.startMonth)}–${monthName(rhythm.schoolYearEndMonth || sched.schoolYear.endMonth)}</h2>
      <div class="grid grid-4" style="gap:14px">
        <div><div class="small" style="opacity:0.7">Current quarter</div><div class="fw-700" style="font-size:18px">${sched.currentQuarter ? sched.currentQuarter.label : "On a break"}</div></div>
        <div><div class="small" style="opacity:0.7">Weekly learning budget</div><div class="fw-700" style="font-size:18px">${cap.weeklyBudgetHours} hrs</div></div>
        <div><div class="small" style="opacity:0.7">Next quarterly</div><div class="fw-700" style="font-size:18px">${fmt(sched.nextQuarterly)}</div></div>
        <div><div class="small" style="opacity:0.7">Annual celebration</div><div class="fw-700" style="font-size:18px">${fmt(sched.annualCelebration)}</div></div>
      </div>
    </div>

    <h2 class="mt-3 mb-2">Reflection schedule</h2>
    <div class="grid grid-auto mb-3">
      ${reflectionCard("Monthly", "A short, encouraging snapshot of the month.", sched.nextMonthly, fmt)}
      ${reflectionCard("Quarterly", "Zoom out — the emerging themes and patterns.", sched.nextQuarterly, fmt)}
      ${reflectionCard("Annual", "Your North Star Year — a celebration, not a report.", sched.nextAnnual, fmt)}
    </div>

    <h2 class="mt-3 mb-2">By child</h2>
    ${children.length === 0
      ? `<div class="empty">Add a child to begin their reflection journey.</div>`
      : `<div class="stack">${children.map(c => childReflectionRow(c, getReflectionReports(c.id), fmt)).join("")}</div>`}
  `;
}

function reflectionCard(title, desc, date, fmt) {
  return `
    <div class="card">
      <div class="small text-muted fw-700" style="letter-spacing:0.1em;text-transform:uppercase">${esc(title)}</div>
      <p class="small text-muted" style="margin:6px 0 10px">${esc(desc)}</p>
      <div class="divider"></div>
      <div class="small text-muted">Next scheduled</div>
      <div class="fw-700" style="font-family:var(--font-serif);font-size:18px">${fmt(date)}</div>
    </div>`;
}

function childReflectionRow(child, reports, fmt) {
  const ready = reports.filter(r => r.status === "ready");
  return `
    <div class="card">
      <div class="row" style="gap:12px;align-items:center">
        <div class="child-card-avatar avatar-${child.avatarIndex}" style="width:36px;height:36px;font-size:14px">${initials(child.name)}</div>
        <div style="flex:1"><div class="fw-700">${esc(child.name)}</div>
          <div class="small text-muted">${ready.length ? `${ready.length} reflection${ready.length > 1 ? "s" : ""} ready` : "Reflections begin as the journey builds — nothing to read just yet."}</div>
        </div>
      </div>
      ${ready.length ? `<div class="stack mt-2">${ready.slice(0, 6).map(r => `
        <div class="row-between" style="padding:8px 0;border-top:1px solid var(--divider)">
          <span>${esc((r.type || "").replace(/^./, m => m.toUpperCase()))}${r.quarter ? ` · Q${r.quarter}` : ""} ${r.schoolYear ? `· ${esc(r.schoolYear)}` : ""}</span>
          <span class="small text-muted">${fmt(r.generatedDate)}</span>
        </div>`).join("")}</div>` : ""}
    </div>`;
}

function initials(name) {
  return (name || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

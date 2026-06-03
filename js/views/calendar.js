/* ============================================================
   calendar.js — Month grid showing projects + milestones.
   Filterable by child and domain.
   ============================================================ */

import { getState } from "../store.js";
import { DOMAIN_CATALOG } from "../seed.js";
import { esc, fmtDate } from "../components/ui.js";
import { navigate } from "../router.js";
import { rerender } from "../app.js";

let _viewDate = new Date();
let _childFilter = "all";
let _domainFilter = "all";

export function renderCalendar(container) {
  const s = getState();
  const year = _viewDate.getFullYear();
  const month = _viewDate.getMonth();
  const first = new Date(year, month, 1);
  const startWeekday = (first.getDay() + 6) % 7; // Mon-start
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const events = collectEvents(s, year, month);

  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Calendar</h1>
        <div class="sub">All projects, milestones and term events at a glance.</div>
      </div>
      <div class="btn-row">
        <button class="btn btn-sm" id="prev">←</button>
        <span class="fw-700" style="min-width:160px;text-align:center">${first.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
        <button class="btn btn-sm" id="next">→</button>
        <button class="btn btn-sm" id="today">Today</button>
      </div>
    </div>

    <div class="row mb-2" style="gap:8px;flex-wrap:wrap">
      <button class="chip ${_childFilter === "all" ? "selected" : ""}" data-cf="all">All children</button>
      ${s.children.map(c => `<button class="chip ${_childFilter === c.id ? "selected" : ""}" data-cf="${c.id}">${esc(c.name)}</button>`).join("")}
      <div style="width:1px;background:var(--border);margin:0 4px;align-self:stretch"></div>
      <button class="chip ${_domainFilter === "all" ? "selected" : ""}" data-df="all">All domains</button>
      ${DOMAIN_CATALOG.filter(d => !d.optional || s.family.faithEnabled).map(d =>
        `<button class="chip ${_domainFilter === d.id ? "selected" : ""}" data-df="${d.id}">${esc(d.short)}</button>`).join("")}
    </div>

    <div class="cal-grid">
      ${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => `<div class="cal-head">${d}</div>`).join("")}
      ${renderCells(year, month, daysInMonth, startWeekday, events)}
    </div>
  `;

  container.querySelector("#prev").addEventListener("click", () => { _viewDate = new Date(year, month - 1, 1); rerender(); });
  container.querySelector("#next").addEventListener("click", () => { _viewDate = new Date(year, month + 1, 1); rerender(); });
  container.querySelector("#today").addEventListener("click", () => { _viewDate = new Date(); rerender(); });

  container.querySelectorAll("[data-cf]").forEach(b => b.addEventListener("click", () => { _childFilter = b.dataset.cf; rerender(); }));
  container.querySelectorAll("[data-df]").forEach(b => b.addEventListener("click", () => { _domainFilter = b.dataset.df; rerender(); }));

  container.querySelectorAll("[data-open-proj]").forEach(b => b.addEventListener("click", () => navigate("/projects/" + b.dataset.openProj)));
}

function renderCells(year, month, daysInMonth, startWeekday, events) {
  const today = new Date();
  const cells = [];
  // padding from previous month
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = startWeekday; i > 0; i--) {
    cells.push(`<div class="cal-cell muted"><div class="d">${prevMonthDays - i + 1}</div></div>`);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
    const dayKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayEvents = events[dayKey] || [];
    cells.push(`
      <div class="cal-cell ${isToday ? "today" : ""}">
        <div class="d">${day}</div>
        ${dayEvents.slice(0, 3).map(e => `<span class="cal-event dom-${e.domain || "brain"}" data-open-proj="${e.projectId}" style="cursor:pointer" title="${esc(e.tooltip)}">${esc(e.label)}</span>`).join("")}
        ${dayEvents.length > 3 ? `<span class="cal-event" style="background:var(--bg-2);color:var(--text-muted)">+${dayEvents.length - 3} more</span>` : ""}
      </div>
    `);
  }
  // pad to 6 rows (42 cells)
  while (cells.length % 7 !== 0 || cells.length < 35) {
    cells.push(`<div class="cal-cell muted"></div>`);
  }
  return cells.join("");
}

function collectEvents(s, year, month) {
  const out = {};
  const add = (date, ev) => {
    if (!date) return;
    const d = new Date(date);
    if (d.getFullYear() !== year || d.getMonth() !== month) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    (out[key] ||= []).push(ev);
  };

  s.projects.forEach(p => {
    if (_childFilter !== "all" && p.childId !== _childFilter) return;
    if (_domainFilter !== "all" && !(p.domains || []).includes(_domainFilter)) return;
    const child = s.children.find(c => c.id === p.childId);
    add(p.dueDate, {
      projectId: p.id, domain: p.domains?.[0],
      label: `★ ${(child?.name || "")[0] || ""} · ${p.title}`,
      tooltip: `${p.title} due (${child?.name})`,
    });
  });

  s.milestones.forEach(m => {
    const proj = s.projects.find(p => p.id === m.projectId);
    if (!proj) return;
    if (_childFilter !== "all" && proj.childId !== _childFilter) return;
    if (_domainFilter !== "all" && !(proj.domains || []).includes(_domainFilter)) return;
    const child = s.children.find(c => c.id === proj.childId);
    add(m.dueDate, {
      projectId: proj.id, domain: proj.domains?.[0],
      label: `${(child?.name || "")[0] || ""} · ${m.title}`,
      tooltip: `${m.title} (${proj.title})`,
    });
  });

  return out;
}

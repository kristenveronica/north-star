/* ============================================================
   calendar.js — Month grid showing projects + milestones,
   plus read-only events from subscribed external calendars.
   Filterable by child.
   ============================================================ */

import { getState } from "../store.js";
import { esc, fmtDate, childColor, openModal, toast, confirmDialog } from "../components/ui.js";
import { navigate } from "../router.js";
import { rerender } from "../app.js";
import { listFeeds, addFeed, removeFeed, fetchExternalEvents } from "../lib/calendarFeeds.js";

let _viewDate = new Date();
let _childFilter = "all";

// External (subscribed) events, cached per visible month so navigating months
// refetches but a rerender within a month does not.
let _external = [];
let _externalKey = "";

export function renderCalendar(container) {
  const s = getState();
  const year = _viewDate.getFullYear();
  const month = _viewDate.getMonth();
  const first = new Date(year, month, 1);
  const startWeekday = (first.getDay() + 6) % 7; // Mon-start
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const events = collectEvents(s, year, month);
  addExternalEvents(events, year, month);

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
        <button class="btn btn-sm" id="feeds" title="Connect Google, Apple or other calendars">🔗 Calendars</button>
      </div>
    </div>

    ${s.children.length > 1 ? `<div class="row mb-2" style="gap:8px;flex-wrap:wrap">
      <button class="chip ${_childFilter === "all" ? "selected" : ""}" data-cf="all">All children</button>
      ${s.children.map(c => `<button class="chip ${_childFilter === c.id ? "selected" : ""}" data-cf="${c.id}">${esc(c.name)}</button>`).join("")}
    </div>` : ""}

    <div class="cal-grid">
      ${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => `<div class="cal-head">${d}</div>`).join("")}
      ${renderCells(year, month, daysInMonth, startWeekday, events)}
    </div>
  `;

  container.querySelector("#prev").addEventListener("click", () => { _viewDate = new Date(year, month - 1, 1); rerender(); });
  container.querySelector("#next").addEventListener("click", () => { _viewDate = new Date(year, month + 1, 1); rerender(); });
  container.querySelector("#today").addEventListener("click", () => { _viewDate = new Date(); rerender(); });
  container.querySelector("#feeds").addEventListener("click", openFeedsManager);

  container.querySelectorAll("[data-cf]").forEach(b => b.addEventListener("click", () => { _childFilter = b.dataset.cf; rerender(); }));
  container.querySelectorAll("[data-open-proj]").forEach(b => b.addEventListener("click", () => navigate("/projects/" + b.dataset.openProj)));

  // Fetch external events for this month (once per month); refresh when they land.
  const monthKey = `${year}-${month}`;
  if (_externalKey !== monthKey) {
    _externalKey = monthKey;
    _external = [];
    const winFrom = new Date(year, month - 1, 1);
    const winTo = new Date(year, month + 2, 0);
    fetchExternalEvents({ from: winFrom, to: winTo }).then(({ events: ext }) => {
      _external = ext || [];
      if (_external.length) rerender();
    });
  }
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
        ${dayEvents.slice(0, 3).map(e => {
          if (e.external) {
            const col = e.color || "#8a8f98";
            return `<span class="cal-event" style="background:${col}1a;color:var(--text-muted);border-left:3px solid ${col}" title="${esc(e.tooltip)}">${esc(e.label)}</span>`;
          }
          const col = childColor(e.avatarIndex);
          return `<span class="cal-event" data-open-proj="${e.projectId}" style="cursor:pointer;background:${col}22;color:var(--text);border-left:3px solid ${col}" title="${esc(e.tooltip)}">${esc(e.label)}</span>`;
        }).join("")}
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
    const child = s.children.find(c => c.id === p.childId);
    add(p.dueDate, {
      projectId: p.id, avatarIndex: child?.avatarIndex,
      label: `★ ${(child?.name || "")[0] || ""} · ${p.title}`,
      tooltip: `${p.title} due (${child?.name})`,
    });
  });

  s.milestones.forEach(m => {
    const proj = s.projects.find(p => p.id === m.projectId);
    if (!proj) return;
    if (_childFilter !== "all" && proj.childId !== _childFilter) return;
    const child = s.children.find(c => c.id === proj.childId);
    add(m.dueDate, {
      projectId: proj.id, avatarIndex: child?.avatarIndex,
      label: `${(child?.name || "")[0] || ""} · ${m.title}`,
      tooltip: `${m.title} (${proj.title})`,
    });
  });

  return out;
}

// Merge subscribed external-calendar events into the day buckets. External
// events belong to the family (not a child), so they show under any filter.
function addExternalEvents(out, year, month) {
  _external.forEach(e => {
    const d = new Date(e.start);
    if (d.getFullYear() !== year || d.getMonth() !== month) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const time = e.allDay ? "" : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) + " ";
    (out[key] ||= []).push({
      external: true, color: e.color,
      label: `${time}${e.title}`,
      tooltip: `${e.title}${e.location ? " · " + e.location : ""} — ${e.feedLabel}`,
    });
  });
}

/* ---------- Connected calendars manager ---------- */

async function openFeedsManager() {
  const modal = openModal({
    title: "Connected calendars",
    body: `<div id="feeds-body"><p class="text-muted">Loading…</p></div>`,
  });
  const body = modal.root.querySelector("#feeds-body");

  async function refresh() {
    const feeds = await listFeeds();
    body.innerHTML = `
      <p class="text-muted" style="margin-top:0">
        Subscribe to a calendar to see its events here — read-only, alongside your projects and milestones.
      </p>

      ${feeds.length ? `<div class="stack" style="gap:8px;margin:12px 0">
        ${feeds.map(f => `
          <div class="row" style="justify-content:space-between;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--border);border-radius:10px">
            <div style="min-width:0">
              <div class="fw-700" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.label)}</div>
              <div class="text-muted" style="font-size:.8rem">
                ${f.last_error ? `⚠️ ${esc(f.last_error)}` : f.last_synced_at ? `Synced ${esc(fmtDate(f.last_synced_at))}` : "Not synced yet"}
              </div>
            </div>
            <button class="btn btn-ghost btn-sm" data-remove="${f.id}">Remove</button>
          </div>`).join("")}
      </div>` : ""}

      <div class="stack" style="gap:8px;margin-top:12px">
        <label class="fw-700" style="font-size:.85rem">Add a calendar</label>
        <input id="feed-label" class="input" placeholder="Name (e.g. Mum's Google Calendar)" />
        <input id="feed-url" class="input" placeholder="Paste the secret iCal / ICS URL" />
        <button class="btn btn-primary btn-sm" id="feed-add" style="align-self:flex-start">Add calendar</button>
      </div>

      <details style="margin-top:14px">
        <summary class="text-muted" style="cursor:pointer;font-size:.85rem">Where do I find that link?</summary>
        <div class="text-muted" style="font-size:.85rem;margin-top:8px;line-height:1.5">
          <strong>Google Calendar:</strong> Settings → your calendar → “Integrate calendar” → copy the <em>Secret address in iCal format</em>.<br>
          <strong>Apple / iCloud:</strong> in Calendar, right-click the calendar → Share → make it a <em>Public Calendar</em> → copy the link.<br>
          <strong>Outlook:</strong> Settings → Calendar → Shared calendars → publish → copy the <em>ICS</em> link.<br>
          It’s read-only: nothing you do here changes the original calendar.
        </div>
      </details>
    `;

    body.querySelector("#feed-add").addEventListener("click", async () => {
      const label = body.querySelector("#feed-label").value;
      const url = body.querySelector("#feed-url").value;
      try {
        await addFeed({ label, url });
        toast("Calendar added — loading its events.");
        _externalKey = ""; // force a refetch on next render
        await refresh();
        rerender();
      } catch (e) {
        toast(e.message || "Couldn't add that calendar.", { type: "error", duration: 4200 });
      }
    });

    body.querySelectorAll("[data-remove]").forEach(b => b.addEventListener("click", async () => {
      const ok = await confirmDialog({
        title: "Remove calendar?",
        message: "This stops showing its events here. The original calendar is untouched.",
        confirmLabel: "Remove", danger: true,
      });
      if (!ok) return;
      try {
        await removeFeed(b.dataset.remove);
        _externalKey = "";
        await refresh();
        rerender();
      } catch (e) {
        toast(e.message || "Couldn't remove that.", { type: "error" });
      }
    }));
  }

  refresh();
}

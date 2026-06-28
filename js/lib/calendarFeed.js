/* ============================================================
   calendarFeed.js — Unified calendar event model (foundation).

   The calendar should feel "alive": one master stream that merges
   projects, milestones, travel, reflection dates, celebrations and the
   family's own activities (dance, sport, music, church, community…),
   plus — in future — imports from Google/Apple/Outlook.

   This pure aggregator is that single source of truth. The existing
   calendar view can adopt buildCalendarFeed() incrementally; external
   integrations land as additional sources writing `calendar_events`
   rows (see migration 0013) without changing this contract.
   ============================================================ */

import { reflectionSchedule } from "./schoolYear.js";

export const EVENT_TYPES = [
  "project", "milestone", "travel", "reflection", "celebration",
  "event", "dance", "sport", "music", "church", "community", "external",
];

const isoFromDateOnly = (s) => {
  if (!s) return null;
  // "YYYY-MM-DD" → local midday ISO (avoids timezone day-shift)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00`).toISOString() : new Date(s).toISOString();
};

/**
 * @param {object} state  full store state
 * @param {{from?:string|Date, to?:string|Date}} range  optional window
 * @returns normalized, date-sorted events:
 *   { id, type, title, date, end?, childId?, allDay?, source, meta }
 */
export function buildCalendarFeed(state, { from, to } = {}) {
  const events = [];
  const fromT = from ? new Date(from).getTime() : -Infinity;
  const toT = to ? new Date(to).getTime() : Infinity;
  const push = (e) => {
    if (!e.date) return;
    const t = new Date(e.date).getTime();
    if (t >= fromT && t <= toT) events.push(e);
  };

  // Projects + milestones (due dates)
  (state.projects || []).forEach(p =>
    push({ id: `proj:${p.id}`, type: "project", title: p.title, date: p.dueDate, childId: p.childId, source: "project", meta: { projectId: p.id } }));
  (state.milestones || []).forEach(m => {
    const proj = (state.projects || []).find(x => x.id === m.projectId);
    push({ id: `mile:${m.id}`, type: "milestone", title: m.title, date: m.dueDate, childId: proj?.childId, source: "milestone", meta: { projectId: m.projectId, milestoneId: m.id } });
  });

  // Travel destinations (arrival/departure)
  (state.family?.travel?.destinations || []).forEach((d, i) => {
    if (d.arrival) push({ id: `trav:${i}:a`, type: "travel", title: `Arrive ${d.city || "destination"}`, date: isoFromDateOnly(d.arrival), allDay: true, source: "travel", meta: { destination: d } });
    if (d.departure) push({ id: `trav:${i}:d`, type: "travel", title: `Leave ${d.city || "destination"}`, date: isoFromDateOnly(d.departure), allDay: true, source: "travel", meta: { destination: d } });
  });

  // Reflection + celebration dates — derived from the family's rhythm.
  const sched = reflectionSchedule(state.family?.rhythm || {}, new Date());
  push({ id: "refl:monthly", type: "reflection", title: "Monthly reflection", date: sched.nextMonthly.toISOString(), allDay: true, source: "schedule", meta: { reflection: "monthly" } });
  push({ id: "refl:quarterly", type: "reflection", title: "Quarterly reflection", date: sched.nextQuarterly.toISOString(), allDay: true, source: "schedule", meta: { reflection: "quarterly" } });
  push({ id: "refl:annual", type: "celebration", title: "Annual reflection & celebration", date: sched.annualCelebration.toISOString(), allDay: true, source: "schedule", meta: { reflection: "annual" } });

  // Family-added + external-calendar events.
  (state.calendarEvents || []).forEach(e =>
    push({ id: `cal:${e.id}`, type: e.type || "event", title: e.title, date: e.start, end: e.end, childId: e.childId, allDay: !!e.allDay, source: e.source || "manual", meta: { eventId: e.id, externalId: e.externalId } }));

  return events.sort((a, b) => new Date(a.date) - new Date(b.date));
}

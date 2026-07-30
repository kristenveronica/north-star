/* ============================================================
   dailyPlan.js — the daily-load intelligence.

   Two jobs, both built on each mission's honest `estimatedMinutes`
   (set at generation; see the ai edge function + migration 0038):

   1. SCHEDULING (generation/save time) — place a new project's
      missions onto real learning days, packing each day up to the
      family's daily target and RESPECTING the load other active
      projects already put on those days. So across all a child's
      projects, a day fills to about the time the family wants —
      no more, and spread over school days only.

   2. TODAY PLAN (display time) — assemble the set of missions a
      child should work on today so their minutes add up to the
      daily target, pulling the next work forward when a day is light.

   Pure functions (dates passed in) so they're unit-testable and match
   the backend estimator in supabase/functions/_shared/projectCapacity.js.
   ============================================================ */

export const DEFAULT_HOURS_PER_DAY = 3;
export const DEFAULT_DAYS_PER_WEEK = 4;

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

/** Honest minutes for a mission. Mirrors the backend estimator: prefer the
 *  model's estimatedMinutes, else fall back to the momentum-points proxy. */
export function milestoneMinutes(m = {}) {
  const est = Number(m.estimatedMinutes);
  if (Number.isFinite(est) && est > 0) return clamp(est, 5, 180);
  const pts = Number(m.momentumPoints) || 10;
  return clamp(pts * 3, 20, 180);
}

/** The family's daily learning target in minutes, from the rhythm setting. */
export function dailyTargetMinutes(rhythm = {}) {
  const h = Number(rhythm.hoursPerDay);
  return Math.round((Number.isFinite(h) && h > 0 ? h : DEFAULT_HOURS_PER_DAY) * 60);
}

const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`;
};
// ISO-ish week key (year + week number) so we can cap learning days per week.
const weekKey = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() + 4 - (x.getDay() || 7)); // to Thursday of this week
  const yearStart = new Date(x.getFullYear(), 0, 1);
  const wk = Math.ceil(((x - yearStart) / 86400000 + 1) / 7);
  return `${x.getFullYear()}-W${wk}`;
};

/** The next `count` learning days from `start` (inclusive if `start` qualifies).
 *  Learning day = a weekday, capped to `daysPerWeek` weekdays per week. We don't
 *  know WHICH weekdays a family uses, so we take the first N weekdays each week —
 *  a sensible default the family's actual calendar can refine later. */
export function learningDaysFrom(start, count, rhythm = {}) {
  const dpw = clamp(Number(rhythm.daysPerWeek) || DEFAULT_DAYS_PER_WEEK, 1, 5);
  const out = [];
  const weekUsed = new Map();
  const d = new Date(start);
  d.setHours(12, 0, 0, 0);
  let guard = 0;
  while (out.length < count && guard < 3660) {
    guard++;
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      const wk = weekKey(d);
      const used = weekUsed.get(wk) || 0;
      if (used < dpw) { out.push(new Date(d)); weekUsed.set(wk, used + 1); }
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/**
 * Schedule a new project's missions onto learning days, packing each day up to
 * the daily target while respecting load already committed by other projects.
 *
 * @param {Array<{id:string, minutes:number}>} newItems  missions in order
 * @param {Map<string, number>} existingLoadByDay  dayKey → minutes already booked
 * @param {object} rhythm  family rhythm ({hoursPerDay, daysPerWeek})
 * @param {Date}   startDate  earliest day the first mission can land (usually today)
 * @returns {Array<{id:string, dueDate:Date}>}
 */
export function scheduleMilestones(newItems, existingLoadByDay, rhythm, startDate) {
  const target = dailyTargetMinutes(rhythm);
  const load = new Map(existingLoadByDay || []);
  // Enough learning days for one-mission-per-day worst case, plus headroom.
  const days = learningDaysFrom(startDate, Math.max(newItems.length + 4, 12), rhythm);
  const out = [];
  let di = 0;
  for (const it of newItems) {
    // Advance past days that are already at/over target, or where THIS mission
    // would overflow a day that already holds work (keep going if the day is empty
    // — a single mission longer than the target still gets its own day).
    while (di < days.length - 1) {
      const used = load.get(dayKey(days[di])) || 0;
      if (used >= target) { di++; continue; }
      if (used > 0 && used + it.minutes > target) { di++; continue; }
      break;
    }
    const day = days[di];
    out.push({ id: it.id, dueDate: new Date(day) });
    load.set(dayKey(day), (load.get(dayKey(day)) || 0) + it.minutes);
  }
  return out;
}

/** Build a Map of dayKey → committed minutes from a set of milestones (those
 *  with due dates), for use as `existingLoadByDay`. Skips completed ones. */
export function loadByDay(milestones = []) {
  const map = new Map();
  for (const m of milestones) {
    if (m.completed || !m.dueDate) continue;
    const k = dayKey(m.dueDate);
    map.set(k, (map.get(k) || 0) + milestoneMinutes(m));
  }
  return map;
}

/**
 * Today's balanced plan: the missions a child should work on today so their
 * minutes reach the daily target, drawn in due-date order (overdue/today first,
 * then pulling upcoming work forward when today is light).
 *
 * @param {Array} incompleteMilestones  the child's incomplete missions
 * @param {object} rhythm
 * @returns {{items:Array<{milestone:object,minutes:number}>, totalMinutes:number, targetMinutes:number, status:string}}
 */
export function buildTodayPlan(incompleteMilestones = [], rhythm = {}) {
  const target = dailyTargetMinutes(rhythm);
  const sorted = [...incompleteMilestones]
    .filter((m) => !m.completed)
    .sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0));
  const items = [];
  let total = 0;
  for (const m of sorted) {
    if (total >= target) break;
    const minutes = milestoneMinutes(m);
    items.push({ milestone: m, minutes });
    total += minutes;
  }
  let status = "balanced";
  if (items.length === 0) status = "empty";
  else if (total < target * 0.6) status = "light";       // not enough work to fill the day
  else if (total > target * 1.5) status = "heavy";        // one big mission overshoots
  return { items, totalMinutes: total, targetMinutes: target, status };
}

/** "2h 30m" / "45m" — friendly minutes. */
export function fmtMinutes(mins) {
  const m = Math.max(0, Math.round(mins));
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return `${r}m`;
}

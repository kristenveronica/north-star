/* ============================================================
   learningCapacity.js — The Learning Capacity Engine (infrastructure).

   Turns a family's rhythm into an available learning budget so future
   project generation can scale workload to the time a family actually
   has — never overfilling the calendar.

   Phase 1 = the foundational calculation only:
     Days per week × Hours per day = Weekly Learning Budget
   Rebalancing of projects is intentionally NOT done here yet.
   ============================================================ */

const clampDays = (d) => Math.max(0, Math.min(7, parseInt(d, 10) || 0));
const clampHours = (h) => Math.max(0, Number(h) || 0);
const round1 = (n) => Math.round(n * 10) / 10;

/** The headline number: weekly learning budget in hours. */
export function weeklyLearningBudgetHours(rhythm = {}) {
  return round1(clampDays(rhythm.daysPerWeek) * clampHours(rhythm.hoursPerDay));
}

/** Full capacity snapshot future generation/rebalancing can read. */
export function learningCapacity(rhythm = {}) {
  const daysPerWeek = clampDays(rhythm.daysPerWeek);
  const hoursPerDay = clampHours(rhythm.hoursPerDay);
  const weekly = round1(daysPerWeek * hoursPerDay);
  return {
    daysPerWeek,
    hoursPerDay,
    weeklyBudgetHours: weekly,
    monthlyBudgetHours: round1(weekly * 4.345),  // avg weeks/month
    quarterlyBudgetHours: round1(weekly * 13),    // ~13 weeks/quarter
    configured: daysPerWeek > 0 && hoursPerDay > 0,
  };
}

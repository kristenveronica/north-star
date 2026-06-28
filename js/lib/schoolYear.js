/* ============================================================
   schoolYear.js — The School Year + Reflection-timing engine.

   North Star never assumes a fixed calendar year. Every family
   configures its own rhythm (start/end month, hemisphere), and
   this pure module derives — for any reference date — the:
     • current school year (label + window)
     • four quarters (North Star's default term rhythm)
     • current quarter
     • next monthly / quarterly / annual reflection dates
     • annual celebration date

   Pure functions only (no DB, no DOM) so it's trivially testable and
   reusable by generation, the calendar, the scheduler and reflections.
   ============================================================ */

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Rough hemisphere inference from a country name or ISO code. Defaults north.
const SOUTHERN = new Set([
  "AU", "NZ", "ZA", "AR", "CL", "UY", "PY", "BO", "PE", "BR", "ID",
  "Australia", "New Zealand", "South Africa", "Argentina", "Chile",
  "Brazil", "Uruguay", "Indonesia", "Peru", "Bolivia", "Paraguay",
]);

export function inferHemisphere(country) {
  if (!country) return "northern";
  const c = String(country).trim();
  return (SOUTHERN.has(c) || SOUTHERN.has(c.toUpperCase())) ? "southern" : "northern";
}

/** Sensible starting rhythm for a family, inferred from their country. */
export function defaultRhythm(country) {
  const hemisphere = inferHemisphere(country);
  const base = { hemisphere, termStructure: "quarters", daysPerWeek: 4, hoursPerDay: 3, learningWindow: "morning", customStartTime: "", customEndTime: "" };
  return hemisphere === "southern"
    ? { ...base, schoolYearStartMonth: 2, schoolYearEndMonth: 12 }   // Feb → Dec
    : { ...base, schoolYearStartMonth: 9, schoolYearEndMonth: 6 };   // Sep → Jun
}

const clampMonth = (m, fallback) => {
  const n = parseInt(m, 10);
  return (n >= 1 && n <= 12) ? n : fallback;
};

/**
 * The school-year window containing `now` (or the nearest upcoming one if we're
 * currently in a break). Returns { label, start, end, active, startMonth, endMonth }.
 */
export function currentSchoolYear(rhythm = {}, now = new Date()) {
  const startM = clampMonth(rhythm.schoolYearStartMonth, rhythm.hemisphere === "southern" ? 2 : 9);
  const endM = clampMonth(rhythm.schoolYearEndMonth, rhythm.hemisphere === "southern" ? 12 : 6);
  const crosses = startM > endM; // e.g. Sep(9) → Jun(6) spans two calendar years

  const windowFor = (startYear) => ({
    start: new Date(startYear, startM - 1, 1, 0, 0, 0, 0),
    end: new Date(startYear + (crosses ? 1 : 0), endM, 0, 23, 59, 59, 999), // day 0 = last day of endM
  });

  const candidates = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(windowFor);
  let win = candidates.find(w => now >= w.start && now <= w.end);
  const active = !!win;
  if (!win) {
    // Currently between school years (a break) — look forward to the next one.
    win = candidates.filter(w => w.start > now).sort((a, b) => a.start - b.start)[0] || candidates[candidates.length - 1];
  }

  const startYear = win.start.getFullYear();
  const endYear = win.end.getFullYear();
  const label = crosses ? `${startYear}–${String(endYear).slice(2)}` : `${startYear}`;
  return { label, start: win.start, end: win.end, active, startMonth: startM, endMonth: endM };
}

/** Four quarters dividing the school-year window into equal segments (Q1–Q4). */
export function quarters(rhythm = {}, now = new Date()) {
  const sy = currentSchoolYear(rhythm, now);
  const seg = (sy.end - sy.start) / 4;
  return [0, 1, 2, 3].map(i => ({
    index: i + 1,
    label: `Q${i + 1}`,
    start: new Date(sy.start.getTime() + i * seg),
    end: new Date(sy.start.getTime() + (i + 1) * seg - 1),
  }));
}

/** Which quarter `now` falls in (or null if in a break). */
export function currentQuarter(rhythm = {}, now = new Date()) {
  return quarters(rhythm, now).find(q => now >= q.start && now <= q.end) || null;
}

const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

/**
 * Everything the Reflection Scheduler + UI needs: current school year + quarter,
 * and the next monthly / quarterly / annual reflection dates, derived dynamically
 * from the family's rhythm (never hard-coded calendar dates).
 */
export function reflectionSchedule(rhythm = {}, now = new Date()) {
  const schoolYear = currentSchoolYear(rhythm, now);
  const qs = quarters(rhythm, now);
  const cq = currentQuarter(rhythm, now);
  const nextQuarterly = cq ? cq.end : (qs.find(q => q.end > now)?.end || schoolYear.end);
  return {
    schoolYear,
    quarters: qs,
    currentQuarter: cq,
    nextMonthly: endOfMonth(now),
    nextQuarterly,
    nextAnnual: schoolYear.end,
    annualCelebration: schoolYear.end,
  };
}

export const monthName = (m) => MONTHS[clampMonth(m, 1) - 1] || "";

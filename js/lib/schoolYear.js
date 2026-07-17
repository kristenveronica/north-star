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
/* How a family divides its learning year. ~40 teaching weeks either way. */
export const TERM_STRUCTURES = [
  { v: "terms",      count: 4, weeks: 10, unit: "Term",       label: "Terms — 4 × 10 weeks" },
  { v: "trimesters", count: 3, weeks: 13, unit: "Trimester",  label: "Trimesters — 3 × 13 weeks" },
  { v: "semesters",  count: 2, weeks: 20, unit: "Semester",   label: "Semesters — 2 × 20 weeks" },
];

/** Resolve a family's structure (legacy "quarters" == 4 terms). */
export function termStructureOf(rhythm = {}) {
  const v = (!rhythm.termStructure || rhythm.termStructure === "quarters") ? "terms" : rhythm.termStructure;
  return TERM_STRUCTURES.find(t => t.v === v) || TERM_STRUCTURES[0];
}

/** The holiday slots implied by the structure: a break after each block except
    the last, plus the long end-of-year (summer) break. */
export function breakSlots(rhythm = {}) {
  const st = termStructureOf(rhythm);
  const slots = [];
  for (let i = 1; i < st.count; i++) {
    slots.push({ key: `after-${i}`, label: `After ${st.unit} ${i}`, kind: "between" });
  }
  slots.push({ key: "summer", label: "Summer / end-of-year holidays", kind: "summer" });
  return slots;
}

export const DEFAULT_BREAK_WEEKS = { between: 2, summer: 6 };
export const defaultBreakWeeks = (kind) => (kind === "summer" ? DEFAULT_BREAK_WEEKS.summer : DEFAULT_BREAK_WEEKS.between);

export function defaultRhythm(country) {
  const hemisphere = inferHemisphere(country);
  const base = {
    hemisphere, termStructure: "terms",
    holidayMode: "auto", breakWeeks: {}, breakDates: {},
    daysPerWeek: 4, hoursPerDay: 3, learningWindow: "morning", customStartTime: "", customEndTime: "",
  };
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

  // Optional day-of-month; blank/invalid falls back to the 1st (start) and the
  // last day of the end month — the original behaviour. Clamped to the month's
  // real length so e.g. "31" in a 30-day month lands on the 30th.
  const daysIn = (y, m1) => new Date(y, m1, 0).getDate();
  const pickDay = (v, last, fallback) => {
    const n = parseInt(v, 10);
    return (n >= 1 && n <= last) ? n : fallback;
  };
  const windowFor = (startYear) => {
    const endYear = startYear + (crosses ? 1 : 0);
    const startLast = daysIn(startYear, startM);
    const endLast = daysIn(endYear, endM);
    const startDay = pickDay(rhythm.schoolYearStartDay, startLast, 1);
    const endDay = pickDay(rhythm.schoolYearEndDay, endLast, endLast);
    return {
      start: new Date(startYear, startM - 1, startDay, 0, 0, 0, 0),
      end: new Date(endYear, endM - 1, endDay, 23, 59, 59, 999),
    };
  };

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

/** The learning blocks dividing the school-year window into equal segments —
    4 Terms, 3 Trimesters or 2 Semesters, per the family's chosen structure. */
export function terms(rhythm = {}, now = new Date()) {
  const sy = currentSchoolYear(rhythm, now);
  const st = termStructureOf(rhythm);
  const seg = (sy.end - sy.start) / st.count;
  return Array.from({ length: st.count }, (_, i) => ({
    index: i + 1,
    label: `${st.unit} ${i + 1}`,
    start: new Date(sy.start.getTime() + i * seg),
    end: new Date(sy.start.getTime() + (i + 1) * seg - 1),
  }));
}

/** Back-compat alias — the year's blocks (was always 4; now structure-aware). */
export function quarters(rhythm = {}, now = new Date()) {
  return terms(rhythm, now);
}

/** Which block `now` falls in (or null if in a break). */
export function currentQuarter(rhythm = {}, now = new Date()) {
  return terms(rhythm, now).find(q => now >= q.start && now <= q.end) || null;
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

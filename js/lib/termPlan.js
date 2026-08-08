/* ============================================================
   termPlan.js — Term Planner recommendations.

   Turns a family's rhythm (days/hours per week) and their school-year
   structure into a calm recommendation for HOW MANY projects to run for
   a child this term, at what cadence — and a set of structured "slots"
   the parent can generate one at a time.

   It reads the existing engines rather than inventing numbers:
     • learningCapacity() → weekly learning-budget hours
     • terms()/currentQuarter() → the term we're in (or the next one),
       with real start/end dates from their school-year settings.
   ============================================================ */

import { learningCapacity } from "./learningCapacity.js";
import { terms, currentQuarter, termStructureOf } from "./schoolYear.js";

const MS_WEEK = 7 * 24 * 60 * 60 * 1000;
// A "medium" project ≈ a month of calendar time — the sweet spot, and the same
// framing as the project generator's size hints (Short 1–2 wks · Medium ~1 month).
const MEDIUM_WEEKS = 4;

/**
 * Recommend a term of projects for one child from the family's rhythm.
 * Returns { configured, unit, term, weeklyBudgetHours, concurrency, count,
 *           projectWeeks, slots[] }. `configured` is false until the family has
 * set days + hours in Family Rhythm (so the UI can nudge them there first).
 */
export function recommendTermPlan(rhythm = {}, now = new Date()) {
  const cap = learningCapacity(rhythm);
  const struct = termStructureOf(rhythm);
  const all = terms(rhythm, now);
  const active = currentQuarter(rhythm, now);
  // Plan the term we're in; if we're between terms, plan the next one.
  const term = active || all.find(t => t.start > now) || all[0];
  const isFirst = term.index === 1;

  const weeksTotal = Math.max(1, Math.round((term.end - term.start) / MS_WEEK));
  const weeksRemaining = active
    ? Math.max(1, Math.round((term.end - now) / MS_WEEK))
    : weeksTotal;

  const weekly = cap.weeklyBudgetHours;
  // How many projects a family comfortably runs at once — calm by default; a
  // fuller week (≥12h) can sustain two in parallel.
  const concurrency = weekly >= 12 ? 2 : 1;
  // How many medium projects fit end-to-end in the weeks left, scaled by
  // concurrency, then clamped to a calm range (gentler for a first term).
  const sequential = Math.max(1, Math.round(weeksRemaining / MEDIUM_WEEKS));
  const count = Math.max(1, Math.min(sequential * concurrency, isFirst ? 4 : 6));

  return {
    configured: cap.configured,
    unit: struct.unit,                       // "Term" | "Trimester" | "Semester"
    term: {
      index: term.index, label: term.label, start: term.start, end: term.end,
      active: !!active, isFirst, weeksTotal, weeksRemaining,
    },
    weeklyBudgetHours: weekly,
    concurrency,
    count,
    projectWeeks: MEDIUM_WEEKS,
    slots: Array.from({ length: count }, (_, i) => ({
      index: i + 1, size: "medium", approxWeeks: MEDIUM_WEEKS,
    })),
  };
}

/** A warm, plain-language cadence phrase for the recommendation sentence. */
export function termPlanCadence(plan) {
  const w = plan?.projectWeeks || MEDIUM_WEEKS;
  if (w <= 2) return "about one every couple of weeks";
  if (w <= 3) return "about one every three weeks";
  if (w <= 5) return "about one a month";
  return `about one every ${w} weeks`;
}

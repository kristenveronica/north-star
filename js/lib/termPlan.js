/* ============================================================
   termPlan.js — Term Planner recommendations (layered portfolio).

   A term isn't a queue of one-project-at-a-time — it's a portfolio of
   projects running in PARALLEL, layered by duration and offset in time
   so a child always has variety day to day:

     • 1 long-term project spanning the whole term (its spine),
     • a few medium projects (~a month each),
     • several short projects (1–2 weeks each),

   started in offset "waves" so their lifecycles overlap at different
   phases. This module recommends the mix (scaled to the family's weekly
   capacity + the weeks left in the term) and assigns each project a
   start-week so the waves fall out naturally.

   It reads the existing engines rather than inventing numbers:
     • learningCapacity() → weekly learning-budget hours
     • terms()/currentQuarter() → the term (or next one) with real dates.
   Milestone cadence per tier + the day-to-day composition are handled
   downstream (generation + daily plan); this is the term-shape layer.
   ============================================================ */

import { learningCapacity } from "./learningCapacity.js";
import { terms, currentQuarter, termStructureOf } from "./schoolYear.js";

const MS_WEEK = 7 * 24 * 60 * 60 * 1000;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Tier → generator size band + a calendar span (weeks). Long spans the whole
// term; medium ≈ a month; short ≈ a fortnight.
const TIER_SIZE = { long: "large", medium: "medium", short: "small" };

/** Spread `count` projects of `weeks` length across a `termWeeks` window so
    their starts are offset (waves). Returns items with a 0-indexed startWeek. */
function makeTier(key, label, count, weeks, termWeeks) {
  const span = Math.max(0, termWeeks - weeks);
  const items = Array.from({ length: count }, (_, i) => ({
    index: i + 1,
    tier: key,
    size: TIER_SIZE[key],
    startWeek: count > 1 ? Math.round((span * i) / (count - 1)) : 0,
    weeks,
  }));
  return { key, label, size: TIER_SIZE[key], weeks, items };
}

/**
 * Recommend a term-long portfolio for one child from the family's rhythm.
 * Returns { configured, unit, term, weeklyBudgetHours, concurrency,
 *           counts:{long,medium,short,total}, tiers[], slots[] }.
 * `configured` is false until Family Rhythm has days + hours set.
 */
export function recommendTermPlan(rhythm = {}, now = new Date()) {
  const cap = learningCapacity(rhythm);
  const struct = termStructureOf(rhythm);
  const all = terms(rhythm, now);
  const active = currentQuarter(rhythm, now);
  const term = active || all.find(t => t.start > now) || all[0];
  const isFirst = term.index === 1;

  const weeksTotal = Math.max(1, Math.round((term.end - term.start) / MS_WEEK));
  const weeksRemaining = active
    ? Math.max(1, Math.round((term.end - now) / MS_WEEK))
    : weeksTotal;

  const weekly = cap.weeklyBudgetHours;

  // Portfolio sizing scales with weekly hours (cf — reference ~12h/wk = 1.0) and
  // the weeks left (wf — reference a 10-week term). Baselines match the target
  // full-week / 10-week mix: ~1 long · ~3 medium · ~5 short.
  const cf = clamp(weekly / 12, 0.35, 1.4);
  const wf = weeksRemaining / 10;
  const longCount = (weeksRemaining >= 6 && weekly >= 5) ? 1 : 0;   // needs runway
  const mediumCount = clamp(Math.round(2.6 * cf * wf), weekly >= 3 ? 1 : 0, 4);
  const shortCount = clamp(Math.round(4.6 * cf * wf), 1, 7);

  // How many run at once (drives the "in parallel" language + the offset feel).
  const concurrency = clamp(Math.round(weekly / 4), 1, 4);

  const mediumWeeks = Math.min(4, weeksRemaining);
  const shortWeeks = Math.min(2, weeksRemaining);

  const tiers = [];
  if (longCount)   tiers.push(makeTier("long", "Long-term", longCount, weeksRemaining, weeksRemaining));
  if (mediumCount) tiers.push(makeTier("medium", "Medium", mediumCount, mediumWeeks, weeksRemaining));
  if (shortCount)  tiers.push(makeTier("short", "Short", shortCount, shortWeeks, weeksRemaining));

  const total = longCount + mediumCount + shortCount;
  const slots = tiers.flatMap(t => t.items);

  return {
    configured: cap.configured,
    unit: struct.unit,
    term: {
      index: term.index, label: term.label, start: term.start, end: term.end,
      active: !!active, isFirst, weeksTotal, weeksRemaining,
    },
    weeklyBudgetHours: weekly,
    concurrency,
    counts: { long: longCount, medium: mediumCount, short: shortCount, total },
    tiers,
    slots,
  };
}

/** A plain-language portfolio phrase, e.g. "1 long, 3 medium and 5 short". */
export function termPortfolioPhrase(plan) {
  const c = plan?.counts || {};
  const parts = [];
  if (c.long)   parts.push(`<strong>${c.long} long</strong>`);
  if (c.medium) parts.push(`<strong>${c.medium} medium</strong>`);
  if (c.short)  parts.push(`<strong>${c.short} short</strong>`);
  if (parts.length <= 1) return parts[0] || "a project";
  return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
}

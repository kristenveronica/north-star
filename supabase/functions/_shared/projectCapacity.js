/* ============================================================================
   ProjectCapacity — realistic capacity allocation + effective size (G6).

   PURE functions (Deno + `node --test`). The edge function feeds in the family
   rhythm, the child's active-project count, the requested size, and any active
   capacity-reducing circumstances; this returns a deterministic allocation AND a
   deterministic effectiveSize that resolves size↔capacity conflicts BEFORE the
   model is prompted (so we never ask for a "medium" the week can't sustain, then
   fight it with regeneration).

   AUDIT (reliable vs merely present):
   • RELIABLE: total weekly capacity (rhythm days×hours); active project COUNT
     (project_status enum); requested size (parent-chosen).
   • NOT stored: per-project workload, per-milestone duration, sessions. So
     committed capacity and milestone duration use EXPLICIT fallbacks, exposed in
     `assumptions[]`, with lowered `allocationConfidence`.

   GUARDRAILS: keep 30% of capacity open (never fill the week); size bands are
   defined by real worthwhile-project TIME, not round numbers; a single project is
   capped at its size band's max so extra capacity means more/other projects, not
   one bloated quest.
   ============================================================================ */

const RESERVE_FRACTION = 0.30;
const MAX_COMMITTED_FRACTION = 0.75;    // existing projects never claim >75% of allocatable
const NOMINAL_SESSION_MIN = 40;

// Size bands in MEASURABLE total-minutes terms (NON-OVERLAPPING). minTotal is the
// FLOOR that makes a project of that size worthwhile — the structural reality the
// generator already enforces (a "medium" is ≥ ~6 missions ≈ 4h, which is why a
// 2h "medium" was impossible). maxTotal caps it so more capacity ⇒ more/other
// projects, not one bloated quest. No "micro": below small's floor we produce a
// minimal small and flag it, rather than inventing a label with no product meaning.
const SIZE = {
  small:  { weeks: 2, minTotal: 60,  maxTotal: 240 },   // 1–4h,  ~3–6 missions
  medium: { weeks: 4, minTotal: 240, maxTotal: 600 },   // 4–10h, ~6–10 missions
  large:  { weeks: 8, minTotal: 600, maxTotal: 1500 },  // 10–25h, ~8–14 missions
};
const ORDER = ["small", "medium", "large"];
const CAPACITY_MULTIPLIER = { capacity: 0.6, illness: 0.6, travel: 0.75, move: 0.75, hard_season: 0.75 };

const clampDays = (d) => Math.max(0, Math.min(7, parseInt(d, 10) || 0));
const clampHours = (h) => Math.max(0, Number(h) || 0);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const r0 = (n) => Math.round(n);
const normalizeSize = (s) => (SIZE[s] ? s : "medium");   // 'auto'/unknown → medium

export function buildProjectCapacity({ rhythm = {}, activeProjectCount = 0, size = "auto", capacityCircumstanceKinds = [] } = {}) {
  const assumptions = [];
  const requestedSize = normalizeSize(size);
  if (!SIZE[size]) assumptions.push(`Requested size '${size}' read as medium.`);

  const days = clampDays(rhythm.daysPerWeek);
  const hours = clampHours(rhythm.hoursPerDay);
  const configured = days > 0 && hours > 0;

  let capacityMultiplier = 1;
  for (const k of capacityCircumstanceKinds) {
    if (CAPACITY_MULTIPLIER[k] != null) capacityMultiplier = Math.min(capacityMultiplier, CAPACITY_MULTIPLIER[k]);
  }
  if (capacityMultiplier < 1) assumptions.push(`Capacity temporarily reduced to ${Math.round(capacityMultiplier * 100)}% by an active circumstance.`);

  const totalWeeklyMinutes = r0(days * hours * 60 * capacityMultiplier);
  const reserveWeeklyMinutes = r0(totalWeeklyMinutes * RESERVE_FRACTION);
  const allocatable = Math.max(0, totalWeeklyMinutes - reserveWeeklyMinutes);
  assumptions.push(`Kept ${Math.round(RESERVE_FRACTION * 100)}% of capacity open (not every hour is filled).`);

  const nActive = Math.max(0, activeProjectCount | 0);
  let committedWeeklyMinutes = 0;
  if (nActive > 0) {
    committedWeeklyMinutes = r0(Math.min(nActive * (allocatable / (nActive + 1)), allocatable * MAX_COMMITTED_FRACTION));
    assumptions.push(`No stored per-project workload; estimated ${nActive} active project(s) hold ~${committedWeeklyMinutes} min/week (fallback).`);
  }
  // The new project's fair weekly slot = what remains after existing projects + reserve.
  const remainingWeeklyMinutes = Math.max(0, allocatable - committedWeeklyMinutes);
  const weeklySlot = remainingWeeklyMinutes;

  // ---- DETERMINISTIC effectiveSize: step DOWN from requested until the slot can
  // sustain that size's floor over its weeks. Never up-shift beyond the request. ----
  let effIdx = ORDER.indexOf(requestedSize);
  while (effIdx > 0 && weeklySlot * SIZE[ORDER[effIdx]].weeks < SIZE[ORDER[effIdx]].minTotal) effIdx--;
  const effectiveSize = ORDER[effIdx];
  const band = SIZE[effectiveSize];
  const belowSmallFloor = weeklySlot * band.weeks < band.minTotal;   // even small can't reach its floor

  const expectedProjectWeeks = band.weeks;
  const targetTotalMinutes = r0(clamp(weeklySlot * expectedProjectWeeks, band.minTotal, band.maxTotal));
  const targetWeeklyMinutesForProject = r0(targetTotalMinutes / expectedProjectWeeks);
  const targetSessionsPerWeek = clamp(Math.round(targetWeeklyMinutesForProject / NOMINAL_SESSION_MIN), 1, Math.max(1, days));
  const targetSessionMinutes = r0(targetWeeklyMinutesForProject / targetSessionsPerWeek);

  let sizeAdjustmentReason = null;
  if (effectiveSize !== requestedSize) {
    sizeAdjustmentReason = `Current week and active projects support a ${effectiveSize} project, not a ${requestedSize} one.`;
  }
  if (belowSmallFloor) {
    sizeAdjustmentReason = "Capacity is very limited right now — shaped as a light, minimal project.";
    assumptions.push("Below the small-project floor: this is a deliberately minimal starter.");
  }

  const allocationConfidence = (configured && nActive === 0 && capacityMultiplier === 1 && effectiveSize === requestedSize && !belowSmallFloor)
    ? "moderate" : "low";
  if (!configured) assumptions.push("Family rhythm not fully set — using whatever days/hours are configured.");

  return {
    requestedSize,
    effectiveSize,
    sizeAdjustmentReason,
    belowSmallFloor,
    totalWeeklyMinutes,
    reserveWeeklyMinutes,
    committedWeeklyMinutes,
    remainingWeeklyMinutes,
    activeProjectCount: nActive,
    targetWeeklyMinutesForProject,
    targetSessionMinutes,
    targetSessionsPerWeek,
    expectedProjectWeeks,
    targetTotalMinutes,
    allocationConfidence,
    assumptions,
  };
}

// Only IN-PROGRESS projects consume capacity (DB enum: active, ready_for_reflection,
// completed, paused; 'draft' app-only). completed/paused/draft/abandoned do NOT.
const CONSUMING_STATUSES = new Set(["active", "ready-for-reflection", "ready_for_reflection"]);
export function activeProjectCount(projects = []) {
  return projects.filter((p) => CONSUMING_STATUSES.has(p && p.status)).length;
}

/** Coarse milestone-minutes estimate from momentum points (our only effort proxy). */
export function estimateMilestoneMinutes(m = {}) {
  const pts = Number(m.momentumPoints) || 10;
  return clamp(pts * 3, 20, 120);
}

/** Substance check vs the effectiveSize target. Wide ±50% band. Never demands
 *  precision; only catches GROSS thin/large. */
export function substanceCheck(project = {}, capacity = {}) {
  const milestones = Array.isArray(project.milestones) ? project.milestones : [];
  const estTotalMinutes = milestones.reduce((sum, m) => sum + estimateMilestoneMinutes(m), 0);
  const target = capacity.targetTotalMinutes || 0;
  if (target <= 0 || !milestones.length) return { estTotalMinutes, targetTotalMinutes: target, ratio: null, verdict: "unknown" };
  const ratio = estTotalMinutes / target;
  const verdict = ratio < 0.5 ? "thin" : ratio > 1.5 ? "large" : "ok";
  return { estTotalMinutes, targetTotalMinutes: target, ratio: Math.round(ratio * 100) / 100, verdict };
}

/** Prompt block — TRANSPARENT ranges, never exact-looking numbers. */
export function renderCapacityBlock(cap, childName = "this child") {
  const s = cap.targetSessionMinutes;
  const lo = Math.max(15, Math.round((s - 7) / 5) * 5);
  const hi = Math.round((s + 7) / 5) * 5;
  const totalHours = Math.round((cap.targetTotalMinutes / 60) * 10) / 10;
  const soft = cap.allocationConfidence === "low";
  return [
    `LEARNING RHYTHM & SIZE — fit the quest to the time ${childName} actually has. Do NOT try to fill every hour; leaving open time is correct, not a gap to close.`,
    cap.sizeAdjustmentReason ? `- ${cap.sizeAdjustmentReason} Design a genuine ${cap.effectiveSize} quest (not a shrunken larger one).` : "",
    `- Aim for roughly ${cap.targetSessionsPerWeek} session(s) of about ${lo}–${hi} minutes per week, over about ${cap.expectedProjectWeeks} week(s) — around ${totalHours} hours of real work in total.`,
    `- Size the milestones so they ADD UP to about that much genuine work. Fewer, meatier milestones beat many trivial ones.`,
    soft ? `- (An approximate guide, not a strict budget — prioritise a great project over hitting the number exactly.)` : "",
  ].filter(Boolean).join("\n");
}

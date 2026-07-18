/* ============================================================================
   ProjectCapacity — realistic capacity allocation for a NEW project (G6, v1).

   PURE functions (Deno + `node --test`). The edge function feeds in the family
   rhythm, the child's active-project count, the requested size, and any active
   capacity-reducing circumstances; this returns a deterministic allocation that
   shapes the generated project's total time, sessions, and substance.

   AUDIT (what's reliable vs merely present):
   • RELIABLE: total weekly capacity (rhythm days×hours, parent-set); active
     project COUNT (project_status enum); size intent (parent-chosen).
   • NOT stored anywhere: per-project weekly workload, per-milestone duration,
     scheduled sessions. So committed capacity and milestone duration use EXPLICIT
     FALLBACKS, exposed in `assumptions[]`, with lowered `allocationConfidence`.
     We never present an estimate built on missing data as precise.

   GUARDRAILS (docs/lfm-implementation-gaps.md G6):
   • "12h available" must NOT become "12h must be filled." We reserve 30% of
     capacity as open time (spontaneity, family life, rest, overruns, child-led,
     non-North-Star learning) — the upper end of the requested 20–30% band.
   • Capacity is shared ACROSS concurrent projects — a new project never assumes
     the child's whole rhythm.
   ============================================================================ */

// --- tunable constants (configurable later, not now) ---
const RESERVE_FRACTION = 0.30;                 // keep 30% of capacity open — never school-timetable the week
const MAX_COMMITTED_FRACTION = 0.75;           // existing projects never claim >75% of allocatable (a new one always has room)
const NOMINAL_SESSION_MIN = 40;                // nominal session length used to derive session count
const MIN_PROJECT_WEEKLY_MIN = 30;            // a project worth doing is at least this much/week when capacity allows

// size intent in MEASURABLE terms: expected weeks + share of REMAINING weekly capacity
const SIZE = {
  small:  { weeks: 2, share: 0.6 },
  medium: { weeks: 4, share: 0.8 },
  large:  { weeks: 8, share: 1.0 },
};
// Circumstance kinds that reduce available TIME (multiplier on weekly capacity).
// NOTE: 'injury' is deliberately absent — a broken wrist reshapes the ACTIVITY
// (handled by GenerationContext), it does not reduce the hours available.
const CAPACITY_MULTIPLIER = { capacity: 0.6, illness: 0.6, travel: 0.75, move: 0.75, hard_season: 0.75 };

const clampDays = (d) => Math.max(0, Math.min(7, parseInt(d, 10) || 0));
const clampHours = (h) => Math.max(0, Number(h) || 0);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const r0 = (n) => Math.round(n);

/**
 * buildProjectCapacity — the deterministic allocation for one new project.
 * @param rhythm                 family_profiles.rhythm ({daysPerWeek, hoursPerDay})
 * @param activeProjectCount     count of the child's IN-PROGRESS projects (active + ready-for-reflection)
 * @param size                   'auto' | 'small' | 'medium' | 'large'
 * @param capacityCircumstanceKinds  momentKinds of active circumstances (only capacity-reducing ones matter)
 */
export function buildProjectCapacity({ rhythm = {}, activeProjectCount = 0, size = "auto", capacityCircumstanceKinds = [] } = {}) {
  const assumptions = [];
  const days = clampDays(rhythm.daysPerWeek);
  const hours = clampHours(rhythm.hoursPerDay);
  const configured = days > 0 && hours > 0;
  const rawWeekly = days * hours * 60;

  // capacity-reducing circumstance (take the most reductive kind present)
  let capacityMultiplier = 1;
  for (const k of capacityCircumstanceKinds) {
    if (CAPACITY_MULTIPLIER[k] != null) capacityMultiplier = Math.min(capacityMultiplier, CAPACITY_MULTIPLIER[k]);
  }
  if (capacityMultiplier < 1) assumptions.push(`Capacity temporarily reduced to ${Math.round(capacityMultiplier * 100)}% by an active circumstance.`);

  const totalWeeklyMinutes = r0(rawWeekly * capacityMultiplier);
  const reserveWeeklyMinutes = r0(totalWeeklyMinutes * RESERVE_FRACTION);
  const allocatable = Math.max(0, totalWeeklyMinutes - reserveWeeklyMinutes);
  assumptions.push(`Reserved ${Math.round(RESERVE_FRACTION * 100)}% of capacity as open time (not every hour is filled).`);

  const nActive = Math.max(0, activeProjectCount | 0);
  // Fallback (no stored workload): assume existing projects each hold one "slot"
  // of the allocatable pie split across (active + 1) projects; cap so a new one
  // always keeps room. This divides capacity across concurrent projects.
  let committedWeeklyMinutes = 0;
  if (nActive > 0) {
    const perSlot = allocatable / (nActive + 1);
    committedWeeklyMinutes = r0(Math.min(nActive * perSlot, allocatable * MAX_COMMITTED_FRACTION));
    assumptions.push(`No stored per-project workload; estimated ${nActive} active project(s) hold ~${committedWeeklyMinutes} min/week (fallback).`);
  }
  const remainingWeeklyMinutes = Math.max(0, allocatable - committedWeeklyMinutes);

  const sizeKey = SIZE[size] || SIZE.medium;
  if (!SIZE[size]) assumptions.push(`Size '${size}' treated as medium.`);

  // allocate a size-scaled share of REMAINING capacity (never more than remains)
  let targetWeeklyMinutesForProject = r0(clamp(remainingWeeklyMinutes * sizeKey.share, 0, remainingWeeklyMinutes));
  if (remainingWeeklyMinutes > 0 && targetWeeklyMinutesForProject < MIN_PROJECT_WEEKLY_MIN) {
    targetWeeklyMinutesForProject = Math.min(MIN_PROJECT_WEEKLY_MIN, remainingWeeklyMinutes);
  }
  if (remainingWeeklyMinutes < MIN_PROJECT_WEEKLY_MIN) {
    assumptions.push("Child is near capacity across current projects — keeping this one light.");
  }

  const targetSessionsPerWeek = targetWeeklyMinutesForProject <= 0
    ? 0
    : clamp(Math.round(targetWeeklyMinutesForProject / NOMINAL_SESSION_MIN), 1, Math.max(1, days));
  const targetSessionMinutes = targetSessionsPerWeek > 0 ? r0(targetWeeklyMinutesForProject / targetSessionsPerWeek) : 0;
  const expectedProjectWeeks = sizeKey.weeks;
  const targetTotalMinutes = targetWeeklyMinutesForProject * expectedProjectWeeks;

  // Confidence: honest. Only "moderate" when there's nothing to guess (no active
  // projects, rhythm set, no capacity reduction). Otherwise low.
  const allocationConfidence = (configured && nActive === 0 && capacityMultiplier === 1) ? "moderate" : "low";
  if (!configured) assumptions.push("Family rhythm not fully set — using whatever days/hours are configured.");

  return {
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

// Only IN-PROGRESS projects consume current capacity. completed / paused /
// draft (proposed-not-accepted) / abandoned do NOT. (DB enum: active,
// ready_for_reflection, completed, paused; 'draft' is app-only.)
const CONSUMING_STATUSES = new Set(["active", "ready-for-reflection", "ready_for_reflection"]);

/** Count a child's in-progress projects from a list of {status} rows. */
export function activeProjectCount(projects = []) {
  return projects.filter((p) => CONSUMING_STATUSES.has(p && p.status)).length;
}

/** Estimate a milestone's minutes from momentum points (the only effort proxy we
 *  store). Deliberately coarse — used only to catch GROSS substance mismatches. */
export function estimateMilestoneMinutes(m = {}) {
  const pts = Number(m.momentumPoints) || 10;
  return clamp(pts * 3, 20, 120);
}

/** Substance check: does the generated project's estimated work roughly match the
 *  allocation? Wide tolerance (±50%) — we only flag GROSS thin/large, never demand
 *  false precision. */
export function substanceCheck(project = {}, capacity = {}) {
  const milestones = Array.isArray(project.milestones) ? project.milestones : [];
  const estTotalMinutes = milestones.reduce((sum, m) => sum + estimateMilestoneMinutes(m), 0);
  const target = capacity.targetTotalMinutes || 0;
  if (target <= 0 || !milestones.length) {
    return { estTotalMinutes, targetTotalMinutes: target, ratio: null, verdict: "unknown" };
  }
  const ratio = estTotalMinutes / target;
  const verdict = ratio < 0.5 ? "thin" : ratio > 1.5 ? "large" : "ok";
  return { estTotalMinutes, targetTotalMinutes: target, ratio: Math.round(ratio * 100) / 100, verdict };
}

/** The prompt block — TRANSPARENT ranges, never exact-looking numbers (per the
 *  guardrail: "approximately 3 sessions of 35–45 minutes over two weeks"). */
export function renderCapacityBlock(cap, childName = "this child") {
  if (!cap.targetWeeklyMinutesForProject) {
    return `LEARNING RHYTHM: ${childName} is already near capacity across current projects — keep this one light and short, a gentle addition rather than a big commitment.`;
  }
  const s = cap.targetSessionMinutes;
  const lo = Math.max(15, Math.round((s - 7) / 5) * 5);
  const hi = Math.round((s + 7) / 5) * 5;
  const totalHours = Math.round((cap.targetTotalMinutes / 60) * 10) / 10;
  const soft = cap.allocationConfidence === "low";
  return [
    `LEARNING RHYTHM & SIZE — fit the quest to the time ${childName} actually has. Do NOT try to fill every hour; leaving open time is correct, not a gap to close.`,
    `- Aim for roughly ${cap.targetSessionsPerWeek} session(s) of about ${lo}–${hi} minutes per week, over about ${cap.expectedProjectWeeks} week(s) — around ${totalHours} hours of real work in total.`,
    `- Size the milestones so they ADD UP to about that much genuine work — not dramatically more or less. Fewer, meatier milestones are better than many trivial ones.`,
    soft ? `- (This is an approximate guide, not a strict budget — treat it as a sensible shape, and prioritise a great project over hitting the number exactly.)` : "",
  ].filter(Boolean).join("\n");
}

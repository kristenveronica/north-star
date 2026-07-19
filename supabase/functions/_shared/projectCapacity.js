/* ============================================================================
   ProjectCapacity — realistic capacity allocation, effective size + HARD ceiling.

   PURE functions (Deno + `node --test`). The edge function feeds in the family
   rhythm, the child's active-project count, the requested size, and any active
   capacity-reducing circumstances; this returns a deterministic allocation that
   resolves size↔capacity BEFORE the model is prompted.

   THE CORE INVARIANT (why this file was revised):
       finalTargetMinutes <= availableProjectMinutes
   A project may never be sized ABOVE the capacity actually allocated to it just
   to satisfy an internal size-band floor. Three concepts are kept explicit and
   distinct so this can never be violated silently:
     • availableProjectMinutes — the REAL capacity across the project window
       (the child's fair weekly slot × the project's weeks). The HARD CEILING.
     • desiredBandMinutes      — the typical duration for the selected size band.
     • finalTargetMinutes      — what generation is actually allowed to use.
   finalTargetMinutes = min(desiredBandMinutes, availableProjectMinutes). The
   floor is used only for the down-shift DECISION (which band fits) — it is NEVER
   used to inflate the target above real available time.

   WHEN THE WEEK CAN'T SUSTAIN THE SMALLEST STANDARD PROJECT: we do NOT quietly
   raise the target to the small floor, and we do NOT manufacture a smaller project
   that would overshoot. Instead an honest decision path (`effectiveMode`):
     • "standard"     — the band fits; target = min(band typical, available).
     • "insufficient" — the window can't sustain even a small project. Do NOT
                        generate; return a structured insufficient-capacity result
                        so the product can offer to DEFER or REBALANCE. Protecting a
                        family from overcommitment beats overbooking them while
                        claiming the project fits — "the rhythm is already full" is
                        the honest answer.
   CALIBRATION (verified live): the generator's smallest genuinely-worthwhile quest
   lands around the small-band floor (~200 min) — even when explicitly asked for a
   "compact" experience it produced ~150–210 min. So a sub-small "compact/activity"
   tier is NOT viable with today's generator (it would overshoot and flag every
   time). It's kept as a FUTURE option (needs a generator that can build below the
   floor), not a live mode — see docs/lfm-implementation-gaps.md.

   AUDIT (reliable vs merely present):
   • RELIABLE: total weekly capacity (rhythm days×hours); active project COUNT
     (project_status enum); requested size (parent-chosen).
   • NOT stored: per-project workload, per-milestone duration, sessions. So
     committed capacity and milestone duration use EXPLICIT fallbacks, exposed in
     `assumptions[]`, with lowered `allocationConfidence`.

   GUARDRAILS: keep 30% of capacity open (never fill the week); size bands are
   defined by real worthwhile-project TIME, not round numbers; a single project is
   capped at its band typical AND at real available time.
   ============================================================================ */

const RESERVE_FRACTION = 0.30;
const MAX_COMMITTED_FRACTION = 0.75;    // existing projects never claim >75% of allocatable
const NOMINAL_SESSION_MIN = 40;

// Size bands in MEASURABLE total-minutes terms, CALIBRATED to what the generator
// actually produces (a small quest = ~3–6 missions ≈ 4–6h; a medium ≈ 6–10 missions
// ≈ ~12h; a large ≈ 8–14 missions ≈ ~23h). `floor` is the minimum window-total at
// or above which that band is worth building as a STANDARD project — it drives the
// down-shift DECISION only. `typical` is the desired band size and is the ONLY
// thing that seeds a target — and even then it is capped by real available time.
const SIZE = {
  small:  { weeks: 2, floor: 200,  typical: 350 },   // ~3–6 missions
  medium: { weeks: 4, floor: 450,  typical: 750 },   // ~6–10 missions
  large:  { weeks: 8, floor: 900,  typical: 1400 },  // ~8–14 missions
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

  // ---- DETERMINISTIC effectiveSize: step DOWN from the requested band until the
  // slot can sustain that band's floor over its weeks. Never up-shift beyond the
  // request. The floor is a DECISION threshold here — never a target. ----
  let effIdx = ORDER.indexOf(requestedSize);
  while (effIdx > 0 && weeklySlot * SIZE[ORDER[effIdx]].weeks < SIZE[ORDER[effIdx]].floor) effIdx--;
  const effectiveSize = ORDER[effIdx];
  const band = SIZE[effectiveSize];
  const expectedProjectWeeks = band.weeks;

  // ---- THE THREE EXPLICIT QUANTITIES (invariant lives here) ----
  // availableProjectMinutes: the REAL capacity across the window — the hard ceiling.
  const availableProjectMinutes = r0(weeklySlot * expectedProjectWeeks);
  // desiredBandMinutes: what a standard project of this band would typically want.
  const desiredBandMinutes = band.typical;
  const belowSmallFloor = availableProjectMinutes < band.floor;   // even small can't reach its floor

  // ---- HONEST decision path when below the smallest standard project ----
  let effectiveMode = "standard";
  let finalTargetMinutes;
  let sizeAdjustmentReason = null;

  if (belowSmallFloor) {
    // The generator can't reliably build below the small floor (verified live), so
    // manufacturing a smaller project would only overshoot. Decline honestly and
    // offer defer / rebalance instead of overbooking the week.
    effectiveMode = "insufficient";
    finalTargetMinutes = 0;
    sizeAdjustmentReason = "The current week is already close to full. Rather than overbook, North Star suggests saving this idea for a little more room — or pausing an active project to make space.";
    assumptions.push("Available capacity is below the smallest worthwhile project: declined to generate (defer / rebalance).");
  } else {
    // Standard: cap the band typical at real available time. THE INVARIANT.
    finalTargetMinutes = Math.min(desiredBandMinutes, availableProjectMinutes);
    if (effectiveSize !== requestedSize) {
      sizeAdjustmentReason = `Current week and active projects support a ${effectiveSize} project right now, not a ${requestedSize} one.`;
    } else if (finalTargetMinutes < desiredBandMinutes) {
      // Same band, but the typical size doesn't fit the open time — a lighter build.
      sizeAdjustmentReason = `Sized to the open time actually available over the next ${expectedProjectWeeks} week(s) — a lighter ${effectiveSize} project.`;
    }
  }

  const capacityCapped = effectiveMode === "standard" && finalTargetMinutes < desiredBandMinutes;

  // Session breakdown from the (already-capped) final target.
  const targetWeeklyMinutesForProject = expectedProjectWeeks > 0 ? r0(finalTargetMinutes / expectedProjectWeeks) : 0;
  const targetSessionsPerWeek = clamp(Math.round(targetWeeklyMinutesForProject / NOMINAL_SESSION_MIN), 1, Math.max(1, days || 1));
  const targetSessionMinutes = targetSessionsPerWeek > 0 ? r0(targetWeeklyMinutesForProject / targetSessionsPerWeek) : 0;

  const allocationConfidence = (configured && nActive === 0 && capacityMultiplier === 1
      && effectiveMode === "standard" && effectiveSize === requestedSize && !capacityCapped)
    ? "moderate" : "low";
  if (!configured) assumptions.push("Family rhythm not fully set — using whatever days/hours are configured.");

  return {
    requestedSize,
    effectiveSize,
    effectiveMode,                     // standard | compact | insufficient
    insufficientCapacity: effectiveMode === "insufficient",
    sizeAdjustmentReason,
    belowSmallFloor,
    capacityCapped,
    totalWeeklyMinutes,
    reserveWeeklyMinutes,
    committedWeeklyMinutes,
    remainingWeeklyMinutes,
    activeProjectCount: nActive,
    expectedProjectWeeks,
    // The three explicit quantities:
    availableProjectMinutes,           // hard ceiling
    desiredBandMinutes,
    finalTargetMinutes,
    // Back-compat alias (older logs/callers). Always == finalTargetMinutes now.
    targetTotalMinutes: finalTargetMinutes,
    targetWeeklyMinutesForProject,
    targetSessionMinutes,
    targetSessionsPerWeek,
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

// A result may exceed the hard capacity ceiling by at most this factor before it is
// judged over-capacity (small slack absorbs the coarseness of the momentum→minutes
// estimate; it is NOT the ±50% substance tolerance and does not fold into it).
const CAPACITY_OVERRUN_MARGIN = 1.15;

/** Substance check against BOTH the final target AND the hard capacity ceiling.
 *  A draft can NEVER pass merely because it matches a target — the target already
 *  respects capacity, and the ceiling is re-checked here independently. Statuses:
 *    ok               — within ±50% of target AND within capacity.
 *    thin             — well below target.
 *    large_for_target — above target but still within real capacity (tolerable).
 *    exceeds_capacity — over the real available time (HARD; never tolerated).
 *    insufficient_capacity — capacity too low to have generated at all.
 *    unknown          — no milestones / no target to judge against. */
export function substanceCheck(project = {}, capacity = {}) {
  if (capacity.effectiveMode === "insufficient") {
    return { estTotalMinutes: 0, finalTargetMinutes: 0, availableProjectMinutes: capacity.availableProjectMinutes || 0, ratio: null, capacityRatio: null, verdict: "insufficient_capacity" };
  }
  const milestones = Array.isArray(project.milestones) ? project.milestones : [];
  const estTotalMinutes = milestones.reduce((sum, m) => sum + estimateMilestoneMinutes(m), 0);
  const target = capacity.finalTargetMinutes || 0;
  const available = capacity.availableProjectMinutes || 0;
  if (target <= 0 || !milestones.length) {
    return { estTotalMinutes, finalTargetMinutes: target, availableProjectMinutes: available, ratio: null, capacityRatio: null, verdict: "unknown" };
  }
  const capacityRatio = available > 0 ? Math.round((estTotalMinutes / available) * 100) / 100 : null;
  const ratio = Math.round((estTotalMinutes / target) * 100) / 100;
  // Hard ceiling FIRST — an over-capacity draft is never "ok"/"large_for_target".
  if (available > 0 && estTotalMinutes > available * CAPACITY_OVERRUN_MARGIN) {
    return { estTotalMinutes, finalTargetMinutes: target, availableProjectMinutes: available, ratio, capacityRatio, verdict: "exceeds_capacity" };
  }
  const verdict = ratio < 0.5 ? "thin" : ratio > 1.5 ? "large_for_target" : "ok";
  return { estTotalMinutes, finalTargetMinutes: target, availableProjectMinutes: available, ratio, capacityRatio, verdict };
}

/** Prompt block — TRANSPARENT ranges, never exact-looking numbers. Not used for the
 *  insufficient mode (that never reaches the model). */
export function renderCapacityBlock(cap, childName = "this child") {
  const s = cap.targetSessionMinutes;
  const lo = Math.max(15, Math.round((s - 7) / 5) * 5);
  const hi = Math.round((s + 7) / 5) * 5;
  const totalHours = Math.round((cap.finalTargetMinutes / 60) * 10) / 10;
  const soft = cap.allocationConfidence === "low";
  return [
    `LEARNING RHYTHM & SIZE — fit the quest to the time ${childName} actually has. Do NOT try to fill every hour; leaving open time is correct, not a gap to close. This total is a CEILING, not a goal to reach.`,
    cap.sizeAdjustmentReason
      ? `- ${cap.sizeAdjustmentReason} Design a genuine ${cap.effectiveSize} quest (not a shrunken larger one).`
      : "",
    `- Aim for roughly ${cap.targetSessionsPerWeek} session(s) of about ${lo}–${hi} minutes per week, over about ${cap.expectedProjectWeeks} week(s) — around ${totalHours} hours of real work in total, and NOT more.`,
    `- Size the milestones so they ADD UP to about that much genuine work. Fewer, meatier milestones beat many trivial ones.`,
    soft ? `- (An approximate guide — prioritise a great project over hitting the number exactly, but never exceed the ceiling.)` : "",
  ].filter(Boolean).join("\n");
}

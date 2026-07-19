/* Unit tests for capacity allocation, effective size, and the HARD CAPACITY
   CEILING (projectCapacity.js). Pure → `node --test`.

   Central invariant:  finalTargetMinutes <= availableProjectMinutes.
   A size-band floor may inform which band is chosen (or whether we generate at
   all) but must NEVER manufacture time above the child's real available capacity.
   Two honest modes: `standard` (band fits, target capped at real time) and
   `insufficient` (below the smallest worthwhile project → do NOT generate; defer /
   rebalance). Live scenarios A–F run against the deployed function. */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildProjectCapacity, activeProjectCount, estimateMilestoneMinutes, substanceCheck, renderCapacityBlock,
} from "../supabase/functions/_shared/projectCapacity.js";

const R12  = { daysPerWeek: 4, hoursPerDay: 3 };    // 12h/week
const R4   = { daysPerWeek: 2, hoursPerDay: 2 };    // 4h/week
const R24  = { daysPerWeek: 6, hoursPerDay: 4 };    // 24h/week
const tiny = { daysPerWeek: 1, hoursPerDay: 0.5 };  // 30min/week

// Reference capacities reused across substance tests.
const STD_SMALL   = buildProjectCapacity({ rhythm: R4,  activeProjectCount: 0, size: "small"  }); // avail 336, target 336
const STD_MED     = buildProjectCapacity({ rhythm: R12, activeProjectCount: 0, size: "medium" }); // avail 2016, target 750
const INSUFFICIENT = buildProjectCapacity({ rhythm: R4, activeProjectCount: 2, size: "medium" });  // avail 112 → insufficient

/* ---------- active-project counting ---------- */
test("only in-progress projects consume capacity", () => {
  assert.equal(activeProjectCount([
    { status: "active" }, { status: "ready-for-reflection" },
    { status: "completed" }, { status: "paused" }, { status: "draft" },
  ]), 2);
});

/* ---------- the three explicit quantities are exposed ---------- */
test("availableProjectMinutes, desiredBandMinutes and finalTargetMinutes are all exposed", () => {
  const c = buildProjectCapacity({ rhythm: R12, activeProjectCount: 2, size: "medium" });
  assert.equal(typeof c.availableProjectMinutes, "number");
  assert.equal(typeof c.desiredBandMinutes, "number");
  assert.equal(typeof c.finalTargetMinutes, "number");
});

/* ========================================================================
   THE HARD INVARIANT — finalTargetMinutes never exceeds availableProjectMinutes
   ======================================================================== */
test("INVARIANT: finalTargetMinutes never exceeds availableProjectMinutes (broad sweep)", () => {
  const rhythms = [R24, R12, R4, tiny, { daysPerWeek: 3, hoursPerDay: 1.5 }, { daysPerWeek: 5, hoursPerDay: 2 }];
  for (const rhythm of rhythms) {
    for (const size of ["small", "medium", "large"]) {
      for (const n of [0, 1, 2, 3, 5]) {
        const c = buildProjectCapacity({ rhythm, activeProjectCount: n, size });
        assert.ok(
          c.finalTargetMinutes <= c.availableProjectMinutes,
          `finalTarget ${c.finalTargetMinutes} > available ${c.availableProjectMinutes} for ${JSON.stringify(rhythm)} size=${size} n=${n}`,
        );
      }
    }
  }
});

test("INVARIANT: a size-band floor can NEVER raise the target above real capacity", () => {
  // Scenario C: ~112 available. The OLD bug raised this to the 200-min small floor
  // and produced ~300 min. The target must never be inflated to a floor — here the
  // week can't sustain a small at all, so we DECLINE (target 0), never 200.
  assert.ok(INSUFFICIENT.availableProjectMinutes <= 120, `available ~112, got ${INSUFFICIENT.availableProjectMinutes}`);
  assert.equal(INSUFFICIENT.effectiveMode, "insufficient");
  assert.equal(INSUFFICIENT.finalTargetMinutes, 0);         // NOT raised to the 200 floor
  assert.ok(INSUFFICIENT.finalTargetMinutes < 200);
});

/* ---------- Scenario B: typical exceeds real allocation → capped ---------- */
test("Scenario B: medium narrowly supported but typical (750) exceeds available (672) → target capped at 672", () => {
  const c = buildProjectCapacity({ rhythm: R12, activeProjectCount: 2, size: "medium" });
  assert.equal(c.effectiveSize, "medium");                 // band still fits
  assert.equal(c.effectiveMode, "standard");
  assert.equal(c.desiredBandMinutes, 750);
  assert.equal(c.availableProjectMinutes, 672);
  assert.equal(c.finalTargetMinutes, 672);                 // NOT 750
  assert.equal(c.capacityCapped, true);
  assert.ok(/open time|available|lighter/i.test(c.sizeAdjustmentReason));
});

/* ---------- Scenario A: ample capacity preserves the normal band ---------- */
test("Scenario A: ample capacity, medium requested → full medium typical (750), not inflated", () => {
  const c = buildProjectCapacity({ rhythm: R12, activeProjectCount: 0, size: "medium" });
  assert.equal(c.effectiveSize, "medium");
  assert.equal(c.effectiveMode, "standard");
  assert.equal(c.finalTargetMinutes, 750);                 // band typical, capped by huge available
  assert.ok(c.availableProjectMinutes > 750);
  assert.equal(c.capacityCapped, false);
  assert.equal(c.sizeAdjustmentReason, null);
});

/* ---------- normal small/medium/large behaviour preserved under ample capacity ---------- */
test("ample capacity still yields distinct, standard small/medium/large targets", () => {
  const s = buildProjectCapacity({ rhythm: R24, activeProjectCount: 0, size: "small" });
  const m = buildProjectCapacity({ rhythm: R24, activeProjectCount: 0, size: "medium" });
  const l = buildProjectCapacity({ rhythm: R24, activeProjectCount: 0, size: "large" });
  assert.equal(s.effectiveMode, "standard");
  assert.equal(s.finalTargetMinutes, 350);
  assert.equal(m.finalTargetMinutes, 750);
  assert.equal(l.finalTargetMinutes, 1400);
  assert.ok(s.finalTargetMinutes < m.finalTargetMinutes && m.finalTargetMinutes < l.finalTargetMinutes);
});
test("a small request is never up-shifted even with abundant capacity", () => {
  const c = buildProjectCapacity({ rhythm: R24, activeProjectCount: 0, size: "small" });
  assert.equal(c.effectiveSize, "small");
  assert.equal(c.finalTargetMinutes, 350);
});

/* ---------- Scenario C / D: below the small floor → INSUFFICIENT, not a floored small ---------- */
test("Scenario C: medium under scarcity (~112 avail) → insufficient_capacity, no target", () => {
  const c = buildProjectCapacity({ rhythm: R4, activeProjectCount: 2, size: "medium" });
  assert.equal(c.requestedSize, "medium");
  assert.equal(c.effectiveMode, "insufficient");
  assert.equal(c.insufficientCapacity, true);
  assert.equal(c.belowSmallFloor, true);
  assert.equal(c.finalTargetMinutes, 0);
});
test("Scenario D: large requested with only small capacity → insufficient (defer/rebalance)", () => {
  const c = buildProjectCapacity({ rhythm: R4, activeProjectCount: 2, size: "large" });
  assert.equal(c.requestedSize, "large");
  assert.equal(c.effectiveMode, "insufficient");
  assert.equal(c.finalTargetMinutes, 0);
});

/* ---------- Scenario F: almost no capacity → insufficient, structured safe outcome ---------- */
test("Scenario F: almost no capacity → insufficient_capacity, structured safe outcome (no target)", () => {
  const c = buildProjectCapacity({ rhythm: tiny, activeProjectCount: 0, size: "medium" });
  assert.equal(c.effectiveMode, "insufficient");
  assert.equal(c.insufficientCapacity, true);
  assert.equal(c.finalTargetMinutes, 0);
  assert.ok(c.availableProjectMinutes < 200);
  assert.ok(/full|save|pausing|room/i.test(c.sizeAdjustmentReason));
  assert.equal(c.allocationConfidence, "low");
});

/* ---------- effectiveSize is always a standard band; only two live modes ---------- */
test("effectiveSize is always small|medium|large; effectiveMode is standard|insufficient (no public micro tier)", () => {
  for (const rhythm of [tiny, R4, R12, R24]) {
    for (const n of [0, 2, 3]) {
      const c = buildProjectCapacity({ rhythm, activeProjectCount: n, size: "large" });
      assert.ok(["small", "medium", "large"].includes(c.effectiveSize));
      assert.ok(["standard", "insufficient"].includes(c.effectiveMode));
    }
  }
});

/* ---------- capacity math invariants ---------- */
test("reserve preserved; remaining never below zero; committed respects reserve", () => {
  for (const n of [0, 1, 2, 5, 20]) {
    const c = buildProjectCapacity({ rhythm: R4, activeProjectCount: n, size: "large" });
    assert.ok(c.reserveWeeklyMinutes > 0);
    assert.ok(c.remainingWeeklyMinutes >= 0);
    assert.ok(c.committedWeeklyMinutes <= c.totalWeeklyMinutes - c.reserveWeeklyMinutes + 1);
  }
});

/* ---------- temporary capacity circumstance ---------- */
test("capacity-reducing circumstance lowers allocation; injury does not", () => {
  const base = buildProjectCapacity({ rhythm: R12, activeProjectCount: 0, size: "medium" });
  const reduced = buildProjectCapacity({ rhythm: R12, activeProjectCount: 0, size: "medium", capacityCircumstanceKinds: ["capacity"] });
  assert.ok(reduced.totalWeeklyMinutes < base.totalWeeklyMinutes);
  const injury = buildProjectCapacity({ rhythm: R12, activeProjectCount: 0, size: "medium", capacityCircumstanceKinds: ["injury"] });
  assert.equal(injury.totalWeeklyMinutes, base.totalWeeklyMinutes);
});

/* ========================================================================
   SUBSTANCE CHECK — validates against BOTH the final target AND the hard ceiling
   ======================================================================== */
test("a project OVER real capacity is exceeds_capacity, NEVER silently ok", () => {
  const bloated = { milestones: Array.from({ length: 6 }, () => ({ momentumPoints: 40 })) }; // ~720 min vs 336 avail
  const v = substanceCheck(bloated, STD_SMALL);
  assert.equal(v.verdict, "exceeds_capacity");
  assert.notEqual(v.verdict, "ok");
  assert.ok(v.capacityRatio > 1);
});
test("capacity ceiling OVERRIDES the target tolerance: a draft within 1.5x target but over capacity fails", () => {
  // ~405 min: 405/336 = 1.2 (target-ratio alone would say 'ok') but over the ceiling.
  const overCeiling = { milestones: Array.from({ length: 5 }, () => ({ momentumPoints: 27 })) };
  const v = substanceCheck(overCeiling, STD_SMALL);
  assert.ok(v.ratio < 1.5, "target-ratio alone would pass");
  assert.equal(v.verdict, "exceeds_capacity");             // capacity check catches it anyway
});
test("a project that fits the real available time passes ok", () => {
  const fits = { milestones: Array.from({ length: 5 }, () => ({ momentumPoints: 20 })) }; // ~300 min ≤ 336
  assert.equal(substanceCheck(fits, STD_SMALL).verdict, "ok");
});
test("above target but WITHIN capacity is large_for_target (tolerated, not over-capacity)", () => {
  const big = { milestones: Array.from({ length: 10 }, () => ({ momentumPoints: 40 })) }; // ~1200 min, avail 2016
  const v = substanceCheck(big, STD_MED);
  assert.equal(v.verdict, "large_for_target");
  assert.ok(v.estTotalMinutes <= v.availableProjectMinutes);
});
test("insufficient-capacity capacity → substance passthrough is insufficient_capacity", () => {
  assert.equal(substanceCheck({ milestones: [{ momentumPoints: 10 }] }, INSUFFICIENT).verdict, "insufficient_capacity");
});
test("missing milestone durations use the momentum-point fallback", () => {
  assert.equal(estimateMilestoneMinutes({}), 30);
  assert.equal(estimateMilestoneMinutes({ momentumPoints: 20 }), 60);
  assert.equal(estimateMilestoneMinutes({ momentumPoints: 100 }), 120);
});

/* ---------- parent-facing copy is simple + non-judgmental ---------- */
test("size / capacity explanations are gentle and never blame the parent's choice", () => {
  const capped = buildProjectCapacity({ rhythm: R12, activeProjectCount: 2, size: "medium" }); // capped note
  for (const reason of [capped.sizeAdjustmentReason, INSUFFICIENT.sizeAdjustmentReason]) {
    assert.doesNotMatch(reason, /invalid|wrong|too (big|much|ambitious)|error|fail/i);
  }
});
test("the prompt capacity block frames the total as a CEILING, not a goal to fill", () => {
  const c = buildProjectCapacity({ rhythm: R12, activeProjectCount: 2, size: "medium" }); // standard, capped
  const block = renderCapacityBlock(c, "Mia");
  assert.match(block, /ceiling/i);
  assert.match(block, /Mia/);
});

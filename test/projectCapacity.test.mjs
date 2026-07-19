/* Unit tests for capacity allocation, effective size, and the HARD CAPACITY
   CEILING (projectCapacity.js). Pure → `node --test`.

   The central invariant under test:  finalTargetMinutes <= availableProjectMinutes.
   A size-band floor may inform which band is chosen but must NEVER manufacture
   time above the child's real available capacity. Live scenarios A–F run against
   the deployed function in the verification pass. */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildProjectCapacity, activeProjectCount, estimateMilestoneMinutes, substanceCheck, renderCapacityBlock,
} from "../supabase/functions/_shared/projectCapacity.js";

const R12  = { daysPerWeek: 4, hoursPerDay: 3 };    // 12h/week
const R4   = { daysPerWeek: 2, hoursPerDay: 2 };    // 4h/week
const R24  = { daysPerWeek: 6, hoursPerDay: 4 };    // 24h/week
const tiny = { daysPerWeek: 1, hoursPerDay: 0.5 };  // 30min/week

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
  // Scenario C: ~56 min/week slot → ~112 available over 2 weeks. The OLD bug raised
  // this to the 200-min small floor and produced ~300 min. That must be impossible.
  const c = buildProjectCapacity({ rhythm: R4, activeProjectCount: 2, size: "medium" });
  assert.ok(c.availableProjectMinutes <= 120, `available ~112, got ${c.availableProjectMinutes}`);
  assert.equal(c.finalTargetMinutes, c.availableProjectMinutes);       // compact fits real time
  assert.ok(c.finalTargetMinutes < 200, "target must not be raised to the 200-min small floor");
  assert.ok(c.finalTargetMinutes <= 120, `target ~112, got ${c.finalTargetMinutes}`);
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

/* ---------- Scenario C / D: down-shift to a COMPACT experience, not a floored small ---------- */
test("Scenario C: medium under scarcity → small band, COMPACT mode, target = real available", () => {
  const c = buildProjectCapacity({ rhythm: R4, activeProjectCount: 2, size: "medium" });
  assert.equal(c.requestedSize, "medium");
  assert.equal(c.effectiveSize, "small");
  assert.equal(c.effectiveMode, "compact");
  assert.equal(c.belowSmallFloor, true);
  assert.equal(c.finalTargetMinutes, c.availableProjectMinutes);
});
test("Scenario D: large requested with only small capacity → compact, still capped at real time", () => {
  const c = buildProjectCapacity({ rhythm: R4, activeProjectCount: 2, size: "large" });
  assert.equal(c.requestedSize, "large");
  assert.equal(c.effectiveMode, "compact");
  assert.ok(c.finalTargetMinutes <= c.availableProjectMinutes);
});

/* ---------- Scenario F: below the meaningful minimum → insufficient, no generation ---------- */
test("Scenario F: almost no capacity → insufficient_capacity, structured safe outcome (no target)", () => {
  const c = buildProjectCapacity({ rhythm: tiny, activeProjectCount: 0, size: "medium" });
  assert.equal(c.effectiveMode, "insufficient");
  assert.equal(c.insufficientCapacity, true);
  assert.equal(c.finalTargetMinutes, 0);                   // nothing generated
  assert.ok(c.availableProjectMinutes < 60);
  assert.ok(/full|save|pausing|room/i.test(c.sizeAdjustmentReason));
  assert.equal(c.allocationConfidence, "low");
});

/* ---------- no public "micro" tier: effectiveSize is always a standard band ---------- */
test("no public micro tier — effectiveSize is always small|medium|large; compactness is an internal mode", () => {
  for (const rhythm of [tiny, R4, R12, R24]) {
    const c = buildProjectCapacity({ rhythm, activeProjectCount: 3, size: "large" });
    assert.ok(["small", "medium", "large"].includes(c.effectiveSize));
    assert.ok(["standard", "compact", "insufficient"].includes(c.effectiveMode));
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
   SUBSTANCE CHECK — validates against BOTH target AND the hard ceiling
   ======================================================================== */
test("a project OVER real capacity is exceeds_capacity, NEVER silently ok", () => {
  const c = buildProjectCapacity({ rhythm: R4, activeProjectCount: 2, size: "medium" }); // available ~112
  const bloated = { milestones: Array.from({ length: 5 }, () => ({ momentumPoints: 20 })) }; // ~300 min
  const v = substanceCheck(bloated, c);
  assert.equal(v.verdict, "exceeds_capacity");
  assert.notEqual(v.verdict, "ok");
  assert.ok(v.capacityRatio > 1);
});
test("a compact project that fits the real available time passes ok", () => {
  const c = buildProjectCapacity({ rhythm: R4, activeProjectCount: 2, size: "medium" }); // target ~112
  const fits = { milestones: [{ momentumPoints: 18 }, { momentumPoints: 18 }] };          // ~108 min
  assert.equal(substanceCheck(fits, c).verdict, "ok");
});
test("above target but WITHIN capacity is large_for_target (tolerated, not over-capacity)", () => {
  const c = buildProjectCapacity({ rhythm: R12, activeProjectCount: 0, size: "medium" });  // target 750, available 2016
  const big = { milestones: Array.from({ length: 10 }, () => ({ momentumPoints: 40 })) };   // ~1200 min
  const v = substanceCheck(big, c);
  assert.equal(v.verdict, "large_for_target");
  assert.ok(v.estTotalMinutes <= v.availableProjectMinutes);
});
test("insufficient-capacity capacity → substance passthrough is insufficient_capacity", () => {
  const c = buildProjectCapacity({ rhythm: tiny, activeProjectCount: 0, size: "medium" });
  assert.equal(substanceCheck({ milestones: [{ momentumPoints: 10 }] }, c).verdict, "insufficient_capacity");
});
test("substance never passes a draft solely by matching a target that exceeded capacity", () => {
  // Construct a capacity where target == available (compact); any draft above available fails hard.
  const c = buildProjectCapacity({ rhythm: R4, activeProjectCount: 2, size: "small" }); // compact, target≈avail
  const overByABit = { milestones: Array.from({ length: 4 }, () => ({ momentumPoints: 20 })) }; // ~240 min
  assert.equal(substanceCheck(overByABit, c).verdict, "exceeds_capacity");
});
test("missing milestone durations use the momentum-point fallback", () => {
  assert.equal(estimateMilestoneMinutes({}), 30);
  assert.equal(estimateMilestoneMinutes({ momentumPoints: 20 }), 60);
  assert.equal(estimateMilestoneMinutes({ momentumPoints: 100 }), 120);
});

/* ---------- parent-facing copy is simple + non-judgmental ---------- */
test("size / capacity explanations are gentle and never blame the parent's choice", () => {
  const compact = buildProjectCapacity({ rhythm: R4, activeProjectCount: 2, size: "medium" });
  const insufficient = buildProjectCapacity({ rhythm: tiny, activeProjectCount: 0, size: "medium" });
  for (const reason of [compact.sizeAdjustmentReason, insufficient.sizeAdjustmentReason]) {
    assert.doesNotMatch(reason, /invalid|wrong|too (big|much|ambitious)|error|fail/i);
  }
});
test("the prompt capacity block frames the total as a CEILING, not a goal to fill", () => {
  const c = buildProjectCapacity({ rhythm: R4, activeProjectCount: 2, size: "medium" }); // compact
  const block = renderCapacityBlock(c, "Mia");
  assert.match(block, /ceiling/i);
  assert.match(block, /self-contained|short/i);
  assert.match(block, /Mia/);
});

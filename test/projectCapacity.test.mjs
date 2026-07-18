/* Unit tests for capacity allocation + effectiveSize (projectCapacity.js).
   Pure → `node --test`. Live scenarios A–E in the verification run. */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildProjectCapacity, activeProjectCount, estimateMilestoneMinutes, substanceCheck, renderCapacityBlock,
} from "../supabase/functions/_shared/projectCapacity.js";

const R12 = { daysPerWeek: 4, hoursPerDay: 3 };   // 12h/week
const R4  = { daysPerWeek: 2, hoursPerDay: 2 };   // 4h/week
const tiny = { daysPerWeek: 1, hoursPerDay: 0.5 }; // 30min/week

/* ---------- active-project counting ---------- */
test("only in-progress projects consume capacity", () => {
  assert.equal(activeProjectCount([
    { status: "active" }, { status: "ready-for-reflection" },
    { status: "completed" }, { status: "paused" }, { status: "draft" },
  ]), 2);
});

/* ---------- requested size preserved separately from effective size ---------- */
test("requestedSize and effectiveSize are both exposed and distinct concepts", () => {
  const c = buildProjectCapacity({ rhythm: R4, activeProjectCount: 2, size: "medium" });
  assert.equal(c.requestedSize, "medium");           // never overwritten
  assert.equal(c.effectiveSize, "small");            // what capacity supports
  assert.ok(c.sizeAdjustmentReason);
});

/* ---------- no unnecessary down-shift ---------- */
test("requested medium REMAINS medium when capacity supports it", () => {
  const c = buildProjectCapacity({ rhythm: R12, activeProjectCount: 0, size: "medium" });
  assert.equal(c.effectiveSize, "medium");
  assert.equal(c.sizeAdjustmentReason, null);
  assert.equal(c.expectedProjectWeeks, 4);
});
test("a small request is never up-shifted even with abundant capacity", () => {
  const c = buildProjectCapacity({ rhythm: R12, activeProjectCount: 0, size: "small" });
  assert.equal(c.effectiveSize, "small");
});

/* ---------- down-shift under scarcity (the Scenario C defect) ---------- */
test("requested medium DOWN-SHIFTS to small under scarcity (Scenario C)", () => {
  const c = buildProjectCapacity({ rhythm: R4, activeProjectCount: 2, size: "medium" });
  assert.equal(c.effectiveSize, "small");
  assert.equal(c.expectedProjectWeeks, 2);                 // structure follows effectiveSize
  assert.ok(c.targetTotalMinutes <= 350, "small band size");
});
test("requested large DOWN-SHIFTS appropriately under scarcity", () => {
  const c = buildProjectCapacity({ rhythm: R4, activeProjectCount: 2, size: "large" });
  assert.equal(c.requestedSize, "large");
  assert.equal(c.effectiveSize, "small");                  // 56min/wk can't sustain large or medium floors
});

/* ---------- effectiveSize changes STRUCTURE, not just the label ---------- */
test("effectiveSize changes weeks + target total (structural, not cosmetic)", () => {
  const abundant = buildProjectCapacity({ rhythm: R12, activeProjectCount: 0, size: "medium" }); // medium
  const scarce   = buildProjectCapacity({ rhythm: R4, activeProjectCount: 2, size: "medium" });  // → small
  assert.ok(scarce.expectedProjectWeeks < abundant.expectedProjectWeeks);
  assert.ok(scarce.targetTotalMinutes < abundant.targetTotalMinutes);
  const block = renderCapacityBlock(scarce, "Mia");
  assert.match(block, /genuine small quest/);              // instructs a real small, not a shrunken medium
  assert.match(block, /Mia/);
});

/* ---------- size bands are measurable + non-overlapping ---------- */
test("size bands map to distinct total-minute ranges", () => {
  const s = buildProjectCapacity({ rhythm: R12, activeProjectCount: 0, size: "small" });
  const m = buildProjectCapacity({ rhythm: R12, activeProjectCount: 0, size: "medium" });
  const l = buildProjectCapacity({ rhythm: { daysPerWeek: 6, hoursPerDay: 4 }, activeProjectCount: 0, size: "large" });
  assert.ok(s.targetTotalMinutes <= 350);
  assert.ok(m.targetTotalMinutes > 350 && m.targetTotalMinutes <= 900);
  assert.ok(l.targetTotalMinutes > 900 && l.targetTotalMinutes <= 2000);
  assert.ok(s.targetTotalMinutes < m.targetTotalMinutes && m.targetTotalMinutes < l.targetTotalMinutes);
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

/* ---------- extremely low capacity → safe, explicit ---------- */
test("extremely low capacity produces a safe, explicit minimal project (no crash, flagged)", () => {
  const c = buildProjectCapacity({ rhythm: tiny, activeProjectCount: 0, size: "medium" });
  assert.equal(c.effectiveSize, "small");
  assert.equal(c.belowSmallFloor, true);
  assert.ok(/minimal|very limited/i.test(c.sizeAdjustmentReason));
  assert.ok(c.targetTotalMinutes >= 60);                  // floored to a worthwhile minimum, never 0
  assert.equal(c.allocationConfidence, "low");
});

/* ---------- parent-facing explanation is simple + non-judgmental ---------- */
test("size-adjustment explanation is gentle and never blames the parent's choice", () => {
  const c = buildProjectCapacity({ rhythm: R4, activeProjectCount: 2, size: "medium" });
  assert.match(c.sizeAdjustmentReason, /support|current week|active project|limited/i);
  assert.doesNotMatch(c.sizeAdjustmentReason, /invalid|wrong|too (big|much|ambitious)|can't|cannot|error/i);
});

/* ---------- substance check: honest, not silently "passing" ---------- */
test("regeneration is avoided for deterministic mismatch: a small project fits the small target", () => {
  const c = buildProjectCapacity({ rhythm: R4, activeProjectCount: 2, size: "medium" }); // effective small, target ~112
  // a genuine small project (3 short milestones) lands in-band → verdict ok → NO regen
  const smallProject = { milestones: [{ momentumPoints: 15 }, { momentumPoints: 15 }, { momentumPoints: 10 }] };
  assert.equal(substanceCheck(smallProject, c).verdict, "ok");
});
test("a still-oversized result is reported as large, not silently ok", () => {
  const c = buildProjectCapacity({ rhythm: R4, activeProjectCount: 2, size: "medium" }); // target ~112
  const bloated = { milestones: Array.from({ length: 7 }, () => ({ momentumPoints: 40 })) }; // ~840 min
  assert.equal(substanceCheck(bloated, c).verdict, "large");
});
test("missing milestone durations use the momentum-point fallback", () => {
  assert.equal(estimateMilestoneMinutes({}), 30);
  assert.equal(estimateMilestoneMinutes({ momentumPoints: 20 }), 60);
  assert.equal(estimateMilestoneMinutes({ momentumPoints: 100 }), 120);
});

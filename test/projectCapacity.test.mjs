/* Unit tests for capacity allocation (supabase/functions/_shared/projectCapacity.js).
   Pure → `node --test`. Live scenarios A–D + isolation are in the verification run. */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildProjectCapacity, activeProjectCount, estimateMilestoneMinutes, substanceCheck,
} from "../supabase/functions/_shared/projectCapacity.js";

const R12 = { daysPerWeek: 4, hoursPerDay: 3 };   // 12h/week = 720 min
const R4  = { daysPerWeek: 2, hoursPerDay: 2 };   // 4h/week = 240 min

/* ---------- active-project counting (state discipline) ---------- */
test("only in-progress projects consume capacity; paused/completed/draft do not", () => {
  const projects = [
    { status: "active" }, { status: "ready-for-reflection" },
    { status: "completed" }, { status: "paused" }, { status: "draft" },
  ];
  assert.equal(activeProjectCount(projects), 2);
});

/* ---------- no active projects ---------- */
test("no active projects: nothing committed, moderate confidence, reserve preserved", () => {
  const c = buildProjectCapacity({ rhythm: R12, activeProjectCount: 0, size: "medium" });
  assert.equal(c.totalWeeklyMinutes, 720);
  assert.equal(c.reserveWeeklyMinutes, 216);           // 30%
  assert.equal(c.committedWeeklyMinutes, 0);
  assert.equal(c.remainingWeeklyMinutes, 504);         // 720 - 216
  assert.equal(c.allocationConfidence, "moderate");
  assert.ok(c.targetWeeklyMinutesForProject > 0 && c.targetWeeklyMinutesForProject <= 504);
});

/* ---------- one active project ---------- */
test("one active project: ~half of allocatable committed; confidence drops to low", () => {
  const c = buildProjectCapacity({ rhythm: R12, activeProjectCount: 1, size: "medium" });
  assert.equal(c.committedWeeklyMinutes, 252);          // 504/2
  assert.equal(c.remainingWeeklyMinutes, 252);
  assert.equal(c.allocationConfidence, "low");          // committed is a fallback guess
  assert.ok(c.assumptions.some((a) => /fallback/i.test(a)));
});

/* ---------- several active projects: committed capped, room always left ---------- */
test("several active projects: committed capped at 75% of allocatable; new project still gets room", () => {
  const c = buildProjectCapacity({ rhythm: R12, activeProjectCount: 5, size: "medium" });
  assert.ok(c.committedWeeklyMinutes <= Math.round(504 * 0.75) + 1);
  assert.ok(c.remainingWeeklyMinutes >= Math.round(504 * 0.25) - 1);   // always some room
  assert.ok(c.remainingWeeklyMinutes >= 0);
});

/* ---------- small / medium / large differ materially ---------- */
test("small, medium, large differ materially in weeks and total time", () => {
  const s = buildProjectCapacity({ rhythm: R12, activeProjectCount: 0, size: "small" });
  const m = buildProjectCapacity({ rhythm: R12, activeProjectCount: 0, size: "medium" });
  const l = buildProjectCapacity({ rhythm: R12, activeProjectCount: 0, size: "large" });
  assert.deepEqual([s.expectedProjectWeeks, m.expectedProjectWeeks, l.expectedProjectWeeks], [2, 4, 8]);
  assert.ok(s.targetTotalMinutes < m.targetTotalMinutes, "small < medium total");
  assert.ok(m.targetTotalMinutes < l.targetTotalMinutes, "medium < large total");
  assert.ok(s.targetWeeklyMinutesForProject < l.targetWeeklyMinutesForProject);
});

test("auto is treated as medium", () => {
  const a = buildProjectCapacity({ rhythm: R12, activeProjectCount: 0, size: "auto" });
  const m = buildProjectCapacity({ rhythm: R12, activeProjectCount: 0, size: "medium" });
  assert.equal(a.expectedProjectWeeks, m.expectedProjectWeeks);
});

/* ---------- low vs high capacity ---------- */
test("low-capacity rhythm yields a smaller allocation than high-capacity", () => {
  const low = buildProjectCapacity({ rhythm: R4, activeProjectCount: 0, size: "medium" });
  const high = buildProjectCapacity({ rhythm: R12, activeProjectCount: 0, size: "medium" });
  assert.equal(low.totalWeeklyMinutes, 240);
  assert.ok(low.targetWeeklyMinutesForProject < high.targetWeeklyMinutesForProject);
});

/* ---------- invariants: remaining >= 0, reserve preserved ---------- */
test("remaining capacity never goes below zero; reserve always preserved", () => {
  for (const n of [0, 1, 2, 3, 8, 20]) {
    const c = buildProjectCapacity({ rhythm: R4, activeProjectCount: n, size: "large" });
    assert.ok(c.remainingWeeklyMinutes >= 0, `remaining >=0 for ${n}`);
    assert.ok(c.committedWeeklyMinutes <= c.totalWeeklyMinutes - c.reserveWeeklyMinutes + 1, `committed respects reserve for ${n}`);
    assert.ok(c.reserveWeeklyMinutes > 0);
  }
});

/* ---------- temporary capacity circumstance reduces allocation ---------- */
test("a capacity-reducing circumstance lowers the allocation; injury does NOT", () => {
  const base = buildProjectCapacity({ rhythm: R12, activeProjectCount: 0, size: "medium" });
  const reduced = buildProjectCapacity({ rhythm: R12, activeProjectCount: 0, size: "medium", capacityCircumstanceKinds: ["capacity"] });
  assert.ok(reduced.totalWeeklyMinutes < base.totalWeeklyMinutes);      // 60%
  assert.ok(reduced.targetWeeklyMinutesForProject < base.targetWeeklyMinutesForProject);
  assert.equal(reduced.allocationConfidence, "low");
  // injury reshapes activity, not time — capacity unchanged
  const injury = buildProjectCapacity({ rhythm: R12, activeProjectCount: 0, size: "medium", capacityCircumstanceKinds: ["injury"] });
  assert.equal(injury.totalWeeklyMinutes, base.totalWeeklyMinutes);
});

/* ---------- substance check ---------- */
test("substance check: within tolerance = ok; too thin / too large flagged", () => {
  const cap = buildProjectCapacity({ rhythm: R12, activeProjectCount: 0, size: "medium" }); // targetTotal ~ 400*4? compute below
  const target = cap.targetTotalMinutes;
  // build milestones whose estimate ~ target (ok)
  const perMs = 60; // 20 pts -> 60 min
  const okCount = Math.max(1, Math.round(target / perMs));
  const ok = { milestones: Array.from({ length: okCount }, () => ({ momentumPoints: 20 })) };
  assert.equal(substanceCheck(ok, cap).verdict, "ok");
  // too thin: one tiny milestone
  assert.equal(substanceCheck({ milestones: [{ momentumPoints: 5 }] }, cap).verdict, "thin");
  // too large: many heavy milestones
  const big = { milestones: Array.from({ length: okCount * 3 }, () => ({ momentumPoints: 40 })) };
  assert.equal(substanceCheck(big, cap).verdict, "large");
});

test("substance check: missing milestone durations use the momentum-point fallback", () => {
  assert.equal(estimateMilestoneMinutes({}), 30);                 // default 10 pts * 3
  assert.equal(estimateMilestoneMinutes({ momentumPoints: 20 }), 60);
  assert.equal(estimateMilestoneMinutes({ momentumPoints: 100 }), 120);  // capped
  assert.equal(estimateMilestoneMinutes({ momentumPoints: 1 }), 20);     // floored
});

test("substance check: no milestones or no target = unknown (not a false pass/fail)", () => {
  const cap = buildProjectCapacity({ rhythm: R12, activeProjectCount: 0, size: "medium" });
  assert.equal(substanceCheck({ milestones: [] }, cap).verdict, "unknown");
  assert.equal(substanceCheck({ milestones: [{ momentumPoints: 20 }] }, { targetTotalMinutes: 0 }).verdict, "unknown");
});

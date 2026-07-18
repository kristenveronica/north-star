/* Unit tests for the milestone/project completion Archive builders
   (js/lib/milestoneArchive.js). Pure → `node --test`. RLS / unauthorized /
   missing-row cases are in rls_behavioral.sql + the live verification run. */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMilestoneCompleted, buildMilestoneUncompleted, buildProjectCompleted,
} from "../js/lib/milestoneArchive.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/;
const FAM = "d5292c4a-f678-4416-a134-982b06fcd7d4";
const KID = "ef77e1c6-9242-49f9-bdc3-caa5cf77a304";
const USER = "b1376734-cc47-4591-901f-01bffd57fcfc";
const T1 = "2026-07-18T10:00:00.000Z";
const T2 = "2026-07-18T11:30:00.000Z";

// "Record what happened, not what it means" — metadata may hold only these keys.
const ALLOWED = {
  milestone_completed: new Set(["event", "source", "projectId", "milestoneId", "momentumPoints", "estimatedProjectDurationDays", "finalMilestone"]),
  milestone_uncompleted: new Set(["event", "source", "projectId", "milestoneId", "previousCompletedAt"]),
  project_completed: new Set(["event", "source", "projectId", "trigger"]),
};
const NO_INTERPRETATION = ["interest", "enjoyment", "mastery", "motivation", "preference", "difficulty", "calibration", "success"];
function assertNoInterpretation(meta) {
  const blob = JSON.stringify(meta).toLowerCase();
  for (const w of NO_INTERPRETATION) assert.ok(!blob.includes(w), `metadata must not interpret ("${w}")`);
}

/* ---------- first completion ---------- */
test("first completion: canonical milestone_progress / milestone_completed", () => {
  const c = buildMilestoneCompleted({
    familyId: FAM, childId: KID, projectId: "proj-1", milestoneId: "ms-1", milestoneTitle: "Build the frame",
    momentumPoints: 15, estimatedProjectDurationDays: 21, finalMilestone: false, actor: USER, completedAt: T1,
  });
  assert.equal(c.sourceType, "milestone_progress");
  assert.equal(c.scope, "child");
  assert.equal(c.subjectId, KID);
  assert.equal(c.createdBy, USER);
  assert.equal(c.occurredAt, T1);
  assert.equal(c.metadata.event, "milestone_completed");
  assert.equal(c.metadata.projectId, "proj-1");
  assert.equal(c.metadata.milestoneId, "ms-1");
  assert.equal(c.metadata.momentumPoints, 15);
  assert.equal(c.metadata.estimatedProjectDurationDays, 21);
  assert.equal(c.metadata.finalMilestone, false);
  assert.match(c.id, UUID_RE);
  assert.deepEqual(new Set(Object.keys(c.metadata)), ALLOWED.milestone_completed);
  assertNoInterpretation(c.metadata);
  // actual duration & depth are NOT captured → must be absent (never fabricated)
  assert.ok(!("actualDurationDays" in c.metadata) && !("depthReached" in c.metadata));
});

test("final milestone flags the project's work as finished (the old writer's fact)", () => {
  const c = buildMilestoneCompleted({ familyId: FAM, childId: KID, projectId: "p", milestoneId: "m", finalMilestone: true, completedAt: T1 });
  assert.equal(c.metadata.finalMilestone, true);
});

/* ---------- duplicate retry → idempotent ---------- */
test("duplicate retry: same milestone + same completedAt → same id", () => {
  const args = { familyId: FAM, childId: KID, projectId: "p", milestoneId: "ms-1", completedAt: T1 };
  assert.equal(buildMilestoneCompleted(args).id, buildMilestoneCompleted(args).id);
});

/* ---------- undo completion ---------- */
test("undo: first-class milestone_uncompleted event, records the completion it undoes", () => {
  const u = buildMilestoneUncompleted({
    familyId: FAM, childId: KID, projectId: "p", milestoneId: "ms-1", undoneAt: T2, previousCompletedAt: T1,
  });
  assert.equal(u.sourceType, "milestone_progress");
  assert.equal(u.metadata.event, "milestone_uncompleted");
  assert.equal(u.metadata.previousCompletedAt, T1);
  assert.equal(u.occurredAt, T2);
  assert.deepEqual(new Set(Object.keys(u.metadata)), ALLOWED.milestone_uncompleted);
});

/* ---------- re-completion after undo → distinct event ---------- */
test("re-completion after undo: new completedAt → NEW id (faithful history, not a dedupe)", () => {
  const first = buildMilestoneCompleted({ familyId: FAM, childId: KID, projectId: "p", milestoneId: "ms-1", completedAt: T1 });
  const undo = buildMilestoneUncompleted({ familyId: FAM, childId: KID, projectId: "p", milestoneId: "ms-1", undoneAt: T2, previousCompletedAt: T1 });
  const again = buildMilestoneCompleted({ familyId: FAM, childId: KID, projectId: "p", milestoneId: "ms-1", completedAt: "2026-07-18T12:00:00.000Z" });
  assert.equal(new Set([first.id, undo.id, again.id]).size, 3);   // three distinct factual events
});

/* ---------- two different milestones ---------- */
test("two different milestones → different ids", () => {
  const a = buildMilestoneCompleted({ familyId: FAM, childId: KID, projectId: "p", milestoneId: "ms-1", completedAt: T1 });
  const b = buildMilestoneCompleted({ familyId: FAM, childId: KID, projectId: "p", milestoneId: "ms-2", completedAt: T1 });
  assert.notEqual(a.id, b.id);
});

/* ---------- project completion (separately triggered) ---------- */
test("project completion: distinct event, records how it was reached", () => {
  const pc = buildProjectCompleted({ familyId: FAM, childId: KID, projectId: "proj-1", actor: USER, completedAt: T1, trigger: "reflection" });
  assert.equal(pc.sourceType, "milestone_progress");
  assert.equal(pc.metadata.event, "project_completed");
  assert.equal(pc.metadata.trigger, "reflection");
  assert.deepEqual(new Set(Object.keys(pc.metadata)), ALLOWED.project_completed);
  // distinct from a milestone completion of the same project
  const ms = buildMilestoneCompleted({ familyId: FAM, childId: KID, projectId: "proj-1", milestoneId: "m", completedAt: T1 });
  assert.notEqual(pc.id, ms.id);
  assert.equal(buildProjectCompleted({ familyId: FAM, childId: KID, projectId: "proj-1", completedAt: T1 }).id,
               buildProjectCompleted({ familyId: FAM, childId: KID, projectId: "proj-1", completedAt: T1 }).id); // idempotent
});

/* ---------- missing / deleted milestone or project → graceful ---------- */
test("missing ids: builders tolerate nulls (no throw, valid stable payload)", () => {
  const c = buildMilestoneCompleted({ familyId: FAM, childId: KID, projectId: null, milestoneId: null, completedAt: T1 });
  assert.match(c.id, UUID_RE);
  assert.equal(c.metadata.projectId, null);
  assert.equal(c.metadata.milestoneId, null);
  const pc = buildProjectCompleted({ familyId: FAM, childId: KID, projectId: null, completedAt: T1 });
  assert.match(pc.id, UUID_RE);
});

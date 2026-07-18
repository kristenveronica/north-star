/* ============================================================================
   Milestone / project completion → Archive (the second write producer).

   Replaces the old preference_signals "completed" write (the LAST project-
   lifecycle writer). When a milestone is completed or undone, or a project is
   completed, that is something that HAPPENED — it belongs in the Archive
   (docs/lfm-architecture.md).

   DESIGN RULES (same discipline as projectArchive.js):
   • Record what happened, not what it means (no interest / enjoyment / mastery /
     motivation / preference / difficulty-calibration inference). Distillation,
     later, decides what completion may mean.
   • Preserve the product's real distinctions — milestone_completed vs
     milestone_uncompleted vs project_completed — via metadata.event. (The product
     has no skip/abandon/optional-extension states, so we invent none.)
   • Idempotent: ids key off the event timestamp, so a retry of the SAME action
     de-dupes, while an undo→re-complete is a genuinely NEW event (new timestamp),
     giving a faithful factual history even though milestone.completed toggles.

   Pure + Node-testable (only imports deterministicId, itself pure).
   One source_type ('milestone_progress') for all three; event distinguishes them.
   ============================================================================ */

import { deterministicId } from "./projectArchive.js";

const SOURCE_MILESTONE_PROGRESS = "milestone_progress"; // mirrors lfm.js SOURCE.MILESTONE_PROGRESS
const SCOPE_CHILD = "child";

/* ---------- milestone completed ---------- */
// completedAt is the milestone's own completion timestamp (ISO). finalMilestone =
// this completion also finished the project's last remaining milestone (the fact
// the old preference_signals writer captured). estimatedProjectDurationDays is the
// only duration KNOWN at completion; actual duration / depth are NOT captured here,
// so they are deliberately absent (never fabricated).
export function buildMilestoneCompleted({
  familyId, childId, projectId, milestoneId, milestoneTitle,
  momentumPoints, estimatedProjectDurationDays, finalMilestone, actor, completedAt,
}) {
  return {
    id: deterministicId(`milestone_completed:${familyId}:${milestoneId}:${completedAt}`),
    scope: SCOPE_CHILD,
    subjectId: childId,
    sourceType: SOURCE_MILESTONE_PROGRESS,
    title: milestoneTitle || null,
    occurredAt: completedAt || null,
    createdBy: actor || null,
    metadata: {
      event: "milestone_completed",
      source: "milestone_toggle",
      projectId: projectId || null,
      milestoneId: milestoneId || null,
      momentumPoints: momentumPoints ?? null,
      estimatedProjectDurationDays: estimatedProjectDurationDays ?? null,
      finalMilestone: !!finalMilestone,   // did this complete the project's milestones?
    },
  };
}

/* ---------- milestone un-completed (undo) — a first-class factual event ------- */
export function buildMilestoneUncompleted({
  familyId, childId, projectId, milestoneId, milestoneTitle, actor, undoneAt, previousCompletedAt,
}) {
  return {
    id: deterministicId(`milestone_uncompleted:${familyId}:${milestoneId}:${undoneAt}`),
    scope: SCOPE_CHILD,
    subjectId: childId,
    sourceType: SOURCE_MILESTONE_PROGRESS,
    title: milestoneTitle || null,
    occurredAt: undoneAt || null,
    createdBy: actor || null,
    metadata: {
      event: "milestone_uncompleted",
      source: "milestone_toggle",
      projectId: projectId || null,
      milestoneId: milestoneId || null,
      previousCompletedAt: previousCompletedAt || null,  // the completion being undone
    },
  };
}

/* ---------- project completed (separate trigger: reflection submitted) -------- */
export function buildProjectCompleted({ familyId, childId, projectId, actor, completedAt, trigger }) {
  return {
    id: deterministicId(`project_completed:${familyId}:${projectId}:${completedAt}`),
    scope: SCOPE_CHILD,
    subjectId: childId,
    sourceType: SOURCE_MILESTONE_PROGRESS,
    occurredAt: completedAt || null,
    createdBy: actor || null,
    metadata: {
      event: "project_completed",
      source: "project_lifecycle",
      projectId: projectId || null,
      trigger: trigger || null,          // e.g. 'reflection' — how completion was reached (factual)
    },
  };
}

/* ============================================================================
   Project decisions → Archive (the first canonical write producer).

   When a parent ACCEPTS, EDITS, or DECLINES a generated project proposal, that
   is something that HAPPENED — it belongs in the Archive (docs/lfm-architecture.md).
   This module builds the canonical Archive payload for each and writes it.

   Replaces the old preference_signals write for these three events (no dual-write).

   DESIGN RULES honoured here:
   • Record what happened, not what it means (requirement #6). No interpretation,
     no scoring, no "this parent prefers X" — the builders only capture raw facts.
     Distillation (a later slice) decides what it may mean.
   • An edit is NOT an accept. It is its own high-value entry that preserves the
     DELTA (the parent's requested change + the pre-edit proposal) without judging it.
   • Idempotent: each event has a deterministic id from its natural key, so a retry
     or double-click upserts the same row rather than duplicating evidence (#7).

   The build* functions are PURE (no imports, fully param-driven) so they are unit-
   testable under `node --test`. Only recordProjectDecision touches Supabase.

   Source-type mapping follows docs/project-generation-v2.md §4:
     accepted → 'project_decision'   edited → 'feedback'   declined → 'feedback'
   ============================================================================ */

// Kept as local literals (mirrors lfm.js SOURCE/SCOPE) so the builders import
// nothing and stay Node-pure. Values MUST match lfm.js.
const SOURCE_PROJECT_DECISION = "project_decision";
const SOURCE_FEEDBACK = "feedback";
const SCOPE_CHILD = "child";

/* ---------- deterministic id: stable UUID from a natural key (pure) ---------- */
// FNV-1a over the key, expanded to 32 hex chars, formatted as a v4-shaped UUID.
// Not cryptographic — only needs determinism + low collision within one family's
// small event volume. Same key in → same UUID out → upsert de-dupes retries.
export function deterministicId(key) {
  const str = String(key);
  // four independent FNV-1a passes with different offsets → 128 bits of hex
  const pass = (seed) => {
    let h = seed >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ("00000000" + h.toString(16)).slice(-8);
  };
  const hex = pass(0x811c9dc5) + pass(0x9e3779b1) + pass(0x85ebca77) + pass(0xc2b2ae3d);
  // Shape as UUID; force version nibble to 4 and variant to 8 for validity.
  return (
    hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-4" + hex.slice(13, 16) +
    "-8" + hex.slice(17, 20) + "-" + hex.slice(20, 32)
  );
}

/* ---------- accepted (unchanged) — the parent took the proposal as-is --------- */
export function buildAcceptedArchive({ familyId, childId, projectId, actingUserId, proposed, occurredAt }) {
  return {
    id: deterministicId(`accepted:${familyId}:${projectId}`),
    scope: SCOPE_CHILD,
    subjectId: childId,
    sourceType: SOURCE_PROJECT_DECISION,
    title: proposed?.title || null,
    occurredAt: occurredAt || null,
    createdBy: actingUserId || null,
    metadata: {
      event: "accepted",
      source: "project_generator",
      projectId: projectId || null,
      proposed: proposed || null,       // what was originally proposed (raw snapshot)
    },
  };
}

/* ---------- edited — the parent asked for a change (preserve the DELTA) -------- */
// preEdit = the proposal snapshot BEFORE this refine; refineText = what they asked
// to change. We store both, uninterpreted. `sequence` disambiguates successive
// refines while staying stable across a retry of the SAME refine.
export function buildEditedArchive({ familyId, childId, actingUserId, preEdit, refineText, sequence = 0, occurredAt }) {
  const refine = (refineText || "").trim();
  return {
    id: deterministicId(`edited:${familyId}:${childId}:${sequence}:${preEdit?.title || ""}:${refine}`),
    scope: SCOPE_CHILD,
    subjectId: childId,
    sourceType: SOURCE_FEEDBACK,
    title: preEdit?.title || null,
    content: refine || null,            // the parent's own words — the spark of the edit
    occurredAt: occurredAt || null,
    createdBy: actingUserId || null,
    metadata: {
      event: "edited",
      source: "project_generator",
      requestedChange: refine || null,  // WHAT was changed (raw), never why we think they wanted it
      preEdit: preEdit || null,         // the proposal as it stood before the change
      sequence,
    },
  };
}

/* ---------- declined — the parent dismissed the proposal ---------------------- */
// reason is optional (there is no reasons UI today; null when absent). No inference.
export function buildDeclinedArchive({ familyId, childId, actingUserId, proposed, reason, occurredAt }) {
  const r = (reason || "").trim();
  return {
    id: deterministicId(`declined:${familyId}:${childId}:${proposed?.title || ""}:${JSON.stringify(proposed?.domains || [])}`),
    scope: SCOPE_CHILD,
    subjectId: childId,
    sourceType: SOURCE_FEEDBACK,
    title: proposed?.title || null,
    content: r || null,
    occurredAt: occurredAt || null,
    createdBy: actingUserId || null,
    metadata: {
      event: "declined",
      source: "project_generator",
      reason: r || null,                // any explicit reason the parent provided (else null)
      proposed: proposed || null,       // what was declined (raw snapshot)
    },
  };
}

/* ---------- the writer (the only side-effecting part) ------------------------ */
// Thin wrapper over recordArchive; injected so this module stays test-friendly.
export async function recordProjectDecision(recordArchiveFn, familyId, payload) {
  return recordArchiveFn(familyId, payload);
}

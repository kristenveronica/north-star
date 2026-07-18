/* ============================================================================
   Living Family Model — the four-noun data-access layer.

   Canonical architecture: docs/lfm-architecture.md. North Star reasons with
   FOUR nouns, and this module is the only place the app reads/writes them:

     Archive         family_archive   — what has happened (Moments/Evidence/Reflections)
     Understanding   understandings   — what North Star currently believes
     Recommendation  recommendations  — what North Star suggests
     Report          reports          — what North Star communicates back

   Kept deliberately OUT of repo.js: the four nouns are a new subsystem that will
   eventually absorb preference_signals / parent_observations / growth_reports etc.
   (see docs/lfm-consolidation-audit.md). Isolating them here keeps that cutover a
   file boundary, not a surgery on the (large, recently-hardened) sync path.

   Writes go direct to Supabase under the RLS verified for migration 0031
   (is_family_member(family_id) — no per-child gating yet; a uniform later pass).
   ============================================================================ */

import { supabase } from "./supabase.js";
import { uid } from "../store.js";

/* ---------- Canonical vocabularies (use these, not string literals) --------- */
// Archive.source_type — the KIND of thing that happened.
export const SOURCE = Object.freeze({
  MOMENT: "moment",                       // a life event North Star accompanies
  PARENT_OBSERVATION: "parent_observation",
  CHILD_SELF_ASSESSMENT: "child_self_assessment",
  REFLECTION: "reflection",
  PROJECT_DECISION: "project_decision",   // accept/edit of a generated quest
  FEEDBACK: "feedback",                   // decline reason, too_easy/wanted_more, time_vs_estimate…
  CONVERSATION: "conversation",
  NOTE: "note",
});

// Understanding.domain — the KIND of belief (free text in DB; these are the known set).
export const DOMAIN = Object.freeze({
  INTEREST: "interest", CAPABILITY: "capability", TEMPERAMENT: "temperament",
  VALUE: "value", GROWTH_GOAL: "growth_goal", PACE: "pace",
  RHYTHM_PREFERENCE: "rhythm_preference", LEARNING_PREFERENCE: "learning_preference",
  RELATIONSHIP: "relationship", CULTURE: "culture", CHALLENGE: "challenge",
  STRENGTH: "strength", SENSITIVITY: "sensitivity", CIRCUMSTANCE: "circumstance",
  ENGAGEMENT_PATTERN: "engagement_pattern",
});

export const LIFESPAN = Object.freeze({
  PERMANENT: "permanent", SLOW_CHANGING: "slow_changing", SEASONAL: "seasonal",
  TEMPORARY: "temporary", MOMENTARY: "momentary",
});
export const PROVENANCE = Object.freeze({
  DECLARED: "declared", INFERRED: "inferred", CONFIRMED: "confirmed", CORRECTED: "corrected",
});
export const SURFACE = Object.freeze({
  DRAFT: "draft", OFFERED: "offered", CONFIRMED: "confirmed",
  CORRECTED: "corrected", DISMISSED: "dismissed", EXPIRED: "expired",
});
export const SCOPE = Object.freeze({ FAMILY: "family", CHILD: "child" });

const nowIso = () => new Date().toISOString();
const orNull = (v) => (v === undefined || v === "" ? null : v);

/* ===========================================================================
   1 · ARCHIVE — what has happened
   =========================================================================== */

/** Record one Archive entry (a Moment, a Reflection, a decision, feedback…).
 *  The atomic write of the learning loop — the raw truth Understanding rises from.
 *
 *  Idempotency: pass a stable `id` (derived from the event's natural key) and the
 *  write upserts on it, so a retry or double-submit cannot create duplicate
 *  evidence. Omit `id` for genuinely new, non-deduplicated events (a fresh uid). */
export async function recordArchive(familyId, {
  id = null, scope = SCOPE.FAMILY, subjectId = null, relatedSubjectId = null,
  sourceType = SOURCE.NOTE, title = null, content = null, summary = null,
  occurredAt = null, metadata = {}, createdBy = null,
} = {}) {
  const row = {
    id: id || uid(), family_id: familyId, scope, subject_id: subjectId,
    related_subject_id: relatedSubjectId, source_type: sourceType,
    title: orNull(title), content: orNull(content), summary: orNull(summary),
    occurred_at: occurredAt || nowIso(), metadata: metadata || {}, created_by: createdBy,
  };
  // Deterministic id → upsert (idempotent); random id → plain insert.
  const q = id
    ? supabase.from("family_archive").upsert(row, { onConflict: "id" })
    : supabase.from("family_archive").insert(row);
  const { data, error } = await q.select().single();
  if (error) throw error;
  return fromArchiveRow(data);
}

/** Read Archive entries for a family, optionally filtered by subject / source / since. */
export async function loadArchive(familyId, { subjectId, sourceType, since, limit = 500 } = {}) {
  let q = supabase.from("family_archive").select("*").eq("family_id", familyId);
  if (subjectId) q = q.eq("subject_id", subjectId);
  if (sourceType) q = q.eq("source_type", sourceType);
  if (since) q = q.gte("occurred_at", since);
  q = q.order("occurred_at", { ascending: false }).limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(fromArchiveRow);
}

export function fromArchiveRow(r) {
  return {
    id: r.id, scope: r.scope, subjectId: r.subject_id, relatedSubjectId: r.related_subject_id,
    sourceType: r.source_type, title: r.title, content: r.content, summary: r.summary,
    retentionState: r.retention_state, occurredAt: r.occurred_at,
    metadata: r.metadata || {}, createdBy: r.created_by, createdAt: r.created_at,
  };
}

/* ===========================================================================
   2 · UNDERSTANDING — what North Star currently believes
   =========================================================================== */

/** Upsert a belief. Provide `id` to evolve an existing one, omit to create.
 *  Optionally link the Evidence that supports it (Archive/source rows). */
export async function saveUnderstanding(familyId, u = {}, evidence = []) {
  const id = u.id || uid();
  const row = {
    id, family_id: familyId, scope: u.scope || SCOPE.CHILD, subject_id: u.subjectId || null,
    related_subject_id: u.relatedSubjectId || null, domain: orNull(u.domain),
    statement: u.statement, lifespan: u.lifespan || LIFESPAN.TEMPORARY,
    status: u.status || "emerging", confidence: u.confidence ?? null,
    family_verdict: orNull(u.familyVerdict), excluded_from_ai: !!u.excludedFromAi,
    last_reinforced_at: u.lastReinforcedAt || nowIso(), metadata: u.metadata || {},
    created_by: u.createdBy || null, updated_at: nowIso(),
    // 0031 engine columns:
    provenance: u.provenance || PROVENANCE.INFERRED,
    surfaced_at: orNull(u.surfacedAt), surface_status: orNull(u.surfaceStatus),
    noticing: orNull(u.noticing), review_at: orNull(u.reviewAt),
  };
  const { data, error } = await supabase.from("understandings")
    .upsert(row, { onConflict: "id" }).select().single();
  if (error) throw error;
  if (evidence.length) await linkEvidence(familyId, id, evidence);
  return fromUnderstandingRow(data);
}

/** Link Evidence (belief ⇄ source) with a stance. Keeps meaning separate from source. */
export async function linkEvidence(familyId, understandingId, evidence = []) {
  const rows = evidence.map((e) => ({
    id: uid(), family_id: familyId, understanding_id: understandingId,
    source_type: e.sourceType, source_id: e.sourceId || null,
    stance: e.stance || "supporting", note: orNull(e.note),
  }));
  if (!rows.length) return;
  const { error } = await supabase.from("understanding_evidence").insert(rows);
  if (error) throw error;
}

/** Read active beliefs for a family/subject (excludes retired + AI-suppressed). */
export async function loadUnderstandings(familyId, { subjectId, scope, includeInactive = false } = {}) {
  let q = supabase.from("understandings").select("*").eq("family_id", familyId);
  if (scope) q = q.eq("scope", scope);
  if (subjectId) q = q.eq("subject_id", subjectId);
  if (!includeInactive) q = q.not("status", "in", "(retired,contradicted)").eq("excluded_from_ai", false);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(fromUnderstandingRow);
}

/** The surfaced beliefs (the former "observations") awaiting or holding a parent response. */
export async function loadSurfaced(familyId, { statuses = [SURFACE.OFFERED] } = {}) {
  const { data, error } = await supabase.from("understandings").select("*")
    .eq("family_id", familyId).in("surface_status", statuses);
  if (error) throw error;
  return (data || []).map(fromUnderstandingRow);
}

export function fromUnderstandingRow(r) {
  return {
    id: r.id, scope: r.scope, subjectId: r.subject_id, relatedSubjectId: r.related_subject_id,
    domain: r.domain, statement: r.statement, lifespan: r.lifespan, status: r.status,
    confidence: r.confidence, familyVerdict: r.family_verdict, excludedFromAi: r.excluded_from_ai,
    firstNoticedAt: r.first_noticed_at, lastReinforcedAt: r.last_reinforced_at,
    metadata: r.metadata || {}, provenance: r.provenance, surfacedAt: r.surfaced_at,
    surfaceStatus: r.surface_status, noticing: r.noticing, reviewAt: r.review_at,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

/** THE ASSEMBLER — assembled understanding of a subject (data-model §1):
 *  active Understanding records + active Moments currently in effect (from the Archive).
 *  This is what every engine reads. Assembled live; add a cache only if it gets hot. */
export async function assembleUnderstanding(familyId, { subjectId = null } = {}) {
  const [childBeliefs, familyBeliefs, moments] = await Promise.all([
    subjectId ? loadUnderstandings(familyId, { subjectId }) : Promise.resolve([]),
    loadUnderstandings(familyId, { scope: SCOPE.FAMILY }),
    loadActiveMoments(familyId, subjectId),
  ]);
  return {
    subjectId,
    beliefs: [...childBeliefs, ...familyBeliefs],
    moments,                                   // current reality (Noah's wrist) that colours guidance
    // Convenience partitions the engines lean on:
    byDomain: groupBy([...childBeliefs, ...familyBeliefs], (b) => b.domain),
    declared: childBeliefs.filter((b) => b.provenance === PROVENANCE.DECLARED || b.provenance === PROVENANCE.CONFIRMED),
    inferred: childBeliefs.filter((b) => b.provenance === PROVENANCE.INFERRED),
  };
}

/** Active Moments = Archive life-events still in effect (no resolved marker in metadata). */
export async function loadActiveMoments(familyId, subjectId = null) {
  const all = await loadArchive(familyId, { sourceType: SOURCE.MOMENT, limit: 100 });
  return all.filter((m) =>
    m.metadata?.status !== "resolved" &&
    (!subjectId || m.subjectId === subjectId || m.scope === SCOPE.FAMILY));
}

/* ===========================================================================
   3 · RECOMMENDATION — what North Star suggests (three-question contract)
   =========================================================================== */

export async function saveRecommendation(familyId, r = {}) {
  const row = {
    id: r.id || uid(), family_id: familyId, scope: r.scope || SCOPE.FAMILY,
    subject_id: r.subjectId || null, trigger_type: orNull(r.triggerType), trigger_id: r.triggerId || null,
    what_changed: orNull(r.whatChanged), what_it_affects: r.whatItAffects || {},
    recommendation: r.recommendation, proposed_actions: r.proposedActions || [],
    status: r.status || "proposed", decision_note: orNull(r.decisionNote),
    applied_at: orNull(r.appliedAt), updated_at: nowIso(),
  };
  const { data, error } = await supabase.from("recommendations")
    .upsert(row, { onConflict: "id" }).select().single();
  if (error) throw error;
  return fromRecommendationRow(data);
}

export async function loadRecommendations(familyId, { statuses = ["proposed"], subjectId } = {}) {
  let q = supabase.from("recommendations").select("*").eq("family_id", familyId).in("status", statuses);
  if (subjectId) q = q.eq("subject_id", subjectId);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(fromRecommendationRow);
}

export function fromRecommendationRow(r) {
  return {
    id: r.id, scope: r.scope, subjectId: r.subject_id, triggerType: r.trigger_type, triggerId: r.trigger_id,
    whatChanged: r.what_changed, whatItAffects: r.what_it_affects || {}, recommendation: r.recommendation,
    proposedActions: r.proposed_actions || [], status: r.status, decisionNote: r.decision_note,
    appliedAt: r.applied_at, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

/* ===========================================================================
   4 · REPORT — what North Star communicates back (a read over Understanding)
   =========================================================================== */

export async function saveReport(familyId, rep = {}) {
  const row = {
    id: rep.id || uid(), family_id: familyId, scope: rep.scope || SCOPE.CHILD,
    subject_id: rep.subjectId || null, type: rep.type || "growth", period_key: orNull(rep.periodKey),
    content: rep.content || {}, status: rep.status || "ready", metadata: rep.metadata || {},
    generated_at: rep.generatedAt || nowIso(), updated_at: nowIso(),
  };
  const { data, error } = await supabase.from("reports").upsert(row, { onConflict: "id" }).select().single();
  if (error) throw error;
  return fromReportRow(data);
}

export async function loadReports(familyId, { subjectId, type } = {}) {
  let q = supabase.from("reports").select("*").eq("family_id", familyId);
  if (subjectId) q = q.eq("subject_id", subjectId);
  if (type) q = q.eq("type", type);
  const { data, error } = await q.order("generated_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(fromReportRow);
}

export function fromReportRow(r) {
  return {
    id: r.id, scope: r.scope, subjectId: r.subject_id, type: r.type, periodKey: r.period_key,
    content: r.content || {}, status: r.status, metadata: r.metadata || {},
    generatedAt: r.generated_at, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

/* ---------- small util ---------- */
function groupBy(arr, keyFn) {
  const out = {};
  for (const x of arr) { const k = keyFn(x) || "_"; (out[k] ||= []).push(x); }
  return out;
}

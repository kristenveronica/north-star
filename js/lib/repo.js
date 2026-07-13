/* ============================================================
   repo.js — Cloud data access (Supabase) + mappers.

   Bridges the app's in-memory state shape (camelCase, the shape every
   view already expects) to the relational schema (snake_case, RLS-scoped).

   Two jobs:
     • ensureFamilyAndHydrate() — on login, make sure a family exists, then
       load the family's data into the store (one-time hydrate).
     • syncCore(state) — write-behind: upsert the core collections back to
       the cloud after any local change (debounced by the store).

   Deferred collections (councils, guild, insights, showcases, mentorship,
   challenges, notifications, cart, observations, growth/insight reports,
   milestone evidence files) remain local-only for the beta and will be
   migrated in later passes.
   ============================================================ */

import { supabase } from "./supabase.js";
import { freshState, hydrateState, getState } from "../store.js";
import { claimSubscription, claimSubscriptionByEmail } from "./billing.js";
import { DOMAIN_CATALOG, normalizeDomainId } from "../seed.js";

/** Map an array of (possibly legacy) domain ids to current Capability Domain
    ids — migrate-on-read so old gig-tagged data buckets correctly everywhere. */
const normDomains = (a) => (Array.isArray(a) ? a.map(normalizeDomainId) : []);

/* ---------- small coercion helpers ---------- */
const orNull = (v) => (v === undefined || v === "" ? null : v);
const arr = (v) => (Array.isArray(v) ? v : []);
const dateOrNull = (v) => (v ? v : null);
// Coerce a value to a plain object (jsonb), tolerating the legacy case where an
// object was serialized to a JSON *string* in a text column (the mobility_profile
// round-trip bug). Returns null for anything that isn't/can't be an object.
const asObj = (v) => {
  if (v && typeof v === "object" && !Array.isArray(v)) return v;
  if (typeof v === "string" && v.trim().startsWith("{")) {
    try { const o = JSON.parse(v); return (o && typeof o === "object" && !Array.isArray(o)) ? o : null; }
    catch { return null; }
  }
  return null;
};

/* ============================================================
   MAPPERS  (state shape  <->  db row)
   ============================================================ */

// FAMILY  (state.family  <->  families + family_profiles + family_members.display_name)
function toProfileRow(family, meta, familyId) {
  return {
    family_id: familyId,
    mission: orNull(family.mission),
    motto: orNull(family.motto),
    core_word: orNull(family.coreWord),
    core_word_acronym: arr(family.acronym),
    desired_capabilities: arr(family.desiredOutcomes),
    learning_style: family.learningStyleDefault ?? 5,
    diy_level: family.diyMaterialsPreference ?? 5,
    faith_enabled: !!family.faithEnabled,
    faith_tradition: orNull(family.faithTradition),
    vision_answers: family.vision || {},
    relationships: arr(family.relationships),
    travel: family.travel || {},
    location: family.location || {},
    family_type: orNull(family.familyType),
    // Extended faith detail (0012) + Family Rhythm config (0013).
    faith: family.faith || {},
    rhythm: family.rhythm || {},
    // Living Family Inventory context (music lessons, sports clubs, reading) — 0018.
    inventory_context: family.inventoryContext || {},
    // NOTE: child_profile_limit is server-managed (billing) — never written here.
    onboarded: !!meta?.onboarded,
  };
}
function fromFamilyRows(famRow, profile, membership) {
  return {
    id: famRow.id,
    familyName: famRow.name || "Our Family",
    parentName: membership?.display_name || "",
    mission: profile?.mission || "",
    motto: profile?.motto || "",
    // Core word is earned at the end of the exercise — never pre-filled.
    coreWord: profile?.core_word || "",
    acronym: arr(profile?.core_word_acronym),
    desiredOutcomes: arr(profile?.desired_capabilities),
    faithEnabled: !!profile?.faith_enabled,
    faithTradition: profile?.faith_tradition || "",
    // Extended faith detail (denomination, church, website, notes). Reads the
    // jsonb column once migration 0012 is applied; harmless ({}) before then.
    faith: profile?.faith || {},
    learningStyleDefault: profile?.learning_style ?? 5,
    diyMaterialsPreference: profile?.diy_level ?? 5,
    vision: profile?.vision_answers || {},
    relationships: arr(profile?.relationships),
    travel: profile?.travel || {},
    location: profile?.location || {},
    familyType: profile?.family_type || "",
    structure: famRow.structure || "unified",
    // Subscription entitlements — SERVER-MANAGED, read-only on the client.
    // Never written back in toProfileRow; the client must not raise its own limits.
    entitlements: { childProfileLimit: profile?.child_profile_limit ?? 1 },
    // Family Rhythm config (reads once migration 0013 adds the column; {} before).
    rhythm: profile?.rhythm || {},
    // Living Family Inventory context (reads once 0018 adds the column; {} before).
    inventoryContext: profile?.inventory_context || {},
    createdAt: famRow.created_at,
  };
}

// INVENTORY ITEM
function toInventoryItemRow(item, familyId) {
  return {
    id: item.id,
    family_id: familyId,
    category: item.category || "other",
    name: item.name || "",
    owned: item.owned !== false,
    note: orNull(item.note),
    meta: (item.meta && typeof item.meta === "object" && !Array.isArray(item.meta)) ? item.meta : {},
  };
}
function fromInventoryItemRow(r) {
  return {
    id: r.id,
    category: r.category || "other",
    name: r.name || "",
    owned: r.owned !== false,
    note: r.note || "",
    meta: (r.meta && typeof r.meta === "object" && !Array.isArray(r.meta)) ? r.meta : {},
    createdAt: r.created_at,
  };
}

/* ------------------------------------------------------------------
   Long-term architecture mappers (Rhythm Engine + Reflection System).
   Ready for cloud sync, intentionally NOT yet wired into hydrate/syncCore
   because their tables/columns ship in migration 0013. To activate after
   applying 0013:
     • add `rhythm: family.rhythm || {}` to toProfileRow,
     • load these tables in _doEnsureFamilyAndHydrate (Promise.all),
     • add their upserts to the syncCore loop.
   ------------------------------------------------------------------ */
export function toReflectionReportRow(r, familyId) {
  return {
    id: r.id, family_id: familyId, child_id: r.childId || null,
    type: r.type, school_year: r.schoolYear || null, quarter: r.quarter ?? null,
    generated_date: dateOrNull(r.generatedDate), status: r.status || "scheduled",
    summary: orNull(r.summary), strengths: arr(r.strengths),
    growth_opportunities: arr(r.growthOpportunities), ai_observations: arr(r.aiObservations),
    suggested_next_steps: arr(r.suggestedNextSteps), metadata: r.metadata || {},
  };
}
export function fromReflectionReportRow(r) {
  return {
    id: r.id, childId: r.child_id, type: r.type, schoolYear: r.school_year, quarter: r.quarter,
    generatedDate: r.generated_date, status: r.status, summary: r.summary || "",
    strengths: arr(r.strengths), growthOpportunities: arr(r.growth_opportunities),
    aiObservations: arr(r.ai_observations), suggestedNextSteps: arr(r.suggested_next_steps),
    metadata: r.metadata || {},
  };
}
export function toMediaRow(m, familyId) {
  return {
    id: m.id, family_id: familyId, child_id: m.childId || null,
    project_id: m.projectId || null, milestone_id: m.milestoneId || null,
    kind: m.kind || "photo", storage_path: orNull(m.storagePath), caption: orNull(m.caption),
    captured_at: dateOrNull(m.capturedAt), school_year: orNull(m.schoolYear), metadata: m.metadata || {},
  };
}
export function fromMediaRow(r) {
  return {
    id: r.id, childId: r.child_id, projectId: r.project_id, milestoneId: r.milestone_id,
    kind: r.kind, storagePath: r.storage_path, caption: r.caption || "",
    capturedAt: r.captured_at, schoolYear: r.school_year, dataUrl: null, metadata: r.metadata || {},
  };
}
export function toCalendarRow(e, familyId) {
  return {
    id: e.id, family_id: familyId, child_id: e.childId || null, type: e.type || "event",
    title: e.title || "", starts_at: dateOrNull(e.start), ends_at: dateOrNull(e.end),
    all_day: !!e.allDay, recurrence: orNull(e.recurrence), source: e.source || "manual",
    external_id: orNull(e.externalId), metadata: e.metadata || {},
  };
}
export function fromCalendarRow(r) {
  return {
    id: r.id, childId: r.child_id, type: r.type, title: r.title,
    start: r.starts_at, end: r.ends_at, allDay: r.all_day, recurrence: r.recurrence,
    source: r.source, externalId: r.external_id, metadata: r.metadata || {},
  };
}
export function toPreferenceSignalRow(s, familyId) {
  return {
    id: s.id, family_id: familyId, child_id: s.childId || null, type: s.type || "rejected",
    reasons: arr(s.reasons), note: orNull(s.note), project_id: s.projectId || null,
    project_snapshot: s.projectSnapshot || {}, metadata: s.metadata || {},
  };
}
export function fromPreferenceSignalRow(r) {
  return {
    id: r.id, childId: r.child_id, type: r.type, reasons: arr(r.reasons), note: r.note || "",
    projectId: r.project_id, projectSnapshot: r.project_snapshot || {}, metadata: r.metadata || {},
    createdAt: r.created_at,
  };
}

// CHILD  (note: app uses `passions`, db uses `interests`)
function toChildRow(c, familyId) {
  return {
    id: c.id,
    family_id: familyId,
    name: c.name || "",
    age: c.age ?? null,
    birthday: dateOrNull(c.birthday),
    grade: orNull(c.grade),
    interests: arr(c.passions),
    strengths: arr(c.strengths),
    areas_developing: arr(c.areasDeveloping),
    support_needs: arr(c.supportNeeds),
    goals: arr(c.goals),
    learning_preferences: arr(c.learningPreferences),
    learning_style: c.learningStyle ?? null,
    diy_materials: c.diyMaterials ?? null,
    faith_enabled: !!c.faithEnabled,
    faith_tradition: orNull(c.faithTradition),
    notes: orNull(c.notes),
    avatar_index: c.avatarIndex ?? 1,
    access_code: c.accessCode,
    domains: normDomains(c.domains),
    insights_config: c.insightsConfig || {},
    guide_id: orNull(c.guideId),
    // Capability-based Learning Profile blob: { levels, levelsNote, differences,
    // differencesNote, about }. Stored as-is in the existing jsonb column.
    // `gender`, `pin`, `printPermission` and `birthData` have no dedicated columns,
    // so they're tucked in here to round-trip to the cloud without a schema change
    // (same trick as gender). Without this, a child's portal PIN silently vanishes
    // on any other device / after re-hydrate, and print permission + birth data are lost.
    learning_profile: {
      ...((c.learningProfile && !Array.isArray(c.learningProfile)) ? c.learningProfile : {}),
      gender: c.gender || "",
      pin: c.pin || "",
      printPermission: c.printPermission || "approval",
      birthData: c.birthData || null,
    },
    // jsonb (migration 0024). Send a real object or null — never a stringified blob.
    mobility_profile: asObj(c.mobilityProfile),
  };
}
export function fromChildRow(r) {
  return {
    id: r.id,
    familyId: r.family_id,
    name: r.name || "",
    age: r.age,
    birthday: r.birthday || null,
    grade: r.grade || null,
    passions: arr(r.interests),
    strengths: arr(r.strengths),
    areasDeveloping: arr(r.areas_developing),
    supportNeeds: arr(r.support_needs),
    goals: arr(r.goals),
    learningPreferences: arr(r.learning_preferences),
    learningStyle: r.learning_style,
    diyMaterials: r.diy_materials,
    faithEnabled: !!r.faith_enabled,
    faithTradition: r.faith_tradition || "",
    notes: r.notes || "",
    avatarIndex: r.avatar_index ?? 1,
    accessCode: r.access_code,
    domains: normDomains(r.domains),
    insightsConfig: r.insights_config || {},
    guideId: r.guide_id || null,
    learningProfile: (r.learning_profile && !Array.isArray(r.learning_profile)) ? r.learning_profile : {},
    gender: (r.learning_profile && !Array.isArray(r.learning_profile) ? r.learning_profile.gender : "") || "",
    // pin / printPermission / birthData live inside learning_profile (no dedicated
    // columns) — read them back so the portal PIN, print permission and birth data
    // survive cross-device and re-hydrate. See toChildRow.
    pin: (r.learning_profile && !Array.isArray(r.learning_profile) ? r.learning_profile.pin : "") || "",
    printPermission: (r.learning_profile && !Array.isArray(r.learning_profile) ? r.learning_profile.printPermission : "") || "approval",
    birthData: (r.learning_profile && !Array.isArray(r.learning_profile) ? r.learning_profile.birthData : null) || null,
    mobilityProfile: asObj(r.mobility_profile),
    createdAt: r.created_at,
  };
}

// PROJECT  (status: app uses hyphen "ready-for-reflection", db uses underscore)
const statusToDb = (s) => (s || "active").replace(/-/g, "_");
const statusFromDb = (s) => (s || "active").replace(/_/g, "-");
// The DB project_status enum only allows these. App-only statuses (e.g. "draft")
// are stored safely as "active" in the column and recovered from generation_meta,
// so they persist without a schema migration.
const DB_PROJECT_STATUSES = new Set(["active", "ready_for_reflection", "completed", "paused"]);
const toDbStatus = (s) => { const d = statusToDb(s); return DB_PROJECT_STATUSES.has(d) ? d : "active"; };
// The DB project_pathway enum uses lowercase/underscore ids. The app + AI emit
// human forms ("Self-Reliance", "SelfReliance", "Arts"). Normalise every form to
// the enum, and fall back to null for anything unknown (pathway is optional) so a
// single stray value can NEVER reject the whole project insert and lose the work.
const DB_PATHWAYS = new Set([
  "adventure", "arts", "community", "enterprise", "faith", "family", "health",
  "history", "mentorship", "science", "self_reliance", "service", "technology",
]);
const toDbPathway = (p) => {
  if (!p) return null;
  const k = String(p).trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2") // camelCase -> camel_Case
    .toLowerCase()
    .replace(/[\s-]+/g, "_");            // spaces/hyphens -> underscore
  return DB_PATHWAYS.has(k) ? k : null;
};
const fromDbPathway = (p) =>
  (p || "").replace(/_/g, "-").replace(/\b\w/g, (c) => c.toUpperCase()); // self_reliance -> Self-Reliance
function toProjectRow(p, familyId) {
  return {
    id: p.id,
    family_id: familyId,
    child_id: orNull(p.childId),
    title: p.title || "",
    description: orNull(p.description),
    purpose: orNull(p.purpose),
    pathway: toDbPathway(p.pathway),
    quest_role: orNull(p.questRole),
    capabilities_developed: arr(p.capabilitiesDeveloped),
    foundational_literacies: arr(p.foundationalLiteracies),
    domains: normDomains(p.domains),
    // Capability mapping metadata — the intelligence layer that powers
    // reflection reports, capability visualisations and growth tracking:
    // { primary:[ids], secondary:[ids], skills:[..], competencyGrowth:{} }
    capability_map: (p.capabilityMap && typeof p.capabilityMap === "object" && !Array.isArray(p.capabilityMap)) ? p.capabilityMap : {},
    real_world_application: orNull(p.realWorldApplication),
    contribution_opportunities: orNull(p.contributionOpportunities),
    passion_connection: orNull(p.passionConnection),
    learning_outcomes: arr(p.learningOutcomes),
    interest_areas: arr(p.interestAreas),
    materials: arr(p.materials),
    start_date: dateOrNull(p.startDate),
    due_date: dateOrNull(p.dueDate),
    momentum_points_available: p.momentumPointsAvailable || 0,
    momentum_points_earned: p.momentumPointsEarned || 0,
    stars_available: p.starsAvailable || 0,
    stars_earned: p.starsEarned || 0,
    reward: orNull(p.reward),
    toll: orNull(p.toll),
    child_agreed: !!p.childAgreed,
    parent_approved: p.parentApproved !== false,
    status: toDbStatus(p.status),
    generated_by_ai: !!p.generatedByAi,
    // generation_meta carries the true app status (incl. "draft") + the richer AI
    // proposal fields, so they all round-trip without adding DB columns.
    generation_meta: {
      ...((p.generationMeta && typeof p.generationMeta === "object" && !Array.isArray(p.generationMeta)) ? p.generationMeta : {}),
      appStatus: p.status || "active",
      childDescription: p.childDescription || "",
      academicSkills: arr(p.academicSkills),
      practicalSkills: arr(p.practicalSkills),
      reflectionPrompts: arr(p.reflectionPrompts),
      extensionIdeas: arr(p.extensionIdeas),
      parentNotes: p.parentNotes || "",
    },
    child_roles: p.childRoles || {},
    project_category: orNull(p.projectCategory),
    experience_type: orNull(p.experienceType),
  };
}
export function fromProjectRow(r) {
  const gm = (r.generation_meta && typeof r.generation_meta === "object" && !Array.isArray(r.generation_meta)) ? r.generation_meta : {};
  return {
    id: r.id,
    childId: r.child_id,
    title: r.title || "",
    description: r.description || "",
    purpose: r.purpose || "",
    pathway: fromDbPathway(r.pathway),
    questRole: r.quest_role || "",
    capabilitiesDeveloped: arr(r.capabilities_developed),
    foundationalLiteracies: arr(r.foundational_literacies),
    domains: normDomains(r.domains),
    capabilityMap: (r.capability_map && typeof r.capability_map === "object" && !Array.isArray(r.capability_map)) ? r.capability_map : {},
    realWorldApplication: r.real_world_application || "",
    contributionOpportunities: r.contribution_opportunities || "",
    passionConnection: r.passion_connection || "",
    learningOutcomes: arr(r.learning_outcomes),
    interestAreas: arr(r.interest_areas),
    materials: arr(r.materials),
    startDate: r.start_date,
    dueDate: r.due_date,
    momentumPointsAvailable: r.momentum_points_available || 0,
    momentumPointsEarned: r.momentum_points_earned || 0,
    starsAvailable: r.stars_available || 0,
    starsEarned: r.stars_earned || 0,
    reward: r.reward || "",
    toll: r.toll || "",
    childAgreed: !!r.child_agreed,
    parentApproved: r.parent_approved !== false,
    // Prefer the true app status from generation_meta (recovers "draft"); fall back
    // to the column for older rows written before this field existed.
    status: gm.appStatus || statusFromDb(r.status),
    generatedByAi: !!r.generated_by_ai,
    generationMeta: gm,
    childDescription: gm.childDescription || "",
    academicSkills: arr(gm.academicSkills),
    practicalSkills: arr(gm.practicalSkills),
    reflectionPrompts: arr(gm.reflectionPrompts),
    extensionIdeas: arr(gm.extensionIdeas),
    parentNotes: gm.parentNotes || "",
    projectCategory: r.project_category || "",
    experienceType: r.experience_type || "",
    createdAt: r.created_at,
  };
}

// MILESTONE  (family_id injected; evidence files stay local for beta)
function toMilestoneRow(m, familyId) {
  return {
    id: m.id,
    project_id: m.projectId,
    family_id: familyId,
    title: m.title || "",
    description: orNull(m.description),
    instructions: arr(m.instructions),
    due_date: dateOrNull(m.dueDate),
    momentum_points: m.momentumPoints ?? 10,
    order_index: m.orderIndex || 0,
    completed: !!m.completed,
    completed_at: dateOrNull(m.completedAt),
    star_earned: !!m.starEarned,
    reflection_required: !!m.reflectionRequired,
    submission: m.submission || null,
  };
}
export function fromMilestoneRow(r) {
  return {
    id: r.id,
    projectId: r.project_id,
    title: r.title || "",
    description: r.description || "",
    instructions: arr(r.instructions),
    dueDate: r.due_date,
    momentumPoints: r.momentum_points ?? 10,
    orderIndex: r.order_index || 0,
    completed: !!r.completed,
    completedAt: r.completed_at,
    starEarned: !!r.star_earned,
    reflectionRequired: !!r.reflection_required,
    reflectionId: null,
    evidence: [],
    submission: r.submission || null,
  };
}

// REFLECTION (child-owned)
function toReflectionRow(r, familyId) {
  return {
    id: r.id,
    child_id: r.childId,
    family_id: familyId,
    project_id: orNull(r.projectId),
    milestone_id: orNull(r.milestoneId),
    prompt: orNull(r.prompt),
    response: orNull(r.response),
    voice_transcript: orNull(r.voiceTranscript),
  };
}
function fromReflectionRow(r) {
  return {
    id: r.id,
    childId: r.child_id,
    projectId: r.project_id,
    milestoneId: r.milestone_id,
    prompt: r.prompt || "",
    response: r.response || "",
    voiceTranscript: r.voice_transcript || "",
    createdAt: r.created_at,
  };
}

// MATERIAL
function toMaterialRow(m, familyId) {
  return {
    id: m.id,
    family_id: familyId,
    child_id: orNull(m.forChildId),
    name: m.name || "",
    category: orNull(m.category),
    description: orNull(m.description),
    reason_suggested: orNull(m.reasonSuggested),
    age_range: orNull(m.ageRange),
    buy_or_diy: m.buyOrDIY || "buy",
    estimated_price: m.estimatedPrice || 0,
    approved: !!m.approved,
    rejected: !!m.rejected,
    in_cart: !!m.inCart,
    affiliate_url: m.affiliateUrlPlaceholder || "#",
    section: m.section || "personalised",
    status: m.status || "suggested",
    meta: (m.meta && typeof m.meta === "object" && !Array.isArray(m.meta)) ? m.meta : {},
  };
}
function fromMaterialRow(r) {
  return {
    id: r.id,
    forChildId: r.child_id,
    name: r.name || "",
    category: r.category || "",
    description: r.description || "",
    reasonSuggested: r.reason_suggested || "",
    ageRange: r.age_range || "",
    buyOrDIY: r.buy_or_diy || "buy",
    estimatedPrice: r.estimated_price || 0,
    approved: !!r.approved,
    rejected: !!r.rejected,
    inCart: !!r.in_cart,
    affiliateUrlPlaceholder: r.affiliate_url || "#",
    section: r.section || "personalised",
    status: r.status || "suggested",
    meta: (r.meta && typeof r.meta === "object" && !Array.isArray(r.meta)) ? r.meta : {},
  };
}

/* ============================================================
   HYDRATE
   ============================================================ */
// Guard against concurrent runs (signup calls this directly AND the auth-state
// listener fires it). Without this, two runs could each create a family.
/* ---- Membership & permissions (migration 0019) ---- */
export function fromMemberRow(r) {
  return {
    id: r.id,
    user_id: r.user_id || null,
    role: r.role || "contributor",
    is_primary: !!r.is_primary,
    display_name: r.display_name || "",
    status: r.status || "active",
    permissions: Array.isArray(r.permissions) ? r.permissions : [],
    relationship: r.relationship || "",
    invited_email: r.invited_email || "",
  };
}
export function fromMemberChildAccessRow(r) {
  return {
    id: r.id,
    member_id: r.member_id,
    child_id: r.child_id,
    access_level: r.access_level || "contributor",
    permissions: Array.isArray(r.permissions) ? r.permissions : [],
  };
}

/* ---- Invitations: accept (join an existing family) ----
   When a user arrives via an invite link we stash the token; on the next
   hydrate we redeem it FIRST, so they join the inviter's family rather than
   auto-creating their own. */
const PENDING_INVITE_KEY = "northstar::pendingInvite";
export function setPendingInvite(token) {
  try { token ? localStorage.setItem(PENDING_INVITE_KEY, token) : localStorage.removeItem(PENDING_INVITE_KEY); } catch { /* ignore */ }
}
export function getPendingInvite() {
  try { return localStorage.getItem(PENDING_INVITE_KEY); } catch { return null; }
}
export async function acceptInvite(token) {
  const { error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) throw new Error(error.message || "This invitation could not be accepted.");
  return true;
}

/* ---- Onboarding parked ----
   A parent can "park" the Family North Star setup and explore the dashboard
   first, finishing onboarding later from a resume banner. This flag (device-
   local) lets the route guard wave a not-yet-onboarded-but-parked parent
   through to the dashboard. Irrelevant once meta.onboarded is true; cleared on
   logout (store.resetToLoggedOut) and on completion. */
const ONBOARDING_PARKED_KEY = "northstar::onboardingParked";
export function setOnboardingParked(parked) {
  try { parked ? localStorage.setItem(ONBOARDING_PARKED_KEY, "1") : localStorage.removeItem(ONBOARDING_PARKED_KEY); } catch { /* ignore */ }
}
export function isOnboardingParked() {
  try { return localStorage.getItem(ONBOARDING_PARKED_KEY) === "1"; } catch { return false; }
}
async function acceptPendingInviteIfAny() {
  let token = null;
  try { token = localStorage.getItem(PENDING_INVITE_KEY); } catch { /* ignore */ }
  if (!token) return;
  try { await acceptInvite(token); }
  catch (e) { console.warn("[repo] pending invite accept failed:", e?.message); }
  finally { setPendingInvite(null); }
}

/* ---- Public-checkout claim: link a subscription paid on the marketing site ----
   The buyer pays first (no account), returns to the app with ?checkout_session=ID
   (stashed below), signs up, and on the next hydrate we link that subscription to
   their new family — verified server-side by matching the paying email. */
const PENDING_CHECKOUT_KEY = "northstar::pendingCheckout";
const EMAIL_CLAIM_KEY = "northstar::emailClaimDone";
export function setPendingCheckout(sessionId) {
  try {
    if (sessionId) {
      localStorage.setItem(PENDING_CHECKOUT_KEY, sessionId);
      localStorage.removeItem(EMAIL_CLAIM_KEY); // a fresh payment → allow a fresh link attempt
    } else {
      localStorage.removeItem(PENDING_CHECKOUT_KEY);
    }
  } catch { /* ignore */ }
}
export function getPendingCheckout() {
  try { return localStorage.getItem(PENDING_CHECKOUT_KEY); } catch { return null; }
}
async function claimPendingCheckoutIfAny() {
  const sid = getPendingCheckout();
  if (sid) {
    try {
      const res = await claimSubscription(sid);
      setPendingCheckout(null);                       // claimed or benignly skipped
      if (res?.ok) { console.log("[repo] subscription claimed:", res.status); return; }
    } catch (e) {
      const msg = e?.message || "";
      // Definitive outcomes → stop retrying; transient (network) → keep for next hydrate.
      if (/email_mismatch|already linked|not_a_subscription/i.test(msg)) {
        console.warn("[repo] checkout claim not applied:", msg);
        setPendingCheckout(null);
      } else {
        console.warn("[repo] checkout claim deferred (will retry):", msg);
        return; // keep the session for a retry; skip the email fallback this time
      }
    }
  }
  // Fallback (no session, or session didn't link): try linking a live subscription
  // by the signed-in email, AT MOST ONCE per device so it costs nothing normally.
  try {
    if (localStorage.getItem(EMAIL_CLAIM_KEY)) return;
  } catch { /* ignore */ }
  try {
    const res = await claimSubscriptionByEmail();
    if (res?.ok) console.log("[repo] subscription linked by email:", res.status);
  } catch (e) {
    console.warn("[repo] email claim skipped:", e?.message || e);
  } finally {
    try { localStorage.setItem(EMAIL_CLAIM_KEY, "1"); } catch { /* ignore */ }
  }
}

// PARENT OBSERVATIONS  (state.parentObservations  <->  parent_observations)
function toObservationRow(o, familyId) {
  return {
    id: o.id,
    family_id: familyId,
    child_id: o.childId,
    author_user_id: o.authorUserId || null,
    strengths: orNull(o.strengths),
    challenges: orNull(o.challenges),
    growth_observed: orNull(o.growthObserved),
    concerns: orNull(o.concerns),
    goals_next_term: orNull(o.goalsNextTerm),
    created_at: o.createdAt || new Date().toISOString(),
  };
}
function fromObservationRow(r) {
  return {
    id: r.id,
    childId: r.child_id,
    authorUserId: r.author_user_id || null,
    strengths: r.strengths || "",
    challenges: r.challenges || "",
    growthObserved: r.growth_observed || "",
    concerns: r.concerns || "",
    goalsNextTerm: r.goals_next_term || "",
    createdAt: r.created_at,
  };
}

// CHILD SELF-ASSESSMENTS  (note app `wantToGetBetterAt` -> db `want_to_improve`)
function toSelfAssessmentRow(a, familyId) {
  return {
    id: a.id,
    family_id: familyId,
    child_id: a.childId,
    proud_of: orNull(a.proudOf),
    hard_thing: orNull(a.hardThing),
    want_to_improve: orNull(a.wantToGetBetterAt),
    favourite_project: orNull(a.favouriteProject),
    want_to_learn_next: orNull(a.wantToLearnNext),
    created_at: a.createdAt || new Date().toISOString(),
  };
}
function fromSelfAssessmentRow(r) {
  return {
    id: r.id,
    childId: r.child_id,
    proudOf: r.proud_of || "",
    hardThing: r.hard_thing || "",
    wantToGetBetterAt: r.want_to_improve || "",
    favouriteProject: r.favourite_project || "",
    wantToLearnNext: r.want_to_learn_next || "",
    createdAt: r.created_at,
  };
}

// GROWTH REPORTS — the report is a rich AI-generated object; store the whole
// thing in the `content` jsonb and lift id/child/period/generated_at to columns.
function toGrowthReportRow(r, familyId) {
  return {
    id: r.id,
    family_id: familyId,
    child_id: r.childId,
    period_key: orNull(r.periodKey),
    content: (r && typeof r === "object" && !Array.isArray(r)) ? r : {},
    generated_at: r.generatedAt || r.createdAt || new Date().toISOString(),
  };
}
function fromGrowthReportRow(r) {
  const content = (r.content && typeof r.content === "object" && !Array.isArray(r.content)) ? r.content : {};
  // Columns are authoritative; content carries every narrative field.
  return {
    ...content,
    id: r.id,
    childId: r.child_id,
    periodKey: r.period_key || content.periodKey || null,
    generatedAt: r.generated_at || content.generatedAt || null,
  };
}

let _hydrateInFlight = null;
export function ensureFamilyAndHydrate() {
  if (_hydrateInFlight) return _hydrateInFlight;
  _hydrateInFlight = _doEnsureFamilyAndHydrate().finally(() => { _hydrateInFlight = null; });
  return _hydrateInFlight;
}

async function _doEnsureFamilyAndHydrate() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // If they arrived via an invitation, redeem it first so they JOIN that family
  // instead of auto-creating their own below.
  await acceptPendingInviteIfAny();

  // Find (or create) this user's family. Oldest first → deterministic.
  let { data: members } = await supabase
    .from("family_members")
    .select("family_id, display_name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  let familyId;
  if (!members || members.length === 0) {
    const { data: newId, error } = await supabase.rpc(
      "create_family_for_current_user",
      { p_family_name: "Our Family" }
    );
    if (error) { console.error("[repo] create family failed", error); return; }
    familyId = newId;
    const reload = await supabase
      .from("family_members")
      .select("display_name")
      .eq("user_id", user.id)
      .eq("family_id", familyId)
      .limit(1);
    members = reload.data;
  } else {
    familyId = members[0].family_id;
  }
  const displayName = members?.[0]?.display_name || "";

  // If they paid on the public pricing page before signing up, link that
  // subscription to this family now (before loading, so the child limit is current).
  await claimPendingCheckoutIfAny();

  // Load everything for this family in parallel.
  const [fam, prof, children, projects, milestones, reflections, materials,
         reflectionReports, mediaAssets, calendarEvents, preferenceSignals, inventory,
         allMembers, memberAccess, observations, selfAssessments, growthReports] =
    await Promise.all([
      supabase.from("families").select("*").eq("id", familyId).single(),
      supabase.from("family_profiles").select("*").eq("family_id", familyId).single(),
      supabase.from("children").select("*").eq("family_id", familyId),
      supabase.from("projects").select("*").eq("family_id", familyId),
      supabase.from("milestones").select("*").eq("family_id", familyId),
      supabase.from("reflections").select("*").eq("family_id", familyId),
      supabase.from("materials").select("*").eq("family_id", familyId),
      // Long-term architecture tables (migrations 0013/0014).
      supabase.from("reflection_reports").select("*").eq("family_id", familyId),
      supabase.from("media_assets").select("*").eq("family_id", familyId),
      supabase.from("calendar_events").select("*").eq("family_id", familyId),
      supabase.from("preference_signals").select("*").eq("family_id", familyId),
      // Living Family Inventory (migration 0018).
      supabase.from("inventory_items").select("*").eq("family_id", familyId),
      // Membership & permissions (migration 0019).
      supabase.from("family_members").select("*").eq("family_id", familyId),
      supabase.from("member_child_access").select("*").eq("family_id", familyId),
      // Understand-the-child record: parent notes, the child's own check-ins, and
      // the (paid-compute) growth reports. Previously local-only — now cross-device.
      supabase.from("parent_observations").select("*").eq("family_id", familyId),
      supabase.from("child_self_assessments").select("*").eq("family_id", familyId),
      supabase.from("growth_reports").select("*").eq("family_id", familyId),
    ]);

  const state = freshState();
  state.family = fromFamilyRows(fam.data, prof.data, { display_name: displayName });
  state.domains = DOMAIN_CATALOG;
  state.children = (children.data || []).map(fromChildRow);
  state.projects = (projects.data || []).map(fromProjectRow);
  state.milestones = (milestones.data || []).map(fromMilestoneRow);
  state.reflections = (reflections.data || []).map(fromReflectionRow);
  state.materials = (materials.data || []).map(fromMaterialRow);
  state.reflectionReports = (reflectionReports.data || []).map(fromReflectionReportRow);
  state.mediaAssets = (mediaAssets.data || []).map(fromMediaRow);
  state.calendarEvents = (calendarEvents.data || []).map(fromCalendarRow);
  state.preferenceSignals = (preferenceSignals.data || []).map(fromPreferenceSignalRow);
  state.inventory = (inventory.data || []).map(fromInventoryItemRow);
  state.familyMembers = (allMembers.data || []).map(fromMemberRow);
  state.memberChildAccess = (memberAccess.data || []).map(fromMemberChildAccessRow);
  state.parentObservations = (observations.data || []).map(fromObservationRow);
  state.childSelfAssessments = (selfAssessments.data || []).map(fromSelfAssessmentRow);
  state.growthReports = (growthReports.data || []).map(fromGrowthReportRow);
  state.meta.onboarded = !!prof.data?.onboarded;

  // ---- Anti-clobber: never lose locally-created-but-unsynced rows ----
  // A re-hydrate (token refresh, tab focus, second sign-in event) replaces the
  // whole store from the cloud. If it fires in the ~½s before a just-added
  // child/project/milestone finishes its debounced write, that row would be
  // wiped from the store AND never synced — the classic "I add a child and it
  // deletes itself" bug. So, ONLY when we're re-hydrating the SAME family we
  // already hold locally (never on an account switch — that would leak data),
  // carry over any local rows whose id isn't in the cloud result yet, then push
  // them up. Deleting a row on another device is the rare loser here; silently
  // losing a brand-new child is the far worse outcome we're preventing.
  const local = getState();
  const sameFamily = !!local?.family?.id && local.family.id === familyId;
  let preserved = 0;
  if (sameFamily) {
    const mergeLocalOnly = (cloudArr, localArr) => {
      const ids = new Set(cloudArr.map(x => x.id));
      const extras = (localArr || []).filter(x => x && x.id && !ids.has(x.id));
      preserved += extras.length;
      return extras.length ? [...cloudArr, ...extras] : cloudArr;
    };
    state.children = mergeLocalOnly(state.children, local.children);
    state.projects = mergeLocalOnly(state.projects, local.projects);
    state.milestones = mergeLocalOnly(state.milestones, local.milestones);
  }
  state.meta.activeChildId = state.children[0]?.id || null;

  hydrateState(state);

  // If we rescued unsynced local rows, push them to the cloud right away so a
  // later hydrate (which now WILL see them) can't lose them again.
  if (preserved) { try { await syncCore(state); } catch { /* next update retries */ } }
}

/* ============================================================
   WRITE-BEHIND  (called debounced by the store after any change)
   ============================================================ */
let _syncing = false;
let _dirtyAgain = false;

export async function syncCore(state) {
  const familyId = state?.family?.id;
  if (!familyId) return;
  if (_syncing) { _dirtyAgain = true; return; }
  _syncing = true;
  try {
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("families")
      .update({ name: state.family.familyName || "Our Family" })
      .eq("id", familyId);

    await supabase.from("family_profiles")
      .upsert(toProfileRow(state.family, state.meta, familyId), { onConflict: "family_id" });

    if (user && state.family.parentName !== undefined) {
      await supabase.from("family_members")
        .update({ display_name: state.family.parentName })
        .eq("family_id", familyId).eq("user_id", user.id);
    }

    const upserts = [
      ["children",    (state.children || []).map((c) => toChildRow(c, familyId))],
      ["projects",    (state.projects || []).map((p) => toProjectRow(p, familyId))],
      ["milestones",  (state.milestones || []).map((m) => toMilestoneRow(m, familyId))],
      ["reflections", (state.reflections || []).map((r) => toReflectionRow(r, familyId))],
      ["materials",   (state.materials || []).map((m) => toMaterialRow(m, familyId))],
      // Long-term architecture tables (migrations 0013/0014).
      ["reflection_reports", (state.reflectionReports || []).map((r) => toReflectionReportRow(r, familyId))],
      ["media_assets",       (state.mediaAssets || []).map((m) => toMediaRow(m, familyId))],
      ["calendar_events",    (state.calendarEvents || []).map((e) => toCalendarRow(e, familyId))],
      ["preference_signals", (state.preferenceSignals || []).map((s) => toPreferenceSignalRow(s, familyId))],
      // Living Family Inventory (migration 0018).
      ["inventory_items", (state.inventory || []).map((i) => toInventoryItemRow(i, familyId))],
      // Understand-the-child record (child_id is NOT NULL, so drop any stray
      // child-less rows rather than let them fail every sync).
      ["parent_observations", (state.parentObservations || []).filter((o) => o.childId).map((o) => toObservationRow(o, familyId))],
      ["child_self_assessments", (state.childSelfAssessments || []).filter((a) => a.childId).map((a) => toSelfAssessmentRow(a, familyId))],
      ["growth_reports", (state.growthReports || []).filter((r) => r.childId).map((r) => toGrowthReportRow(r, familyId))],
    ];
    for (const [table, rows] of upserts) {
      if (!rows.length) continue;
      const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
      if (error) {
        // A single bad row would otherwise reject the WHOLE batch — and on the next
        // hydrate the stale cloud copy would overwrite good local data. Retry per-row
        // so every valid row still persists; only the genuinely bad one is skipped.
        console.error(`[repo] sync ${table} batch failed — retrying per-row`, error);
        for (const row of rows) {
          const { error: rowErr } = await supabase.from(table).upsert(row, { onConflict: "id" });
          if (rowErr) console.error(`[repo] sync ${table} row ${row.id} failed`, rowErr);
        }
      }
    }
  } catch (e) {
    console.error("[repo] syncCore error", e);
  } finally {
    _syncing = false;
    if (_dirtyAgain) { _dirtyAgain = false; syncCore(state); }
  }
}

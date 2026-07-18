/* ============================================================
   store.js — Persistent data layer
   localStorage-backed for MVP; architected so a real backend
   can replace it without changing call sites.
   ============================================================ */

import { generateAccessCode as _genAccessCode, normalizeAccessCode } from "./lib/accessCode.js";

const STORAGE_KEY = "northstar::v1";

const DEFAULT_STATE = {
  meta: {
    version: 1,
    createdAt: new Date().toISOString(),
    onboarded: false,
    activeChildId: null,
  },
  auth: null,   // { email, passwordHash, salt, parentName, createdAt, session: { active, since, expiresAt } }
  family: null,
  domains: [],
  children: [],
  projects: [],
  milestones: [],
  reflections: [],
  materials: [],
  cart: [],
  rewardsTolls: [],
  notifications: [],
  parentObservations: [],
  childSelfAssessments: [],
  growthReports: [],
  insightReports: [],

  // Long-term architecture (Rhythm Engine + Reflection System). Persisted
  // locally now; cloud sync activates with migration 0013.
  reflectionReports: [], // monthly | quarterly | annual reflections (distinct from milestone `reflections`)
  mediaAssets: [],       // photos/videos/voice/docs linked to projects/milestones (Annual Video source)
  calendarEvents: [],    // family-added events (dance, sport, music, church…) + external-calendar imports
  preferenceSignals: [], // the family learning loop: explicit (rejection reasons) + implicit (accept/regen/edit/complete…) signals
  inventory: [],         // the living Family Inventory: what the family already owns/has access to ({id,category,name,owned,note,meta})

  // Membership & permissions (migration 0019). Auth-linked adults in this family
  // (owner + accepted invitees) and their per-child access grants. The dynamic
  // portal resolves the logged-in user's role/permissions from here.
  familyMembers: [],     // [{ id, user_id, role, is_primary, display_name, status, permissions[] }]
  memberChildAccess: [], // [{ id, member_id, child_id, access_level, permissions[] }]

  // Learning Apps hub (code held out of the MVP in /dev/lib/appsHub.js) — per-child
  // enablement, daily time limits and reported session progress for satellite apps.
  // Slice kept here (inert) so the /dev harness keeps working without a migration.
  childApps: [],         // [{ id, childId, appId, enabled, dailyLimitMin, minutesByDay{}, sessions[], lastSummary }]

  // AI mentors (Phase 1: Polaris/maths) — child chat UI held out of the MVP in
  // /dev/views/polaris.js. One conversation per child per mentor; local-only for
  // now (shared cross-mentor memory is Phase 2). Slice kept here (inert) for /dev.
  mentorConversations: [], // [{ id, childId, mentorId, turns:[{ role:"child"|"mentor", text, suggestions?, at }], createdAt, updatedAt }]

  // Family Councils (live) + Learning Guild state (Guild UI held out of MVP in /dev,
  // but these slices stay here — the /dev harness imports them). Family Legacy removed.
  guildConfig: {
    premiumEnabled: false,
    showcaseAllowed: false,
    mentorshipAllowed: false,
    messagingAllowed: false,
    localMatchingAllowed: false,
    challengesAllowed: true,
    location: { city: "", region: "" },
    childParticipation: {}, // { [childId]: { participates: bool, showcaseOk, mentorshipOk, messagingOk, localOk } }
  },
  questTeamMemberships: {}, // { [childId]: [teamId, ...] }
  showcases: [],            // { id, childId, fromOtherFamily, family, projectId, title, summary, photos, reflections, lessons, points, celebrations, comments[] }
  mentorshipRequests: [],   // { id, mentorId, menteeChildId, category, status, parentApproved, createdAt }
  challengeParticipants: {},// { [challengeId]: [{ childId, joinedAt, completedAt }] }
  skillExchange: {},        // { [childId]: { teaches: [], wantsToLearn: [] } }
  familyCouncils: [],       // { id, periodKey, generatedAt, sections{}, familyGoals[] }

  insightsConfig: {
    premiumEnabled: false,
    disclaimerAcknowledged: false,
    frameworks: {
      learningPreferences: true,
      characterStrengths: true,
      multipleIntelligences: true,
      executiveFunction: true,
      motivationalDrivers: true,
      entrepreneurialTendencies: true,
      leadershipTendencies: true,
      // Interpretive (disabled by default)
      humanDesign: false,
      astrology: false,
      archetypalPatterns: false,
    },
  },
};

let _state = load();
const _subs = new Set();
sortChildren(); // canonical oldest-first ordering from the very first render
ensureChildAccessCodes(); // heal any code-less legacy children before first sync

/* ---------- cloud sync hook ----------
   The store stays UI-synchronous; the cloud (Supabase) is written behind it.
   app.js registers the sync handler; hydrateState() loads a family's data in.
*/
let _cloudSync = null;     // (state) => Promise<void>
let _cloudEnabled = false;
let _syncTimer = null;
// Sink for factual LFM Archive events (kept out of store.js's imports to avoid a
// cycle into lfm.js/auth.js; the wiring layer resolves the actor and writes).
let _archiveSink = null;   // (event) => void

export function setCloudSync(fn) { _cloudSync = fn; }
export function setCloudEnabled(b) { _cloudEnabled = !!b; }
export function setArchiveSink(fn) { _archiveSink = fn; }

function scheduleCloudSync() {
  if (!_cloudEnabled || !_cloudSync) return;
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    try { _cloudSync(_state); } catch (e) { console.error("[store] cloud sync", e); }
  }, 500);
}

/** Flush any pending write-behind immediately — used when the tab is hidden or the
    app is about to reload, so recent changes aren't lost to the 500ms debounce. */
export function flushCloudSync() {
  if (!_cloudEnabled || !_cloudSync) return;
  clearTimeout(_syncTimer);
  try { _cloudSync(_state); } catch (e) { console.error("[store] cloud flush", e); }
}
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushCloudSync();
  });
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    return { ...structuredClone(DEFAULT_STATE), ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
}

export function getState() {
  return _state;
}

/** A clean default state — used by the cloud hydrator to build from rows. */
export function freshState() {
  return structuredClone(DEFAULT_STATE);
}

/** Replace state wholesale from the cloud and turn write-behind sync on. */
export function hydrateState(state) {
  _state = state;
  sortChildren();
  _cloudEnabled = true;
  // Heal legacy code-less children now that we're cloud-enabled; if anything was
  // fixed, push it so those children (and everything hanging off them) can sync.
  const healed = ensureChildAccessCodes();
  persist();
  if (healed) scheduleCloudSync();
  _subs.forEach(cb => cb(_state));
}

/** Logout: drop the cached data and stop syncing. */
export function resetToLoggedOut() {
  _cloudEnabled = false;
  _state = structuredClone(DEFAULT_STATE);
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  // Wipe any local "safety net" drafts so nothing personal lingers on a shared device.
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("northstar::draft::")) localStorage.removeItem(k);
    }
    // Allow the next account on this device a fresh email-based subscription link.
    localStorage.removeItem("northstar::emailClaimDone");
    // Don't carry a "parked onboarding" flag across accounts on a shared device.
    localStorage.removeItem("northstar::onboardingParked");
  } catch { /* ignore */ }
  _subs.forEach(cb => cb(_state));
}

/**
 * Atomic update. `fn` receives a draft (the live state) and may mutate;
 * after mutation we persist locally, notify subscribers, and (when logged in)
 * schedule a debounced write-behind to the cloud.
 */
// Keep children in a single canonical order everywhere: oldest first, youngest
// last (unknown ages sort to the end). Mutates the array in place so every view
// that reads state.children is consistent without per-view sorting.
function sortChildren() {
  if (!Array.isArray(_state.children)) return;
  _state.children.sort((a, b) => {
    const aa = ageOf(a), ab = ageOf(b);
    if (aa == null && ab == null) return 0;
    if (aa == null) return 1;
    if (ab == null) return -1;
    return ab - aa; // descending age = oldest first
  });
}

/**
 * Heal any child missing an access_code. Children created under the OLD scheme
 * (codes were derived from the name on the fly, never stored) have no accessCode
 * — and access_code is NOT NULL in the cloud, so those children silently fail to
 * sync, which cascades: their projects, milestones and evidence can't sync either.
 * Backfilling a valid, collision-free code here repairs the whole chain.
 * Returns true if anything changed (so the caller can trigger a sync).
 */
function ensureChildAccessCodes() {
  const kids = _state.children || [];
  const used = new Set(kids.map(c => normalizeAccessCode(c.accessCode)).filter(Boolean));
  let changed = false;
  kids.forEach(c => {
    if (c.accessCode && normalizeAccessCode(c.accessCode)) {
      if (!c.accessCodeDisplay) { c.accessCodeDisplay = c.accessCode; changed = true; }
      return;
    }
    let pair;
    do { pair = _genAccessCode(); } while (used.has(normalizeAccessCode(pair.code)));
    used.add(normalizeAccessCode(pair.code));
    c.accessCode = pair.code;
    c.accessCodeDisplay = pair.display;
    changed = true;
  });
  return changed;
}

export function update(fn) {
  fn(_state);
  sortChildren();
  persist();
  _subs.forEach(cb => cb(_state));
  scheduleCloudSync();
}

export function subscribe(cb) {
  _subs.add(cb);
  return () => _subs.delete(cb);
}

/* Load a CHILD-PORTAL session fetched from the cloud (the child is on their own
   device with no parent data). Sets just the child's slices locally and does NOT
   schedule a cloud write (the child isn't an authed parent). family stays unset,
   so syncCore early-returns and the read-only portal renders from these. */
export function loadChildPortalSession({ children = [], projects = [], milestones = [] }) {
  _state.children = children;
  _state.projects = projects;
  _state.milestones = milestones;
  _state.meta = { ..._state.meta, childPortalMode: true };
  persist();
  _subs.forEach(cb => cb(_state));
}

export function resetAll() {
  _state = structuredClone(DEFAULT_STATE);
  persist();
  _subs.forEach(cb => cb(_state));
}

// Live age from a child's birthday (auto-tracks as time passes). Falls back to
// a stored `age` if no birthday is set.
export function ageOf(child) {
  const b = child?.birthday;
  if (!b) return child?.age ?? null;
  const d = new Date(b);
  if (isNaN(d.getTime())) return child?.age ?? null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a >= 0 ? a : null;
}

// Real UUIDs so app-generated ids are valid Postgres primary keys.
// (The prefix arg is ignored now; kept for call-site compatibility.)
export const uid = (_prefix = "id") =>
  (crypto.randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      }));

/* ---------------- Family Rhythm (Rhythm Engine config) ---------------- */
export function setFamilyRhythm(patch) {
  update(s => {
    s.family = s.family || {};
    s.family.rhythm = { ...(s.family.rhythm || {}), ...patch };
  });
}

/* ---------------- Reflection reports (monthly/quarterly/annual) ---------------- */
export function addReflectionReport(report) {
  const r = {
    id: uid("refl"),
    type: "monthly",          // monthly | quarterly | annual
    childId: null,
    schoolYear: null,
    quarter: null,
    generatedDate: new Date().toISOString(),
    status: "scheduled",      // scheduled | generating | ready
    summary: "",
    strengths: [],
    growthOpportunities: [],
    aiObservations: [],
    suggestedNextSteps: [],
    metadata: {},
    ...report,
  };
  update(s => { s.reflectionReports.push(r); });
  return r;
}
export function getReflectionReports(childId = null) {
  const all = _state.reflectionReports || [];
  return childId ? all.filter(r => r.childId === childId) : all;
}
export function updateReflectionReport(id, patch) {
  update(s => { const r = s.reflectionReports.find(x => x.id === id); if (r) Object.assign(r, patch); });
}

/* ---------------- Media assets (photos/videos/voice/docs) ---------------- */
export function addMediaAsset(asset) {
  const m = {
    id: uid("media"),
    childId: null,
    projectId: null,
    milestoneId: null,
    kind: "photo",            // photo | video | voice | document
    storagePath: null,        // future: Supabase Storage path
    dataUrl: null,            // MVP: inline data (small files) until Storage is wired
    caption: "",
    capturedAt: new Date().toISOString(),
    schoolYear: null,
    metadata: {},
    ...asset,
  };
  update(s => { s.mediaAssets.push(m); });
  return m;
}
export function getMediaAssets(filter = {}) {
  return (_state.mediaAssets || []).filter(m =>
    (!filter.childId || m.childId === filter.childId) &&
    (!filter.projectId || m.projectId === filter.projectId) &&
    (!filter.milestoneId || m.milestoneId === filter.milestoneId) &&
    (!filter.schoolYear || m.schoolYear === filter.schoolYear));
}
export function removeMediaAsset(id) {
  update(s => { s.mediaAssets = s.mediaAssets.filter(m => m.id !== id); });
}

/* ---------------- Calendar events (family-added + external imports) ---------------- */
export function addCalendarEvent(event) {
  const e = {
    id: uid("cal"),
    childId: null,            // null = whole-family event
    type: "event",            // event | dance | sport | music | church | community | travel | external
    title: "",
    start: null,              // ISO
    end: null,                // ISO
    allDay: false,
    recurrence: null,         // future: RRULE-style string
    source: "manual",         // manual | google | apple | outlook
    externalId: null,
    metadata: {},
    ...event,
  };
  update(s => { s.calendarEvents.push(e); });
  return e;
}
export function getCalendarEvents() { return _state.calendarEvents || []; }
export function updateCalendarEvent(id, patch) {
  update(s => { const e = s.calendarEvents.find(x => x.id === id); if (e) Object.assign(e, patch); });
}
export function removeCalendarEvent(id) {
  update(s => { s.calendarEvents = s.calendarEvents.filter(e => e.id !== id); });
}

/* ---------------- Preference signals (the family learning loop) ----------------
   One unified event log capturing both EXPLICIT feedback (rejection reasons +
   notes) and IMPLICIT behaviour (accepted / regenerated / edited / completed /
   abandoned …). Future generation aggregates these into a richer understanding
   of each family's preferences. Capture now; the AI deepens its use over time. */
export function recordPreferenceSignal(signal) {
  const sig = {
    id: uid("sig"),
    type: "rejected",        // rejected | accepted | regenerated | edited | completed | abandoned | milestone-completed | photo-uploaded | reward-selected
    childId: null,
    projectId: null,
    reasons: [],             // explicit: selected rejection reasons
    note: "",                // explicit: optional free text
    projectSnapshot: {},      // attributes of the project the signal is about (for pattern learning)
    metadata: {},
    createdAt: new Date().toISOString(),
    ...signal,
  };
  update(s => { s.preferenceSignals.push(sig); });
  return sig;
}
export function getPreferenceSignals(childId = null) {
  const all = _state.preferenceSignals || [];
  return childId ? all.filter(s => s.childId === childId) : all;
}

/* ---------------- Family ---------------- */
export function setFamily(patch) {
  update(s => {
    s.family = { ...(s.family || {}), ...patch };
  });
}

/* ---------------- Family Technology Agreement (per child) ----------------
   Stored inside the child's existing learning_profile jsonb (syncs with no
   migration). Always merge into learningProfile so other profile fields and
   the agreement coexist. */
export function getTechAgreement(childId) {
  const c = _state.children.find(x => x.id === childId);
  return c?.learningProfile?.techAgreement || {};
}
export function setTechAgreement(childId, agreement) {
  update(s => {
    const c = s.children.find(x => x.id === childId);
    if (!c) return;
    c.learningProfile = { ...(c.learningProfile || {}), techAgreement: { ...agreement, updatedAt: new Date().toISOString() } };
  });
}
// Stamp a review: when, and which age bracket the child was in, so the
// living-document nudges can notice when the child grows into a new stage.
export function markTechReviewed(childId, ageBand = null) {
  update(s => {
    const c = s.children.find(x => x.id === childId);
    if (!c) return;
    const cur = c.learningProfile?.techAgreement || {};
    c.learningProfile = { ...(c.learningProfile || {}), techAgreement: {
      ...cur, lastReviewedAt: new Date().toISOString(),
      reviewedAgeBands: ageBand ? [ageBand] : (cur.reviewedAgeBands || []),
      updatedAt: new Date().toISOString(),
    } };
  });
}

/* ---------------- Children ---------------- */
export function addChild(child) {
  const c = {
    id: uid("child"),
    familyId: _state.family?.id,
    name: "",
    age: null,
    birthday: null,
    grade: null,
    passions: [],
    strengths: [],
    supportNeeds: [],
    goals: [],
    faithEnabled: false,
    faithTradition: "",
    notes: "",
    avatarIndex: ((_state.children.length) % 5) + 1,
    ...newAccessCode(),   // { accessCode, accessCodeDisplay } — a matched pair
    learningStyle: _state.family?.learningStyleDefault ?? 5,
    diyMaterials: _state.family?.diyMaterialsPreference ?? 5,
    domains: [],
    guideId: null,             // the Guide this child journeys with
    // Capability-based Learning Profile: { levels, levelsNote, differences, differencesNote, about }
    learningProfile: {},
    mobilityProfile: null,     // freedom level slug
    // Printing access for THIS child's own portal (parent always can print):
    //   "allow" | "approval" | "disabled". Defaults to parent-approval.
    printPermission: "approval",
    createdAt: new Date().toISOString(),
    ...child,
  };
  update(s => { s.children.push(c); });
  return c;
}
export function updateChild(id, patch) {
  update(s => {
    const c = s.children.find(x => x.id === id);
    if (c) Object.assign(c, patch);
  });
}
export function removeChild(id) {
  update(s => {
    s.children = s.children.filter(c => c.id !== id);
    s.projects = s.projects.filter(p => p.childId !== id);
    s.milestones = s.milestones.filter(m => {
      const proj = s.projects.find(p => p.id === m.projectId);
      return !!proj;
    });
  });
}
export function getChild(id) {
  return _state.children.find(c => c.id === id);
}
export function getChildByCode(code) {
  // Match on the normalized form so a friendly/typed variant (hyphens, case,
  // spaces) resolves to the same child as the stored normalized code.
  const norm = normalizeAccessCode(code);
  return _state.children.find(c => normalizeAccessCode(c.accessCode) === norm);
}

/* Access code = two memorable words + a 2-digit number (e.g. "sunny-otter-47").
   High-entropy, identity-safe, child-friendly — see js/lib/accessCode.js. Returns
   a matched pair { accessCode (normalized), accessCodeDisplay (friendly) },
   retrying on the rare local collision so no two of a family's children clash. */
export function newAccessCode() {
  const existing = new Set((_state.children || []).map(c => normalizeAccessCode(c.accessCode)));
  let pair = _genAccessCode();
  for (let i = 0; i < 8 && existing.has(pair.code); i++) pair = _genAccessCode();
  return { accessCode: pair.code, accessCodeDisplay: pair.display };
}

/* ---------------- Projects ---------------- */
export function addProject(project) {
  const p = {
    id: uid("proj"),
    childId: null,
    title: "",
    description: "",
    domains: [],                 // Capability Domain ids this project strengthens
    // Capability mapping metadata — the intelligence layer (set by AI generation):
    // { primary:[ids], secondary:[ids], skills:[strings], competencyGrowth:{ids→0-100} }
    capabilityMap: { primary: [], secondary: [], skills: [], competencyGrowth: {} },
    passionConnection: "",
    learningOutcomes: [],
    materials: [],
    startDate: new Date().toISOString(),
    dueDate: null,
    momentumPointsAvailable: 0,
    momentumPointsEarned: 0,
    starsAvailable: 0,
    starsEarned: 0,
    reward: "",
    toll: "",
    childAgreed: false,
    parentApproved: true,
    status: "active", // active | completed | paused
    createdAt: new Date().toISOString(),
    ...project,
  };
  update(s => { s.projects.push(p); });
  return p;
}
export function updateProject(id, patch) {
  update(s => {
    const p = s.projects.find(x => x.id === id);
    if (p) Object.assign(p, patch);
  });
}
export function removeProject(id) {
  update(s => {
    s.projects = s.projects.filter(p => p.id !== id);
    s.milestones = s.milestones.filter(m => m.projectId !== id);
    s.reflections = s.reflections.filter(r => r.projectId !== id);
  });
}
export function getProject(id) { return _state.projects.find(p => p.id === id); }

/* ---------------- Milestones ---------------- */
export function addMilestone(m) {
  const mile = {
    id: uid("mile"),
    projectId: null,
    title: "",
    description: "",
    instructions: [],   // concrete action-step strings the child can follow
    dueDate: null,
    momentumPoints: 10,
    completed: false,
    completedAt: null,
    starEarned: false,
    reflectionRequired: false,
    reflectionId: null,
    evidence: [],         // [{ id, kind:"note"|"upload"|"voice", text?, fileName?, fileType?, fileSize?, storagePath?, createdAt }]
    submission: null,     // { text, voiceTranscript, submittedAt } — the child's typed/spoken answer
    ...m,
  };
  update(s => { s.milestones.push(mile); });
  return mile;
}

/**
 * Attach evidence (notes, files, voice) to a milestone.
 * `payload` shape:
 *   { submission: { text }, evidence: [{ kind, text?, fileName?, fileType?, fileSize?, dataUrl? }] }
 */
export function addMilestoneSubmission(milestoneId, payload) {
  update(s => {
    const m = s.milestones.find(x => x.id === milestoneId);
    if (!m) return;
    if (payload.submission && (payload.submission.text || payload.submission.voiceTranscript)) {
      m.submission = {
        text: payload.submission.text || "",
        voiceTranscript: payload.submission.voiceTranscript || "",
        submittedAt: new Date().toISOString(),
      };
    }
    if (Array.isArray(payload.evidence) && payload.evidence.length) {
      m.evidence = (m.evidence || []).concat(payload.evidence.map(e => ({
        id: uid("ev"),
        createdAt: new Date().toISOString(),
        ...e,
      })));
    }
  });
}

export function removeMilestoneEvidence(milestoneId, evidenceId) {
  update(s => {
    const m = s.milestones.find(x => x.id === milestoneId);
    if (m) m.evidence = (m.evidence || []).filter(e => e.id !== evidenceId);
  });
}

export function getMilestoneEvidenceForChild(childId) {
  const projectIds = new Set(_state.projects.filter(p => p.childId === childId).map(p => p.id));
  const out = [];
  _state.milestones.forEach(m => {
    if (!projectIds.has(m.projectId)) return;
    if (!m.evidence || !m.evidence.length) return;
    const project = _state.projects.find(p => p.id === m.projectId);
    m.evidence.forEach(e => out.push({ ...e, milestone: m, project }));
  });
  return out.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
export function updateMilestone(id, patch) {
  update(s => {
    const m = s.milestones.find(x => x.id === id);
    if (m) Object.assign(m, patch);
  });
}
export function getMilestonesForProject(projectId) {
  return _state.milestones
    .filter(m => m.projectId === projectId)
    .sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0));
}

/**
 * Toggle a milestone as completed. Awards a star + momentum points.
 * Also bumps the parent project's earned tallies.
 */
export function completeMilestone(milestoneId) {
  let event = null;   // the factual Archive event, emitted after the state update
  update(s => {
    const m = s.milestones.find(x => x.id === milestoneId);
    if (!m) return;
    const p = s.projects.find(p => p.id === m.projectId);
    const familyId = s.family?.id || null;
    const childId = p?.childId || null;
    if (m.completed) {
      // un-complete (mistake recovery) — a first-class factual event, not a delete.
      const previousCompletedAt = m.completedAt;
      m.completed = false;
      m.completedAt = null;
      m.starEarned = false;
      if (p) {
        p.starsEarned = Math.max(0, p.starsEarned - 1);
        p.momentumPointsEarned = Math.max(0, p.momentumPointsEarned - (m.momentumPoints || 0));
      }
      event = {
        kind: "milestone_uncompleted", familyId, childId, projectId: m.projectId,
        milestoneId: m.id, milestoneTitle: m.title,
        undoneAt: new Date().toISOString(), previousCompletedAt,
      };
    } else {
      m.completed = true;
      m.completedAt = new Date().toISOString();
      m.starEarned = true;
      let finalMilestone = false;   // did this completion finish the project's milestones?
      if (p) {
        p.starsEarned += 1;
        p.momentumPointsEarned += (m.momentumPoints || 0);
        const allDone = s.milestones.filter(x => x.projectId === p.id).every(x => x.completed);
        if (allDone && p.status === "active") {
          // wait for reflection before marking fully complete; we mark "ready"
          p.status = "ready-for-reflection";
          finalMilestone = true;
        }
      }
      event = {
        kind: "milestone_completed", familyId, childId, projectId: m.projectId,
        milestoneId: m.id, milestoneTitle: m.title, momentumPoints: m.momentumPoints,
        estimatedProjectDurationDays: p?.durationDays ?? null, finalMilestone,
        completedAt: m.completedAt,
      };
    }
  });
  // Factual completion evidence → Archive (via the sink; actor resolved there).
  if (event && _archiveSink) {
    try { _archiveSink(event); } catch (e) { console.error("[store] archive sink", e); }
  }
}

/* ---------------- Reflections ---------------- */
export function addReflection(r) {
  const ref = {
    id: uid("refl"),
    childId: null,
    projectId: null,
    milestoneId: null,
    prompt: "",
    response: "",
    createdAt: new Date().toISOString(),
    ...r,
  };
  update(s => { s.reflections.push(ref); });
  return ref;
}
export function getReflectionsForProject(projectId) {
  return _state.reflections.filter(r => r.projectId === projectId);
}

/* ---------------- AI Mentor conversations (Phase 1: Polaris) ----------------
   One conversation per child per mentor. Persisted locally so a child can
   resume where they left off. Cloud sync + shared memory arrive in Phase 2. */
export function getMentorConversation(childId, mentorId) {
  return (_state.mentorConversations || []).find(
    c => c.childId === childId && c.mentorId === mentorId
  ) || null;
}
export function getOrCreateMentorConversation(childId, mentorId) {
  let convo = getMentorConversation(childId, mentorId);
  if (convo) return convo;
  convo = {
    id: uid("mentor"),
    childId,
    mentorId,
    turns: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  update(s => { s.mentorConversations.push(convo); });
  return convo;
}
/** Append one turn. role = "child" | "mentor". */
export function addMentorTurn(conversationId, turn) {
  update(s => {
    const c = s.mentorConversations.find(x => x.id === conversationId);
    if (!c) return;
    c.turns.push({
      role: turn.role || "child",
      text: turn.text || "",
      suggestions: turn.suggestions || [],
      whiteboard: turn.whiteboard || null,
      at: new Date().toISOString(),
    });
    c.updatedAt = new Date().toISOString();
  });
}
/** Clear a conversation's history (start fresh). */
export function resetMentorConversation(conversationId) {
  update(s => {
    const c = s.mentorConversations.find(x => x.id === conversationId);
    if (c) { c.turns = []; c.updatedAt = new Date().toISOString(); }
  });
}

/* ---------------- Materials + Cart ---------------- */
export function addMaterial(mat) {
  const m = {
    id: uid("mat"),
    name: "",
    category: "",
    description: "",
    reasonSuggested: "",
    ageRange: "",
    buyOrDIY: "buy",
    estimatedPrice: 0,
    approved: false,
    rejected: false,
    inCart: false,
    affiliateUrlPlaceholder: "#",
    forChildId: null,
    // Learning Resources engine fields:
    section: "personalised",         // essentials | project | personalised | printable | marketplace
    status: "suggested",             // suggested | approved | owned | self-source | dismissed
    meta: {},                        // { catalogId, format, frequency, capabilityDomains[], projectIds[], affiliateAvailable, purchased }
    ...mat,
  };
  update(s => { s.materials.push(m); });
  return m;
}

/* ---------- Learning Resources lifecycle ----------
   The engine (lib/resources.js) derives the five sections from catalogs +
   live project/child data. When a parent acts on any derived/catalog item,
   we "materialise" it into a persistent resource record and set its status.
   This is the relationship layer that keeps Learning Resources in sync with
   the rest of the platform. */
function _resourceKey({ section, catalogId, name }) {
  if (catalogId) return `cat::${catalogId}`;
  return `${section || "personalised"}::${String(name || "").trim().toLowerCase()}`;
}
function _recordKeyOf(m) {
  return _resourceKey({ section: m.section, catalogId: m.meta?.catalogId, name: m.name });
}
function _materialFromSpec(spec) {
  return {
    id: uid("mat"),
    name: spec.name || "",
    category: spec.category || "",
    description: spec.description || "",
    reasonSuggested: spec.reasonSuggested || "",
    ageRange: spec.ageRange || "",
    buyOrDIY: spec.kind === "diy" ? "diy" : "buy",
    estimatedPrice: spec.estimatedPrice || 0,
    approved: false,
    rejected: false,
    inCart: false,
    affiliateUrlPlaceholder: spec.affiliateUrl || "#",
    forChildId: spec.forChildId || null,
    section: spec.section || "personalised",
    status: "suggested",
    meta: {
      catalogId: spec.catalogId || null,
      format: spec.format || "physical",
      frequency: spec.frequency || "occasional",
      capabilityDomains: spec.capabilityDomains || [],
      projectIds: spec.projectIds || [],
      affiliateAvailable: spec.affiliateAvailable ?? (spec.kind !== "diy"),
    },
  };
}
function _applyResourceStatus(s, m, status) {
  m.status = status;
  m.approved = status === "approved";
  m.rejected = status === "dismissed";
  // "planned" = the family wants this and it's on their Planning List. Seed a
  // default acquisition method (make a DIY item, otherwise buy) they can change.
  if (status === "planned" && !m.planMethod) m.planMethod = m.buyOrDIY === "diy" ? "make" : "buy";
  if (status === "owned") {
    m.meta = { ...(m.meta || {}), purchased: true };
    // Marking a resource as owned grows the living Family Inventory.
    const invCategory = m.section === "character" ? "character" : "learning-equipment";
    if (!(s.inventory || []).some(i => _invKey(i.category, i.name) === _invKey(invCategory, m.name))) {
      s.inventory.push({ id: uid("inv"), category: invCategory, name: m.name, owned: true, note: "", meta: { fromResource: true }, createdAt: new Date().toISOString() });
    }
  }
  // Cart: only ready-made physical items, when approved.
  const wantsCart = status === "approved" && m.buyOrDIY !== "diy" && (m.meta?.format !== "printable");
  if (wantsCart && !m.inCart) {
    s.cart.push({ id: uid("cart"), materialId: m.id, quantity: 1 });
    m.inCart = true;
  } else if (!wantsCart && m.inCart) {
    s.cart = s.cart.filter(c => c.materialId !== m.id);
    m.inCart = false;
  }
}
/** Act on a resource (from the engine). `spec` describes the item; if no stored
    record exists yet it is created, then its status is set. Returns the record id. */
export function recordResourceAction(spec, status) {
  let id = null;
  update(s => {
    let m = spec.recordId ? s.materials.find(x => x.id === spec.recordId) : null;
    if (!m) m = s.materials.find(x => _recordKeyOf(x) === (spec.key || _resourceKey(spec)));
    if (!m) { m = _materialFromSpec(spec); s.materials.push(m); }
    _applyResourceStatus(s, m, status);
    id = m.id;
  });
  return id;
}
export function updateMaterial(id, patch) {
  update(s => {
    const m = s.materials.find(x => x.id === id);
    if (m) Object.assign(m, patch);
  });
}
export function approveMaterial(id) {
  update(s => {
    const m = s.materials.find(x => x.id === id);
    if (m) {
      m.approved = true;
      m.rejected = false;
      if (m.buyOrDIY === "buy" && !m.inCart) {
        s.cart.push({ id: uid("cart"), materialId: m.id, quantity: 1 });
        m.inCart = true;
      }
    }
  });
}
export function rejectMaterial(id) {
  update(s => {
    const m = s.materials.find(x => x.id === id);
    if (m) {
      m.rejected = true;
      m.approved = false;
      if (m.inCart) {
        s.cart = s.cart.filter(c => c.materialId !== m.id);
        m.inCart = false;
      }
    }
  });
}
export function removeFromCart(materialId) {
  update(s => {
    s.cart = s.cart.filter(c => c.materialId !== materialId);
    const m = s.materials.find(x => x.id === materialId);
    if (m) m.inCart = false;
  });
}

/* ---- Planning List (the honest replacement for the mock cart) ----
   Items the family has chosen to acquire live as materials with status
   "planned", each carrying a planMethod: "buy" | "borrow" | "make". */
export function getPlannedResources() {
  return (_state.materials || []).filter(m => m.status === "planned");
}
export function setResourcePlanMethod(id, method) {
  update(s => {
    const m = s.materials.find(x => x.id === id);
    if (m) m.planMethod = method;
  });
}
/** Set a stored resource's status by record id (used by the Planning List for
    "got it" → owned, or removing an item), routing through the shared status
    logic so inventory/cart side-effects stay consistent. */
export function setResourceStatusById(id, status) {
  update(s => {
    const m = s.materials.find(x => x.id === id);
    if (m) _applyResourceStatus(s, m, status);
  });
}

/* ---------------- Family Inventory ----------------
   North Star's living understanding of what the family already owns. Built
   progressively and fed into project generation so projects use what the family
   has before recommending purchases. */
const _invKey = (category, name) => `${category}::${String(name || "").trim().toLowerCase()}`;

export function getInventory() { return _state.inventory || []; }

export function hasInventoryItem(category, name) {
  return (_state.inventory || []).some(i => _invKey(i.category, i.name) === _invKey(category, name));
}

export function addInventoryItem({ category, name, note = "", meta = {} }) {
  const clean = String(name || "").trim();
  if (!clean) return null;
  if (hasInventoryItem(category, clean)) return null;
  const item = { id: uid("inv"), category: category || "other", name: clean, owned: true, note, meta, createdAt: new Date().toISOString() };
  update(s => { s.inventory.push(item); });
  return item;
}

export function removeInventoryItem(id) {
  update(s => { s.inventory = s.inventory.filter(i => i.id !== id); });
}

/** Toggle an item by category+name. Returns true if now owned, false if removed. */
export function toggleInventoryItem(category, name) {
  const existing = (_state.inventory || []).find(i => _invKey(i.category, i.name) === _invKey(category, name));
  if (existing) { removeInventoryItem(existing.id); return false; }
  addInventoryItem({ category, name });
  return true;
}

/** Merge structured inventory context (music lessons, sports clubs, reading) onto the family. */
export function setInventoryContext(patch) {
  update(s => {
    if (!s.family) return;
    s.family.inventoryContext = { ...(s.family.inventoryContext || {}), ...patch };
  });
}

/* ---------------- Notifications ---------------- */
export function addNotification(n) {
  const notif = {
    id: uid("notif"),
    childId: null,
    projectId: null,
    milestoneId: null,
    message: "",
    dueDate: new Date().toISOString(),
    read: false,
    ...n,
  };
  update(s => { s.notifications.unshift(notif); });
  return notif;
}
export function markNotificationRead(id) {
  update(s => {
    const n = s.notifications.find(x => x.id === id);
    if (n) n.read = true;
  });
}

/* ---------------- Derived selectors ---------------- */
export function getChildStats(childId) {
  const projects = _state.projects.filter(p => p.childId === childId);
  const projectIds = projects.map(p => p.id);
  const milestones = _state.milestones.filter(m => projectIds.includes(m.projectId));
  const completedMilestones = milestones.filter(m => m.completed);
  const totalMomentum = projects.reduce((s, p) => s + (p.momentumPointsEarned || 0), 0);
  const totalStars = projects.reduce((s, p) => s + (p.starsEarned || 0), 0);
  const completedProjects = projects.filter(p => p.status === "completed");
  return {
    activeProjects: projects.filter(p => p.status === "active" || p.status === "ready-for-reflection"),
    completedProjects,
    totalProjects: projects.length,
    milestones,
    completedMilestones: completedMilestones.length,
    totalMilestones: milestones.length,
    totalMomentum,
    totalStars,
    badges: completedProjects.length,
  };
}

export function getActiveMilestonesForChild(childId) {
  const projects = _state.projects
    .filter(p => p.childId === childId && p.status !== "completed");
  const projectIds = new Set(projects.map(p => p.id));
  return _state.milestones
    .filter(m => projectIds.has(m.projectId) && !m.completed)
    .sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0));
}

/* ---------------- Parent observations ---------------- */
export function addParentObservation(o) {
  const obs = {
    id: uid("obs"),
    childId: null,
    strengths: "",
    challenges: "",
    growthObserved: "",
    concerns: "",
    goalsNextTerm: "",
    createdAt: new Date().toISOString(),
    ...o,
  };
  update(s => { (s.parentObservations ||= []).push(obs); });
  return obs;
}
export function getObservationsForChild(childId) {
  return (_state.parentObservations || [])
    .filter(o => o.childId === childId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/* ---------------- Child self-assessments ---------------- */
export function addChildSelfAssessment(a) {
  const sa = {
    id: uid("self"),
    childId: null,
    proudOf: "",
    hardThing: "",
    wantToGetBetterAt: "",
    favouriteProject: "",
    wantToLearnNext: "",
    createdAt: new Date().toISOString(),
    ...a,
  };
  update(s => { (s.childSelfAssessments ||= []).push(sa); });
  return sa;
}
export function getSelfAssessmentsForChild(childId) {
  return (_state.childSelfAssessments || [])
    .filter(a => a.childId === childId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/* ---------------- Growth reports ---------------- */
export function saveGrowthReport(report) {
  update(s => { (s.growthReports ||= []).push(report); });
  return report;
}
export function getReport(id) {
  return (_state.growthReports || []).find(r => r.id === id);
}
export function getReportsForChild(childId) {
  return (_state.growthReports || [])
    .filter(r => r.childId === childId)
    .sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));
}
export function deleteReport(id) {
  update(s => { s.growthReports = (s.growthReports || []).filter(r => r.id !== id); });
}

/* ---------------- Insight Reports ---------------- */
export function saveInsightReport(report) {
  update(s => { (s.insightReports ||= []).push(report); });
  return report;
}
export function getInsightReport(id) {
  return (_state.insightReports || []).find(r => r.id === id);
}
export function getInsightReportsForChild(childId) {
  return (_state.insightReports || [])
    .filter(r => r.childId === childId)
    .sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));
}
export function deleteInsightReport(id) {
  update(s => { s.insightReports = (s.insightReports || []).filter(r => r.id !== id); });
}

/* ---------------- Guild Config ---------------- */
export function setGuildConfig(patch) {
  update(s => {
    s.guildConfig = { ...(s.guildConfig || {}), ...patch };
    if (patch.location) s.guildConfig.location = { ...(s.guildConfig.location || {}), ...patch.location };
    if (patch.childParticipation) {
      s.guildConfig.childParticipation = { ...(s.guildConfig.childParticipation || {}), ...patch.childParticipation };
    }
  });
}

/* ---------------- Quest Teams ---------------- */
export function toggleQuestTeam(childId, teamId) {
  update(s => {
    const cur = new Set((s.questTeamMemberships?.[childId]) || []);
    if (cur.has(teamId)) cur.delete(teamId); else cur.add(teamId);
    s.questTeamMemberships = { ...(s.questTeamMemberships || {}), [childId]: Array.from(cur) };
  });
}

/* ---------------- Showcases ---------------- */
export function addShowcase(sc) {
  const s = {
    id: uid("show"),
    childId: null,
    projectId: null,
    title: "", summary: "", lessons: "",
    photos: [],
    points: 0,
    celebrations: 0,
    comments: [],
    fromOtherFamily: false,
    family: "",
    createdAt: new Date().toISOString(),
    ...sc,
  };
  update(state => { (state.showcases ||= []).push(s); });
  return s;
}
export function celebrateShowcase(id) {
  update(s => {
    const sc = (s.showcases || []).find(x => x.id === id);
    if (sc) sc.celebrations = (sc.celebrations || 0) + 1;
  });
}
export function addShowcaseComment(id, comment) {
  update(s => {
    const sc = (s.showcases || []).find(x => x.id === id);
    if (sc) (sc.comments ||= []).push({ id: uid("c"), at: new Date().toISOString(), ...comment });
  });
}
export function removeShowcase(id) {
  update(s => { s.showcases = (s.showcases || []).filter(x => x.id !== id); });
}

/* ---------------- Mentorship ---------------- */
export function requestMentorship(req) {
  const r = {
    id: uid("ment"),
    mentorId: null, menteeChildId: null, category: "",
    status: "pending", parentApproved: false,
    createdAt: new Date().toISOString(),
    ...req,
  };
  update(s => { (s.mentorshipRequests ||= []).push(r); });
  return r;
}
export function approveMentorship(id) {
  update(s => {
    const r = (s.mentorshipRequests || []).find(x => x.id === id);
    if (r) { r.parentApproved = true; r.status = "active"; r.approvedAt = new Date().toISOString(); }
  });
}
export function rejectMentorship(id) {
  update(s => {
    const r = (s.mentorshipRequests || []).find(x => x.id === id);
    if (r) { r.status = "rejected"; r.rejectedAt = new Date().toISOString(); }
  });
}
export function completeMentorship(id) {
  update(s => {
    const r = (s.mentorshipRequests || []).find(x => x.id === id);
    if (r) { r.status = "completed"; r.completedAt = new Date().toISOString(); }
  });
}

/* ---------------- Challenges ---------------- */
export function joinChallenge(challengeId, childId) {
  update(s => {
    const lst = (s.challengeParticipants ||= {});
    lst[challengeId] ||= [];
    if (!lst[challengeId].some(p => p.childId === childId)) {
      lst[challengeId].push({ childId, joinedAt: new Date().toISOString() });
    }
  });
}
export function leaveChallenge(challengeId, childId) {
  update(s => {
    if (!s.challengeParticipants?.[challengeId]) return;
    s.challengeParticipants[challengeId] = s.challengeParticipants[challengeId].filter(p => p.childId !== childId);
  });
}
export function completeChallenge(challengeId, childId) {
  update(s => {
    const lst = s.challengeParticipants?.[challengeId];
    if (!lst) return;
    const entry = lst.find(p => p.childId === childId);
    if (entry) entry.completedAt = new Date().toISOString();
  });
}

/* ---------------- Skill Exchange ---------------- */
export function setSkillExchange(childId, patch) {
  update(s => {
    s.skillExchange ||= {};
    s.skillExchange[childId] = { teaches: [], wantsToLearn: [], ...(s.skillExchange[childId] || {}), ...patch };
  });
}

/* ---------------- Family Councils ---------------- */
export function saveCouncil(council) {
  update(s => { (s.familyCouncils ||= []).push(council); });
  return council;
}
export function getCouncil(id) {
  return (_state.familyCouncils || []).find(c => c.id === id);
}
export function listCouncils() {
  return (_state.familyCouncils || []).slice().sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));
}
export function deleteCouncil(id) {
  update(s => { s.familyCouncils = (s.familyCouncils || []).filter(c => c.id !== id); });
}
export function setCouncilGoals(councilId, goals) {
  update(s => {
    const c = (s.familyCouncils || []).find(x => x.id === councilId);
    if (c) c.familyGoals = goals;
  });
}

/* ---------------- Insights Config ---------------- */
export function setInsightsConfig(patch) {
  update(s => {
    s.insightsConfig = { ...(s.insightsConfig || {}), ...patch };
    if (patch.frameworks) {
      s.insightsConfig.frameworks = { ...(s.insightsConfig.frameworks || {}), ...patch.frameworks };
    }
  });
}

export function getAllUpcomingEvents() {
  const events = [];
  _state.projects.forEach(p => {
    if (p.status === "completed") return;                 // finished projects aren't "coming up"
    if (p.dueDate) events.push({ type: "project-due", date: p.dueDate, project: p, child: getChild(p.childId) });
  });
  _state.milestones.forEach(m => {
    if (m.completed) return;                              // once marked done, it drops off the parent's list
    const proj = _state.projects.find(p => p.id === m.projectId);
    if (!proj || proj.status === "completed") return;
    if (m.dueDate) {
      events.push({ type: "milestone-due", date: m.dueDate, milestone: m, project: proj, child: getChild(proj.childId) });
    }
  });
  return events.sort((a, b) => new Date(a.date) - new Date(b.date));
}

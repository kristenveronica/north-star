/* ============================================================
   store.js — Persistent data layer
   localStorage-backed for MVP; architected so a real backend
   can replace it without changing call sites.
   ============================================================ */

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

  // Layer 15 — Learning Guild + Family Councils + Family Legacy
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

/**
 * Atomic update. `fn` receives a draft (the live state) and may mutate;
 * after mutation we persist and notify subscribers.
 */
export function update(fn) {
  fn(_state);
  persist();
  _subs.forEach(cb => cb(_state));
}

export function subscribe(cb) {
  _subs.add(cb);
  return () => _subs.delete(cb);
}

export function resetAll() {
  _state = structuredClone(DEFAULT_STATE);
  persist();
  _subs.forEach(cb => cb(_state));
}

export const uid = (prefix = "id") =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;

/* ---------------- Family ---------------- */
export function setFamily(patch) {
  update(s => {
    s.family = { ...(s.family || {}), ...patch };
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
    accessCode: generateAccessCode(),
    learningStyle: _state.family?.learningStyleDefault ?? 5,
    diyMaterials: _state.family?.diyMaterialsPreference ?? 5,
    domains: [],
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
  return _state.children.find(c => c.accessCode === code);
}

function generateAccessCode() {
  const letters = "BCDFGHJKLMNPQRSTVWXYZ";
  const digits = "23456789";
  let out = "";
  for (let i = 0; i < 3; i++) out += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 3; i++) out += digits[Math.floor(Math.random() * digits.length)];
  return out;
}

/* ---------------- Projects ---------------- */
export function addProject(project) {
  const p = {
    id: uid("proj"),
    childId: null,
    title: "",
    description: "",
    domains: [],
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
    dueDate: null,
    momentumPoints: 10,
    completed: false,
    completedAt: null,
    starEarned: false,
    reflectionRequired: false,
    reflectionId: null,
    evidence: null,
    ...m,
  };
  update(s => { s.milestones.push(mile); });
  return mile;
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
  update(s => {
    const m = s.milestones.find(x => x.id === milestoneId);
    if (!m) return;
    if (m.completed) {
      // un-complete (kid mis-clicked)
      m.completed = false;
      m.completedAt = null;
      m.starEarned = false;
      const p = s.projects.find(p => p.id === m.projectId);
      if (p) {
        p.starsEarned = Math.max(0, p.starsEarned - 1);
        p.momentumPointsEarned = Math.max(0, p.momentumPointsEarned - (m.momentumPoints || 0));
      }
    } else {
      m.completed = true;
      m.completedAt = new Date().toISOString();
      m.starEarned = true;
      const p = s.projects.find(p => p.id === m.projectId);
      if (p) {
        p.starsEarned += 1;
        p.momentumPointsEarned += (m.momentumPoints || 0);
        const allDone = s.milestones.filter(x => x.projectId === p.id).every(x => x.completed);
        if (allDone && p.status === "active") {
          // wait for reflection before marking fully complete; we mark "ready"
          p.status = "ready-for-reflection";
        }
      }
    }
  });
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
    ...mat,
  };
  update(s => { s.materials.push(m); });
  return m;
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
    if (p.dueDate) events.push({ type: "project-due", date: p.dueDate, project: p, child: getChild(p.childId) });
  });
  _state.milestones.forEach(m => {
    const proj = _state.projects.find(p => p.id === m.projectId);
    if (m.dueDate && proj) {
      events.push({ type: "milestone-due", date: m.dueDate, milestone: m, project: proj, child: getChild(proj.childId) });
    }
  });
  return events.sort((a, b) => new Date(a.date) - new Date(b.date));
}

/* ============================================================
   councilEngine.js — Family Council Guide generator (Layer 15).

   At the end of each month or term, the engine produces a guided
   conversation document the family can use to gather and plan
   intentionally. Replace per-section functions with LLM calls later.
   ============================================================ */

import { DOMAIN_CATALOG } from "../seed.js";

const PERIODS = {
  month:   { label: "This month",     ms: 30 * 86400000 },
  term:    { label: "This term",      ms: 84 * 86400000 },
  quarter: { label: "Last quarter",   ms: 90 * 86400000 },
};

function inPeriod(iso, period, now = Date.now()) {
  if (!iso || !period.ms) return false;
  return now - new Date(iso).getTime() <= period.ms;
}

export function generateCouncilGuide({ family, children, projects, milestones, reflections, observations = [], periodKey = "month" }) {
  const period = PERIODS[periodKey] || PERIODS.month;

  const completedProjects = projects.filter(p => p.status === "completed");
  const periodCompleted = completedProjects.filter(p => inPeriod(p.dueDate || p.createdAt, period));
  const periodMilestones = milestones.filter(m => m.completedAt && inPeriod(m.completedAt, period));
  const periodReflections = reflections.filter(r => inPeriod(r.createdAt, period));
  const totalPoints = projects.reduce((sum, p) => sum + (p.momentumPointsEarned || 0), 0);

  const wins = collectWins(children, periodCompleted, periodMilestones, periodReflections);
  const strengths = collectEmergingStrengths(children, periodCompleted, periodReflections);
  const challenges = collectDevelopingChallenges(children, milestones, projects);
  const visionAlignment = computeFamilyVisionAlignment(family, projects);
  const suggestedTopics = buildConversationTopics(family, periodCompleted, challenges, visionAlignment);
  const discussionQuestions = buildDiscussionQuestions(children);

  return {
    id: "council_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36),
    periodKey,
    periodLabel: period.label,
    generatedAt: new Date().toISOString(),
    snapshot: {
      projectsCompleted: periodCompleted.length,
      milestonesCompleted: periodMilestones.length,
      momentumPoints: totalPoints,
      reflectionsCount: periodReflections.length,
    },
    sections: {
      wins,
      projectsCompleted: periodCompleted.map(p => ({
        title: p.title,
        childId: p.childId,
        domains: p.domains || [],
        points: p.momentumPointsEarned || 0,
      })),
      strengthsEmerging: strengths,
      challengesDeveloping: challenges,
      momentumEarned: collectMomentumByChild(children, projects),
      familyVisionAlignment: visionAlignment,
      suggestedTopics,
      discussionQuestions,
    },
    familyGoals: [],
  };
}

/* ---------- helpers ---------- */
function collectWins(children, completed, milestones, reflections) {
  const wins = [];
  completed.forEach(p => {
    const child = children.find(c => c.id === p.childId);
    if (child) wins.push({ kind: "project", text: `${child.name} completed "${p.title}".` });
  });
  // Top milestone earners
  const byChild = {};
  milestones.forEach(m => {
    const proj = arguments[1].find?.(p => p.id === m.projectId);
    // We don't have project lookup here cleanly; aggregate by count instead
    byChild[m.projectId] = (byChild[m.projectId] || 0) + 1;
  });
  // Reflection wins
  const deepRef = reflections.filter(r => (r.response || "").split(/\s+/).length >= 40);
  if (deepRef.length) {
    wins.push({ kind: "reflection", text: `${deepRef.length} deep reflection${deepRef.length === 1 ? "" : "s"} written this period.` });
  }
  if (wins.length === 0) wins.push({ kind: "neutral", text: "A quieter period. Not every month is a peak — some are for planting." });
  return wins;
}

function collectEmergingStrengths(children, completedProjects, reflections) {
  // Aggregate signal across children, count domains touched
  const domainCount = {};
  completedProjects.forEach(p => (p.domains || []).forEach(d => domainCount[d] = (domainCount[d] || 0) + 1));
  const top = Object.entries(domainCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const items = top.map(([dId, n]) => {
    const dom = DOMAIN_CATALOG.find(d => d.id === dId);
    return { name: dom?.name || dId, evidence: `${n} project${n === 1 ? "" : "s"} completed in this domain this period.` };
  });
  // Reflection-based signal
  const reflective = reflections.length >= 4;
  if (reflective) items.push({ name: "Reflective Practice", evidence: `${reflections.length} reflections recorded this period.` });
  return items;
}

function collectDevelopingChallenges(children, milestones, projects) {
  const items = [];
  const late = milestones.filter(m => m.completed && m.dueDate && new Date(m.completedAt) > new Date(m.dueDate));
  const missed = milestones.filter(m => !m.completed && m.dueDate && new Date(m.dueDate) < new Date());
  if (late.length + missed.length >= 2) {
    items.push({ name: "Pacing on longer work", evidence: `${late.length} milestones late, ${missed.length} still outstanding.` });
  }
  const stalled = projects.filter(p => p.status === "active" && p.startDate && Date.now() - new Date(p.startDate).getTime() > 60 * 86400000);
  if (stalled.length) {
    items.push({ name: "Finishing what was started", evidence: `${stalled.length} project${stalled.length === 1 ? "" : "s"} have been active for 60+ days.` });
  }
  return items;
}

function collectMomentumByChild(children, projects) {
  return children.map(c => {
    const childProjects = projects.filter(p => p.childId === c.id);
    return {
      childId: c.id, name: c.name,
      points: childProjects.reduce((s, p) => s + (p.momentumPointsEarned || 0), 0),
      stars: childProjects.reduce((s, p) => s + (p.starsEarned || 0), 0),
    };
  });
}

function computeFamilyVisionAlignment(family, projects) {
  const outcomes = family?.desiredOutcomes || [];
  if (!outcomes.length) return { items: [], overall: null, note: "Add desired outcomes in Family Vision to populate this section." };

  const items = outcomes.map(text => {
    const themes = inferThemes(text);
    const matchingProjects = projects.filter(p =>
      themes.some(t => THEME_DEFS[t].domains.some(d => (p.domains || []).includes(d))) ||
      themes.some(t => THEME_DEFS[t].match.test(`${p.title} ${p.description}`))
    );
    const points = matchingProjects.reduce((s, p) => s + (p.momentumPointsEarned || 0), 0);
    const score = Math.min(100, Math.round((points / 150) * 100 + matchingProjects.filter(p => p.status === "completed").length * 5));
    return { outcome: text, themes, score, matchingCount: matchingProjects.length };
  });
  const scored = items.filter(i => i.score != null);
  const overall = scored.length ? Math.round(scored.reduce((s, i) => s + i.score, 0) / scored.length) : null;
  return { items, overall };
}

const THEME_DEFS = {
  entrepreneurship: { match: /entrepre|business|sell|pitch|profit|product|market/i, domains: ["money", "build"] },
  communication:    { match: /communic|present|speak|writ|story|articulat|interview/i, domains: ["brain", "community"] },
  leadership:       { match: /leader|lead\b|organis/i, domains: ["community", "build"] },
  service:          { match: /serv|volunteer|neighbour|help\s|community\b|give/i, domains: ["community"] },
  faith:            { match: /faith|gospel|bible|prayer|spiritual/i, domains: ["faith"] },
  creativity:       { match: /creat|art|design|media|build|invent|story/i, domains: ["build"] },
  academics:        { match: /academ|read|writ|math|science|history|research/i, domains: ["brain"] },
  lifeSkills:       { match: /cook|clean|garden|budget|repair|house/i, domains: ["house", "money"] },
  body:             { match: /body|fit|outdoor|sport|exercise|health/i, domains: ["body"] },
  resilience:       { match: /resilien|grit|perseve|brave/i, domains: ["body", "build"] },
  curiosity:        { match: /curios|wonder|explor|investigat|research/i, domains: ["brain"] },
  generosity:       { match: /generos|give|share|donat/i, domains: ["community", "money"] },
  independence:     { match: /independ|self[- ]?direct/i, domains: ["house", "build"] },
};
function inferThemes(text) {
  if (!text) return [];
  const themes = [];
  Object.entries(THEME_DEFS).forEach(([k, def]) => { if (def.match.test(text)) themes.push(k); });
  return themes;
}

function buildConversationTopics(family, completed, challenges, vision) {
  const topics = [];
  if (completed.length >= 2) topics.push(`Celebrate: which finished project from this period do you each want to share first?`);
  if (vision.items?.length) {
    const weak = vision.items.filter(i => i.score != null && i.score < 35).slice(0, 1)[0];
    if (weak) topics.push(`Notice: our actual work doesn't reflect "${weak.outcome}" yet. What would a project that lived it look like?`);
  }
  if (challenges.length) topics.push(`Acknowledge: "${challenges[0].name}" has shown up this period. What support helps?`);
  topics.push(`Plan: what is the one thing each of us wants next month to actually be about?`);
  if (family?.motto) topics.push(`Anchor: re-read our family motto — "${family.motto}". What did we live this month? What did we drift from?`);
  return topics;
}

function buildDiscussionQuestions(children) {
  return [
    "What are you most proud of this month?",
    "What was hard?",
    "What did you learn?",
    "How did you help someone else?",
    "What do you want to focus on next month?",
    ...(children.length > 1 ? ["What is something you noticed your sibling do well?"] : []),
  ];
}

/* ---------- Goal templates for the closing exercise ---------- */
export const GOAL_TEMPLATES = [
  { kind: "family",     label: "Family goal",     placeholder: "One thing the whole family wants to do or be next month." },
  { kind: "individual", label: "Individual goal", placeholder: "Per child — one specific thing they want to grow." },
  { kind: "project",    label: "Project goal",    placeholder: "A new project the family wants to begin or finish." },
  { kind: "service",    label: "Service goal",    placeholder: "How you'll contribute to someone outside the household." },
  { kind: "adventure",  label: "Adventure goal",  placeholder: "Something physical, outdoors, or memorable." },
];

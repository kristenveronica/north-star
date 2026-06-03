/* ============================================================
   growthEngine.js — Growth Report generator.

   Pure functions that read child + project + milestone +
   reflection + observation data and produce structured insights
   in the voice of an experienced mentor/educator.

   Replace each `analyse*` function with an LLM call later — the
   shape of the returned objects is the public contract that the
   Reports view renders.
   ============================================================ */

import { DOMAIN_CATALOG } from "../seed.js";

/* ---------- Growth bands ---------- */
export const GROWTH_BANDS = ["Emerging", "Developing", "Competent", "Strong", "Advanced"];

function bandForDomain(pointsInDomain, completedInDomain) {
  if (pointsInDomain >= 300 || completedInDomain >= 5) return "Advanced";
  if (pointsInDomain >= 150 || completedInDomain >= 3) return "Strong";
  if (pointsInDomain >= 80  || completedInDomain >= 2) return "Competent";
  if (pointsInDomain >= 30  || completedInDomain >= 1) return "Developing";
  return "Emerging";
}

/* ---------- Period helpers ---------- */
export const PERIODS = {
  "30d":   { label: "Last 30 days",   ms: 30 * 86400000 },
  "term":  { label: "This term (≈12 weeks)", ms: 84 * 86400000 },
  "quarter": { label: "Last quarter", ms: 90 * 86400000 },
  "year":  { label: "Last year",      ms: 365 * 86400000 },
  "all":   { label: "All time",       ms: null },
};

function inPeriod(iso, period, now = Date.now()) {
  if (!iso) return false;
  if (!period.ms) return true;
  return now - new Date(iso).getTime() <= period.ms;
}

/* =============================================================
   MAIN ENTRY: generate a full report for a child over a period.
   ============================================================= */
export function generateReport({
  child, family, projects, milestones, reflections,
  observations = [], selfAssessment = null,
  parentNotes = {},   // {strengths, challenges, growthObserved, concerns, goalsNextTerm}
  periodKey = "term",
  previousReport = null,
}) {
  const period = PERIODS[periodKey];
  const childProjects = projects.filter(p => p.childId === child.id);
  const periodProjects = childProjects.filter(p =>
    inPeriod(p.startDate, period) || inPeriod(p.dueDate, period) || p.status === "active"
  );
  const childMilestones = milestones.filter(m =>
    childProjects.some(p => p.id === m.projectId)
  );
  const periodMilestones = childMilestones.filter(m =>
    inPeriod(m.completedAt || m.dueDate, period)
  );
  const childReflections = reflections.filter(r => r.childId === child.id);
  const periodReflections = childReflections.filter(r => inPeriod(r.createdAt, period));

  const ctx = {
    child, family, period, periodKey,
    projects: childProjects, periodProjects,
    milestones: childMilestones, periodMilestones,
    reflections: childReflections, periodReflections,
    observations, selfAssessment, parentNotes,
    previousReport,
  };

  return {
    id: "rep_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36),
    childId: child.id,
    childName: child.name,
    childAge: child.age,
    periodKey,
    periodLabel: period.label,
    generatedAt: new Date().toISOString(),
    snapshot: snapshotData(ctx),
    parentNotes,
    selfAssessment,
    sections: {
      executiveSummary: analyseSummary(ctx),
      strengths: analyseStrengths(ctx),
      developing: analyseDeveloping(ctx),
      growthSinceLast: analyseGrowthDelta(ctx),
      domains: analyseDomains(ctx),
      visionAlignment: analyseVisionAlignment(ctx),
      recommendations: analyseRecommendations(ctx),
      longitudinal: analyseLongitudinal(ctx),
    },
  };
}

/* ---------- Snapshot (used for longitudinal compare) ---------- */
function snapshotData(ctx) {
  const { periodProjects, periodMilestones, periodReflections, child } = ctx;
  const completed = periodProjects.filter(p => p.status === "completed");
  const points = periodProjects.reduce((s, p) => s + (p.momentumPointsEarned || 0), 0);
  const stars = periodProjects.reduce((s, p) => s + (p.starsEarned || 0), 0);
  const onTimeMs = periodMilestones.filter(m => m.completed && m.dueDate && new Date(m.completedAt) <= new Date(m.dueDate));
  const lateMs = periodMilestones.filter(m => m.completed && m.dueDate && new Date(m.completedAt) > new Date(m.dueDate));
  const incompleteMs = periodMilestones.filter(m => !m.completed && m.dueDate && new Date(m.dueDate) < new Date());

  const domainPoints = {};
  const domainCompleted = {};
  ctx.projects.forEach(p => {
    (p.domains || []).forEach(d => {
      domainPoints[d] = (domainPoints[d] || 0) + (p.momentumPointsEarned || 0);
      if (p.status === "completed") domainCompleted[d] = (domainCompleted[d] || 0) + 1;
    });
  });
  const bands = {};
  DOMAIN_CATALOG.forEach(d => {
    bands[d.id] = bandForDomain(domainPoints[d.id] || 0, domainCompleted[d.id] || 0);
  });

  return {
    projectsCompleted: completed.length,
    projectsActive: periodProjects.filter(p => p.status !== "completed").length,
    momentumPoints: points,
    starsEarned: stars,
    milestonesCompleted: periodMilestones.filter(m => m.completed).length,
    milestonesOnTime: onTimeMs.length,
    milestonesLate: lateMs.length,
    milestonesMissed: incompleteMs.length,
    reflectionsWritten: periodReflections.length,
    reflectionAvgWords: periodReflections.length
      ? Math.round(periodReflections.reduce((s, r) => s + r.response.split(/\s+/).length, 0) / periodReflections.length)
      : 0,
    domainPoints, domainCompleted, domainBands: bands,
    childAge: child.age,
    childAgeAtReport: child.age, // snapshotted for longitudinal
  };
}

/* ---------- 1. Executive Summary ---------- */
function analyseSummary(ctx) {
  const { child, periodProjects, periodReflections, periodMilestones } = ctx;
  const completed = periodProjects.filter(p => p.status === "completed").length;
  const active = periodProjects.filter(p => p.status !== "completed").length;
  const milestoneDone = periodMilestones.filter(m => m.completed).length;
  const onTime = periodMilestones.filter(m => m.completed && m.dueDate && new Date(m.completedAt) <= new Date(m.dueDate)).length;
  const late = periodMilestones.filter(m => m.completed && m.dueDate && new Date(m.completedAt) > new Date(m.dueDate)).length;
  const reflDepth = periodReflections.length
    ? Math.round(periodReflections.reduce((s, r) => s + r.response.split(/\s+/).length, 0) / periodReflections.length)
    : 0;

  // Pick top growth domain
  const top = topDomains(ctx).slice(0, 3).map(d => domainShort(d.id).toLowerCase());

  const sentences = [];
  if (completed) {
    sentences.push(`${child.name} completed ${plural(completed, "project")} this period${active ? `, with ${plural(active, "more project")} currently in progress` : ""}.`);
  } else if (active) {
    sentences.push(`${child.name} is currently engaged in ${plural(active, "active project")} but has not yet completed one in this period.`);
  } else {
    sentences.push(`${child.name} has no recorded project activity in this period.`);
  }
  if (top.length) {
    sentences.push(`The strongest activity sits in ${joinNicely(top)}.`);
  }
  if (milestoneDone) {
    const pct = late + onTime > 0 ? Math.round((onTime / (onTime + late)) * 100) : null;
    if (pct != null) {
      sentences.push(`Of ${plural(milestoneDone, "completed milestone")}, ${pct}% were finished on time.`);
    }
  }
  if (reflDepth >= 40) {
    sentences.push(`Reflections were substantial (averaging ${reflDepth} words), suggesting growing self-awareness and a willingness to think honestly about the work.`);
  } else if (reflDepth >= 15 && periodReflections.length) {
    sentences.push(`Reflections were short but consistent — depth is an area to encourage.`);
  } else if (!periodReflections.length) {
    sentences.push(`No reflections were recorded this period — building a regular reflection habit is a clear next step.`);
  }

  return { paragraphs: [sentences.join(" ")] };
}

/* ---------- 2. Key Strengths ---------- */
function analyseStrengths(ctx) {
  const strengths = [];
  const { child, projects, periodProjects, periodReflections } = ctx;

  const top = topDomains(ctx).slice(0, 3);
  top.forEach(({ id, points, completed }) => {
    const dom = DOMAIN_CATALOG.find(d => d.id === id);
    if (!dom) return;
    const projectsInDomain = projects.filter(p => (p.domains || []).includes(id));
    const evidence = projectsInDomain.slice(0, 3).map(p => p.title);
    strengths.push({
      title: strengthTitle(id, child),
      description: strengthDescription(id, child, points, completed),
      evidence,
    });
  });

  // Reflection-based strengths
  const refTotal = periodReflections.length;
  const refWords = periodReflections.reduce((s, r) => s + r.response.split(/\s+/).length, 0);
  if (refTotal >= 3 && refWords / refTotal >= 30) {
    strengths.push({
      title: "Self-Awareness Through Reflection",
      description: `${child.name} reflects honestly and at length on their work — a foundational habit for lifelong learning. Reflections show growing capacity to notice what worked, what didn't, and what they would change.`,
      evidence: periodReflections.slice(0, 3).map(r => r.prompt + ` — "${(r.response || "").slice(0, 60)}${r.response.length > 60 ? "…" : ""}"`),
    });
  }

  // On-time follow through
  const ms = ctx.periodMilestones.filter(m => m.completed && m.dueDate);
  const onTime = ms.filter(m => new Date(m.completedAt) <= new Date(m.dueDate));
  if (ms.length >= 3 && onTime.length / ms.length >= 0.75) {
    strengths.push({
      title: "Follow-Through and Discipline",
      description: `${child.name} consistently delivered milestones on or near their due date this period. That is a real and rare skill at this age and worth naming.`,
      evidence: [`${onTime.length} of ${ms.length} completed milestones delivered on time`],
    });
  }

  if (strengths.length === 0) {
    strengths.push({
      title: "Strengths Forming",
      description: `It's early — too early to confidently name strengths from data alone. Add a few parent observations during the next term and we'll be able to surface them with more confidence.`,
      evidence: [],
    });
  }

  return strengths;
}

/* ---------- 3. Areas Currently Developing ---------- */
function analyseDeveloping(ctx) {
  const items = [];
  const { child, periodMilestones, periodReflections, projects } = ctx;

  // Time management
  const ms = periodMilestones.filter(m => m.completed && m.dueDate);
  const late = ms.filter(m => new Date(m.completedAt) > new Date(m.dueDate));
  const missed = periodMilestones.filter(m => !m.completed && m.dueDate && new Date(m.dueDate) < new Date());
  if (late.length >= 2 || missed.length >= 2) {
    items.push({
      title: "Time Management",
      explanation: `${child.name} occasionally missed milestone due dates on longer projects.`,
      evidence: [
        `${late.length} milestone${late.length === 1 ? "" : "s"} completed after the due date`,
        ...(missed.length ? [`${missed.length} milestone${missed.length === 1 ? "" : "s"} still outstanding past due`] : []),
      ],
      whyItMatters: "Planning and pacing on multi-week projects is a learnable skill that compounds. Most adults are still building it.",
      encouragement: `With additional project-planning experience — short cycles, visible deadlines — this area is likely to strengthen significantly.`,
    });
  }

  // Reflection depth
  const refTotal = periodReflections.length;
  const avgWords = refTotal ? Math.round(periodReflections.reduce((s, r) => s + r.response.split(/\s+/).length, 0) / refTotal) : 0;
  if (refTotal && avgWords < 20) {
    items.push({
      title: "Depth of Reflection",
      explanation: `${child.name} is reflecting, but responses are still quite short.`,
      evidence: [`Average reflection length this period: ${avgWords} words`],
      whyItMatters: "Reflection is where learning becomes wisdom. Longer, more honest reflection is the bridge between completing work and changing how you work.",
      encouragement: `Try a single open-ended question after each major milestone — "What surprised you?" usually unlocks more than rating-scale prompts.`,
    });
  }

  // Narrow domain spread
  const domainsTouched = new Set();
  projects.forEach(p => (p.domains || []).forEach(d => domainsTouched.add(d)));
  if (domainsTouched.size <= 2) {
    items.push({
      title: "Breadth Across Domains",
      explanation: `${child.name}'s work has clustered in a small number of domains so far.`,
      evidence: [`Active across ${domainsTouched.size} domain${domainsTouched.size === 1 ? "" : "s"} this period`],
      whyItMatters: "Specialisation is great. But early breadth — across body, community, house, brain — protects against gaps that show up later.",
      encouragement: `Pick one project next term in a domain you haven't visited recently. It only takes one good project to open a door.`,
    });
  }

  // Stalled projects
  const stalled = projects.filter(p => p.status === "active" && p.startDate && Date.now() - new Date(p.startDate).getTime() > 60 * 86400000 && (p.momentumPointsEarned || 0) < (p.momentumPointsAvailable || 0) * 0.4);
  if (stalled.length) {
    items.push({
      title: "Finishing What Was Started",
      explanation: `Some projects have been active for a long time with limited progress.`,
      evidence: stalled.slice(0, 3).map(p => `${p.title} — started ${Math.round((Date.now() - new Date(p.startDate).getTime()) / 86400000)} days ago, ${p.momentumPointsEarned}/${p.momentumPointsAvailable} pts earned`),
      whyItMatters: "Finishing builds identity. A child who finishes ten medium things tends to be more capable than one who half-builds a hundred ambitious ones.",
      encouragement: `Consider closing or simplifying one stalled project before adding new ones. A clean slate is permission to begin.`,
    });
  }

  // Parent-supplied challenges always make it in
  if (ctx.parentNotes?.challenges) {
    items.push({
      title: "Noticed by You",
      explanation: ctx.parentNotes.challenges,
      evidence: ["Parent observation, recorded with this report"],
      whyItMatters: "Your daily observations carry more signal than any of this data. They belong in the report.",
      encouragement: `Pick one specific micro-habit to address this in the coming term — small and visible beats vague.`,
    });
  }

  if (items.length === 0) {
    items.push({
      title: "Nothing Pressing — Keep Going",
      explanation: `Across the metrics this engine looks at, no clear developmental concerns are surfacing.`,
      evidence: [],
      whyItMatters: "That's good news. The next term is a chance to deepen — pick one strength and stretch it, rather than fix anything.",
      encouragement: ``,
    });
  }
  return items;
}

/* ---------- 4. Growth Since Last Report ---------- */
function analyseGrowthDelta(ctx) {
  const prev = ctx.previousReport;
  if (!prev) {
    return {
      hasPrevious: false,
      note: "This is the first growth report on record. Future reports will compare against this one to show real movement over time.",
    };
  }
  const a = prev.snapshot || {};
  const b = snapshotData(ctx);

  const deltas = [
    delta("Momentum Points",    a.momentumPoints,        b.momentumPoints),
    delta("Stars earned",       a.starsEarned,           b.starsEarned),
    delta("Milestones done",    a.milestonesCompleted,   b.milestonesCompleted),
    delta("On-time delivery",   a.milestonesOnTime,      b.milestonesOnTime),
    delta("Reflections written", a.reflectionsWritten,   b.reflectionsWritten),
    delta("Reflection depth (words)", a.reflectionAvgWords, b.reflectionAvgWords),
    delta("Projects completed", a.projectsCompleted,     b.projectsCompleted),
  ];

  // Band moves
  const bandMoves = [];
  DOMAIN_CATALOG.forEach(d => {
    const before = a.domainBands?.[d.id] || "Emerging";
    const after = b.domainBands?.[d.id] || "Emerging";
    const bi = GROWTH_BANDS.indexOf(before);
    const ai = GROWTH_BANDS.indexOf(after);
    if (ai !== bi) bandMoves.push({ domain: d.id, label: d.short, from: before, to: after, direction: ai > bi ? "up" : "down" });
  });

  return {
    hasPrevious: true,
    previousAt: prev.generatedAt,
    deltas,
    bandMoves,
  };
}
function delta(label, before, after) {
  const b = before || 0; const a = after || 0;
  const diff = a - b;
  return {
    label, before: b, after: a, diff,
    direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
    summary: diff === 0 ? "No change" : (diff > 0 ? `+${diff}` : `${diff}`),
  };
}

/* ---------- 5. Domain Breakdown ---------- */
function analyseDomains(ctx) {
  const { family, child } = ctx;
  const faith = family?.faithEnabled || child?.faithEnabled;
  return DOMAIN_CATALOG
    .filter(d => !d.optional || faith)
    .map(d => {
      const projectsInDomain = ctx.projects.filter(p => (p.domains || []).includes(d.id));
      const completed = projectsInDomain.filter(p => p.status === "completed");
      const points = projectsInDomain.reduce((s, p) => s + (p.momentumPointsEarned || 0), 0);
      const band = bandForDomain(points, completed.length);
      const participation =
        projectsInDomain.length === 0 ? "Not yet engaged" :
        projectsInDomain.length === 1 ? "Light engagement" :
        projectsInDomain.length <= 3 ? "Moderate engagement" :
        "Strong engagement";
      const growth = growthBlurb(d.id, points, completed.length, child);
      const futureOpps = futureOpportunitiesFor(d.id);
      const evidence = projectsInDomain.slice(0, 3).map(p => p.title);

      return {
        id: d.id, name: d.name, short: d.short, color: d.color,
        participation, band, points, projects: projectsInDomain.length,
        completed: completed.length,
        growth, futureOpps, evidence,
      };
    });
}

/* ---------- 6. Family Vision Alignment ---------- */
const VISION_KEYWORDS = {
  entrepreneurship: { match: /entrepre|business|sell|pitch|profit|product|market/i, domains: ["money", "build"] },
  communication:    { match: /communic|present|speak|writ|story|articulat|interview|podcast/i, domains: ["brain", "community"] },
  leadership:       { match: /leader|lead\b|organis|run\s|team/i, domains: ["community", "build"] },
  faith:            { match: /faith|gospel|bible|prayer|spiritual|church/i, domains: ["faith"] },
  service:          { match: /serv|volunteer|neighbour|help\s|community\b|give/i, domains: ["community"] },
  creativity:       { match: /creat|art|design|media|build|invent|story/i, domains: ["build"] },
  academics:        { match: /academ|read|writ|math|science|history|research/i, domains: ["brain"] },
  lifeSkills:       { match: /cook|clean|laundry|garden|budget|repair|house/i, domains: ["house", "money"] },
  body:             { match: /body|fit|outdoor|sport|exercise|health|hike/i, domains: ["body"] },
  resilience:       { match: /resilien|grit|persever|hard\s+thing|brave|courage/i, domains: ["body", "build"] },
  curiosity:        { match: /curios|wonder|explor|investigat|research|ask/i, domains: ["brain"] },
  generosity:       { match: /generos|give|share|donat/i, domains: ["community", "money"] },
  independence:     { match: /independ|self[- ]?direct|own|alone/i, domains: ["house", "build"] },
  craftsmanship:    { match: /craft|quality|finish|attention|excellen/i, domains: ["build"] },
  brave:            { match: /brave|courage|risk|bold/i, domains: ["build", "body"] },
  useful:           { match: /useful|practical|real|contribut|help/i, domains: ["house", "community"] },
};

function inferThemes(text) {
  if (!text) return [];
  const themes = [];
  Object.entries(VISION_KEYWORDS).forEach(([key, def]) => {
    if (def.match.test(text)) themes.push(key);
  });
  return themes;
}

function analyseVisionAlignment(ctx) {
  const { family, child, projects } = ctx;
  const outcomes = family?.desiredOutcomes || [];
  // Also pull from acronym meanings and "values" in vision
  const extraOutcomes = [];
  (family?.acronym || []).forEach(a => a.meaning && extraOutcomes.push(a.meaning));
  if (family?.vision?.values) extraOutcomes.push(family.vision.values);

  const items = [];
  const allOutcomes = [...outcomes, ...extraOutcomes];

  allOutcomes.forEach(text => {
    const themes = inferThemes(text);
    if (!themes.length) {
      items.push({ outcome: text, themes: [], score: null, note: "Couldn't automatically detect themes for this outcome — add a project that names what 'living it' looks like." });
      return;
    }
    const relevantDomains = new Set(themes.flatMap(t => VISION_KEYWORDS[t].domains));
    const relevantProjects = projects.filter(p =>
      (p.domains || []).some(d => relevantDomains.has(d)) ||
      themes.some(t => VISION_KEYWORDS[t].match.test([p.title, p.description, (p.learningOutcomes || []).join(" ")].join(" ")))
    );
    const points = relevantProjects.reduce((s, p) => s + (p.momentumPointsEarned || 0), 0);
    const completed = relevantProjects.filter(p => p.status === "completed").length;
    // Score: up to ~150 pts maps to 100%
    const score = Math.min(100, Math.round((points / 150) * 100 + completed * 5));
    items.push({
      outcome: text,
      themes,
      score,
      relevantProjects: relevantProjects.slice(0, 3).map(p => p.title),
      note: score >= 70
        ? "Strongly represented in this child's actual work."
        : score >= 35
          ? "Present in the work, but not yet a central thread."
          : "Barely surfacing in projects yet — worth designing a project around.",
    });
  });

  // Roll-up: average across detected outcomes
  const scored = items.filter(i => i.score != null);
  const overall = scored.length ? Math.round(scored.reduce((s, i) => s + i.score, 0) / scored.length) : null;

  return {
    overall,
    items,
    note: outcomes.length === 0
      ? "Add desired outcomes in Family Vision to make this section richer."
      : "These percentages are heuristic — they reflect how strongly your projects mirror each desired outcome, not how the child is performing.",
  };
}

/* ---------- 7. Recommendations ---------- */
function analyseRecommendations(ctx) {
  const { child } = ctx;
  const developing = analyseDeveloping(ctx);
  const recs = [];

  developing.forEach(area => {
    const r = recommendationFor(area.title, child);
    if (r) recs.push({ focus: area.title, reason: area.explanation, ...r });
  });

  // Always nudge toward Family Vision alignment if low
  const vision = analyseVisionAlignment(ctx);
  vision.items.filter(i => i.score != null && i.score < 35).slice(0, 2).forEach(i => {
    recs.push({
      focus: `Strengthen "${i.outcome}"`,
      reason: i.note,
      activities: visionActivitiesFor(i.themes, child),
      type: "vision",
    });
  });

  // De-dupe by focus
  const seen = new Set();
  return recs.filter(r => { if (seen.has(r.focus)) return false; seen.add(r.focus); return true; });
}

function recommendationFor(areaTitle, child) {
  switch (areaTitle) {
    case "Time Management":
      return {
        activities: [
          { name: "Event Planning Project", note: "A 2-week project with a real date forces real planning." },
          { name: "Run a Small Business Project", note: "Pricing + supply + delivery teaches pacing under stakes." },
          { name: "Weekly Planning Habit", note: "Sunday-night 15 min: pick 3 missions for the week." },
          { name: "Project Management Challenge", note: "Run their own Kanban — todo / doing / done — for one project." },
        ],
        type: "habit-focus",
      };
    case "Depth of Reflection":
      return {
        activities: [
          { name: "One-Question Reflection Habit", note: `Daily: ask "What surprised you today?" Write the answer, even if it's a sentence.` },
          { name: "Voice-note reflections", note: "Easier than typing at this age. Record + transcribe." },
        ],
        type: "habit-focus",
      };
    case "Breadth Across Domains":
      return {
        activities: [
          { name: "Community Gig project", note: "Interview a neighbour, run a small service mission." },
          { name: "House Gig project", note: "Cook 5 family meals; manage a real grocery budget." },
          { name: "Body Gig project", note: "21-day outdoor habit; document one." },
        ],
        type: "domain-stretch",
      };
    case "Finishing What Was Started":
      return {
        activities: [
          { name: "Finish-First Sprint", note: "No new projects for 2 weeks. Pick one open project; close it." },
          { name: "Honourable Close", note: "Some projects deserve to be honourably closed without finishing. Write a reflection on why and move on." },
        ],
        type: "habit-focus",
      };
    case "Noticed by You":
      return {
        activities: [
          { name: "Create a micro-habit for it", note: "Pick a 2-minute daily action that names the thing you noticed." },
          { name: "Open a tiny project around it", note: "Smallest possible scope. One milestone, one reflection." },
        ],
        type: "parent-led",
      };
    default:
      return null;
  }
}

function visionActivitiesFor(themes, child) {
  const acts = [];
  themes.slice(0, 2).forEach(t => {
    switch (t) {
      case "entrepreneurship": acts.push({ name: "Mini-business project", note: `Tied to ${child.passions?.[0] || "something they love"}.` }); break;
      case "communication":    acts.push({ name: "Present-to-family project", note: "Any project that ends with a 3-minute talk." }); break;
      case "leadership":       acts.push({ name: "Lead a family event", note: "Plan and run a real event for 5+ people." }); break;
      case "service":          acts.push({ name: "Service mission", note: "One act of service per week, named and reflected on." }); break;
      case "faith":            acts.push({ name: "Scripture / character project", note: "Project tied to a passage or character formation goal." }); break;
      case "lifeSkills":       acts.push({ name: "Cook-five-meals project", note: "Plan, shop, cook, serve." }); break;
      case "academics":        acts.push({ name: "Research-and-present project", note: "A single deep-dive topic, ending in a written or video output." }); break;
      case "creativity":       acts.push({ name: "Make-something-real project", note: "Physical object or finished media artifact." }); break;
      case "body":             acts.push({ name: "Outdoor adventure challenge", note: "Daily movement habit for 21 days." }); break;
      default:                  acts.push({ name: `Project around "${t}"`, note: "Tie it to a real audience or deadline." });
    }
  });
  return acts;
}

/* ---------- 9. Longitudinal Growth ---------- */
function analyseLongitudinal(ctx) {
  // Group all reports for this child by domain.
  const reports = (ctx.previousReport ? [ctx.previousReport] : []);
  const childAllReports = ctx._allReports || reports;
  const timeline = {};
  DOMAIN_CATALOG.forEach(d => {
    timeline[d.id] = [];
  });

  childAllReports.forEach(r => {
    const age = r.snapshot?.childAge ?? r.childAge;
    Object.entries(r.snapshot?.domainBands || {}).forEach(([dId, band]) => {
      if (!timeline[dId]) return;
      timeline[dId].push({ age, generatedAt: r.generatedAt, band });
    });
  });

  // Add the current snapshot too
  const current = snapshotData(ctx);
  Object.entries(current.domainBands).forEach(([dId, band]) => {
    if (!timeline[dId]) return;
    timeline[dId].push({ age: ctx.child.age, generatedAt: new Date().toISOString(), band });
  });

  return {
    bands: GROWTH_BANDS,
    timeline,
  };
}

/* ---------- helpers ---------- */
function topDomains(ctx) {
  const points = {};
  const completed = {};
  ctx.projects.forEach(p => {
    (p.domains || []).forEach(d => {
      points[d] = (points[d] || 0) + (p.momentumPointsEarned || 0);
      if (p.status === "completed") completed[d] = (completed[d] || 0) + 1;
    });
  });
  return Object.keys(points)
    .map(id => ({ id, points: points[id], completed: completed[id] || 0 }))
    .filter(x => x.points > 0)
    .sort((a, b) => b.points - a.points);
}

function strengthTitle(domainId, child) {
  const map = {
    brain: "Curiosity & Intellectual Engagement",
    build: "Builder's Mindset",
    money: "Entrepreneurial Thinking",
    house: "Practical Life Capability",
    community: "Service & Contribution",
    body: "Physical Discipline",
    faith: "Spiritual Formation",
  };
  return map[domainId] || "Emerging Strength";
}
function strengthDescription(domainId, child, points, completed) {
  const examples = {
    brain: `${child.name} engages meaningfully with academic and intellectual work — research, reading, problem-solving — not just as compliance but with visible interest.`,
    build: `${child.name} approaches projects with a maker's instinct: prototype, try, iterate. Building things is becoming an identity, not just an activity.`,
    money: `${child.name} demonstrates entrepreneurial thinking — identifying opportunities, conducting research, calculating costs, and presenting solutions through real project work.`,
    house: `${child.name} is taking ownership of real life skills at home. This is unusually rare at their age and worth naming explicitly.`,
    community: `${child.name} shows genuine care for people outside the household — service, attention, contribution. This is character, not just a skill.`,
    body: `${child.name} engages physically and outdoors with consistency. Their relationship with their own body and capability is healthy and growing.`,
    faith: `${child.name} is genuinely engaging with faith formation — not just attending but reflecting and applying.`,
  };
  return examples[domainId] || `Strong engagement in ${domainId}.`;
}

function domainShort(id) { return DOMAIN_CATALOG.find(d => d.id === id)?.short || id; }
function plural(n, w) { return `${n} ${w}${n === 1 ? "" : "s"}`; }
function joinNicely(arr) {
  if (arr.length === 0) return "";
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return arr.join(" and ");
  return arr.slice(0, -1).join(", ") + " and " + arr.slice(-1);
}

function growthBlurb(id, points, completed, child) {
  if (points === 0) return `No active work in this domain this period.`;
  if (points < 30) return `${child.name} is just dipping in here.`;
  if (points < 80) return `Real engagement is forming — the next term is the chance to deepen it.`;
  if (points < 150) return `${child.name} is confidently active in this area.`;
  if (points < 300) return `A core area of ${child.name}'s identity is forming here.`;
  return `${child.name} is already operating with real depth in this domain.`;
}
function futureOpportunitiesFor(id) {
  const map = {
    brain: ["Pick one deep research topic", "Add a writing or presentation component"],
    build: ["Ship a finished, usable artifact", "Document the build with photos/video"],
    money: ["Run a real micro-business with paying customers", "Track the maths every week"],
    house: ["Take ownership of one weekly meal", "Manage a real weekly budget"],
    community: ["Lead a small group", "Interview an elder and share what was learned"],
    body: ["21-day outdoor challenge", "Train for one specific physical goal"],
    faith: ["Memorise a longer passage", "Lead a family devotion"],
  };
  return map[id] || ["Pick one stretch challenge"];
}

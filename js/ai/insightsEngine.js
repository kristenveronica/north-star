/* ============================================================
   insightsEngine.js — Child Insights & Developmental Intelligence
   (Layer 14B)

   Pure functions only. Each `derive*` analyses behaviour data
   and surfaces observations, never labels.

   Replace with LLM calls later. The output shape is the contract
   that the Insights view + Insights Report render against.

   CORE PHILOSOPHY (carried in copy throughout):
   "Children are dynamic, evolving human beings. These insights
    are observations and developmental patterns, not fixed
    identities."
   ============================================================ */

import { DOMAIN_CATALOG } from "../seed.js";

/* ---------- The disclaimer (used in many places) ---------- */
export const INSIGHTS_DISCLAIMER =
  "Children are dynamic, evolving human beings. These insights are observations and developmental patterns — not fixed identities, not diagnoses, and not predictions.";

/* ---------- Personality Lenses (platform-owned) ---------- */
export const ACTION_STYLES = [
  { id: "initiator",   name: "Initiator",   blurb: "Starts things. Loves the spark, the first move, the empty page." },
  { id: "builder",     name: "Builder",     blurb: "Loves making. Comfortable in the middle of the build, sleeves rolled up." },
  { id: "organiser",   name: "Organiser",   blurb: "Brings order, sequence, structure. Knows what comes next." },
  { id: "refiner",     name: "Refiner",     blurb: "Polishes, perfects, finishes. Notices what others miss." },
];
export const ENERGY_STYLES = [
  { id: "explorer",    name: "Explorer",    blurb: "Energised by novelty and following curiosity wherever it leads." },
  { id: "creator",     name: "Creator",     blurb: "Energised by making something that wasn't there before." },
  { id: "connector",   name: "Connector",   blurb: "Energised by people, conversation, and being useful to others." },
  { id: "strategist",  name: "Strategist",  blurb: "Energised by patterns, plans, and figuring things out." },
];
export const PROBLEM_STYLES = [
  { id: "inventor",      name: "Inventor",      blurb: "Tends to solve by making something new." },
  { id: "investigator",  name: "Investigator",  blurb: "Tends to solve by asking and researching first." },
  { id: "implementer",   name: "Implementer",   blurb: "Tends to solve by doing — try, observe, adjust." },
  { id: "optimiser",     name: "Optimiser",     blurb: "Tends to solve by refining what already works." },
];

/* ============================================================
   ENTRY POINT
   ============================================================ */
export function deriveInsights({ child, family, projects, milestones, reflections, observations = [], selfAssessments = [], config = {} }) {
  const childProjects = projects.filter(p => p.childId === child.id);
  const projectIds = new Set(childProjects.map(p => p.id));
  const childMilestones = milestones.filter(m => projectIds.has(m.projectId));
  const childReflections = reflections.filter(r => r.childId === child.id);

  const ctx = { child, family, projects: childProjects, milestones: childMilestones, reflections: childReflections, observations, selfAssessments, config };

  return {
    disclaimer: INSIGHTS_DISCLAIMER,
    generatedAt: new Date().toISOString(),
    childId: child.id, childName: child.name, childAge: child.age,
    sections: {
      developmentalPatterns: deriveDevelopmentalPatterns(ctx),
      learningPreferences: deriveLearningPreferences(ctx),
      motivationalDrivers: deriveMotivationalDrivers(ctx),
      emergingStrengths: deriveEmergingStrengths(ctx),
      emergingChallenges: deriveEmergingChallenges(ctx),
      personalityLenses: derivePersonalityLenses(ctx),
      parentObservations: deriveParentObservations(ctx),
      aiObservations: deriveAIObservations(ctx),
      growthOverTime: deriveGrowthOverTime(ctx),
      interpretive: deriveInterpretive(ctx),
    },
  };
}

/* ============================================================
   1. Developmental Patterns
   ============================================================ */
function deriveDevelopmentalPatterns(ctx) {
  const out = [];
  const { projects, milestones, reflections, child } = ctx;
  const points = projects.reduce((s, p) => s + (p.momentumPointsEarned || 0), 0);

  const completedRatio = projects.length ? projects.filter(p => p.status === "completed").length / projects.length : 0;
  if (completedRatio >= 0.6) out.push({ pattern: "Strong follow-through", evidence: [`${Math.round(completedRatio * 100)}% of started projects reach completion`], confidence: "moderate" });
  else if (completedRatio <= 0.25 && projects.length >= 3) out.push({ pattern: "Tends to start more than finishes", evidence: [`${Math.round(completedRatio * 100)}% completion rate across ${projects.length} projects`], confidence: "moderate" });

  const lateMs = milestones.filter(m => m.completed && m.dueDate && new Date(m.completedAt) > new Date(m.dueDate));
  if (milestones.length >= 4 && lateMs.length / milestones.length > 0.5)
    out.push({ pattern: "Time-blindness on longer projects", evidence: [`${lateMs.length} of ${milestones.length} milestones completed past the due date`], confidence: "moderate" });

  if (reflections.length >= 3) {
    const avgWords = reflections.reduce((s, r) => s + r.response.split(/\s+/).length, 0) / reflections.length;
    if (avgWords >= 40) out.push({ pattern: "Reflective and self-aware", evidence: [`Average reflection length ${Math.round(avgWords)} words across ${reflections.length} reflections`], confidence: "strong" });
    else if (avgWords < 15) out.push({ pattern: "Action-leaning; reflection is brief", evidence: [`Average reflection length ${Math.round(avgWords)} words`], confidence: "moderate" });
  }

  if (points >= 200) out.push({ pattern: "Sustained engagement over time", evidence: [`${points} Momentum Points earned across active work`], confidence: "moderate" });
  if (projects.length === 0) out.push({ pattern: "Patterns are still emerging — add a few projects to surface real signal", evidence: [], confidence: "low" });

  return out;
}

/* ============================================================
   2. Learning Preferences  (observation, never label)
   ============================================================ */
function deriveLearningPreferences(ctx) {
  const { projects } = ctx;
  const observed = {};
  const note = (key, weight) => { observed[key] = (observed[key] || 0) + weight; };

  projects.forEach(p => {
    const text = `${p.title} ${p.description} ${(p.learningOutcomes || []).join(" ")}`.toLowerCase();
    if (/(build|make|prototype|cook|garden|feeder|model)/.test(text)) note("hands-on", 2);
    if (/(draw|visual|poster|sketch|design|film|video|photo)/.test(text)) note("visual", 2);
    if (/(present|discuss|interview|conversation|read aloud)/.test(text)) note("discussion-based", 2);
    if (/(read|book|research|study|encyclopedia)/.test(text)) note("reading-based", 2);
    if (/(outdoor|run|ski|hike|bike|sport|move)/.test(text)) note("movement-based", 2);
    if (/(own|choose|pick|decide)/.test(text)) note("self-directed", 1);
    if (/(family|team|partner|together|with)/.test(text)) note("collaborative", 1);
    if ((p.domains || []).includes("build") || (p.domains || []).includes("money")) note("project-based", 2);
  });

  if (Object.keys(observed).length === 0) return [];
  const max = Math.max(...Object.values(observed));
  return Object.entries(observed)
    .map(([key, score]) => ({ preference: key, signal: Math.round((score / max) * 100), evidence: `Observed across ${projects.length} project${projects.length === 1 ? "" : "s"}.` }))
    .sort((a, b) => b.signal - a.signal)
    .slice(0, 6);
}

/* ============================================================
   3. Motivational Drivers
   ============================================================ */
function deriveMotivationalDrivers(ctx) {
  const { projects, reflections, child } = ctx;
  const score = {};
  const bump = (k, n) => { score[k] = (score[k] || 0) + n; };

  projects.forEach(p => {
    const txt = `${p.title} ${p.description} ${p.reward || ""} ${p.passionConnection || ""}`.toLowerCase();
    if (/(own|self|choose|alone|by myself)/.test(txt)) bump("autonomy", 2);
    if (/(master|level up|practice|skill|better)/.test(txt)) bump("mastery", 2);
    if (/(help|serve|community|neighbour|donat|share)/.test(txt)) bump("contribution", 2);
    if (/(present|show|share|publish|perform)/.test(txt)) bump("recognition", 1);
    if (/(business|sell|earn|profit|customer|race|compet)/.test(txt)) bump("competition", 2);
    if (/(adventure|outdoor|explore|new)/.test(txt)) bump("adventure", 2);
    if (/(create|invent|design|build|make|art|story)/.test(txt)) bump("creativity", 2);
    if (/(lead|organis|run|plan)/.test(txt)) bump("leadership", 1);
    if (/(friend|family|together|team|with)/.test(txt)) bump("social connection", 1);
    if (p.status === "completed") bump("mastery", 1);
  });
  reflections.forEach(r => {
    const txt = (r.response || "").toLowerCase();
    if (/i did it (myself|on my own)|by myself/.test(txt)) bump("autonomy", 2);
    if (/proud/.test(txt)) bump("mastery", 1);
    if (/help|gave|shared/.test(txt)) bump("contribution", 1);
    if (/show|family|present/.test(txt)) bump("recognition", 1);
  });

  // child.passions as a soft signal
  (child.passions || []).forEach(p => {
    const pl = p.toLowerCase();
    if (/business|money/.test(pl)) bump("competition", 1);
    if (/animal|nature|story/.test(pl)) bump("creativity", 1);
    if (/ski|race|formula|bike|scoot/.test(pl)) bump("adventure", 2);
    if (/build|invent|ai|design/.test(pl)) bump("creativity", 1);
    if (/ancient|history|book/.test(pl)) bump("mastery", 1);
  });

  if (!Object.keys(score).length) return [];
  const max = Math.max(...Object.values(score));
  return Object.entries(score)
    .map(([k, v]) => ({ driver: k, signal: Math.round((v / max) * 100) }))
    .sort((a, b) => b.signal - a.signal)
    .slice(0, 6);
}

/* ============================================================
   4. Emerging Strengths
   ============================================================ */
function deriveEmergingStrengths(ctx) {
  const STRENGTH_LIBRARY = {
    creativity:        { match: /(art|design|build|invent|story|create|make)/i, label: "Creativity" },
    persistence:       { match: /(finish|kept|tried again|hard|practiced)/i, label: "Persistence" },
    leadership:        { match: /(led|organis|in charge|run|present)/i, label: "Leadership" },
    storytelling:      { match: /(story|told|wrote|narrate|present|stage|film)/i, label: "Storytelling" },
    entrepreneurship:  { match: /(business|sell|price|customer|market|pitch|product)/i, label: "Entrepreneurship" },
    empathy:           { match: /(care|kind|help|listen|notice|share|gave)/i, label: "Empathy" },
    problemSolving:    { match: /(figure|solve|fix|debug|work out|design)/i, label: "Problem Solving" },
    communication:     { match: /(present|speak|writ|interview|share|explain|articulat)/i, label: "Communication" },
    curiosity:         { match: /(why|research|study|wonder|explor|ask)/i, label: "Curiosity" },
    initiative:        { match: /(started|decided|chose|asked|came up|pitched)/i, label: "Initiative" },
  };

  const scoreText = (text) => {
    const out = {};
    for (const [k, def] of Object.entries(STRENGTH_LIBRARY)) {
      const matches = (text.match(new RegExp(def.match, "gi")) || []).length;
      if (matches) out[k] = matches;
    }
    return out;
  };

  const allText = [
    ...ctx.projects.flatMap(p => [p.title, p.description, (p.learningOutcomes || []).join(" "), p.passionConnection || ""]),
    ...ctx.reflections.map(r => r.response),
    ...ctx.observations.map(o => `${o.strengths} ${o.growthObserved}`),
    ...ctx.selfAssessments.flatMap(a => [a.proudOf, a.favouriteProject, a.wantToLearnNext]),
    (ctx.child.passions || []).join(" "),
  ].join("\n").toLowerCase();

  const scored = scoreText(allText);
  const max = Math.max(0, ...Object.values(scored));
  if (!max) return [];

  return Object.entries(scored)
    .map(([k, v]) => {
      const evidence = collectEvidenceFor(STRENGTH_LIBRARY[k].match, ctx).slice(0, 3);
      const signal = Math.round((v / max) * 100);
      return {
        strength: STRENGTH_LIBRARY[k].label,
        signal,
        confidence: signal >= 70 ? "strong" : signal >= 40 ? "moderate" : "emerging",
        evidence,
      };
    })
    .sort((a, b) => b.signal - a.signal)
    .slice(0, 6);
}

function collectEvidenceFor(rx, ctx) {
  const out = [];
  ctx.projects.forEach(p => {
    if (rx.test(`${p.title} ${p.description}`)) out.push(`Project: ${p.title}`);
  });
  ctx.reflections.forEach(r => {
    if (rx.test(r.response)) {
      const snippet = (r.response || "").slice(0, 80);
      out.push(`Reflection: "${snippet}${r.response.length > 80 ? "…" : ""}"`);
    }
  });
  ctx.observations.forEach(o => {
    if (rx.test(`${o.strengths || ""} ${o.growthObserved || ""}`)) {
      out.push(`Parent observation: ${(o.strengths || o.growthObserved || "").slice(0, 80)}`);
    }
  });
  return out;
}

/* ============================================================
   5. Emerging Challenges
   ============================================================ */
function deriveEmergingChallenges(ctx) {
  const out = [];
  const { milestones, projects, reflections, observations, child } = ctx;
  const late = milestones.filter(m => m.completed && m.dueDate && new Date(m.completedAt) > new Date(m.dueDate));
  const missed = milestones.filter(m => !m.completed && m.dueDate && new Date(m.dueDate) < new Date());
  if (late.length + missed.length >= 2) {
    out.push({ challenge: "Pacing on longer work", evidence: [`${late.length} milestones late, ${missed.length} still outstanding`], framing: "developmental" });
  }
  const refTotal = reflections.length;
  const avgWords = refTotal ? reflections.reduce((s, r) => s + r.response.split(/\s+/).length, 0) / refTotal : 0;
  if (refTotal >= 2 && avgWords < 15) {
    out.push({ challenge: "Going deeper in written reflection", evidence: [`Average ${Math.round(avgWords)} words per reflection`], framing: "developmental" });
  }
  const domains = new Set(projects.flatMap(p => p.domains || []));
  if (domains.size <= 2 && projects.length >= 3) {
    out.push({ challenge: "Breadth across domains", evidence: [`Active across ${domains.size} domain${domains.size === 1 ? "" : "s"}`], framing: "developmental" });
  }
  observations.forEach(o => {
    if (o.challenges) out.push({ challenge: "Noticed by parent", evidence: [o.challenges], framing: "parent" });
    if (o.concerns) out.push({ challenge: "Quiet concern carried by parent", evidence: [o.concerns], framing: "parent" });
  });
  return out;
}

/* ============================================================
   6. Personality Lenses (platform-owned)
   ============================================================ */
function derivePersonalityLenses(ctx) {
  const text = ctx.projects.map(p => `${p.title} ${p.description}`).join(" ").toLowerCase();
  const refText = ctx.reflections.map(r => r.response).join(" ").toLowerCase();
  const all = text + " " + refText;

  // Heuristic mapping
  const action = {
    initiator: /(start|launch|kicked off|first time|came up with|pitched)/.test(all) ? 2 : 0,
    builder:   /(build|made|prototype|construct|assemble)/.test(all) ? 2 : 0,
    organiser: /(plan|schedule|organis|list|sort)/.test(all) ? 2 : 0,
    refiner:   /(polish|refine|improve|fix|edit|version)/.test(all) ? 2 : 0,
  };
  const energy = {
    explorer:   /(explor|new|adventure|try|discover|outdoor)/.test(all) ? 2 : 0,
    creator:    /(create|invent|design|art|story|build)/.test(all) ? 2 : 0,
    connector:  /(family|friend|interview|community|share|present)/.test(all) ? 2 : 0,
    strategist: /(plan|figure|research|compare|business)/.test(all) ? 2 : 0,
  };
  const problem = {
    inventor:     /(invent|design|build|create something)/.test(all) ? 2 : 0,
    investigator: /(research|read|study|find out|why)/.test(all) ? 2 : 0,
    implementer:  /(try|do|test|prototype|practice)/.test(all) ? 2 : 0,
    optimiser:    /(faster|cheaper|better|improve|refine|tune)/.test(all) ? 2 : 0,
  };

  return {
    action:  rankLens(action, ACTION_STYLES),
    energy:  rankLens(energy, ENERGY_STYLES),
    problem: rankLens(problem, PROBLEM_STYLES),
  };
}
function rankLens(scores, lenses) {
  return lenses
    .map(l => ({ ...l, signal: scores[l.id] || 0 }))
    .sort((a, b) => b.signal - a.signal)
    .map((l, i) => ({ ...l, lean: i === 0 && l.signal > 0 ? "primary" : i === 1 && l.signal > 0 ? "secondary" : "minor" }));
}

/* ============================================================
   7. Parent Observations (collected over time)
   ============================================================ */
function deriveParentObservations(ctx) {
  return ctx.observations.slice(0, 10).map(o => ({
    at: o.createdAt,
    strengths: o.strengths,
    challenges: o.challenges,
    growthObserved: o.growthObserved,
    concerns: o.concerns,
    goalsNextTerm: o.goalsNextTerm,
  }));
}

/* ============================================================
   8. AI Observations (placeholder copy until real LLM is wired)
   ============================================================ */
function deriveAIObservations(ctx) {
  const strengths = deriveEmergingStrengths(ctx);
  const drivers = deriveMotivationalDrivers(ctx).slice(0, 2).map(d => d.driver);
  const prefs = deriveLearningPreferences(ctx).slice(0, 2).map(p => p.preference);
  const name = ctx.child.name;

  const notes = [];
  if (strengths[0]) {
    notes.push(`The clearest emerging signal is **${strengths[0].strength.toLowerCase()}** — it shows up across projects, reflections, and how ${name} talks about their work.`);
  }
  if (drivers.length) {
    notes.push(`${name} seems most energised when work involves ${drivers.join(" and ")}. Reward systems and project framings that lean into these will likely produce more sustained engagement.`);
  }
  if (prefs.length) {
    notes.push(`Learning appears to land most when it is ${prefs.join(" and ")}. This is a tendency, not a limitation — but it's useful information when designing the next term.`);
  }
  if (!notes.length) {
    notes.push(`There isn't yet enough behavioural data to surface confident observations. Add a few more projects, reflections and parent observations — three months of activity usually produces a meaningful picture.`);
  }
  notes.push(`${INSIGHTS_DISCLAIMER}`);
  return notes;
}

/* ============================================================
   9. Growth Over Time (longitudinal)
   ============================================================ */
function deriveGrowthOverTime(ctx) {
  // Synthesise simple age-banded points: top strength at this age + signal.
  // For richer history, the Insights Report timeline will accumulate snapshots.
  const top = deriveEmergingStrengths(ctx).slice(0, 3);
  return {
    age: ctx.child.age,
    snapshots: top.map(s => ({
      strength: s.strength,
      level: s.confidence === "strong" ? "Strong" : s.confidence === "moderate" ? "Developing" : "Emerging",
    })),
  };
}

/* ============================================================
   10. Optional Interpretive Frameworks
   ============================================================ */
function deriveInterpretive(ctx) {
  const cfg = ctx.config?.frameworks || {};
  const birth = ctx.child?.birthData || {};
  const enabled = (k) => cfg[k];

  const blocks = [];
  if (enabled("astrology") && birth.date) {
    blocks.push({
      framework: "Astrology",
      summary: `Sun sign by date: ${sunSign(birth.date) || "—"}. A symbolic lens for personality archetypes.`,
      caveat: "Astrology is offered as an interpretive framework for reflection only. It is not predictive and not science.",
    });
  }
  if (enabled("humanDesign") && birth.date) {
    blocks.push({
      framework: "Human Design",
      summary: `Human Design is calculated from birth date, time and city. To compute a true chart you'll need a charting library — for MVP this block reminds you it's enabled.`,
      caveat: "Human Design is an interpretive framework. Use it as a lens, not as a label.",
    });
  }
  if (enabled("archetypalPatterns")) {
    blocks.push({
      framework: "Archetypal Patterns",
      summary: "Classic archetypes that recur in stories and development (Creator, Caregiver, Explorer, Sage, etc.). Useful for noticing the role a child gravitates toward in family + community.",
      caveat: "Archetypes are reflective lenses, not types. A child can express many across a single week.",
    });
  }
  return blocks;
}

function sunSign(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return null;
  const m = d.getMonth() + 1, day = d.getDate();
  if ((m === 3 && day >= 21) || (m === 4 && day <= 19)) return "Aries";
  if ((m === 4 && day >= 20) || (m === 5 && day <= 20)) return "Taurus";
  if ((m === 5 && day >= 21) || (m === 6 && day <= 20)) return "Gemini";
  if ((m === 6 && day >= 21) || (m === 7 && day <= 22)) return "Cancer";
  if ((m === 7 && day >= 23) || (m === 8 && day <= 22)) return "Leo";
  if ((m === 8 && day >= 23) || (m === 9 && day <= 22)) return "Virgo";
  if ((m === 9 && day >= 23) || (m === 10 && day <= 22)) return "Libra";
  if ((m === 10 && day >= 23) || (m === 11 && day <= 21)) return "Scorpio";
  if ((m === 11 && day >= 22) || (m === 12 && day <= 21)) return "Sagittarius";
  if ((m === 12 && day >= 22) || (m === 1 && day <= 19)) return "Capricorn";
  if ((m === 1 && day >= 20) || (m === 2 && day <= 18)) return "Aquarius";
  return "Pisces";
}

/* ============================================================
   FRAMEWORKS MARKETPLACE (presented in Settings)
   ============================================================ */
export const FRAMEWORKS = [
  // Evidence-informed
  { id: "learningPreferences",      group: "evidence", name: "Learning Preferences",       blurb: "Hands-on / visual / discussion-based / etc. — observed from project + reflection behaviour." },
  { id: "characterStrengths",       group: "evidence", name: "Character Strengths",        blurb: "Curiosity, perseverance, kindness — surfaced from real evidence in the work." },
  { id: "multipleIntelligences",    group: "evidence", name: "Multiple Intelligences",     blurb: "A coarse map of how this child seems to engage — linguistic, kinesthetic, interpersonal, etc." },
  { id: "executiveFunction",        group: "evidence", name: "Executive Function Signals", blurb: "Planning, pacing, follow-through — useful for shaping support, not for diagnosis." },
  { id: "motivationalDrivers",      group: "evidence", name: "Motivational Drivers",       blurb: "Autonomy / mastery / contribution / recognition — what energises them, observed from real choices." },
  { id: "entrepreneurialTendencies",group: "evidence", name: "Entrepreneurial Tendencies", blurb: "Pattern-recognition for builder + business inclinations." },
  { id: "leadershipTendencies",     group: "evidence", name: "Leadership Tendencies",      blurb: "Initiation, organising, communicating — surfaced behaviourally, not declared." },
  // Interpretive
  { id: "humanDesign",              group: "interpretive", name: "Human Design",            blurb: "A symbolic framework derived from birth date, time and city. Reflective lens only." },
  { id: "astrology",                group: "interpretive", name: "Astrology",               blurb: "Symbolic interpretive framework. Useful for storytelling and self-reflection, not prediction." },
  { id: "archetypalPatterns",       group: "interpretive", name: "Archetypal Patterns",     blurb: "Classic narrative archetypes (Creator, Explorer, Sage…) as reflective lenses." },
];

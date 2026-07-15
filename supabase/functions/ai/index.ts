// ============================================================================
// North Star — AI edge function
// Calls the Claude API server-side so ANTHROPIC_API_KEY never reaches the browser.
// verify_jwt is ON (default): only signed-in parents can call it.
//
// Actions:
//   suggest-core-word  → propose family core words + acronyms from their vision
//   generate-project   → generate one personalized project for a child
//
// Cost controls: Sonnet 4.6 + prompt caching on the (large, identical-across-
// families) framework system prompt. Token usage is logged + returned.
// ============================================================================

import { resolveCaller, isActiveMember, hasPermission } from "../_shared/authz.ts";
import { logSecurityEvent, recentCount } from "../_shared/security.ts";

// Actions that spend meaningful tokens and require an AI-consuming permission.
const GENERATIVE_ACTIONS = new Set(["generate-project", "generate-printable", "quickstart-extract", "mentor-turn", "coreword-living"]);
const REPORT_ACTIONS = new Set(["growth-reflection"]);
const AI_CALLS_PER_WINDOW = 60;   // per family per 5 minutes (abuse ceiling, not a product quota)
const AI_WINDOW_SECS = 300;

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

// ---- The North Star "soul": shared, cacheable framing for every call --------
const SOUL = `You are the curriculum intelligence inside North Star, a Family Learning Operating System.
North Star helps intentional families raise capable, purposeful human beings. Education begins with a
destination — who the family hopes their children become — and reverse-engineers real-world experiences
toward it. You are a guide to the parent, never a replacement: parents make every final decision.

Core beliefs you always honour:
- Every child is already a whole person with gifts — observe and nurture, never mould or label.
- Capability matters more than curriculum. Real life is the classroom; projects are the vehicle.
- Honour THIS family's values, faith setting, and learning style. Never impose a one-size-fits-all view.
- Growth is shown through demonstration, not tests or grades.

CAPABILITY DOMAINS — the central intelligence layer. North Star does not organise learning into school
subjects; it intentionally cultivates human capability. Every project strengthens one or more domains.
Use these exact lowercase ids when tagging a project's "domains" and "capabilityMap":
- literacy — Literacy & Communication (reading, writing, storytelling, public speaking, research, critical thinking, media literacy)
- maths — Mathematics & Logical Thinking (problem solving, logical reasoning, patterns, data, systems thinking)
- science — Science, Discovery & Understanding the World (engineering, how things work/are made, experimentation, observation, innovation)
- creativity — Creativity & Design (art, design, photography, film, making, craftsmanship)
- music — Music & Performing Arts (instrument, singing, choir, performance, drama, dance, composition, music theory, stage confidence)
- digital — Digital Capability (typing, digital literacy, online research, AI & prompt writing, coding, web/app, video editing, design, animation, podcasting, cyber safety, digital ethics, content creation) — goal is digitally capable young adults, not teaching software; evolves as tech evolves
- practical — Practical Life (cooking, cleaning, organisation, repairs, gardening, home management, self-care, independence)
- enterprise — Entrepreneurship & Financial Capability (money, business, sales, marketing, negotiation, investing, budgeting, leadership through enterprise)
- health — Health & Wellbeing (nutrition, sleep, hygiene, mental wellbeing, emotional regulation, body awareness)
- sport — Sport, Movement & Physical Capability (team/individual sports, strength, mobility, coordination, swimming, cycling, martial arts, fitness, sportsmanship, resilience, leadership through sport) — COMPLEMENT existing coaching/training, never replace it
- relationships — Relationships & Emotional Intelligence (communication, conflict resolution, empathy, collaboration, boundaries, friendship)
- leadership — Leadership & Contribution (initiative, responsibility, service, mentoring, community contribution, decision making)
- nature — Nature & Environmental Stewardship (natural systems, food production, sustainability, outdoor skills, ecology, self-sufficiency)
OPTIONAL domains — use ONLY when the family has enabled them:
- faith — Faith (only if faith integration is on; adapt to the family's tradition)
- travel — Travel capability (only if travel/worldschool is on; researching, planning, budgeting, navigating, transport, customs, geography — capability, NOT tourism)

Think in COMBINATIONS, never isolated subjects: one real project (e.g. organising a family camping trip)
strengthens many domains at once — planning, budgeting, leadership, problem solving, nature, practical life.
Always ask "what capabilities would most meaningfully support this child's growth next?", then design.

Project pathways: Enterprise, Service, Self-Reliance, Health, Science, History, Arts, Adventure,
Mentorship, Family, Community, Faith, Technology.

Learning style is a 1–10 spectrum: 1 = Explorer/unschooling (open-ended, child-led), 10 = Traditional
Academic (structured). Tune the project's structure to where the family sits.`;

async function callClaude(system: string, userText: string, schema: object, apiKey: string) {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      system: [
        { type: "text", text: SOUL, cache_control: { type: "ephemeral" } },
        { type: "text", text: system },
      ],
      output_config: { format: { type: "json_schema", schema } },
      messages: [{ role: "user", content: userText }],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Claude API error ${res.status}`);
  }
  if (data.stop_reason === "refusal") {
    throw new Error("The request was declined. Try rephrasing the family details.");
  }
  const textBlock = (data.content || []).find((b: any) => b.type === "text");
  const parsed = JSON.parse(textBlock?.text || "{}");
  return { parsed, usage: data.usage };
}

// Multi-turn variant: pass a full messages array (for conversational mentors).
async function callClaudeChat(system: string, messages: any[], schema: object, apiKey: string) {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      system: [
        { type: "text", text: SOUL, cache_control: { type: "ephemeral" } },
        { type: "text", text: system },
      ],
      output_config: { format: { type: "json_schema", schema } },
      messages,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Claude API error ${res.status}`);
  }
  if (data.stop_reason === "refusal") {
    throw new Error("Polaris couldn't answer that one. Try asking a different way.");
  }
  const textBlock = (data.content || []).find((b: any) => b.type === "text");
  const parsed = JSON.parse(textBlock?.text || "{}");
  return { parsed, usage: data.usage };
}

// Shared: format a family's "deeper vision" answers (new 6-question set, with
// back-compat fallbacks to the old keys).
function visionLines(v: any): string {
  v = v || {};
  return [
    `- Adults they hope to raise (how described at 25): ${v.adultsHoping || "—"}`,
    `- Values that matter most: ${v.values || "—"}`,
    `- What educational success looks like: ${v.successLooksLike || "—"}`,
    `- Capabilities hoped for by age 18: ${v.capableByEighteen || v.skills || "—"}`,
    `- How they hope the child feels about themselves & treats others: ${v.selfAndOthers || v.qualities || "—"}`,
    `- What to experience more of in childhood: ${v.experiences || v.roles || "—"}`,
  ].join("\n");
}

// ---- Action: suggest core word + acronym -----------------------------------
const CORE_WORD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["suggestions"],
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["coreWord", "acronym", "rationale"],
        properties: {
          coreWord: { type: "string" },
          acronym: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["letter", "meaning"],
              properties: { letter: { type: "string" }, meaning: { type: "string" } },
            },
          },
          rationale: { type: "string" },
        },
      },
    },
  },
};

async function suggestCoreWord(payload: any, apiKey: string) {
  const v = payload?.vision || {};
  const system = `TASK: Propose 3 distinct family "core words" — a single memorable word (4–7 letters, e.g.
BRAVE, GROW, LIGHT, ROOT) whose letters form an acronym of values/qualities this family is growing in
their children. Each letter becomes one short value word or phrase that genuinely reflects what THIS
family said. Keep meanings concrete and warm, not generic. Add a one-sentence rationale per suggestion.
Make the three options feel meaningfully different from each other.`;
  const userText = `Here is what this family shared about who they hope to raise:
${visionLines(v)}
${payload?.currentWord ? `\nThey are currently considering the word "${payload.currentWord}" — you may refine it or offer alternatives.` : ""}

Propose 3 core words with acronyms.`;
  return callClaude(system, userText, CORE_WORD_SCHEMA, apiKey);
}

// ---- Action: suggest vision pieces (desired outcomes / motto / mission) -----
const OUTCOMES_SCHEMA = {
  type: "object", additionalProperties: false, required: ["outcomes"],
  properties: { outcomes: { type: "array", items: { type: "string" } } },
};
const TEXT_VALUE_SCHEMA = {
  type: "object", additionalProperties: false, required: ["value"],
  properties: { value: { type: "string" } },
};

async function suggestVision(payload: any, apiKey: string) {
  const kind = (payload?.kind || "outcomes").toString();
  const v = payload?.vision || {};
  const f = payload?.family || {};
  const ctx = `THIS FAMILY'S REFLECTIONS
${visionLines(v)}
- Family name: ${f.familyName || "—"}${f.coreWord ? `\n- Core word: ${f.coreWord}` : ""}${f.motto ? `\n- Family Credo: ${f.motto}` : ""}`;

  if (kind === "letter") {
    const letter = (f.letter || "").toString().toUpperCase();
    const word = (f.coreWord || "").toString().toUpperCase();
    const system = `TASK: Suggest ONE short value or capability — a single word or 2–3 word phrase — that
STARTS WITH THE LETTER "${letter}", to sit inside this family's core word "${word}" as that letter's
meaning. It must reflect THIS family's vision and feel warm and true. Return only the word/phrase in "value".`;
    return callClaude(system, ctx + `\n\nSuggest one "${letter}" meaning for "${word}".`, TEXT_VALUE_SCHEMA, apiKey);
  }
  if (kind === "outcomes") {
    const system = `TASK: From this family's reflections, propose 8–10 DESIRED OUTCOMES their educational
journey should produce — the kind of capable, whole person they are raising. Each outcome is SHORT
(2–5 words), warm, concrete, and clearly grounded in what THEY said (not generic boilerplate). Span
character, capability, relationships, contribution and wellbeing. Return them in "outcomes".`;
    return callClaude(system, ctx + "\n\nPropose the desired outcomes.", OUTCOMES_SCHEMA, apiKey);
  }
  if (kind === "motto") {
    const system = `TASK: Suggest ONE short, memorable FAMILY CREDO — a phrase children can remember,
repeat and grow up with (ideally 3–8 words; two short clauses is fine). It must capture THIS family's
values and hopes, in their spirit. Warm and true, never corporate or cliché. Return only the credo in "value".`;
    return callClaude(system, ctx + "\n\nSuggest one family credo.", TEXT_VALUE_SCHEMA, apiKey);
  }
  // family vision (the field key remains "mission")
  const system = `TASK: Suggest ONE warm FAMILY VISION (1–2 sentences) — the deeper "why" behind THIS
family's educational journey and who they are becoming together, a guiding light for the projects and
experiences North Star will suggest. Write in the family's own voice (e.g. "We are raising…"). Grounded
in their answers, never generic. Return it in "value".`;
  return callClaude(system, ctx + "\n\nSuggest one family vision.", TEXT_VALUE_SCHEMA, apiKey);
}

// ---- Action: tidy text (normalize formatting ONLY — never rewrite) ----------
async function tidyText(payload: any, apiKey: string) {
  const text = (payload?.text || "").toString().trim();
  if (!text) return { parsed: { value: "" }, usage: null };
  const system = `TASK: Tidy ONLY the FORMATTING of the parent's text below. Normalize capitalization,
spacing and punctuation so it reads cleanly: capitalize the first letter of sentences and obvious proper
nouns, group list-like items with commas and a single "and" before the last item (NO Oxford comma), and
end full sentences with a period.

ABSOLUTE RULES:
- Do NOT add, remove, reorder, rephrase, translate or reinterpret any words or ideas.
- Preserve the parent's exact wording and meaning. This is their truth, not yours.
- If the text is already clean, return it unchanged.
Return the tidied text in "value".`;
  return callClaude(system, `Text to tidy:\n${text}`, TEXT_VALUE_SCHEMA, apiKey);
}

// ---- Action: suggest focus ideas (for the project generator) ---------------
const FOCUS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["interests", "strengths", "develop", "capabilities"],
  properties: {
    interests: { type: "array", items: { type: "string" } },
    strengths: { type: "array", items: { type: "string" } },
    develop: { type: "array", items: { type: "string" } },
    capabilities: { type: "array", items: { type: "string" } },
  },
};

const CAPABILITY_DOMAINS = [
  "Literacy & Communication", "Mathematics & Logical Thinking",
  "Science, Discovery & Understanding the World", "Creativity & Design",
  "Music & Performing Arts", "Digital Capability", "Practical Life",
  "Entrepreneurship & Financial Capability", "Health & Wellbeing",
  "Sport, Movement & Physical Capability", "Relationships & Emotional Intelligence",
  "Leadership & Contribution", "Nature & Environmental Stewardship",
];

// Canonical Capability Domain ids — the enum the AI tags projects with.
const DOMAIN_IDS = [
  "literacy", "maths", "science", "creativity", "music", "digital", "practical",
  "enterprise", "health", "sport", "relationships", "leadership", "nature",
  "faith", "travel",
];

async function suggestFocus(payload: any, apiKey: string) {
  const f = payload?.family || {};
  const c = payload?.child || {};
  const known = {
    interests: (c.passions || []).join(", ") || "(none entered)",
    strengths: (c.strengths || []).join(", ") || "(none entered)",
    develop: (c.areasDeveloping || c.supportNeeds || []).join(", ") || "(none entered)",
    goals: (c.goals || []).join(", ") || "(none entered)",
  };
  const system = `TASK: Help a parent steer a learning quest by proposing a SHORT, friendly set of FOCUS
IDEAS for this child. The parent will tap a few. Keep it light and encouraging — NOT overwhelming.

Return four small lists (aim for 4–6 items each, concise — a couple of words each):
- "interests": things this child likely loves or would enjoy exploring (build on what's known; if little is
  known, infer gentle, age-appropriate possibilities they can confirm or ignore).
- "strengths": strengths to build on.
- "develop": areas to grow or stretch in (be kind and constructive, never deficit-framed).
- "capabilities": the most relevant real-world capabilities to grow, chosen ONLY from this list:
  ${CAPABILITY_DOMAINS.join(", ")}.

Rules: Tailor to the child's age and the family's values. Do NOT repeat items the parent already entered
(listed below) — offer FRESH ideas that complement them. Keep everything specific and warm.`;
  const userText = `FAMILY
- Values / vision: ${JSON.stringify(f.vision || {})}
- Core word: ${f.coreWord || "—"}
- Faith enabled: ${f.faithEnabled ? "yes" : "no"}

CHILD
- Name: ${c.name || "—"}, Age: ${c.age ?? "—"}
- Already entered — interests: ${known.interests}; strengths: ${known.strengths}; areas to grow: ${known.develop}; goals: ${known.goals}

Propose fresh, complementary focus ideas across the four lists.`;
  return callClaude(system, userText, FOCUS_SCHEMA, apiKey);
}

// ---- Action: generate a project --------------------------------------------
const PROJECT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "title", "questRole", "description", "childDescription", "purpose", "pathway", "sizeBand", "domains",
    "capabilityMap", "capabilitiesDeveloped", "academicSkills", "practicalSkills",
    "passionConnection", "learningOutcomes", "durationDays",
    "milestones", "materials", "momentumPointsAvailable", "starsAvailable",
    "reward", "toll", "reasonSuggested", "reflectionPrompts", "extensionIdeas", "parentNotes",
  ],
  properties: {
    title: { type: "string" },
    questRole: { type: "string" },
    description: { type: "string" },
    childDescription: { type: "string" },   // child-facing invitation, spoken TO the child
    purpose: { type: "string" },
    pathway: { type: "string" },
    sizeBand: { type: "string", enum: ["small", "medium", "large"] },
    domains: { type: "array", items: { type: "string", enum: DOMAIN_IDS } },
    capabilityMap: {
      type: "object",
      additionalProperties: false,
      required: ["primary", "secondary", "skills"],
      properties: {
        primary: { type: "array", items: { type: "string", enum: DOMAIN_IDS } },
        secondary: { type: "array", items: { type: "string", enum: DOMAIN_IDS } },
        skills: { type: "array", items: { type: "string" } },
      },
    },
    capabilitiesDeveloped: { type: "array", items: { type: "string" } },
    academicSkills: { type: "array", items: { type: "string" } },   // academic skills woven in
    practicalSkills: { type: "array", items: { type: "string" } },  // practical-life skills woven in
    foundationalLiteracies: { type: "array", items: { type: "string" } },
    realWorldApplication: { type: "string" },
    contributionOpportunities: { type: "string" },
    passionConnection: { type: "string" },
    learningOutcomes: { type: "array", items: { type: "string" } },
    durationDays: { type: "integer" },
    milestones: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "instructions", "dueOffsetDays", "momentumPoints", "reflectionRequired"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          instructions: { type: "array", items: { type: "string" } },
          dueOffsetDays: { type: "integer" },
          momentumPoints: { type: "integer" },
          reflectionRequired: { type: "boolean" },
        },
      },
    },
    materials: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "source", "estimatedPrice", "reasonSuggested", "format", "frequency", "capabilityDomains"],
        properties: {
          name: { type: "string" },
          source: { type: "string", enum: ["buy", "borrow", "build", "repurpose", "create"] },
          estimatedPrice: { type: "number" },
          reasonSuggested: { type: "string" },
          // Resource metadata for the Learning Resources engine:
          format: { type: "string", enum: ["physical", "printable"] },     // can North Star generate it?
          frequency: { type: "string", enum: ["once", "occasional", "frequent", "daily"] },
          capabilityDomains: { type: "array", items: { type: "string", enum: DOMAIN_IDS } },
        },
      },
    },
    momentumPointsAvailable: { type: "integer" },
    starsAvailable: { type: "integer" },
    reward: { type: "string" },
    toll: { type: "string" },
    reasonSuggested: { type: "string" },            // "Why North Star suggested this" — plain-language logic
    reflectionPrompts: { type: "array", items: { type: "string" } },
    extensionIdeas: { type: "array", items: { type: "string" } },
    parentNotes: { type: "string" },
  },
};

function sizeGuidance(size: string, age: number | null) {
  const a = typeof age === "number" ? age : 10;
  const young = a <= 8;
  const granularity = young
    ? "This child is young — make missions TINY and frequent (each doable in one short sitting). Prefer MANY small missions (8–12+) over a few big ones, with smaller point values each."
    : a <= 12
    ? "Make missions small and clearly bounded — several short steps the child can finish in a sitting or two."
    : "This child is older — fewer, more substantial missions are fine, but each must still be concrete and measurable.";
  if (!size || size === "auto") {
    return `SIZE: YOU CHOOSE — read the parent's request and this child, then pick the most fitting scope yourself and set "durationDays" + "sizeBand" to match. Small (7–14 days, 3–6 missions) for a focused single interest; medium (~30 days, 6–10 missions) for something richer; large/term (~63 days, 8–14 missions, a lasting habit) only when they clearly describe a habit, a big build, or a season-long journey (e.g. a multi-week trip). Don't over-scope — match the spark. ${granularity}`;
  }
  if (size === "large" || size === "term") {
    return `SIZE: LARGE / TERM QUEST. Duration ~63 days (most of a 9–10 week term). 8–14 missions building toward a real LIFE SKILL the family wants this child to learn, and a lasting habit (it takes ~63 days for a child to form one). Spread missions roughly evenly across the term. A bigger, meaningful reward for completing the whole quest. ${granularity}`;
  }
  if (size === "medium") {
    return `SIZE: MEDIUM QUEST. Duration ~30 days (about a month). 6–10 missions. A mid-sized reward. ${granularity}`;
  }
  return `SIZE: SMALL QUEST. Duration 7–14 days (1–2 weeks). 3–6 missions. A small, fun reward. ${granularity}`;
}

// Build a compact summary of a previously-generated quest so the model can AMEND
// it (rather than start from scratch) when the parent asks for tweaks.
function previousQuestSummary(prev: any): string {
  if (!prev || typeof prev !== "object") return "";
  const ms = Array.isArray(prev.milestones)
    ? prev.milestones.map((m: any, i: number) => `   ${i + 1}. ${m.title}${m.description ? ` — ${m.description}` : ""}`).join("\n")
    : "";
  return `EXISTING QUEST TO AMEND (keep what works; change only what the parent asked):
- Title: ${prev.title || "—"}
- Quest role: ${prev.questRole || "—"}
- Description: ${prev.description || "—"}
- Domains: ${(prev.domains || []).join(", ") || "—"}
- Pathway: ${prev.pathway || "—"}
- Size: ${prev.sizeBand || "—"}
- Milestones:
${ms || "   (none)"}`;
}

async function generateProject(payload: any, apiKey: string) {
  const f = payload?.family || {};
  const c = payload?.child || {};
  const constraints = payload?.constraints || {};
  const acronym = Array.isArray(f.acronym)
    ? f.acronym.map((a: any) => `${a.letter}=${a.meaning}`).join(", ")
    : "";
  const requestedDomains: string[] = Array.isArray(constraints.domains) ? constraints.domains : [];
  const ownedResources: string[] = Array.isArray(constraints.ownedResources) ? constraints.ownedResources : [];
  const refine: string = (constraints.refine || "").toString().trim();
  const prevSummary = refine ? previousQuestSummary(constraints.previous) : "";
  // The parent's free-text "spark" — the heart of the redesigned generator. The
  // parent describes real life; the AI does the educational design around it.
  const intent: string = (constraints.intent || "").toString().trim();
  // Quiet capability balance: domains this child's recent projects leaned on.
  const recent = (constraints.recentDomains && typeof constraints.recentDomains === "object" && !Array.isArray(constraints.recentDomains)) ? constraints.recentDomains : {};
  const recentTop = Object.entries(recent as Record<string, number>)
    .sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 3).map(([d]) => d);
  const balanceLine = recentTop.length
    ? `QUIET CAPABILITY BALANCE: this child's recent projects have leaned on ${recentTop.join(", ")}. Without ever overriding the child's interest, if it fits naturally, gently weave in a capability area that's been lighter lately. Interest is the doorway; balance is woven through — never forced.`
    : "";

  // Parent-chosen focus for THIS quest (subset of the child's profile to emphasise).
  const focus = constraints.focus || {};
  const focusInterests: string[] = Array.isArray(focus.interests) ? focus.interests : [];
  const focusStrengths: string[] = Array.isArray(focus.strengths) ? focus.strengths : [];
  const focusDevelop: string[] = Array.isArray(focus.develop) ? focus.develop : [];
  const focusGoals: string[] = Array.isArray(focus.goals) ? focus.goals : [];
  const focusCapabilities: string[] = Array.isArray(focus.capabilities) ? focus.capabilities : [];
  const focusLines = [
    focusInterests.length ? `  - Lean into these interests they love: ${focusInterests.join(", ")}` : "",
    focusStrengths.length ? `  - Play to these strengths: ${focusStrengths.join(", ")}` : "",
    focusDevelop.length ? `  - Deliberately grow these areas they're developing: ${focusDevelop.join(", ")}` : "",
    focusGoals.length ? `  - Move toward these goals: ${focusGoals.join(", ")}` : "",
    focusCapabilities.length ? `  - Build these real-world capabilities (reflect them in capabilitiesDeveloped): ${focusCapabilities.join(", ")}` : "",
  ].filter(Boolean).join("\n");
  // Titles of this child's existing quests, so we can avoid repeating themes.
  const avoidTitles: string[] = Array.isArray(constraints.avoidTitles) ? constraints.avoidTitles : [];
  // The family learning loop — explicit + implicit signals from past decisions.
  const prefs = constraints.preferences || {};
  const prefsBlock = prefs.hasSignal ? `
FAMILY LEARNING SIGNALS (from this family's past project decisions — lean in / avoid accordingly)
${prefs.preferredDomains?.length ? `- Tends to accept projects in: ${prefs.preferredDomains.join(", ")}` : ""}
${prefs.topRejectionReasons?.length ? `- Has rejected projects because: ${prefs.topRejectionReasons.join("; ")}` : ""}
${prefs.recentNotes?.length ? `- Recent parent feedback: ${prefs.recentNotes.map((n: string) => `"${n}"`).join(" · ")}` : ""}` : "";
  const system = `TASK: ${refine
    ? `AMEND an existing real-world QUEST for this specific child according to the parent's requested changes below. Keep the parts that already work (the core idea, anything they didn't ask to change) and weave in their amendments naturally. Re-balance milestones, points, materials and reward so the whole quest stays coherent.`
    : `Design ONE meaningful, real-world QUEST for this specific child`} — framed as an
ADVENTURE in which the CHILD is the hero of the story. Give it a "questRole" (e.g. "You are the Gear
Inventor", "You are the Garden Keeper"), an inviting title, and mission names that read like chapters.
Make it fun, with a sense of intrigue and momentum. It must connect to the child's passions, develop
multiple capabilities at once, and be achievable with the family's resources and learning style.

${intent ? `THE PARENT'S REQUEST — THE SPARK (this is the heart of the quest; honour it directly):
"${intent}"
Design the quest AROUND this real-life moment. It is the doorway. Then use the full intelligence of this
family and child below to do the educational design they did NOT spell out — choose the capabilities,
academic skills, practical-life skills, real experiences, materials and milestones that best serve this
child. The parent brought the spark; YOU build the pathway.\n` : ""}
${balanceLine ? balanceLine + "\n" : ""}
${sizeGuidance(constraints.size, c.age ?? null)}

${requestedDomains.length
  ? `REQUESTED CAPABILITY DOMAINS: The parent has chosen the Capability Domains this quest should develop: ${requestedDomains.join(", ")}. Treat this as the DESIRED SET — genuinely develop each one through the missions (don't just tag it), and don't lean on domains they didn't pick. These should be your capabilityMap.primary, and "domains" must include exactly this set.`
  : ""}

${focusLines ? `PARENT'S FOCUS FOR THIS QUEST (weight the design toward these, without ignoring the whole child):\n${focusLines}` : ""}

WELL-ROUNDED & CREATIVE DESIGN: Deliberately balance THREE ingredients so the quest is whole, not one-note:
1) DELIGHT — something that genuinely lights this child up (their real passions/interests).
2) GROWTH — something they (or their parents) want to develop, woven in so it feels earned, not bolted on.
3) STRETCH — at least one mission that challenges them just past their comfort zone (a brave ask, a harder
   build, a real audience) so they surprise themselves.
All three serve the family's values and the capabilities the parent wants to grow.

BE INVENTIVE — AVOID SAMENESS: Each quest must feel DISTINCT. Vary the pathway, the format, the setting and
the central "hook" from one quest to the next — don't keep respinning the same idea (e.g. not always a
business/market stall). Reach across different pathways (Service, Science, Arts, Adventure, History,
Technology, Community, Faith, Enterprise, Self-Reliance, Health, Family, Mentorship) and real-world formats
(an exhibition, a field study, a repair, a performance, a teach-back, an expedition, a published piece, an
event, an experiment, a collection, an interview series). Pick something fresh and a little surprising.
${avoidTitles.length ? `This child has ALREADY done these quests — make this one clearly DIFFERENT in theme, pathway and format from every one of them: ${avoidTitles.join("; ")}.` : ""}

EVERY MILESTONE ("mission") MUST BE:
- MEASURABLE — a clear done / not-done outcome (not vague "learn about X").
- ACCOUNTABLE — name who they show or tell when done (a parent, or a project partner).
- CONTROLLABLE — the child controls the outcome; avoid steps that mostly wait on someone else (rare
  exceptions allowed). Momentum comes from the child being able to act and finish.
- SMALL & SHORT — so it feels achievable. Break work down; it's better to have more small missions.

Each mission's "instructions" is an array of 1–4 concrete ACTION STEPS using strong action verbs such as:
build, research, call, speak to, draw a diagram, make a poster, calculate, write out, read, buy, bake,
make, share, collaborate, ask, generate, design. Tell them EXACTLY what to do and who to show it to.
"description" is a one-line summary of the mission; "instructions" are the steps to follow.

REWARDS & TOLLS (suggestions only — the parent decides): scale the reward to the size — a term-long quest
earns a BIG reward; a 1–2 week quest a small one. Award more momentum points overall for larger quests
(younger children get smaller per-mission point values). The toll is a natural responsibility tied to the
work, never a punishment.
REWARD BALANCE: Vary the TYPE of reward across quests — don't always default to a purchase. Draw from three
kinds: (1) EXPERIENCE rewards (camping trip, museum, rock climbing, workshop, cooking class, nature expedition),
(2) PURCHASE rewards (a tool, kit, instrument, camera, science kit — many of which UNLOCK new capability and
should lead to richer future projects), and (3) CONTRIBUTION rewards, where the child chooses SERVICE over
payment (help a neighbour for free, cook for someone unwell, clean a local park, teach a sibling, volunteer,
an act of anonymous kindness). Contribution rewards reinforce the family's values and cultivate generosity and
intrinsic motivation — offer one regularly, especially for values-driven families. Match the reward to the
child's passions and the quest's domains.

REAL-WORLD & SAFETY RULES (from the family's Settings — use ONLY what is provided; treat empty as empty, never infer):
- LOCATION: If a home location is given, suggest specific, real nearby experiences where relevant (parks, libraries, museums, trails, creeks, beaches, farms, local businesses, cultural/historical sites, nature areas).
- MOBILITY: Respect the child's mobility permissions exactly. Do NOT suggest the child independently walk, ride a bike, use public transport, travel to local businesses, or drive UNLESS that specific permission is listed. When unsure, keep every outing adult-supervised.
- TRAVEL: If Travel/Worldschool mode is on, weight the quest toward the listed destination(s) and their dates, following each destination's preference (local experiences only / destination-based projects only / both).
- FAITH: Only weave in faith elements if faith integration is on; honour the tradition/denomination/notes given, warmly and never preachy. Never introduce faith otherwise.
- PEOPLE: Only reference the real people listed (by their name + role). Never invent relatives, mentors or friends.
- LEARNING RESOURCES (intelligent procurement): List every resource the quest needs in "materials" so it flows into the family's Learning Resources engine. For each: pick a "source" (buy/borrow/build/repurpose/create), set "format" to "printable" if North Star could simply generate it (worksheets, flash cards, templates, trackers) instead of buying, set "frequency" of use, and tag the "capabilityDomains" it supports. Do NOT suggest resources the family already has (see "RESOURCES ALREADY OWNED"). Keep the list lean and genuinely needed.
- FAMILY INVENTORY FIRST (core principle): ALWAYS prioritise what the family already owns (see FAMILY INVENTORY) before recommending any purchase. Actively DESIGN the quest around their existing things — "you already own a microscope" → biology/observation missions that use it; "you have a keyboard" → composition, theory or songwriting; "you own a mountain bike" → navigation, endurance, mechanics or outdoor-adventure missions; owned games/books/instruments/tools become the raw material of missions. Reference owned items by name. This makes North Star feel deeply personal and reduces unnecessary spending. Only suggest buying when nothing owned will do.
- DIY-FIRST (core principle): Whenever practical, recommend MAKING before buying — making builds capability, buying buys convenience. Make the EDUCATIONAL choice, not the easiest one. For a bird feeder, primary = build it (source: build); for alphabet cards or maths posters, primary = print/laminate (format: printable). Reserve buy/ready-made for where it's genuinely the better educational or safety choice. The reasonSuggested can note a ready-made alternative, but lead with the DIY option.
- LOCAL SUPPLIERS & VALUE: When something must be bought, recommend suppliers LOCAL to the family's country (see Country above) — weighing price, shipping, availability, reviews, quality and delivery time to surface the best overall value. Name the supplier type in reasonSuggested (e.g. "from a hardware store like Bunnings (AU)") rather than assuming one global store.
- AGE-APPROPRIATE TOOLS: Match any tool to the child's age, maturity and parent settings. Younger children: glue/cardboard construction, safe cutting, craft. Older children (with parent approval): real toolbox, hammer, screwdrivers, handsaw, cordless drill, repair and woodworking kits. NEVER suggest sharp or power tools below an appropriate age or without parent approval.
- TOOL PROGRESSION & UNLOCKS: Tools and equipment the child has earned/owns (see RESOURCES ALREADY OWNED) UNLOCK more advanced work — escalate project complexity accordingly (e.g. once they have a drill or toolbox, design real woodworking/repair builds). A reward can unlock a whole capability; lean into newly-unlocked capabilities next.
- CHARACTER, IDENTITY & WISDOM: When the family owns character/values resources (see RESOURCES ALREADY OWNED — e.g. Share Tree or values cards, conversation cards, gratitude or reflection journals, family discussion games, family meeting kits), actively BUILD RITUALS around them inside projects: a weekly reflection ritual with the cards, an after-dinner values discussion, gratitude reflections woven into milestones, a weekly conversation/family-meeting night tied to the current Capability Domains. These are not academic add-ons — they are how the family's MISSION, CORE WORD and MOTTO (see FAMILY NORTH STAR) become lived daily rather than words on a page. Over time, treat the resources that have become meaningful to this family as part of their culture and keep weaving them into projects, celebrations, reflections and conversations.
- LEARN FROM THIS FAMILY: If FAMILY LEARNING SIGNALS are present below, honour them — gravitate toward the kinds of projects they've accepted and steer clear of the reasons they've rejected before (e.g. too screen-based, too expensive, too much travel, too much parent involvement). This is how North Star gets to know each family over time.
- CAPABILITY-FIRST (core principle): Personalise to each capability area in the LEARNING PROFILE, NOT chronological age. A child may read above age level yet need gentler maths — pitch each part of the quest to the child's actual current level in that specific area. Honour the learning style (how to package learning), build on the stated strengths, gently strengthen the chosen growth areas. Read the parent's "How ${c.name || "this child"} learns" observations as PATTERNS to design around — NEVER as clinical diagnoses or deficits. If they note "concentrates better after movement" → build in movement breaks; "reads years above age" → use reading material by ability not age; "hates handwriting but loves talking" → favour voice recordings, presentations and typing; "overwhelmed in noisy places" → calmer, quieter settings. Use the parent's "about" description to set the tone and the hooks that will genuinely engage this child.
- ACADEMIC FLEXIBILITY: If the family follows any traditional curriculum (listed under ACADEMIC & CURRICULUM below), weave it in as a natural ingredient of the quest — don't sit it outside North Star. Reference specific workbooks/pages, this week's lesson, province/state requirements or upcoming tests inside real missions (e.g. "Complete pages 34–36 of your maths workbook", "Run a practical experiment tied to this week's science lesson", "Write a reflection connected to today's reading"). Blend structured academics with real-world capability wherever it fits.
- EXTERNAL LEARNING ECOSYSTEM: North Star is the intelligence layer ABOVE the family's existing learning — music teachers, sports coaches, language tutors, dance schools, coding programs, Duolingo, reading apps, YouTube, courses, museums, mentors. NEVER try to replace excellent resources the child already uses (listed under "Existing learning, mentors & tools"). Instead extend and deepen them: design missions that build ON top of what's already happening (e.g. "Apply this week's piano lesson by performing for a relative", "Use your Duolingo Spanish in a real conversation at the market").
- NO PASSIVE CONSUMPTION (core design principle): NEVER recommend watching/listening/reading as an endpoint. Every resource MUST be paired with reflection, application or creation. Watch a documentary → create a presentation. Listen to a podcast → interview someone about the topic. Watch a TED Talk → apply one idea this week. Complete a Duolingo lesson → use the language for real. Watch a tutorial → build the thing. Always move the child from consuming information to creating capability.
- DIGITAL CAPABILITY & PREFERENCE: Honour the family's "Preferred role of technology" and "Approximate digital learning preference (%)". A family at 10% should get markedly more hands-on, real-world missions with minimal screens; a family at 80% can lean into digital tools, AI, coding and online resources. Only recommend the resource types the parent ticked under "North Star may recommend…" — if none are ticked, keep the quest essentially screen-free. The Digital domain develops capable young adults (typing, AI/prompting, creation, cyber safety, digital ethics), never passive screen time.
- FAMILY TECHNOLOGY AGREEMENT (hard boundaries — respect absolutely): If a FAMILY TECHNOLOGY AGREEMENT is present below, it is the family's stated digital values for THIS child and OVERRIDES convenience. Never design missions that violate it. If YouTube is limited, do NOT build a quest that DEPENDS on YouTube — offer offline/hands-on or alternative-resource paths instead. If internet must be supervised, prefer offline alternatives and frame any online step as "with a parent". If the family has AI-use rules, honour them (e.g. "AI helps us learn, it doesn't replace our thinking" → use AI to assist/check, never to do the child's thinking). If gaming or screen time is bounded, keep screen-based missions optional and brief. Treat these as guardrails on every recommendation, not preferences to weigh.
- AGE-APPROPRIATE REFLECTION: Match how the child responds/reflects to their developmental stage. 3–6: voice recording, drawing, photos, conversation with a parent. 7–10: short written reflections, illustrations, simple presentations. 11–14: written summaries, video reflections, presentations, interviews. 15–18: essays, podcast episodes, video documentaries, business presentations, research papers, public speaking. The aim (communication, reflection, application) is constant; the FORMAT must fit the age. Reflection-required missions should name a format that fits this child.

PROPOSAL FIELDS (fill ALL — this is the proposal the parent reviews before accepting; make it trustworthy and complete):
- "description": a clear summary for the PARENT of what this quest involves.
- "childDescription": the same quest spoken directly TO ${c.name || "the child"} — warm, exciting and age-appropriate, their invitation into the adventure ("You are about to…").
- "purpose": why this quest fits THIS child right now (their interest, stage, and what it grows).
- "reasonSuggested": "Why North Star suggested this" — 1–2 plain-language sentences explaining the design logic: how it builds on their interest while quietly balancing capabilities (e.g. "This builds on Noah's mountain-biking passion while strengthening measurement, planning and resilience, and balances his recent science-heavy work with practical maths and reflective writing."). Keep it short and useful — this is what earns the parent's trust.
- "academicSkills": the academic skills woven in (e.g. measurement, persuasive writing, data handling) — concrete, short items.
- "practicalSkills": the practical-life skills woven in (e.g. budgeting, cooking, planning, basic repairs).
- "reflectionPrompts": 2–4 reflection questions for the child, matched to their age and the right format.
- "extensionIdeas": 2–4 OPTIONAL ways to take it further if the child catches fire.
- "parentNotes": brief practical notes for the parent — how to support, any safety/set-up, and what "done well" looks like.

CAPABILITY MAPPING (required — this is core North Star intelligence): Map the quest against the Capability Domains it develops.
- "capabilityMap.primary": the 1–3 domain ids this quest most strongly develops.
- "capabilityMap.secondary": other domain ids it also genuinely touches (think in combinations).
- "capabilityMap.skills": the specific real skills it grows (e.g. "budgeting", "public speaking", "soldering") — drawn from the domains' skill sets.
- "domains": the union of primary + secondary (these drive the UI tags).
Use ONLY the lowercase Capability Domain ids. Set sizeBand to small, medium, or large to match the quest you designed.`;
  // Real-world context from Family Settings (used only when provided).
  const loc = f.location || {};
  const travel = f.travel || {};
  const travelOn = travel.mode && travel.mode !== "off";
  const dests = Array.isArray(travel.destinations) ? travel.destinations : [];
  const faithDetail = f.faith || {};
  const people = Array.isArray(f.relationships) ? f.relationships : [];
  const mob = c.mobilityProfile || {};
  const mobPerms = Array.isArray(mob.permissions) ? mob.permissions : [];
  // Capability-based Learning Profile (teach the child in front of you).
  const lp = (c.learningProfile && !Array.isArray(c.learningProfile)) ? c.learningProfile : {};
  const lpLevels = lp.levels || {};
  const lpLevelLine = Object.keys(lpLevels).length
    ? Object.entries(lpLevels).map(([k, v]) => `${k}: ${v}`).join(", ")
    : "—";
  const lpDiffs = Array.isArray(lp.differences) ? lp.differences : [];
  // "Understanding Your Child" — the parent's natural-language observations of
  // how this child learns. Treat as PATTERNS to design around, never diagnoses.
  const understanding = lp.understanding || lp.differencesNote || (lpDiffs.length ? lpDiffs.join(", ") : "") || "";
  // Family-added custom skills the parent attached to specific Capability Domains.
  const customSkills = (lp.customSkills && typeof lp.customSkills === "object" && !Array.isArray(lp.customSkills)) ? lp.customSkills : {};
  const customSkillLine = Object.entries(customSkills)
    .filter(([, v]) => Array.isArray(v) && v.length)
    .map(([dom, v]) => `${dom}: ${(v as string[]).join(", ")}`)
    .join("; ");
  // Technology & Digital Learning preferences (drive how much screen-based learning a quest uses).
  const tech = (lp.tech && typeof lp.tech === "object" && !Array.isArray(lp.tech)) ? lp.tech : {};
  const TECH_PREF_LABELS: Record<string, string> = {
    youtube: "educational YouTube", ted: "TED Talks", podcasts: "podcasts", audiobooks: "audiobooks",
    documentaries: "documentaries", courses: "online courses", websites: "educational websites",
    ai: "AI tools", coding: "coding platforms", musicApps: "music learning apps", languageApps: "language learning apps",
  };
  const techRole = typeof tech.role === "number" ? tech.role : null;
  // Single measure: derive an approximate digital % from the 1–10 slider
  // (the standalone % control was removed to avoid asking the same thing twice).
  const techPct = techRole != null ? techRole * 10 : (typeof tech.digitalPct === "number" ? tech.digitalPct : null);
  const techAllow = Array.isArray(tech.allow) ? tech.allow.map((k: string) => TECH_PREF_LABELS[k] || k) : [];
  const techLines = [
    techRole != null ? `\n- Preferred role of technology (1 hands-on – 10 tech-rich): ${techRole}` : "",
    techPct != null ? `\n- Approx digital learning preference: ${techPct}% of learning via screens — calibrate screen use to this` : "",
    `\n- Resources North Star MAY recommend (each paired with reflection/application/creation — never passive): ${techAllow.length ? techAllow.join(", ") : "none ticked — keep this quest essentially screen-free"}`,
    tech.ecosystem ? `\n- Existing learning, mentors & tools to EXTEND (never replace): ${tech.ecosystem}` : "",
  ].filter(Boolean).join("");
  const profileBlock = `
LEARNING PROFILE (capability-first — teach the child in front of you, not the average child of this age)
- Learning style (1 Explorer – 10 Traditional): ${c.learningStyle ?? f.learningStyleDefault ?? 5}
- Current levels by area: ${lpLevelLine}${lp.levelsNote ? `\n- Levels note: ${lp.levelsNote}` : ""}
- How ${c.name || "this child"} learns (parent's observations — PATTERNS to design around, NEVER diagnoses): ${understanding || "—"}${customSkillLine ? `\n- Family-prioritised skills (the parent specifically wants these grown, by domain): ${customSkillLine}` : ""}${techLines}
- About ${c.name || "this child"} (in the parent's words): ${lp.about || "—"}`;
  // Traditional curriculum this family chooses to keep (optional). Stored inside
  // the learning profile; woven into missions rather than sitting outside North Star.
  const acad = (lp.academics && typeof lp.academics === "object" && !Array.isArray(lp.academics)) ? lp.academics : {};
  const acadEntries = [
    ["Maths curriculum", acad.maths],
    ["Reading curriculum", acad.reading],
    ["Language curriculum", acad.language],
    ["Science curriculum", acad.science],
    ["Province / State requirements", acad.requirements],
    ["Textbooks", acad.textbooks],
    ["Workbooks", acad.workbooks],
    ["Testing schedule", acad.testing],
  ].filter(([, v]) => v && String(v).trim());
  const academicBlock = acadEntries.length ? `
ACADEMIC & CURRICULUM (traditional curriculum this family follows — weave it into missions; do not replace the quest)
${acadEntries.map(([k, v]) => `- ${k}: ${v}`).join("\n")}` : "";
  const settingsBlock = `
REAL-WORLD CONTEXT (Family Settings — use ONLY what's here; empty = empty)
- Home location: ${loc.display ? `${loc.display}${loc.lat != null ? ` (lat ${loc.lat}, lon ${loc.lon})` : ""}` : "—"}
- Country (recommend LOCAL suppliers for this country): ${loc.country || "—"}
- Travel / Worldschool mode: ${travelOn ? travel.mode : "off"}${travelOn && dests.length ? `\n- Destinations: ${dests.map((d: any) => `${d.city || "?"}${d.country ? ", " + d.country : ""}${d.arrival || d.departure ? ` (${d.arrival || "?"}→${d.departure || "?"})` : ""} [${d.preference || "both"}]`).join("; ")}` : ""}
- Faith integration: ${f.faithEnabled ? `ON — ${[faithDetail.tradition || f.faithTradition, faithDetail.denomination].filter(Boolean).join(", ") || "unspecified"}${faithDetail.churchName ? `; community: ${faithDetail.churchName}` : ""}${faithDetail.notes ? `; notes: ${faithDetail.notes}` : ""}` : "off"}
- People in the child's life (refer ONLY to these by name): ${people.length ? people.map((p: any) => `${p.name} (${p.relationship}${p.roleNote ? `, ${p.roleNote}` : ""})`).join("; ") : "—"}
- ${c.name || "This child"}'s mobility permissions: ${mobPerms.length ? mobPerms.join(", ") : "none specified — assume adult supervision for any outing"}${mob.notes ? `; notes: ${mob.notes}` : ""}`;

  // Living Family Inventory — what the family already owns. Design projects around
  // these before recommending any purchase.
  const inventory = (constraints.inventory && typeof constraints.inventory === "object") ? constraints.inventory : null;
  const invByCat = inventory?.byCategory || {};
  const invCtx = inventory?.context || {};
  const invCatLines = Object.entries(invByCat)
    .filter(([, v]) => Array.isArray(v) && (v as string[]).length)
    .map(([cat, v]) => `- ${cat}: ${(v as string[]).join(", ")}`);
  const invCtxLines = Object.entries(invCtx)
    .map(([k, v]) => {
      const pairs = (v && typeof v === "object") ? Object.entries(v as Record<string, string>).filter(([, val]) => val).map(([kk, val]) => `${kk}: ${val}`) : [];
      return pairs.length ? `- ${k} → ${pairs.join(", ")}` : "";
    }).filter(Boolean);
  const inventoryBlock = (invCatLines.length || invCtxLines.length) ? `
FAMILY INVENTORY (what they ALREADY OWN / have access to — DESIGN THE QUEST AROUND THESE before recommending any purchase)
${invCatLines.join("\n")}${invCtxLines.length ? `\n${invCtxLines.join("\n")}` : ""}` : "";

  // Family Technology Agreement (per child) — hard digital boundaries.
  const tech_ = (constraints.technology && typeof constraints.technology === "object") ? constraints.technology : null;
  const techFlags = tech_?.flags || {};
  const techConstraintLines = [
    techFlags.youtubeLimited ? "- YouTube is LIMITED — do not build quests that depend on YouTube; offer offline/alternative paths." : "",
    techFlags.internetSupervised ? "- Internet use is SUPERVISED — prefer offline alternatives; frame any online step as 'with a parent'." : "",
    techFlags.gamingLimited ? "- Gaming/screen time is BOUNDED — keep any screen-based missions optional and brief." : "",
    techFlags.screenLimits ? "- The family protects screen-free time — lean hands-on and real-world." : "",
    techFlags.aiRules ? `- AI-use rules to honour: ${techFlags.aiRules}` : "",
  ].filter(Boolean);
  const technologyBlock = (tech_ && Array.isArray(tech_.lines) && tech_.lines.length) ? `
FAMILY TECHNOLOGY AGREEMENT for ${c.name || "this child"} (the family's stated digital values — RESPECT as hard boundaries)
${tech_.lines.map((l: string) => `- ${l}`).join("\n")}${techConstraintLines.length ? `\nDerived guardrails:\n${techConstraintLines.join("\n")}` : ""}` : "";

  const GENDER_PRONOUNS: Record<string, string> = {
    girl: "she/her", boy: "he/him", nonbinary: "they/them",
  };
  const pronouns = GENDER_PRONOUNS[(c.gender || "").toString()] || "they/them (gender not specified)";
  const userText = `FAMILY NORTH STAR
- Family: ${f.familyName || "—"}
- Family Vision (who they are becoming): ${f.mission || "—"}
- Family Credo (their memorable line): ${f.motto || "—"}
- Core word: ${f.coreWord || "—"}${acronym ? ` (${acronym})` : ""}
- Values / vision: ${JSON.stringify(f.vision || {})}
- Learning style (1 Explorer – 10 Traditional): ${f.learningStyleDefault ?? 5}
- DIY preference (1 buy – 10 make): ${f.diyMaterialsPreference ?? 5}
- Faith enabled: ${f.faithEnabled ? `yes (${f.faithTradition || "unspecified"})` : "no"}

CHILD
- Name: ${c.name || "—"}, Age: ${c.age ?? "—"}, Pronouns: ${pronouns} — ALWAYS use these pronouns for ${c.name || "this child"}; never assume from the name.
- Passions/interests: ${(c.passions || []).join(", ") || "—"}
- Strengths: ${(c.strengths || []).join(", ") || "—"}
- Areas developing / needing support: ${(c.areasDeveloping || c.supportNeeds || []).join(", ") || "—"}
- Goals: ${(c.goals || []).join(", ") || "—"}
- Selected Capability Domains: ${(c.domains || []).join(", ") || "—"}
${profileBlock}
${academicBlock}
${settingsBlock}
${inventoryBlock}
${technologyBlock}
${prefsBlock}

CONSTRAINTS (optional)
- Parent's request / spark (PRIMARY — design around this): ${intent ? `"${intent}"` : "(none — design for the whole child)"}
- Recent capability focus (for gentle balance): ${recentTop.length ? recentTop.join(", ") : "(no recent projects)"}
- Requested quest size: ${constraints.size || "(you choose the best-fitting scope)"}
- Requested domains to incorporate: ${requestedDomains.join(", ") || "(parent's choice)"}
- Parent's focus picks: ${focusLines ? "\n" + focusLines : "(none — design for the whole child)"}
- Quests already done (avoid repeating these themes/formats): ${avoidTitles.join("; ") || "(none yet)"}
- Preferred pathway: ${constraints.pathway || "any"}
- RESOURCES ALREADY OWNED (do NOT re-suggest these in materials): ${ownedResources.join(", ") || "—"}
- Budget: ${constraints.budget || "modest"}
- Season/location: ${constraints.season || "any"} / ${constraints.location || "home"}
${prevSummary ? `\n${prevSummary}\n\nPARENT'S REQUESTED CHANGES (apply these): "${refine}"` : ""}

${refine
  ? `Return the AMENDED quest for ${c.name || "this child"} — the same quest, revised per the parent's requested changes above, with ${c.name || "the child"} still as the hero.`
  : `Design one quest tailored to ${c.name || "this child"}, with ${c.name || "the child"} as the hero.`}`;
  return callClaude(system, userText, PROJECT_SCHEMA, apiKey);
}

// ---- Action: growth-reflection (quarterly report, framed by the family vision) ----
const REFLECTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reflection", "coreWordLived", "strengths", "opportunity", "evolutionPrompt"],
  properties: {
    reflection: { type: "array", items: { type: "string" } },   // 3–5 narrative observations
    coreWordLived: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["letter", "quality", "evidence"],
        properties: { letter: { type: "string" }, quality: { type: "string" }, evidence: { type: "string" } },
      },
    },
    strengths: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["title", "detail"],
        properties: { title: { type: "string" }, detail: { type: "string" } },
      },
    },
    opportunity: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["focus", "why"],
        properties: { focus: { type: "string" }, why: { type: "string" } },
      },
    },
    evolutionPrompt: { type: "string" },   // one gentle line for "Has your vision evolved?"
  },
};

async function growthReflection(payload: any, apiKey: string) {
  const f = payload?.family || {};
  const c = payload?.child || {};
  const s = payload?.summary || {};
  const acronym = Array.isArray(f.acronym) ? f.acronym.map((a: any) => `${a.letter}=${a.meaning}`).join(", ") : "";
  const projects = Array.isArray(s.projects) ? s.projects : [];
  const projLines = projects.map((p: any) =>
    `  • "${p.title}" [${p.status || "active"}]${(p.domains || []).length ? ` — ${(p.domains).join(", ")}` : ""}${p.passion ? `; sparked by ${p.passion}` : ""}`).join("\n") || "  (no projects this period)";
  const reflectionSnips = Array.isArray(s.reflectionSnippets) && s.reflectionSnippets.length
    ? s.reflectionSnippets.map((r: string) => `  • "${r}"`).join("\n") : "  (none recorded)";
  const pn = s.parentNotes || {};
  const parentNoteLines = ["strengths", "challenges", "growthObserved", "concerns", "goalsNextTerm"]
    .map(k => pn[k] ? `  • ${k}: ${pn[k]}` : "").filter(Boolean).join("\n") || "  (none)";

  const system = `TASK: Write the heart of a family's QUARTERLY GROWTH REFLECTION for one child. North Star's
defining principle: we NEVER measure a child against other children, grade levels or generic standards — we
reflect their growth ONLY against the family THIS family is intentionally becoming (their Family Vision,
Core Word and its meanings, and Family Credo). Ground every observation in those words and in the child's
ACTUAL work this quarter (the projects, milestones and reflections below). Warm, specific, honest, never
flattering or generic. Celebrate WHO the child is becoming, not just what they completed.

Return:
- "reflection": 3–5 short narrative observations (1–3 sentences each) reflecting the quarter against the
  family's vision/values. Name the value, then the evidence. E.g. "Curiosity — one of the threads in your
  vision — showed up again and again: in the bird study, in the questions logged in reflections…". Tie to
  the family's actual Core Word meanings and Credo wherever the evidence supports it. Honest about what
  was light, never deficit-framed.
- "coreWordLived": which of the family's CORE WORD qualities (each letter's meaning, listed above) THIS
  child GENUINELY lived this quarter — its letter, the quality exactly as written, and ONE concrete
  sentence of evidence naming the specific project/action. SINCERITY RULE: include a quality ONLY with
  clear, specific evidence; it's far better to return an EMPTY list than to force a connection — families
  instantly sense an insincere one. The evidence must be a real observed action, never a restatement of
  the quality. At most 4, strongest only. Empty list is a perfectly good answer.
- "strengths": 2–4 PATTERNS (not isolated wins) that show the family's vision becoming real, each a
  {title, detail}. Detail cites concrete evidence from the quarter.
- "opportunity": ONE or TWO meaningful growth areas for next quarter, each {focus, why}. "why" must connect
  back to the Family Vision, Core Word or Credo — growth in service of who they're becoming, never catch-up.
- "evolutionPrompt": ONE gentle sentence inviting the family to consider whether their Vision, Core Word or
  Credo has evolved this quarter — acknowledging healthy families grow, never implying earlier answers were wrong.`;

  const userText = `FAMILY (the lens for everything below)
- Family Vision (who they are becoming): ${f.mission || "—"}
- Core Word: ${f.coreWord || "—"}${acronym ? ` (${acronym})` : ""}
- Family Credo: ${f.motto || "—"}
- Values (from deeper vision): ${f.vision?.values || "—"}

CHILD
- Name: ${c.name || "—"}, Age: ${c.age ?? "—"}

THIS QUARTER (${s.periodLabel || "the period"})
- Projects:
${projLines}
- Milestones completed: ${s.milestonesCompleted ?? 0} (${s.onTime ?? 0} on time, ${s.late ?? 0} late)
- Reflections written: ${s.reflectionCount ?? 0}
- Reflection snippets:
${reflectionSnips}
- Most active capability areas: ${(s.topDomains || []).join(", ") || "—"}
- Parent's observations:
${parentNoteLines}
${s.previousSummary ? `\nLAST REPORT (for continuity): ${s.previousSummary}` : ""}

Write ${c.name || "this child"}'s reflection against THIS family's vision.`;
  return callClaude(system, userText, REFLECTION_SCHEMA, apiKey);
}

// ---- Action: coreword-living (which Core Word qualities were genuinely lived) ----
const COREWORD_LIVING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["connections"],
  properties: {
    connections: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["letter", "quality", "evidence"],
        properties: { letter: { type: "string" }, quality: { type: "string" }, evidence: { type: "string" } },
      },
    },
  },
};

async function coreWordLiving(payload: any, apiKey: string) {
  const f = payload?.family || {};
  const s = payload?.summary || {};
  const acronym = Array.isArray(f.acronym) ? f.acronym.filter((a: any) => a.meaning) : [];
  if (!f.coreWord || !acronym.length) return { parsed: { connections: [] }, usage: null };

  const meanings = acronym.map((a: any) => `${a.letter} = ${a.meaning}`).join("\n");
  const projects = Array.isArray(s.projects) ? s.projects : [];
  const projLines = projects.map((p: any) =>
    `  • ${p.childName || "A child"}: "${p.title}" [${p.status}]${(p.capabilities || []).length ? ` — built: ${(p.capabilities).join(", ")}` : ""}${(p.domains || []).length ? `; areas: ${(p.domains).join(", ")}` : ""}${p.passion ? `; sparked by ${p.passion}` : ""}`).join("\n");
  const refl = (s.reflectionSnippets || []).map((r: string) => `  • "${r}"`).join("\n");

  const system = `This family's Core Word is "${f.coreWord}". Each letter stands for a quality they are
intentionally growing in their children:
${meanings}

TASK: From the children's ACTUAL recent work below, identify ONLY the qualities that were GENUINELY and
specifically demonstrated. For each, return its letter, the quality (exactly as written above), and ONE
short, warm, concrete sentence of evidence that names the child and the specific project or action.

SINCERITY IS EVERYTHING — families instantly sense a forced or generic connection, and a false one does
real damage to their trust. Rules:
- Include a quality ONLY when there is clear, specific evidence in the work below. When in doubt, leave it out.
- It is far better to return FEW connections — or an EMPTY list — than to manufacture one.
- Never generalise ("they showed growth"). Cite the real, observable thing the child did.
- The evidence must be an action/outcome, never just a restatement of the quality.
- Return at most 3 connections — only the strongest, most clearly evidenced.
If nothing clearly qualifies, return an empty "connections" list. That is a perfectly good answer.`;

  const userText = `RECENT WORK
${projLines || "  (no recent projects)"}
${refl ? `\nRECENT REFLECTIONS\n${refl}` : ""}

Which Core Word qualities were genuinely brought to life — and only those?`;
  return callClaude(system, userText, COREWORD_LIVING_SCHEMA, apiKey);
}

// ---- Action: mentor-turn (a conversational turn with an AI mentor) ----------
// One turn of a child ↔ mentor conversation. The mentor persona + pedagogy come
// from the client's mentor registry; the child context personalises it. This is
// the Phase-1 proof of the "one world, many mentors" pattern (Polaris / maths).
const MENTOR_REPLY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "suggestions", "whiteboard"],
  properties: {
    reply: { type: "string" },                              // the mentor's short, in-character message
    suggestions: { type: "array", items: { type: "string" } }, // 0–3 short things the child could tap to say next
    // An OPTIONAL visual the app animates on a whiteboard so the child SEES the idea.
    // type "none" = no picture this turn. All fields always present (unused ones
    // are 0 / "none" / []). The frontend reads only the fields for the chosen type.
    whiteboard: {
      type: "object",
      additionalProperties: false,
      required: ["type", "caption", "shape", "parts", "shaded", "rows", "cols", "groups", "perGroup", "from", "to", "jumps"],
      properties: {
        type: { type: "string", enum: ["none", "fraction", "numberline", "array", "groups"] },
        caption: { type: "string" },                        // one short sentence describing the picture
        shape: { type: "string", enum: ["circle", "bar", "none"] }, // fraction only
        parts: { type: "integer" },                         // fraction: total parts
        shaded: { type: "integer" },                        // fraction: highlighted parts
        rows: { type: "integer" },                          // array: rows
        cols: { type: "integer" },                          // array: columns
        groups: { type: "integer" },                        // groups: number of groups
        perGroup: { type: "integer" },                      // groups: items per group
        from: { type: "integer" },                          // numberline: start
        to: { type: "integer" },                            // numberline: end
        jumps: {                                            // numberline: hops to draw
          type: "array",
          items: {
            type: "object", additionalProperties: false,
            required: ["start", "end", "label"],
            properties: { start: { type: "integer" }, end: { type: "integer" }, label: { type: "string" } },
          },
        },
      },
    },
  },
};

async function mentorTurn(payload: any, apiKey: string) {
  const m = payload?.mentor || {};
  const c = payload?.child || {};
  const history = Array.isArray(payload?.history) ? payload.history : [];
  const message = (payload?.message || "").toString().trim();
  if (!message) throw new Error("No message to respond to.");

  const interests = (c.passions || []).join(", ") || "not sure yet";
  const system = `${m.persona || "You are a warm, patient mentor inside North Star."}

You are speaking for the Capability Domain(s): ${(m.domains || []).join(", ") || "—"}.

${m.pedagogy || ""}

THE CHILD you are talking with:
- Name: ${c.name || "the child"}
- Age: ${c.age ?? "unknown"}
- Loves / is interested in: ${interests}
- Learning style (1 = open-ended & child-led, 10 = structured & academic): ${c.learningStyle ?? 5}

OUTPUT: Return JSON with:
- "reply": your next message to ${c.name || "the child"} — in character, short (2–4 sentences), warm.
- "suggestions": 0 to 3 VERY short things the child might tap to reply (a few words each), or an empty list. Write them in the CHILD's voice (e.g. "I'm stuck", "Show me an example").
- "whiteboard": an OPTIONAL picture the app draws so the child can SEE the idea. Set "type" to "none" when no picture helps this turn. Otherwise pick the ONE that fits:
  • "fraction" — parts of a whole. Set "shape" ("circle" like a pizza, or "bar"), "parts" (total, ≤ 12) and "shaded" (how many are highlighted). Example: two-eighths → shape "circle", parts 8, shaded 2.
  • "numberline" — counting, adding, subtracting or skip-counting. Set "from" and "to" (keep the span ≤ 20) and "jumps": [{start, end, label}] (label like "+2" or "×3").
  • "array" — multiplication as a grid of dots. Set "rows" and "cols" (each ≤ 10).
  • "groups" — sharing / division. Set "groups" and "perGroup" (each ≤ 10).
  ALWAYS include every field — put 0 / "none" / [] in the ones your chosen type doesn't use. Keep "caption" to ONE short sentence describing the picture. Reach for a whiteboard whenever seeing it would genuinely help (fractions, times tables, sharing, number sense); otherwise "none". When you DO show a picture, let your "reply" refer to it ("Look at the pizza below…").

Stay in character. Never break the fourth wall or mention that you are an AI, a model, or JSON.`;

  // Build the running conversation. history items: { role: "child"|"mentor", text }
  const messages = history
    .filter((t: any) => t && t.text)
    .map((t: any) => ({
      role: t.role === "mentor" ? "assistant" : "user",
      content: t.role === "mentor" ? JSON.stringify({ reply: t.text, suggestions: [] }) : t.text,
    }));
  messages.push({ role: "user", content: message });

  return callClaudeChat(system, messages, MENTOR_REPLY_SCHEMA, apiKey);
}

// ---- Printable worksheet generation ------------------------------------
// Produces a genuinely usable, ready-to-print worksheet tailored to one child
// (age, learning style, interests, capability domains) — not a description of one.
const PRINTABLE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "subtitle", "parentNote", "materials", "sections"],
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    parentNote: { type: "string" },
    materials: { type: "array", items: { type: "string" } },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["heading", "instructions", "items", "writingLines"],
        properties: {
          heading: { type: "string" },
          instructions: { type: "string" },
          items: { type: "array", items: { type: "string" } },
          writingLines: { type: "integer" },
        },
      },
    },
    extension: { type: "string" },
  },
};

async function generatePrintable(payload: any, apiKey: string) {
  const c = payload.child || {};
  const pr = payload.printable || {};
  const system = `You create a SINGLE, ready-to-print worksheet or activity sheet a homeschooling parent hands to their child. It must be genuinely usable when printed — real questions, prompts, problems or step-by-step activities, never a description of a worksheet.

Tailor everything to THIS child:
- Name: ${c.name || "the child"}
- Age: ${c.age ?? "unknown"}
- Learning style (1 = Explorer/unschooling, open-ended & child-led; 10 = Traditional academic, structured): ${c.learningStyle ?? 5}
- Interests / passions: ${(c.passions || []).join(", ") || "—"}
- Capability domains in focus: ${(c.domains || []).join(", ") || "—"}

Worksheet topic: "${pr.name || "learning activity"}"${pr.description ? ` — ${pr.description}` : ""}.
Target capability domains: ${(pr.domains || []).join(", ") || "general"}.

Rules:
- Match the difficulty and language to the child's age. Weave their interests into the examples where it feels natural, not forced.
- 2 to 4 sections. Each has clear, kid-facing instructions and 4 to 10 concrete items (questions / prompts / tasks).
- writingLines = how many blank answer lines to print beneath a section (0 if the items already leave room, e.g. circle/match/multiple-choice).
- Fits on 1–2 printed pages.
- parentNote: one or two sentences on how to use it and what capability it builds.
- Plain text only — no markdown symbols, no emoji.`;
  const { parsed, usage } = await callClaude(system, `Create the worksheet now for ${c.name || "the child"}.`, PRINTABLE_SCHEMA, apiKey);
  return { parsed, usage };
}

/* ============================================================
   quickstart-extract — the engine behind the 5-minute onboarding.
   Turns a parent's three casual (often voice-transcribed) answers into
   a clean, structured starting point: family values, each child's
   profile, and a rich project seed. Accuracy on names/ages matters most.
   ============================================================ */
const QUICKSTART_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["family", "children", "project", "understood"],
  properties: {
    family: {
      type: "object",
      additionalProperties: false,
      required: ["values", "passions"],
      properties: {
        familyName: { type: "string" },
        values: { type: "array", items: { type: "string" } },
        passions: { type: "array", items: { type: "string" } },
        suggestedCoreWord: { type: "string" },
      },
    },
    children: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "age", "passions", "strengths", "learningStyle", "howTheyLearn"],
        properties: {
          name: { type: "string" },
          age: { type: ["integer", "null"] },
          passions: { type: "array", items: { type: "string" } },
          strengths: { type: "array", items: { type: "string" } },
          learningStyle: { type: "integer" },
          howTheyLearn: { type: "string" },
        },
      },
    },
    project: {
      type: "object",
      additionalProperties: false,
      required: ["forChildName", "idea"],
      properties: {
        forChildName: { type: "string" },
        idea: { type: "string" },
        title: { type: "string" },
      },
    },
    understood: { type: "string" },
  },
};

async function quickstartExtract(payload: any, apiKey: string) {
  const familyText = (payload?.family || "").toString().slice(0, 4000);
  const kidsText = (payload?.kids || "").toString().slice(0, 4000);
  const dreamText = (payload?.dream || "").toString().slice(0, 4000);
  // "just talk" path: one free-form blob covering everything at once.
  const freeform = (payload?.freeform || "").toString().slice(0, 6000);
  const system = `You are turning a parent's casual, often voice-transcribed answers into a clean, structured starting point for North Star. The answers may be messy, rambling, spoken aloud, or contain filler words — read for MEANING, not literal phrasing.

You receive three answers:
1. ABOUT THE FAMILY — their values, what matters to them, shared passions/interests.
2. ABOUT THE KIDS — names, ages, passions, and how each one learns best.
3. A DREAM PROJECT the parent would love to see come to life for their child(ren).

Extract:
- family.values: 2–5 short character/value words the family clearly cares about (infer sensibly from what they say; never invent values they didn't imply).
- family.passions: shared family interests or activities they mention.
- family.familyName: ONLY if they actually state a surname / family name; otherwise omit the field entirely.
- family.suggestedCoreWord: OPTIONAL — a single evocative word that could anchor this family's identity, ONLY if one is strongly implied. Otherwise omit. Never force it.
- children[]: one object per child mentioned.
    • name: EXACTLY as written (you may fix capitalisation, never guess a different name).
    • age: an integer if stated or clearly implied; otherwise null.
    • passions / strengths: short items drawn from what they said.
    • learningStyle: an integer 1–10 for how they learn, where 1 = fully child-led / unschooling / hands-on & exploratory, 5 = balanced, 10 = highly structured / traditional-academic. Map from their description; if genuinely unclear, use 5.
    • howTheyLearn: ONE short, warm, human sentence a parent would nod at (this is shown back to them).
- project.forChildName: which child the dream project is for — match one of the children's names; if unspecified, use the first/eldest child.
- project.idea: distil the dream into a rich 1–3 sentence brief a project generator can build from. PRESERVE the parent's specific words and excitement — this is the spark, not a summary.
- project.title: OPTIONAL short, friendly working title.
- understood: ONE warm second-person sentence mirroring back what you heard about this family ("You're a family that…"), shown on the reveal screen.

Accuracy on NAMES and AGES matters most — a project addressed to the wrong child breaks trust instantly. Everything else can be a sensible best guess grounded in what they actually said. If an answer was skipped, do your best with the others and keep arrays small rather than inventing.`;
  const userText = freeform
    ? `The parent described everything in their own words — this single free-form answer covers their family, their kids, and a dream project all together. Read it all and extract the structured pieces:\n\n${freeform}`
    : `ABOUT THE FAMILY:\n${familyText || "(skipped)"}\n\nABOUT THE KIDS:\n${kidsText || "(skipped)"}\n\nDREAM PROJECT:\n${dreamText || "(skipped)"}`;
  const { parsed, usage } = await callClaude(system, userText, QUICKSTART_SCHEMA, apiKey);
  return { parsed, usage };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "AI is not configured (missing ANTHROPIC_API_KEY)." }, 500);

  try {
    const { action, payload } = await req.json();

    // ---- Authorization + abuse control (server-side; never trust the client) ----
    const caller = await resolveCaller(req);
    if (!isActiveMember(caller)) return json({ error: "Not an active member of a family." }, 403);
    if (await recentCount("ai_call", { identifier: caller!.familyId }, AI_WINDOW_SECS) >= AI_CALLS_PER_WINDOW) {
      await logSecurityEvent("ai_abuse_throttled", { identifier: caller!.familyId, meta: { action } });
      return json({ error: "Too many requests — please wait a moment and try again." }, 429);
    }
    await logSecurityEvent("ai_call", { identifier: caller!.familyId, meta: { action } });
    if (GENERATIVE_ACTIONS.has(action) && !hasPermission(caller, "contrib:generate")) {
      return json({ error: "You don't have permission to generate here." }, 403);
    }
    if (REPORT_ACTIONS.has(action) && !hasPermission(caller, "contrib:generate") && !hasPermission(caller, "contrib:reports")) {
      return json({ error: "You don't have permission to request reports here." }, 403);
    }

    let result;
    if (action === "suggest-core-word") result = await suggestCoreWord(payload, apiKey);
    else if (action === "suggest-vision") result = await suggestVision(payload, apiKey);
    else if (action === "tidy-text") result = await tidyText(payload, apiKey);
    else if (action === "suggest-focus") result = await suggestFocus(payload, apiKey);
    else if (action === "generate-project") result = await generateProject(payload, apiKey);
    else if (action === "growth-reflection") result = await growthReflection(payload, apiKey);
    else if (action === "coreword-living") result = await coreWordLiving(payload, apiKey);
    else if (action === "mentor-turn") result = await mentorTurn(payload, apiKey);
    else if (action === "generate-printable") result = await generatePrintable(payload, apiKey);
    else if (action === "quickstart-extract") result = await quickstartExtract(payload, apiKey);
    else return json({ error: `Unknown action: ${action}` }, 400);

    console.log(`[ai] ${action} usage:`, JSON.stringify(result.usage));
    return json({ data: result.parsed, usage: result.usage });
  } catch (e) {
    console.error("[ai] error:", e);
    return json({ error: (e as Error).message || "AI request failed" }, 500);
  }
});

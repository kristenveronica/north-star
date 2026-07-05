/* ============================================================
   seed.js — Sample data so the MVP demonstrates the full flow.
   Includes Noah (12) and Jett (4) per spec.
   ============================================================ */

import { getState, update, uid } from "./store.js";

/* ============================================================
   Capability Domains — the central intelligence layer of North Star.

   North Star does not organise learning into school subjects. It
   intentionally cultivates human capability. Every project strengthens
   one or more Capability Domains; every domain shapes the child into a
   capable adult. This catalogue is the single source of truth that
   powers project generation, reflection reports, capability
   visualisations and long-term growth tracking.

   Ten Foundation domains always exist. Optional domains (Faith, Travel)
   appear only when the family enables them (gated by `requiresFlag`).
   Each domain carries the skills it develops, used both as UI chips and
   as the vocabulary the AI maps projects against.
   ============================================================ */
export const CAPABILITY_DOMAINS = [
  {
    id: "literacy", name: "Literacy & Communication", short: "Literacy",
    description: "Reading, writing, speaking and thinking clearly about the world.",
    color: "plum", optional: false,
    subSkills: ["reading", "writing", "storytelling", "public speaking", "listening", "research", "critical thinking", "media literacy"],
  },
  {
    id: "maths", name: "Mathematics & Logical Thinking", short: "Maths",
    description: "Numbers, reasoning, patterns and solving problems.",
    color: "sky", optional: false,
    subSkills: ["mathematics", "problem solving", "logical reasoning", "pattern recognition", "data interpretation", "systems thinking"],
  },
  {
    id: "science", name: "Science, Discovery & Understanding the World", short: "Science",
    description: "How the world works, how things are made, and the joy of finding out.",
    color: "sage", optional: false,
    subSkills: ["science", "engineering", "how things work", "how things are made", "experimentation", "curiosity", "observation", "innovation"],
  },
  {
    id: "creativity", name: "Creativity & Design", short: "Creativity",
    description: "Making, designing and creative expression.",
    color: "coral", optional: false,
    subSkills: ["art", "design", "creative expression", "photography", "film", "making", "craftsmanship"],
  },
  {
    id: "music", name: "Music & Performing Arts", short: "Music & Arts",
    description: "Music, performance and the confidence to take the stage — supporting whatever pathway the child already follows.",
    color: "plum", optional: false,
    subSkills: ["music", "instrument learning", "singing", "choir", "performance", "drama", "dance", "composition", "music theory", "performance confidence"],
  },
  {
    id: "digital", name: "Digital Capability", short: "Digital",
    description: "Developing digitally capable young adults — the goal is capability, not teaching software. Evolves as technology evolves.",
    color: "sky", optional: false,
    subSkills: ["typing", "digital literacy", "online research", "AI & prompt writing", "coding", "website & app creation", "video editing", "graphic design", "animation", "podcasting", "cyber safety", "digital ethics", "responsible AI use", "content creation", "digital entrepreneurship"],
  },
  {
    id: "practical", name: "Practical Life", short: "Practical Life",
    description: "The real skills of running a life and a home.",
    color: "gold", optional: false,
    subSkills: ["cooking", "cleaning", "organisation", "repairs", "gardening", "home management", "self-care", "independence", "daily living skills"],
  },
  {
    id: "enterprise", name: "Entrepreneurship & Financial Capability", short: "Enterprise",
    description: "Creating value, managing money and leading through enterprise.",
    color: "gold", optional: false,
    subSkills: ["money management", "business creation", "sales", "marketing", "negotiation", "value creation", "investing", "budgeting", "customer service", "leadership through enterprise"],
  },
  {
    id: "health", name: "Health & Wellbeing", short: "Health",
    description: "Caring for body, mind and emotions.",
    color: "coral", optional: false,
    subSkills: ["nutrition", "movement", "exercise", "sleep", "personal hygiene", "mental wellbeing", "emotional regulation", "body awareness", "healthy cooking", "natural remedies"],
  },
  {
    id: "sport", name: "Sport, Movement & Physical Capability", short: "Sport",
    description: "Physical capability through sport and movement — North Star complements existing coaching and training, never replaces it.",
    color: "sage", optional: false,
    subSkills: ["team sports", "individual sports", "strength", "mobility", "flexibility", "coordination", "balance", "swimming", "cycling", "skiing", "martial arts", "dance", "outdoor adventure", "fitness", "sportsmanship", "goal setting", "resilience", "leadership through sport"],
  },
  {
    id: "relationships", name: "Relationships & Emotional Intelligence", short: "Relationships",
    description: "Connecting, collaborating and navigating emotions.",
    color: "plum", optional: false,
    subSkills: ["communication", "conflict resolution", "empathy", "collaboration", "boundaries", "compromise", "friendship", "family relationships", "social confidence"],
  },
  {
    id: "leadership", name: "Leadership & Contribution", short: "Leadership",
    description: "Initiative, responsibility and serving others.",
    color: "sky", optional: false,
    subSkills: ["leadership", "initiative", "responsibility", "service", "mentoring", "community contribution", "project ownership", "decision making"],
  },
  {
    id: "nature", name: "Nature & Environmental Stewardship", short: "Nature",
    description: "Caring for the natural world and learning to live self-sufficiently.",
    color: "sage", optional: false,
    subSkills: ["natural systems", "gardening", "food production", "sustainability", "outdoor skills", "ecology", "environmental responsibility", "self-sufficiency"],
  },
  /* ---- Optional domains: appear only when the family enables them ---- */
  {
    id: "faith", name: "Faith", short: "Faith",
    description: "Spiritual formation, adapted to your family's tradition.",
    color: "plum", optional: true, requiresFlag: "faithEnabled",
    subSkills: ["scripture", "prayer", "reflection", "service", "church life", "mission opportunities", "acts of kindness", "faith discussions"],
  },
  {
    id: "travel", name: "Travel", short: "Travel",
    description: "The capability to navigate and understand the world — not tourism.",
    color: "sky", optional: true, requiresFlag: "travelEnabled",
    subSkills: ["researching destinations", "planning itineraries", "budgeting", "booking accommodation", "comparing flights", "reading maps", "navigating airports", "using public transport", "local customs", "basic language phrases", "currencies", "cultural immersion", "world geography"],
  },
];

/* Backward-compatible alias. The platform historically called these "Learning
   Domains" / "Gigs" (DOMAIN_CATALOG); they are now Capability Domains. Existing
   imports of DOMAIN_CATALOG keep working — same array, same shape. */
export const DOMAIN_CATALOG = CAPABILITY_DOMAINS;

/* Legacy gig ids → nearest Capability Domain, so projects/children saved under
   the old 7-gig model still render and map sensibly with no data migration. */
export const LEGACY_DOMAIN_MAP = {
  brain: "literacy",
  build: "creativity",
  money: "enterprise",
  house: "practical",
  community: "leadership",
  body: "health",
  faith: "faith", // unchanged
};

const _DOMAIN_BY_ID = Object.fromEntries(CAPABILITY_DOMAINS.map(d => [d.id, d]));

/** Map any stored domain id (new or legacy) to a current Capability Domain id. */
export function normalizeDomainId(id) {
  if (!id) return id;
  if (_DOMAIN_BY_ID[id]) return id;
  return LEGACY_DOMAIN_MAP[id] || id;
}

/** Look up a Capability Domain by id, tolerating legacy ids. */
export function domainById(id) {
  return _DOMAIN_BY_ID[normalizeDomainId(id)] || null;
}

/** Display name for a domain id (legacy-tolerant). */
export function domainDisplayName(id) {
  return domainById(id)?.name || id;
}

/** Short label for a domain id (legacy-tolerant). */
export function domainShort(id) {
  return domainById(id)?.short || id;
}

/** Is an (optional) Capability Domain enabled for this family? Foundation
    domains are always on. Faith follows the faith toggle; Travel becomes
    available when the family sets a travel toggle OR turns on Worldschool. */
export function isDomainEnabled(domain, family) {
  const fam = family || {};
  if (!domain.optional) return true;
  if (domain.id === "faith") return !!fam.faithEnabled;
  if (domain.id === "travel") {
    return !!fam.travelEnabled || !!(fam.travel && fam.travel.mode && fam.travel.mode !== "off");
  }
  return !!fam[domain.requiresFlag];
}

/** The Capability Domains available to a given family — all Foundation domains
    plus any optional domain the family has enabled (faith, travel). */
export function availableDomains(family) {
  return CAPABILITY_DOMAINS.filter(d => isDomainEnabled(d, family));
}

/* ---------- Reflection prompt bank ---------- */
export const REFLECTION_PROMPTS = [
  "What did I do?",
  "What did I learn?",
  "What was hard?",
  "What surprised me?",
  "What would I do differently next time?",
  "What am I proud of?",
  "How did this help me grow?",
];

/* ---------- Seeder ---------- */
export function seedIfEmpty() {
  const s = getState();
  if (s.family) return; // already seeded or set up

  update(state => {
    state.domains = DOMAIN_CATALOG;

    state.family = {
      id: uid("fam"),
      parentName: "Kristen",
      familyName: "The Rae / Ivany Family",
      mission: "We are nurturing brave, curious, capable humans who learn through real life and contribute generously to the world.",
      motto: "Be brave. Be curious. Be useful.",
      // Core word is intentionally NOT seeded — it's the payoff the family
      // generates at the end of the exercise, so they feel its power in the
      // moment rather than meeting a placeholder.
      coreWord: "",
      acronym: [],
      desiredOutcomes: [
        "Confident communicators",
        "Independent thinkers",
        "Generous contributors",
        "Creators and builders, not just consumers",
        "Resilient and adventurous",
      ],
      faithEnabled: false,
      faithTradition: "",
      learningStyleDefault: 5,
      diyMaterialsPreference: 6,
      vision: {
        adultsHoping: "Curious adults who create, lead and love their lives.",
        values: "Bravery, curiosity, generosity, integrity, craftsmanship.",
        successLooksLike: "They can think, communicate, build, earn, and contribute meaningfully — and they enjoy learning.",
        skills: "Critical thinking, communication, real-world problem solving, financial literacy, practical life skills.",
        qualities: "Brave, kind, persistent, observant, useful.",
        capableByEighteen: "Run a small business, manage their money, communicate clearly, cook real meals, serve others, learn anything they need to.",
        roles: "Faith optional; service essential; entrepreneurship encouraged; creativity central; academics solid; life skills daily; community woven in.",
      },
      createdAt: new Date().toISOString(),
    };

    state.meta.onboarded = true;

    /* ---------- Noah ---------- */
    const noah = {
      id: uid("child"),
      familyId: state.family.id,
      name: "Noah",
      age: 12,
      birthday: "2013-09-14",
      grade: "Year 7",
      passions: ["skiing", "formula 1", "scootering", "biking", "business", "AI", "storytelling", "ancient history"],
      strengths: ["fast learner", "loves a challenge", "competitive", "great with people"],
      supportNeeds: ["sitting still for long writing tasks", "spelling"],
      goals: ["start his own mini business", "improve writing", "learn more about ancient civilisations"],
      faithEnabled: false,
      faithTradition: "",
      notes: "Best learning happens when something feels real and the stakes matter. Loves video, loves a deadline.",
      avatarIndex: 1,
      accessCode: "NOAH12",
      learningStyle: 6,
      diyMaterials: 5,
      domains: ["literacy", "creativity", "enterprise", "leadership", "health"],
      createdAt: new Date().toISOString(),
    };
    state.children.push(noah);

    /* ---------- Jett ---------- */
    const jett = {
      id: uid("child"),
      familyId: state.family.id,
      name: "Jett",
      age: 4,
      birthday: "2021-04-02",
      grade: "Pre-K",
      passions: ["animals", "cars and trucks", "nature", "building", "stories", "puzzles", "colouring", "learning to write"],
      strengths: ["observant", "playful", "loving with animals", "great fine-motor"],
      supportNeeds: ["letter formation", "patience with longer tasks"],
      goals: ["recognise all his letters", "build something he is proud of", "help feed the birds every day"],
      faithEnabled: false,
      faithTradition: "",
      notes: "Loves to copy big brother. Learns best by doing, touching, and being outside.",
      avatarIndex: 2,
      accessCode: "JETT04",
      learningStyle: 3,
      diyMaterials: 7,
      domains: ["literacy", "creativity", "practical", "health", "leadership"],
      createdAt: new Date().toISOString(),
    };
    state.children.push(jett);

    /* ---------- Noah's project ---------- */
    const noahProject = {
      id: uid("proj"),
      childId: noah.id,
      title: "Create a Ski Wax Mini Business",
      description: "Research, brand, price and pitch a small ski wax business. Build the whole thing end-to-end and present the idea to the family.",
      domains: ["enterprise", "creativity", "literacy"],
      passionConnection: "skiing + business + AI",
      learningOutcomes: [
        "Compare 3 real products and articulate the difference",
        "Calculate costs, margins and a starting price",
        "Design a brand identity (name, logo, poster)",
        "Communicate a business idea confidently",
      ],
      materials: ["Notebook", "Markers", "Cardboard for prototype packaging", "Phone for research and filming pitch"],
      startDate: daysFromNow(-7).toISOString(),
      dueDate: daysFromNow(21).toISOString(),
      momentumPointsAvailable: 120,
      momentumPointsEarned: 40,
      starsAvailable: 6,
      starsEarned: 2,
      reward: "Extra ski day with Dad + $20 toward the real first batch of wax",
      toll: "Finish unfinished milestones before unlocking next optional project (no screens after 6pm until done)",
      childAgreed: true,
      parentApproved: true,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    state.projects.push(noahProject);

    const noahMilestones = [
      { title: "Research 3 ski wax brands", points: 15, dueOffset: -2, completed: true },
      { title: "Calculate costs and starting price", points: 20, dueOffset: 2, completed: true },
      { title: "Create a product name and brand", points: 20, dueOffset: 6 },
      { title: "Design a sales poster", points: 20, dueOffset: 10 },
      { title: "Present the business idea to the family", points: 25, dueOffset: 16, reflectionRequired: true },
      { title: "Complete final reflection", points: 20, dueOffset: 21, reflectionRequired: true },
    ];
    noahMilestones.forEach((m, i) => {
      state.milestones.push({
        id: uid("mile"),
        projectId: noahProject.id,
        title: m.title,
        description: "",
        dueDate: daysFromNow(m.dueOffset).toISOString(),
        momentumPoints: m.points,
        completed: !!m.completed,
        completedAt: m.completed ? daysFromNow(m.dueOffset).toISOString() : null,
        starEarned: !!m.completed,
        reflectionRequired: !!m.reflectionRequired,
        order: i,
      });
    });

    /* ---------- Jett's project ---------- */
    const jettProject = {
      id: uid("proj"),
      childId: jett.id,
      title: "Create a Backyard Bird Sanctuary",
      description: "Discover the birds in our backyard, build a bird feeder, draw the visitors and care for them each day.",
      domains: ["literacy", "creativity", "practical", "leadership", "health"],
      passionConnection: "animals + nature + building",
      learningOutcomes: [
        "Identify 3 local bird species",
        "Build a simple bird feeder with help",
        "Practise letter formation by labelling pictures",
        "Care for something daily (responsibility)",
      ],
      materials: ["Toilet roll tubes", "Peanut butter", "Bird seed", "String", "Crayons + drawing paper", "Picture bird book"],
      startDate: daysFromNow(-4).toISOString(),
      dueDate: daysFromNow(18).toISOString(),
      momentumPointsAvailable: 80,
      momentumPointsEarned: 25,
      starsAvailable: 5,
      starsEarned: 1,
      reward: "Family trip to the wildlife park + choose Saturday's dinner",
      toll: "Feed the birds every morning until project is finished",
      childAgreed: true,
      parentApproved: true,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    state.projects.push(jettProject);

    const jettMilestones = [
      { title: "Spot and name 3 birds in the garden", points: 15, dueOffset: -1, completed: true },
      { title: "Make a bird feeder with Mum", points: 20, dueOffset: 3 },
      { title: "Draw your favourite bird and label it", points: 15, dueOffset: 7 },
      { title: "Feed the birds for 5 days in a row", points: 15, dueOffset: 14 },
      { title: "Show the family your sanctuary", points: 15, dueOffset: 18, reflectionRequired: true },
    ];
    jettMilestones.forEach((m, i) => {
      state.milestones.push({
        id: uid("mile"),
        projectId: jettProject.id,
        title: m.title,
        description: "",
        dueDate: daysFromNow(m.dueOffset).toISOString(),
        momentumPoints: m.points,
        completed: !!m.completed,
        completedAt: m.completed ? daysFromNow(m.dueOffset).toISOString() : null,
        starEarned: !!m.completed,
        reflectionRequired: !!m.reflectionRequired,
        order: i,
      });
    });

    /* ---------- Seed reflections (one each) ---------- */
    state.reflections.push({
      id: uid("refl"),
      childId: noah.id,
      projectId: noahProject.id,
      milestoneId: null,
      prompt: "What surprised me?",
      response: "How much the wax actually costs to make compared to the shop price. The margin is huge.",
      createdAt: daysFromNow(-1).toISOString(),
    });

    /* ---------- Seed materials ---------- */
    const seedMats = [
      {
        name: "Cashflow for Kids (board game)", category: "Money Game",
        description: "Robert Kiyosaki's family money game — assets vs liabilities.",
        reasonSuggested: "Matches Noah's Enterprise capability + business interest at learning style 6.",
        ageRange: "8–14", buyOrDIY: "buy", estimatedPrice: 55, forChildId: noah.id,
      },
      {
        name: "Marker + cardboard prototype kit", category: "Build Materials",
        description: "Cardboard sheets, sharpies and craft tape for product mockups.",
        reasonSuggested: "Needed for ski wax packaging milestone. DIY-friendly.",
        ageRange: "All ages", buyOrDIY: "DIY", estimatedPrice: 12, forChildId: noah.id,
      },
      {
        name: "Ancient civilisations encyclopedia (DK)", category: "Reading",
        description: "Visual encyclopedia of ancient cultures.",
        reasonSuggested: "Matches Noah's ancient history passion.",
        ageRange: "9–14", buyOrDIY: "buy", estimatedPrice: 28, forChildId: noah.id,
      },
      {
        name: "DIY sandpaper letters", category: "Montessori",
        description: "Make sandpaper letters at home with cardboard, sandpaper & glue.",
        reasonSuggested: "Jett is learning to write — DIY preferred (his slider is high).",
        ageRange: "3–6", buyOrDIY: "DIY", estimatedPrice: 8, forChildId: jett.id,
      },
      {
        name: "Toilet-roll bird feeder kit", category: "Nature / Build",
        description: "Use a toilet roll, peanut butter and seeds to make a simple feeder.",
        reasonSuggested: "Core build milestone for Jett's Bird Sanctuary project.",
        ageRange: "3–6", buyOrDIY: "DIY", estimatedPrice: 5, forChildId: jett.id,
      },
      {
        name: "First Field Guide to Australian Birds", category: "Reading / Nature",
        description: "Beautifully illustrated, simple text for emerging readers.",
        reasonSuggested: "Matches Jett's animal passion + identifies sanctuary visitors.",
        ageRange: "3–8", buyOrDIY: "buy", estimatedPrice: 18, forChildId: jett.id,
      },
      {
        name: "Loose parts play basket", category: "Open-ended Play",
        description: "Stones, shells, wood, fabric, jar lids — for child-led creativity.",
        reasonSuggested: "Strong fit at learning style 3 (Guided Explorer).",
        ageRange: "3–8", buyOrDIY: "DIY", estimatedPrice: 0, forChildId: jett.id,
      },
      {
        name: "Hands-on maths game set", category: "Maths Game",
        description: "Dice, counters, number cards for game-based maths.",
        reasonSuggested: "Family slider at 5–6 + Noah likes games over worksheets.",
        ageRange: "5–12", buyOrDIY: "buy", estimatedPrice: 24, forChildId: noah.id,
      },
    ];
    seedMats.forEach(m => {
      state.materials.push({
        id: uid("mat"),
        approved: false,
        rejected: false,
        inCart: false,
        affiliateUrlPlaceholder: "#",
        ...m,
      });
    });

    /* ---------- Seed a couple of notifications ---------- */
    state.notifications.push({
      id: uid("notif"),
      childId: noah.id,
      projectId: noahProject.id,
      milestoneId: null,
      message: "Your next milestone is due in 2 days — Create a product name and brand.",
      dueDate: new Date().toISOString(),
      read: false,
    });
    state.notifications.push({
      id: uid("notif"),
      childId: jett.id,
      projectId: jettProject.id,
      milestoneId: null,
      message: "Make a bird feeder with Mum — due Sunday.",
      dueDate: new Date().toISOString(),
      read: false,
    });

    state.meta.activeChildId = noah.id;
    // (The Learning Guild — incl. sample showcase data — is held out of the MVP in /dev.)
  });
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(17, 0, 0, 0);
  return d;
}

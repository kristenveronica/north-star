/* ============================================================
   suggestions.js — Mock AI engine.
   Pure functions, deterministic-ish. Structured so a real LLM
   call can later replace any of these `suggest*` functions.
   ============================================================ */

import { DOMAIN_CATALOG } from "../seed.js";

/* ---------- Learning style descriptions ---------- */
export const LEARNING_STYLE_LEVELS = [
  { range: [1, 2], label: "Explorer",
    summary: "Very unschooling, interest-led, minimal structure.",
    flavour: "Days unfold around curiosity. The role of the parent is to notice and resource what's already alive in the child.",
    materials: ["nature journals", "open-ended art supplies", "loose parts play", "child-led project kits", "library books", "real-world experiences"],
  },
  { range: [3, 4], label: "Guided Explorer",
    summary: "Mostly child-led, with gentle prompts, projects and reflections.",
    flavour: "Curiosity-led with quiet scaffolding. A few invitations a week; lots of room to follow what sparks.",
    materials: ["project journals", "nature study guides", "story baskets", "hands-on maths games", "practical life skill kits"],
  },
  { range: [5, 6], label: "Project-Based Hybrid",
    summary: "Balanced structure, project-based learning, weekly goals, literacy and numeracy woven in.",
    flavour: "Real projects with real deadlines. Reading + maths threaded through meaningful work.",
    materials: ["family games such as Cashflow", "maths games", "entrepreneurship activities", "project-based unit studies", "hybrid curriculum books", "writing journals", "science kits"],
  },
  { range: [7, 8], label: "Structured Homeschool",
    summary: "Clear lessons, deadlines, curriculum resources, parent-led planning.",
    flavour: "Each day has a plan. Subjects, deadlines, and consistent rhythms.",
    materials: ["subject-specific workbooks", "structured maths curriculum", "writing programs", "history/science curriculum", "planners and assessment checklists"],
  },
  { range: [9, 10], label: "Traditional Academic",
    summary: "State/province-aligned, formal subjects, assessments, textbooks, and lesson books.",
    flavour: "Structured, assessed, curriculum-aligned. Looks closest to a classical school timetable.",
    materials: ["state/province-aligned textbooks", "lesson books", "formal assessments", "grade-level curriculum bundles", "structured timetables"],
  },
];

export function describeLearningStyle(value) {
  return LEARNING_STYLE_LEVELS.find(l => value >= l.range[0] && value <= l.range[1])
    || LEARNING_STYLE_LEVELS[2];
}

// Scale: 1 = make everything (world-is-the-classroom) → 10 = buy everything
// (ready-made curriculum). Runs the same direction as the learning-style scale:
// Explorer/unschooling tends to make; Traditional tends to buy.
export function describeDIY(value) {
  if (value <= 3) return {
    label: "Hands-on maker",
    summary: "Make most things yourself. Cheaper, deeper, takes more time.",
    bias: "diy",
  };
  if (value <= 7) return {
    label: "Balanced",
    summary: "Mix of ready-made + a few DIY projects you'll enjoy making.",
    bias: "mixed",
  };
  return {
    label: "Ready-made",
    summary: "Buy most materials ready-made. Save time, plug-and-play.",
    bias: "buy",
  };
}

/* ---------- Suggested materials catalogue (mock library) ----------
   Each entry has selectors that the engine matches against a child.
   Replace with a real model call later.
*/
const MATERIAL_LIBRARY = [
  // -------- Brain / academics --------
  { name: "Brave Writer journal", category: "Writing", description: "A gentle writing journal with weekly invitations.",
    ageMin: 7, ageMax: 16, styleMin: 3, styleMax: 7, diyBias: "either", buyOrDIY: "buy", price: 22,
    domains: ["brain"], passions: ["storytelling", "writing"] },
  { name: "Beast Academy comic-style maths", category: "Maths", description: "Maths through stories, problem-solving and characters.",
    ageMin: 8, ageMax: 13, styleMin: 5, styleMax: 9, buyOrDIY: "buy", price: 38,
    domains: ["brain"], passions: ["maths"] },
  { name: "DIY copywork notebook", category: "Handwriting",
    description: "Print a few favourite quotes; child copies them daily.",
    ageMin: 5, ageMax: 12, styleMin: 1, styleMax: 8, buyOrDIY: "DIY", price: 0,
    domains: ["brain"] },
  { name: "Story of the World (Vol. 1)", category: "History",
    description: "Narrative ancient history read-aloud.",
    ageMin: 6, ageMax: 12, buyOrDIY: "buy", price: 24,
    domains: ["brain"], passions: ["ancient history", "history", "storytelling"] },

  // -------- Build / create --------
  { name: "Cardboard prototype kit", category: "Build",
    description: "Cardboard sheets, glue gun, sharpies, tape — to build anything.",
    ageMin: 5, ageMax: 16, buyOrDIY: "DIY", price: 15,
    domains: ["build"], passions: ["building", "invention"] },
  { name: "Tinkering Lab science kit", category: "Science / Build",
    description: "20 experiments with everyday materials.",
    ageMin: 6, ageMax: 12, buyOrDIY: "buy", price: 32,
    domains: ["build", "brain"] },
  { name: "Beginner coding with Scratch (free)", category: "Coding",
    description: "MIT Scratch — block coding for kids. Free online.",
    ageMin: 7, ageMax: 14, buyOrDIY: "DIY", price: 0,
    domains: ["build", "brain"], passions: ["AI", "coding", "games"] },

  // -------- Money --------
  { name: "Cashflow for Kids", category: "Money Game",
    description: "Family game teaching assets vs liabilities.",
    ageMin: 6, ageMax: 14, styleMin: 4, buyOrDIY: "buy", price: 55,
    domains: ["money"], passions: ["business", "money"] },
  { name: "Lemonade Stand business kit (DIY)", category: "Mini Business",
    description: "Templates for pricing, signage and tracking sales.",
    ageMin: 6, ageMax: 14, buyOrDIY: "DIY", price: 3,
    domains: ["money", "build"], passions: ["business"] },
  { name: "Three-jar money system", category: "Money System",
    description: "Save / Spend / Give jars to teach budgeting at home.",
    ageMin: 4, ageMax: 14, buyOrDIY: "DIY", price: 3,
    domains: ["money"] },

  // -------- House --------
  { name: "Kids' real-knife cooking set", category: "Cooking",
    description: "Child-safe real knives + cutting board for proper cooking skills.",
    ageMin: 4, ageMax: 12, buyOrDIY: "buy", price: 28,
    domains: ["house"], passions: ["cooking"] },
  { name: "Weekly chore chart (DIY)", category: "Home Skills",
    description: "Print or draw a chore chart together to build daily responsibility.",
    ageMin: 3, ageMax: 16, buyOrDIY: "DIY", price: 0,
    domains: ["house"] },
  { name: "Garden bed starter kit", category: "Gardening",
    description: "Small raised bed, soil, seeds + seasonal planting guide.",
    ageMin: 3, ageMax: 16, buyOrDIY: "buy", price: 45,
    domains: ["house", "community"], passions: ["nature", "animals"] },

  // -------- Community --------
  { name: "Neighbour interview kit (DIY)", category: "Community",
    description: "Print 10 great interview questions + a small notebook.",
    ageMin: 6, ageMax: 14, buyOrDIY: "DIY", price: 2,
    domains: ["community"], passions: ["storytelling"] },
  { name: "Service of the month tracker", category: "Service",
    description: "Track one act of service per family member each month.",
    ageMin: 4, ageMax: 16, buyOrDIY: "DIY", price: 0,
    domains: ["community"] },

  // -------- Body --------
  { name: "Outdoor adventure backpack (DIY)", category: "Outdoor",
    description: "Stock a small pack with first aid, compass, snacks for ready outings.",
    ageMin: 4, ageMax: 14, buyOrDIY: "DIY", price: 12,
    domains: ["body"], passions: ["skiing", "biking", "scootering"] },
  { name: "Yoga / mindfulness deck", category: "Mind-body",
    description: "Card deck with daily kids' yoga and breathing prompts.",
    ageMin: 3, ageMax: 12, buyOrDIY: "buy", price: 16,
    domains: ["body"] },

  // -------- Montessori / early years --------
  { name: "DIY sandpaper letters", category: "Montessori — Letters",
    description: "Cardboard + sandpaper + glue. Trace the shape; learn the sound.",
    ageMin: 3, ageMax: 6, buyOrDIY: "DIY", price: 6,
    domains: ["brain"], passions: ["learning to write", "letters"] },
  { name: "Wooden Montessori sandpaper letters", category: "Montessori — Letters",
    description: "Ready-made set if you'd rather buy.",
    ageMin: 3, ageMax: 6, buyOrDIY: "buy", price: 48,
    domains: ["brain"], passions: ["learning to write", "letters"] },
  { name: "Loose parts play basket", category: "Open-ended Play",
    description: "Stones, shells, wood pieces, jar lids, fabric — child-led creativity.",
    ageMin: 2, ageMax: 8, buyOrDIY: "DIY", price: 0,
    domains: ["brain", "build"], passions: ["nature", "animals"] },
  { name: "Bird identification guide (children's)", category: "Nature Study",
    description: "Illustrated field guide for emerging readers.",
    ageMin: 3, ageMax: 9, buyOrDIY: "buy", price: 18,
    domains: ["brain", "community"], passions: ["animals", "nature"] },
];

/**
 * Suggest materials for a child given their profile + family preferences.
 */
export function suggestMaterialsForChild(child, family) {
  const styleBucket = describeLearningStyle(child.learningStyle);
  const diy = describeDIY(child.diyMaterials);
  const childPassions = (child.passions || []).map(p => p.toLowerCase());
  const childDomains = new Set(child.domains || []);

  const scored = MATERIAL_LIBRARY.map(item => {
    let score = 0;
    const reasons = [];
    if (item.ageMin && item.ageMax) {
      if (child.age < item.ageMin || child.age > item.ageMax) return null;
      reasons.push(`age fit (${item.ageMin}–${item.ageMax})`);
    }
    if (item.styleMin && item.styleMax) {
      if (child.learningStyle < item.styleMin || child.learningStyle > item.styleMax) score -= 1;
      else { score += 2; reasons.push(`matches ${styleBucket.label} style`); }
    } else { score += 1; }

    const overlap = (item.domains || []).filter(d => childDomains.has(d));
    if (overlap.length) { score += overlap.length * 2; reasons.push(`covers ${overlap.join(", ")}`); }

    const passionHit = (item.passions || []).find(p => childPassions.includes(p));
    if (passionHit) { score += 3; reasons.push(`connects to ${child.name}'s love of ${passionHit}`); }

    if (diy.bias === "diy" && item.buyOrDIY === "DIY") { score += 2; reasons.push("DIY-friendly (your preference)"); }
    if (diy.bias === "buy" && item.buyOrDIY === "buy") { score += 2; reasons.push("ready-made (time-saving)"); }
    if (diy.bias === "mixed") score += 1;

    if (score <= 0) return null;
    return {
      ...item,
      score,
      reasonSuggested: reasons.slice(0, 2).join(" + "),
      forChildId: child.id,
      ageRange: `${item.ageMin}–${item.ageMax}`,
      estimatedPrice: item.price,
      buyOrDIY: item.buyOrDIY,
    };
  }).filter(Boolean);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 8);
}

/* ---------- Project templates (mock library) ---------- */
const PROJECT_TEMPLATES = [
  {
    titleFn: (c) => "Create a Mini Business around " + topPassion(c),
    description: "Research, brand, price and pitch a small business based on something you love.",
    domains: ["money", "build", "brain"],
    ageMin: 8, ageMax: 16,
    durationDays: 28,
    milestones: [
      "Research 3 existing products or services",
      "Calculate costs, pricing and profit",
      "Create a product name and brand",
      "Design a sales poster or simple ad",
      "Present the idea to the family",
      "Reflect: what worked, what didn't",
    ],
    learningOutcomes: [
      "Compare real products with a critical eye",
      "Understand basic margins and pricing",
      "Communicate an idea confidently",
    ],
    rewardTemplate: "Special outing connected to the business idea + small starter capital",
    tollTemplate: "Finish any incomplete milestones before unlocking the next optional project",
    starsAvailable: 6, momentumPointsAvailable: 120,
  },
  {
    titleFn: (c) => "Build a Backyard Nature Sanctuary",
    description: "Discover what lives in your backyard, build a small habitat and care for it daily.",
    domains: ["brain", "build", "house", "community", "body"],
    ageMin: 3, ageMax: 9,
    durationDays: 21,
    milestones: [
      "Spot and name 3 living things in the garden",
      "Build a feeder or small habitat",
      "Draw a favourite creature and label it",
      "Care for it for 5 days in a row",
      "Show the family your sanctuary",
    ],
    learningOutcomes: [
      "Identify 3 local species",
      "Practise letter formation through labelling",
      "Build daily responsibility through real care",
    ],
    rewardTemplate: "Trip to a wildlife park + choose Saturday's dinner",
    tollTemplate: "Continue daily care until the project is complete",
    starsAvailable: 5, momentumPointsAvailable: 80,
  },
  {
    titleFn: (c) => "Document a Family Ancient History Quest",
    description: "Pick an ancient civilisation, research it deeply and produce a short film or talk.",
    domains: ["brain", "build"],
    ageMin: 9, ageMax: 16,
    durationDays: 30,
    milestones: [
      "Choose a civilisation and explain why",
      "Read 3 sources (book, video, article)",
      "Build a timeline of key events",
      "Write a 1-page script",
      "Film or present a 3-minute mini-doc",
      "Reflect on what you learned",
    ],
    learningOutcomes: [
      "Research from 3 source types",
      "Synthesize information into a story",
      "Speak to camera with confidence",
    ],
    rewardTemplate: "Family movie night with your mini-doc screened first",
    tollTemplate: "Redo the milestone that wasn't completed properly before next reward",
    starsAvailable: 6, momentumPointsAvailable: 120,
  },
  {
    titleFn: () => "Cook 5 Real Family Meals",
    description: "Plan, shop, cook and serve 5 real meals for the family.",
    domains: ["house", "money", "body"],
    ageMin: 6, ageMax: 16,
    durationDays: 35,
    milestones: [
      "Pick 5 meals you'll actually eat",
      "Make a shopping list with a budget",
      "Shop within the budget",
      "Cook each meal (with help if needed)",
      "Reflect on what you'd do differently",
    ],
    learningOutcomes: ["Plan a budget", "Read a recipe", "Real kitchen confidence"],
    rewardTemplate: "Get to choose the family's restaurant pick for one Friday",
    tollTemplate: "Help cook one extra family meal next week",
    starsAvailable: 5, momentumPointsAvailable: 90,
  },
  {
    titleFn: () => "Interview an Elder in the Family or Community",
    description: "Pick someone older than 60. Interview them about their life. Share what you learned.",
    domains: ["community", "brain"],
    ageMin: 6, ageMax: 16,
    durationDays: 14,
    milestones: [
      "Choose who and ask permission",
      "Write 10 great questions",
      "Conduct the interview (audio or in person)",
      "Pick your favourite quote and share it with the family",
    ],
    learningOutcomes: ["Active listening", "Question design", "Recording another person's story"],
    rewardTemplate: "Coffee/hot chocolate date with that elder",
    tollTemplate: "Write a thank-you note before next project starts",
    starsAvailable: 4, momentumPointsAvailable: 60,
  },
  {
    titleFn: (c) => "Outdoor Adventure Challenge",
    description: "Spend time outside every day for 3 weeks doing something physically real.",
    domains: ["body", "build"],
    ageMin: 4, ageMax: 16,
    durationDays: 21,
    milestones: [
      "Plan 3 outdoor adventures",
      "Do something outside for 30 minutes a day",
      "Document one with photos or a sketch",
      "Reflect on how your body feels different",
    ],
    learningOutcomes: ["Daily movement habit", "Outdoor skills", "Body awareness"],
    rewardTemplate: "A bigger adventure outing of your choice",
    tollTemplate: "Extra outdoor day next week",
    starsAvailable: 4, momentumPointsAvailable: 70,
  },
];

function topPassion(child) {
  return (child.passions && child.passions[0]) || "something you love";
}

/**
 * Suggest 3–5 projects for a child based on age, domains, passions, style.
 * The output is in "template" form — the parent can accept to create real Project records.
 */
export function suggestProjectsForChild(child) {
  const styleBucket = describeLearningStyle(child.learningStyle);
  const childDomains = new Set(child.domains || []);
  const childPassions = (child.passions || []).map(p => p.toLowerCase());

  return PROJECT_TEMPLATES
    .map(t => {
      let score = 0;
      const reasons = [];
      if (child.age < t.ageMin || child.age > t.ageMax) return null;

      const overlap = t.domains.filter(d => childDomains.has(d));
      if (overlap.length) { score += overlap.length * 2; reasons.push(`covers ${overlap.join(", ")}`); }

      const passionMatch = childPassions.some(p =>
        t.description.toLowerCase().includes(p) || (t.titleFn(child) || "").toLowerCase().includes(p));
      if (passionMatch) { score += 3; reasons.push(`connects to a passion`); }

      score += 1; // baseline
      reasons.push(`fits ${styleBucket.label}`);

      return {
        templateId: t.titleFn(child).toLowerCase().replace(/\s+/g, "-"),
        title: t.titleFn(child),
        description: t.description,
        domains: t.domains,
        durationDays: t.durationDays,
        learningOutcomes: t.learningOutcomes,
        milestones: t.milestones.map((m, i) => ({
          title: m,
          dueOffsetDays: Math.round((t.durationDays / t.milestones.length) * (i + 1)),
          momentumPoints: Math.round(t.momentumPointsAvailable / t.milestones.length),
          reflectionRequired: i === t.milestones.length - 1,
        })),
        starsAvailable: t.starsAvailable,
        momentumPointsAvailable: t.momentumPointsAvailable,
        reward: t.rewardTemplate,
        toll: t.tollTemplate,
        passionConnection: topPassion(child),
        reasonSuggested: reasons.slice(0, 2).join(" + "),
        score,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/* ---------- Well-rounded balance check ---------- */
/**
 * Look at the selected domains for a term and suggest a balancing nudge.
 * Returns an array of soft suggestions.
 */
export function suggestWellRoundedNudges(domains, projects = []) {
  const set = new Set(domains);
  const projectDomains = new Set(projects.flatMap(p => p.domains || []));
  const suggestions = [];

  const hasAcademic = set.has("brain");
  const hasBuild = set.has("build") || set.has("money");
  const hasHouse = set.has("house");
  const hasCommunity = set.has("community");
  const hasBody = set.has("body");

  if (hasAcademic && hasBuild && !hasHouse) {
    suggestions.push({
      id: "add-house",
      text: "You've selected strong academic and business goals. Would you like to include one House Gig this term — a real practical life skill like cooking 3 meals or doing their own laundry?",
      addDomain: "house",
    });
  }
  if ((hasBuild || hasAcademic) && !hasCommunity) {
    suggestions.push({
      id: "add-community",
      text: "You haven't included Community Gigs yet. Adding one act of service or community project per term builds belonging and contribution.",
      addDomain: "community",
    });
  }
  if (set.size >= 3 && !hasBody) {
    suggestions.push({
      id: "add-body",
      text: "Your plan is rich on indoor work. Want to add an outdoor / body-based project to balance the rhythm?",
      addDomain: "body",
    });
  }
  if (projectDomains.has("money") && !projectDomains.has("brain")) {
    suggestions.push({
      id: "add-presentation",
      text: "Your child has entrepreneurship projects but no communication/presentation milestone. Want to add one so they can practise explaining their ideas?",
    });
  }
  if (projects.length >= 3 && !projects.some(p => (p.domains || []).includes("body"))) {
    suggestions.push({
      id: "add-outdoor-project",
      text: "You have many structured projects. Want to add one outdoor, body-based, or creative project to balance the week?",
    });
  }
  return suggestions;
}

/* ============================================================
   seed.js — Sample data so the MVP demonstrates the full flow.
   Includes Noah (12) and Jett (4) per spec.
   ============================================================ */

import { getState, update, uid } from "./store.js";
import { SAMPLE_SHOWCASES } from "./communityCatalogue.js";

/* ---------- Domain catalogue (shared across families) ---------- */
export const DOMAIN_CATALOG = [
  {
    id: "brain", name: "Brain Gigs", short: "Brain",
    description: "Academic and intellectual growth.",
    color: "plum",
    subSkills: ["reading", "writing", "maths", "science", "research", "critical thinking", "problem solving", "storytelling", "presentation skills"],
    optional: false,
  },
  {
    id: "build", name: "Build Gigs", short: "Build",
    description: "Making, creativity and entrepreneurship.",
    color: "coral",
    subSkills: ["business creation", "product design", "AI projects", "art", "media", "invention", "coding", "building things"],
    optional: false,
  },
  {
    id: "money", name: "Money Gigs", short: "Money",
    description: "Financial literacy and value creation.",
    color: "gold",
    subSkills: ["budgeting", "saving", "selling", "pricing", "profit", "value hunting", "investing basics", "generosity"],
    optional: false,
  },
  {
    id: "house", name: "House Gigs", short: "House",
    description: "Home and adulthood skills.",
    color: "sage",
    subSkills: ["cooking", "laundry", "cleaning", "meal planning", "basic repairs", "organising", "gardening", "household responsibility"],
    optional: false,
  },
  {
    id: "community", name: "Community Gigs", short: "Community",
    description: "Service and contribution.",
    color: "sky",
    subSkills: ["helping neighbours", "volunteering", "interviewing elders", "community problem solving", "friendship skills", "leadership", "acts of service"],
    optional: false,
  },
  {
    id: "body", name: "Body Gigs", short: "Body",
    description: "Physical health and capability.",
    color: "coral",
    subSkills: ["fitness", "hygiene", "sport", "nutrition", "sleep", "outdoor skills", "resilience", "discipline"],
    optional: false,
  },
  {
    id: "faith", name: "Faith Gigs", short: "Faith",
    description: "Spiritual formation (optional).",
    color: "plum",
    subSkills: ["Bible study", "prayer", "scripture memory", "youth group", "service", "character formation", "gratitude", "spiritual reflection"],
    optional: true,
  },
];

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
      coreWord: "BRAVE",
      acronym: [
        { letter: "B", meaning: "Build" },
        { letter: "R", meaning: "Reason" },
        { letter: "A", meaning: "Articulate" },
        { letter: "V", meaning: "Value Hunt" },
        { letter: "E", meaning: "Embody" },
      ],
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
      domains: ["brain", "build", "money", "community", "body"],
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
      domains: ["brain", "build", "house", "body", "community"],
      createdAt: new Date().toISOString(),
    };
    state.children.push(jett);

    /* ---------- Noah's project ---------- */
    const noahProject = {
      id: uid("proj"),
      childId: noah.id,
      title: "Create a Ski Wax Mini Business",
      description: "Research, brand, price and pitch a small ski wax business. Build the whole thing end-to-end and present the idea to the family.",
      domains: ["money", "build", "brain"],
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
      domains: ["brain", "build", "house", "community", "body"],
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
        reasonSuggested: "Matches Noah's Money Gigs + business interest at learning style 6.",
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

    /* ---------- Layer 15: seed sample community data ---------- */
    state.showcases = SAMPLE_SHOWCASES.map(s => ({
      id: uid("show"),
      title: s.title, summary: s.summary, lessons: s.lessons,
      points: s.points, celebrations: s.celebrations,
      photos: [], comments: [],
      fromOtherFamily: true,
      family: s.family,
      childName: s.childName,
      icon: s.icon,
      createdAt: new Date(Date.now() - Math.random() * 60 * 86400000).toISOString(),
    }));
  });
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(17, 0, 0, 0);
  return d;
}

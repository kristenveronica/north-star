/* ============================================================
   communityCatalogue.js — Static catalogues for the Learning Guild.

   In the MVP these are local mock data. When a real backend is
   wired, replace each `getXxx()` with a network call — the
   consuming views won't change.
   ============================================================ */

/* ---------- Quest Teams ---------- */
export const QUEST_TEAMS = [
  { id: "young-entrepreneurs", name: "Young Entrepreneurs", icon: "💼", blurb: "Kids who run lemonade stands, ski-wax businesses, and learn to think in margins.", domain: "money" },
  { id: "storytellers",        name: "Storytellers Guild",  icon: "📖", blurb: "Writers, podcasters, filmmakers and theatre kids in the making.", domain: "brain" },
  { id: "animal-explorers",    name: "Animal Explorers",    icon: "🦋", blurb: "Bird-watchers, junior zoologists, backyard scientists.", domain: "community" },
  { id: "future-builders",     name: "Future Builders",     icon: "🧱", blurb: "Makers, tinkerers and prototypers who would rather build than buy.", domain: "build" },
  { id: "outdoor-adventurers", name: "Outdoor Adventurers", icon: "🏔", blurb: "Mountain kids, surf kids, hike kids — anyone whose classroom is outside.", domain: "body" },
  { id: "coders",              name: "Coders Guild",        icon: "💻", blurb: "Scratch, Python, web — kids learning to make computers do things.", domain: "build" },
  { id: "ai-creators",         name: "AI Creators",         icon: "🤖", blurb: "Kids exploring what's possible with AI as a creative partner.", domain: "build" },
  { id: "artists",             name: "Artists Guild",       icon: "🎨", blurb: "Drawing, painting, sculpture, design — the visual makers.", domain: "build" },
  { id: "community-leaders",   name: "Community Leaders",   icon: "🤝", blurb: "Kids who organise, lead, serve — the future captains.", domain: "community" },
];

export function getQuestTeam(id) { return QUEST_TEAMS.find(t => t.id === id); }

/* ---------- Community Challenges (rotating) ---------- */
export const CHALLENGES = [
  { id: "grow-something",     name: "Grow Something Challenge",      duration: "30 days", period: "monthly",
    blurb: "Plant something edible and care for it for 30 days. Sprouts, herbs, tomatoes — anything alive.", badge: "Green Thumb", icon: "🌱" },
  { id: "interview-elder",    name: "Interview a Grandparent",       duration: "1 week",  period: "monthly",
    blurb: "Sit down with someone older than 60. Ask 10 great questions. Share the favourite answer.", badge: "Bridge Builder", icon: "👴" },
  { id: "community-service",  name: "Community Service Mission",      duration: "1 month", period: "monthly",
    blurb: "Find a need in your street, school or community. Do something about it.", badge: "Helper of Many", icon: "💗" },
  { id: "first-business",     name: "First Business Challenge",       duration: "8 weeks", period: "quarterly",
    blurb: "Start, brand, price and sell your first real thing. Make at least one real sale.", badge: "Founder", icon: "💰" },
  { id: "storytelling",       name: "Storytelling Challenge",         duration: "1 month", period: "monthly",
    blurb: "Tell a story in any medium — writing, video, podcast, comic, play. Share with the family.", badge: "Storyteller", icon: "📚" },
  { id: "build-something",    name: "Build Something Challenge",      duration: "1 month", period: "monthly",
    blurb: "Make something physical with your hands. Cardboard, wood, fabric, paper — your call.", badge: "Maker", icon: "🔨" },
  { id: "family-adventure",   name: "Family Adventure Challenge",     duration: "1 month", period: "monthly",
    blurb: "Plan, lead and complete one real adventure as a family. Bonus if a child plans it.", badge: "Explorer", icon: "🗺" },
];
export function getChallenge(id) { return CHALLENGES.find(c => c.id === id); }

/* ---------- Sample Mentors (from "other families") ---------- */
export const MENTORS = [
  { id: "mentor-1", name: "Maya R.", age: 15, family: "The Rivers Family · Wanaka, NZ", categories: ["entrepreneurship", "storytelling"],
    bio: "Runs her own podcast and a handmade soap business. Mentors younger kids on starting their first thing.", avatarIndex: 3 },
  { id: "mentor-2", name: "Sol H.",  age: 14, family: "The Henley Family · Queenstown, NZ", categories: ["leadership", "project support"],
    bio: "Organises a weekly homeschool meetup of 30+ kids. Loves helping kids run their own projects.", avatarIndex: 4 },
  { id: "mentor-3", name: "Eli M.",  age: 13, family: "The Moana Family · Nelson, NZ", categories: ["creativity", "study support"],
    bio: "Self-taught animator and writer. Helps younger kids find their voice.", avatarIndex: 5 },
  { id: "mentor-4", name: "Iris K.", age: 16, family: "The Kahurangi Family · Christchurch, NZ", categories: ["entrepreneurship", "leadership"],
    bio: "Sells her bird-themed ceramics at local markets. Coaches younger kids on pricing and presence.", avatarIndex: 2 },
];
export function getMentor(id) { return MENTORS.find(m => m.id === id); }
export const MENTORSHIP_CATEGORIES = ["entrepreneurship", "storytelling", "leadership", "creativity", "project support", "study support"];

/* ---------- Sample Showcases from "other families" ---------- */
export const SAMPLE_SHOWCASES = [
  { childName: "Mira (10)", family: "The Otago Family · NZ",
    title: "I built a bee hotel for our backyard",
    summary: "Researched solitary bees, designed a habitat with my dad, and built it from offcuts. We've had 7 species visit so far.",
    lessons: "How to use a drill bit without breaking it. That solitary bees don't sting much.",
    points: 90, celebrations: 24, photos: [], icon: "🐝",
    fromOtherFamily: true },
  { childName: "Theo (13)", family: "The Lakeside Family · AU",
    title: "I started a dog-walking business",
    summary: "Walked 3 dogs in our street for 4 weeks. Made $112, kept records in a notebook, learned that cancelling people sting.",
    lessons: "How to write a clear text to a customer. Pricing per dog vs per walk.",
    points: 140, celebrations: 41, photos: [], icon: "🐕",
    fromOtherFamily: true },
  { childName: "Luca (8)", family: "The Pakuranga Family · NZ",
    title: "I wrote and illustrated my first book",
    summary: "20 pages, hand-drawn, about a dragon who can't breathe fire. Read it to my class at our homeschool meetup.",
    lessons: "Editing is harder than writing. I rewrote page 7 four times.",
    points: 70, celebrations: 18, photos: [], icon: "🐉",
    fromOtherFamily: true },
  { childName: "Aroha (12)", family: "The Maitai Family · NZ",
    title: "Our community garden bed",
    summary: "Got permission from the local school to manage a 2m x 2m bed. Grew lettuce, basil and beans. Donated harvest to a soup kitchen.",
    lessons: "Asking strangers for things gets easier each time. Slugs are formidable.",
    points: 200, celebrations: 56, photos: [], icon: "🌿",
    fromOtherFamily: true },
];

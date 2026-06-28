/* ============================================================
   techAgreement.js — the Family Technology Agreement (PER CHILD).

   NOT a one-and-done printable. This is where a family records its digital
   values and boundaries FOR A SPECIFIC CHILD (children differ by age, so each
   child carries their own agreement) — and that data becomes part of North
   Star's intelligence: it shapes which projects, resources and online
   experiences the AI generates for that child (see techAgreementForAI). The
   printable PDF is simply the visible outcome of those conversations.

   Stored inside the child's existing `learningProfile.techAgreement` jsonb, so
   it syncs with no migration and sits where it's authored — the Learning
   Profile → Technology & Digital Learning section.

   Pure data + helpers; UI lives in components/techSections.js, editor page in
   views/technology.js, the PDF in lib/pdf/agreement.js.
   ============================================================ */

// Each section: a short explanation + thoughtfully written suggested agreements
// the family can adopt, edit or ignore. Never prescriptive — North Star is
// facilitating a conversation, not imposing rules.
export const TECH_SECTIONS = [
  {
    id: "devices", icon: "📱", title: "Devices",
    blurb: "Phones, tablets, laptops — when and where they're used.",
    explanation: "How and where devices live in your home shapes everything else. A few shared agreements here prevent a lot of negotiations later.",
    suggestions: [
      "Devices stay out of bedrooms overnight.",
      "We charge devices in a shared family space.",
      "We ask before downloading new apps.",
      "New devices come with a conversation about how we'll use them.",
    ],
  },
  {
    id: "internet", icon: "🌐", title: "Internet Access",
    blurb: "How the family browses and searches the web.",
    explanation: "The open web is powerful and unpredictable. Decide together how much supervision feels right at each age.",
    suggestions: [
      "Younger children use the internet with an adult nearby.",
      "We use kid-safe search or filtered browsing.",
      "Browsing happens in shared spaces, not behind closed doors.",
      "We tell an adult if we land somewhere that feels wrong.",
    ],
  },
  {
    id: "youtube", icon: "▶️", title: "YouTube",
    blurb: "Watching, choosing channels, and avoiding the endless scroll.",
    explanation: "YouTube can teach almost anything — and also pull children down rabbit holes. Agree how it's used so it stays a tool, not a trap.",
    suggestions: [
      "We watch YouTube together or with permission.",
      "We choose creators and channels as a family.",
      "YouTube is for learning and chosen shows, not endless scrolling.",
      "Autoplay is turned off.",
    ],
  },
  {
    id: "ai", icon: "✨", title: "AI Usage",
    blurb: "How AI tools support learning — without replacing thinking.",
    explanation: "AI is becoming part of how children learn. Decide together how it helps so it builds capability rather than shortcutting it.",
    suggestions: [
      "AI helps us learn. It does not replace our thinking.",
      "We check important facts AI gives us.",
      "We don't share personal or family details with AI tools.",
      "We're honest when AI helped with our work.",
    ],
  },
  {
    id: "gaming", icon: "🎮", title: "Gaming",
    blurb: "Game time, age-appropriate choices, and online play.",
    explanation: "Games can build problem-solving and teamwork — or quietly take over an afternoon. Set expectations before the controller's in hand.",
    suggestions: [
      "We agree on game time before we start.",
      "Games are age-appropriate and chosen together.",
      "We take a movement break between sessions.",
      "Online play happens with people we know.",
    ],
  },
  {
    id: "social", icon: "📷", title: "Social Media",
    blurb: "When it's time, and how to begin safely.",
    explanation: "Social media arrives sooner than most parents expect. Thinking it through early makes the eventual conversation calmer.",
    suggestions: [
      "We wait until we're ready (and old enough) for social media.",
      "Accounts are set up together, with privacy on.",
      "We think before we post — would we be happy for anyone to see it?",
      "We never share where we live or go to school.",
    ],
  },
  {
    id: "communication", icon: "💬", title: "Online Communication",
    blurb: "Messaging, group chats and talking to people online.",
    explanation: "Most online risk arrives through messages, not browsers. Agree who it's okay to talk to, and what to do when something feels off.",
    suggestions: [
      "We only message people we know in real life.",
      "We tell an adult if a stranger contacts us.",
      "We're kind online — we don't say things we wouldn't say in person.",
      "We don't share photos of others without asking.",
    ],
  },
  {
    id: "privacy", icon: "🔒", title: "Privacy",
    blurb: "Passwords, personal information and digital footprints.",
    explanation: "What goes online tends to stay online. Small habits now protect your children's privacy for years.",
    suggestions: [
      "We keep passwords private — except from parents.",
      "We pause before sharing personal information.",
      "We use nicknames or avatars where we can.",
      "We check app permissions together.",
    ],
  },
  {
    id: "screentime", icon: "⏳", title: "Family Screen Time",
    blurb: "Balance, screen-free moments and rhythms that work for you.",
    explanation: "This isn't about a magic number of minutes — it's about protecting the moments that matter most to your family.",
    suggestions: [
      "Family meals are screen free.",
      "Screens go off an hour before bed.",
      "We balance screen time with outdoor and hands-on time.",
      "Weekends include screen-free adventures.",
    ],
  },
  {
    id: "safety", icon: "🛡️", title: "Digital Safety",
    blurb: "What to do when something online doesn't feel right.",
    explanation: "The most important agreement of all: that children can always come to you, and never feel they're in trouble for telling.",
    suggestions: [
      "We tell an adult if something online makes us uncomfortable.",
      "We don't open links or messages from people we don't know.",
      "If in doubt, we ask before we click.",
      "Mistakes online are okay to talk about — no one's in trouble for telling.",
    ],
  },
];

export const techSectionById = (id) => TECH_SECTIONS.find(s => s.id === id);

// Where a child's agreement lives (inside the synced learning_profile jsonb).
export const childTechAgreement = (child) => child?.learningProfile?.techAgreement || {};

// ---- shape + normalisation ------------------------------------------------
// agreement = {
//   sections: { [id]: { adopted: string[], notes: string, skipped: bool } },
//   reviewDate: ISO|null, lastReviewedAt: ISO|null,
//   reviewedAgeBands: string[], signatures: { parents, children }, updatedAt
// }
export function normalizeTechAgreement(t) {
  t = (t && typeof t === "object" && !Array.isArray(t)) ? t : {};
  const sections = {};
  for (const s of TECH_SECTIONS) {
    const sec = (t.sections && t.sections[s.id]) || {};
    sections[s.id] = {
      adopted: Array.isArray(sec.adopted) ? sec.adopted.filter(Boolean) : [],
      notes: typeof sec.notes === "string" ? sec.notes : "",
      skipped: !!sec.skipped,
    };
  }
  return {
    sections,
    reviewDate: t.reviewDate || null,
    lastReviewedAt: t.lastReviewedAt || null,
    reviewedAgeBands: Array.isArray(t.reviewedAgeBands) ? t.reviewedAgeBands : [],
    signatures: { parents: t.signatures?.parents || "", children: t.signatures?.children || "" },
    updatedAt: t.updatedAt || null,
  };
}

// All agreed lines for a section (adopted suggestions + any free-text lines).
export function sectionAgreements(sec) {
  if (!sec) return [];
  const notes = (sec.notes || "").split("\n").map(s => s.trim()).filter(Boolean);
  return [...(sec.adopted || []), ...notes];
}

const sectionActive = (sec) => !!sec && !sec.skipped && (sectionAgreements(sec).length > 0);

export function isTechStarted(agreement) {
  const a = normalizeTechAgreement(agreement);
  return TECH_SECTIONS.some(s => sectionActive(a.sections[s.id])) ||
    TECH_SECTIONS.some(s => a.sections[s.id].skipped) || !!a.lastReviewedAt;
}

// Progress: how many sections the family has addressed (agreed or deliberately skipped).
export function techProgress(agreement) {
  const a = normalizeTechAgreement(agreement);
  const addressed = TECH_SECTIONS.filter(s => sectionActive(a.sections[s.id]) || a.sections[s.id].skipped).length;
  return { addressed, total: TECH_SECTIONS.length };
}

// ---- age brackets (for the living-document review nudges) -----------------
export const AGE_BANDS = [
  { id: "early", label: "under 6", max: 5 },
  { id: "young", label: "6–9", max: 9 },
  { id: "middle", label: "10–12", max: 12 },
  { id: "teen", label: "13–15", max: 15 },
  { id: "older", label: "16–18", max: 99 },
];
export function ageBandOf(age) {
  if (age == null) return null;
  return (AGE_BANDS.find(b => age <= b.max) || AGE_BANDS[AGE_BANDS.length - 1]).id;
}
export function currentAgeBands(children) {
  return [...new Set((children || []).map(c => ageBandOf(c.age)).filter(Boolean))].sort();
}

// ---- AI profile ------------------------------------------------------------
// Compact, model-friendly summary of THIS CHILD's digital boundaries. This is
// the bridge into curriculum generation: passed as constraints.technology so
// the AI respects YouTube/internet/AI/gaming/screen boundaries when designing
// projects and recommending resources. Returns null when nothing's been set.
export function techAgreementForAI(child) {
  const a = normalizeTechAgreement(childTechAgreement(child));
  if (!isTechStarted(a)) return null;

  const lines = [];
  for (const s of TECH_SECTIONS) {
    const sec = a.sections[s.id];
    if (sectionActive(sec)) lines.push(`${s.title}: ${sectionAgreements(sec).join("; ")}`);
  }
  if (!lines.length) return null;

  const text = (id) => sectionAgreements(a.sections[id]).join(" ").toLowerCase();
  const flags = {
    youtubeLimited: sectionActive(a.sections.youtube),
    internetSupervised: sectionActive(a.sections.internet) &&
      /adult|supervis|nearby|together|with an? adult|shared space/.test(text("internet")),
    aiRules: sectionActive(a.sections.ai) ? sectionAgreements(a.sections.ai).join("; ") : "",
    gamingLimited: sectionActive(a.sections.gaming),
    screenLimits: sectionActive(a.sections.screentime),
  };
  return { lines, flags };
}

// ---- living-document review nudge (per child) -----------------------------
// A single gentle suggestion (or null) — never a notification demanding action.
export function techReviewSuggestion(child) {
  const a = normalizeTechAgreement(childTechAgreement(child));
  const name = child?.name || "your child";

  if (!isTechStarted(a)) {
    return { kind: "setup", title: `Create a Technology Agreement for ${name}`,
      text: "Think through your family's digital values together, and North Star will respect them in every project it designs for them." };
  }
  if (a.reviewDate && new Date(a.reviewDate) <= new Date()) {
    return { kind: "due", title: "It's time for your scheduled review",
      text: `You set a review date for ${name}'s Technology Agreement — revisit it together when it suits you.` };
  }
  const bandNow = ageBandOf(child?.age);
  const grew = bandNow && a.reviewedAgeBands.length > 0 && !a.reviewedAgeBands.includes(bandNow);
  if (grew) {
    return { kind: "age", title: `${name} is growing into a new stage`,
      text: `${name} has moved into a new age bracket. It might be worth revisiting devices, social media and online communication together.` };
  }
  if (a.lastReviewedAt) {
    const months = (Date.now() - new Date(a.lastReviewedAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (months >= 6) {
      return { kind: "stale", title: "A gentle nudge to revisit this agreement",
        text: `It's been a while since you reviewed ${name}'s Technology Agreement. Technology — and children — change quickly.` };
    }
  }
  return null;
}

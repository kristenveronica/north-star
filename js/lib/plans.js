/* ============================================================
   plans.js — The North Star capability model (single source of truth).

   Subscription tiers are NOT "feature locks". Each tier is a DEEPER
   relationship with North Star: features unlock AND the mentoring
   relationship deepens (more memory, richer Guide understanding,
   better personalisation). Foundation is complete and generous — a
   family can homeschool successfully on it forever. Upgrading should
   feel exciting, never necessary.

   Architecture rule: components NEVER hardcode a tier name. They ask
   entitlement questions — hasFeature(state, "GROWTH_REPORTS") — so
   packaging can change here without rewriting any UI.

   The SOURCE OF TRUTH for what a family is entitled to is server-side
   (Stripe → family_billing.plan → this map). The client only READS.
   ============================================================ */

/* ---------- Tiers ---------- */
// rank orders the ladder (higher includes everything below it).
// price = founding-family monthly rate (USD); amounts live in Stripe,
// these are for display/marketing only.
export const PLANS = {
  foundation: {
    key: "foundation", name: "Foundation", rank: 1, price: 49,
    tagline: "The complete core North Star experience.",
    includedChildren: 5, includedAdults: 2,
  },
  flourish: {
    key: "flourish", name: "Flourish", rank: 2, price: 69, recommended: true,
    tagline: "North Star begins to understand your family more deeply.",
    includedChildren: 5, includedAdults: 2,
  },
  legacy: {
    key: "legacy", name: "Legacy", rank: 3, price: 99,
    tagline: "North Star becomes a long-term mentoring partner for your whole family.",
    includedChildren: 5, includedAdults: 2,
  },
};

export const PLAN_ORDER = ["foundation", "flourish", "legacy"];

// During the founding launch we GRANDFATHER: a family with an active
// subscription but no plan stamped yet, and every beta family, is treated
// as Legacy so nobody currently in loses access. New checkouts stamp the
// real plan. Tighten this when the hard paywall lands.
export const DEFAULT_PLAN = "legacy";

export function planRank(planKey) {
  return PLANS[planKey]?.rank ?? 0;
}

/* ---------- Features ---------- */
// kind:
//   "page" — a navigable feature that stays VISIBLE in nav; if the family's
//            plan doesn't include it, the route renders an intro page (never a
//            paywall). Carries the intro-page content.
//   "ai"   — a capability that deepens AI/Guide behaviour (more memory, richer
//            personalisation). Enforced server-side in the AI layer, not via a
//            page. No intro page; flagged so generation can read it.
//
// minPlan — the lowest tier that includes this feature.
export const FEATURES = {
  /* ---- Flourish ---- */
  FAMILY_INVENTORY: {
    key: "FAMILY_INVENTORY", minPlan: "flourish", kind: "page", route: "/inventory",
    title: "Family Inventory",
    philosophy: "North Star learns what your family already has — and builds around it.",
    why: "Great learning rarely needs new things bought. When North Star knows the books on your shelf, the tools in your garage and the instruments in the cupboard, every project reaches for what you already own before it ever suggests a purchase.",
    benefits: [
      "Projects use what you already have — less spent, less waste",
      "A living toolkit of your family's materials, across 14 categories",
      "Borrow-and-return tracking so nothing gets lost",
      "The AI plans around your real resources, not a generic shopping list",
    ],
  },
  GROWTH_REPORTS: {
    key: "GROWTH_REPORTS", minPlan: "flourish", kind: "page", route: "/reports",
    title: "Growth Reports",
    philosophy: "Watch who your child is becoming — in evidence, over time.",
    why: "A grade tells you almost nothing. A Growth Report gathers the real evidence of a season — effort, character, capability, the projects that mattered — and reflects back the person emerging from it. Not a test score. A portrait.",
    benefits: [
      "Rich, evidence-based reflections on each child's growth",
      "Progress across the capability domains, not just academics",
      "Character and effort surfaced alongside outcomes",
      "A record you'll want to keep — season after season",
    ],
  },
  REWARDS: {
    key: "REWARDS", minPlan: "flourish", kind: "page", route: "/rewards",
    title: "Rewards & Tolls",
    philosophy: "A gentle family economy that makes effort visible.",
    why: "Children thrive when contribution is seen. Rewards & Tolls turns momentum into a simple, values-aligned economy your family designs together — meaningful, never gamified, never a system of points for their own sake.",
    benefits: [
      "Turn earned momentum into rewards your family chooses",
      "Set 'tolls' that teach responsibility and trade-offs",
      "Reinforces contribution and effort — not screen-time streaks",
      "You design it around your family's values",
    ],
  },

  /* ---- Legacy ---- */
  FAMILY_NORTH_STAR: {
    key: "FAMILY_NORTH_STAR", minPlan: "legacy", kind: "page", route: "/vision", flagship: true,
    title: "Family North Star",
    philosophy: "North Star stops being a homeschooling platform and becomes the operating system for your family's future.",
    why: "Every Guide conversation, every project, every reflection ultimately points back to one thing: who your family is becoming, together. Family North Star is the living heart of that — your mission, your values, your direction — and once it's alive, everything North Star does bends toward it. No other platform has this. It is the deepest reason a family stays for years.",
    benefits: [
      "Your family's mission, values and direction — held as a living model",
      "Every project, council and Guide conversation aligns to it",
      "The intelligence that connects all your children into one family story",
      "Grows richer every season as North Star comes to know you",
      "The foundation the whole Legacy relationship is built on",
    ],
  },
  FAMILY_COUNCILS: {
    key: "FAMILY_COUNCILS", minPlan: "legacy", kind: "page", route: "/councils",
    title: "Family Councils",
    philosophy: "The rhythm where your family decides who it wants to become.",
    why: "The strongest families talk on purpose. Councils give you a gentle, guided cadence for the conversations that matter — direction, decisions, celebration, repair — with North Star helping you prepare and remember.",
    benefits: [
      "Guided family meetings that build real togetherness",
      "North Star helps you prepare, run and remember each one",
      "Decisions and commitments captured as part of your story",
      "A cadence that turns intention into family culture",
    ],
  },
  CHILD_INSIGHTS: {
    key: "CHILD_INSIGHTS", minPlan: "legacy", kind: "page", route: "/insights",
    title: "Child Insights",
    philosophy: "The deepest understanding North Star can offer of a single child.",
    why: "Beyond any single report, Child Insights is North Star's developing understanding of who a child is — their patterns, their edges, what helps them flourish — drawn from everything you've shared over time. It is intelligence that only becomes possible with rich memory.",
    benefits: [
      "A developing, evidence-based portrait of each child",
      "Patterns across years, not just moments",
      "Developmental intelligence that grows with your history",
      "Insight to guide your most important parenting decisions",
    ],
  },
  COMMUNITY: {
    key: "COMMUNITY", minPlan: "legacy", kind: "page", route: "/community", state: "coming_soon",
    title: "Community",
    philosophy: "A community of families raising remarkable humans — by contribution, not consumption.",
    why: "Not a feed. A place to share the projects you've made, mentor newer families, and learn from those a few steps ahead. Community is a long-term part of the Legacy relationship, arriving as North Star grows.",
    benefits: [
      "Share the projects and journeys your family has built",
      "Mentor and be mentored by other founding families",
      "Learn from families a few steps ahead",
      "Contribution-first — never a comparison feed",
    ],
  },
  GUIDE_MENTORING: {
    key: "GUIDE_MENTORING", minPlan: "legacy", kind: "page", route: "/mentoring", state: "coming_soon",
    title: "Guide Mentoring",
    philosophy: "The Guides mentor the whole family — not just the children.",
    why: "At Legacy the relationship opens up: parents and the family can speak with the Guides, ask for direction, and receive mentoring around purpose and growth. This is only possible with the deepest, longest memory — the Guides who truly remember.",
    benefits: [
      "Parent ↔ Guide mentoring conversations",
      "Family ↔ Guide mentoring around purpose and direction",
      "The longest, deepest Guide memory North Star offers",
      "Purpose mentoring that spans years, not sessions",
    ],
  },

  /* ---- AI-capability features (server-enforced; no intro page) ---- */
  // These deepen the mentoring relationship rather than adding a page.
  AI_GUIDE_MEMORY_EXTENDED: { key: "AI_GUIDE_MEMORY_EXTENDED", minPlan: "flourish", kind: "ai" },
  AI_PERSONALISATION_ENHANCED: { key: "AI_PERSONALISATION_ENHANCED", minPlan: "flourish", kind: "ai" },
  AI_RICHER_OBSERVATIONS: { key: "AI_RICHER_OBSERVATIONS", minPlan: "flourish", kind: "ai" },
  AI_GUIDE_MEMORY_LONGTERM: { key: "AI_GUIDE_MEMORY_LONGTERM", minPlan: "legacy", kind: "ai" },
  AI_ADVANCED_UNDERSTANDING: { key: "AI_ADVANCED_UNDERSTANDING", minPlan: "legacy", kind: "ai" },
};

/** All page-features that appear in nav (for badge/gating wiring). */
export const PAGE_FEATURES = Object.values(FEATURES).filter((f) => f.kind === "page");

/** Look up the page-feature that owns a given route, incl. sub-paths
    (so "/reports/123" is gated by the "/reports" feature). */
export function featureForRoute(route) {
  return PAGE_FEATURES.find((f) => route === f.route || route.startsWith(f.route + "/")) || null;
}

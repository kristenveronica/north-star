/* ============================================================
   appsCatalog.js — The Learning Apps registry.
   Satellite apps North Star can launch for a child. Each app
   receives a launch context (child, time budget, return URL)
   and reports a session summary back via `?ns_result=` on the
   return URL (see lib/appsHub.js for the contract).
   ============================================================ */

export const APP_CATALOG = [
  {
    id: "polaris-math",
    name: "Polaris Math",
    emoji: "🦊",
    tagline: "Adaptive, mastery-based math with Momo the fox. 90% proficiency gates, spaced review, misconception tracking.",
    domain: "Brain",
    ages: "4–18",
    status: "live",
    // Dev default; override per device via localStorage key below (e.g. a
    // deployed URL). Becomes a per-org setting when apps move to Supabase.
    // Runs on 8082 so it doesn't collide with the Daily Oracle Expo app on 8081
    // (both are Expo apps, which default to 8081).
    launchUrl: localStorage.getItem("ns::appUrl::polaris-math") || "http://localhost:8082",
    defaultLimitMin: 15,
  },
  {
    id: "polaris-reading",
    name: "Polaris Reading",
    emoji: "🦉",
    tagline: "Phonics to comprehension, matched to your child's level.",
    domain: "Brain",
    ages: "4–12",
    status: "coming_soon",
  },
  {
    id: "polaris-money",
    name: "Money Makers",
    emoji: "🐝",
    tagline: "Real-world money skills — earning, saving, first ventures.",
    domain: "Money",
    ages: "8–18",
    status: "coming_soon",
  },
];

export const getApp = (id) => APP_CATALOG.find(a => a.id === id);
export const liveApps = () => APP_CATALOG.filter(a => a.status === "live");

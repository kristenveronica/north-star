/* ============================================================
   permissions.js — the Permission Engine.

   North Star has ONE educational vision (the Owner's), delivered by many
   trusted adults (Contributors) whose access the Owner customises. This
   module is the single source of truth that maps:

        Current User  →  Permission Engine  →  what they can access

   The whole parent portal (sidebar + route guards) is generated from it, so
   each person sees ONLY the pages relevant to their role — locked pages are
   omitted entirely, never shown disabled.

   Identity today: the logged-in account is always an Owner. The Owner can
   "View as" any member to preview that person's portal (Owner-only). The same
   engine will drive real per-member sessions once member auth lands — nothing
   here assumes who is authenticated, only the member object handed in.
   ============================================================ */

import { currentUserId } from "../auth.js";

export const OWNER = "__owner__";   // sentinel: Owner-only (config) routes
export const ALWAYS = "__always__"; // sentinel: everyone (e.g. Dashboard)

// Configuration — Owner only, hidden entirely from Contributors.
export const CONFIG_PERMS = [
  "Family North Star", "Family Settings", "Learning Profile", "Editing Child Profiles",
  "Capability configuration", "Subscription & Billing", "Managing permissions",
];

// Contribution — what a person may DO (selectable per person).
export const CONTRIBUTION_PERMS = [
  { key: "contrib:viewChild", label: "View Child Profile" },
  { key: "contrib:generate", label: "Generate AI Projects" },
  { key: "contrib:editProjects", label: "Edit generated projects" },
  { key: "contrib:milestones", label: "Update milestone progress" },
  { key: "contrib:portfolio", label: "Upload portfolio items" },
  { key: "contrib:reflections", label: "Add reflections" },
  { key: "contrib:observations", label: "Add observations" },
  { key: "contrib:reports", label: "Request AI reports" },
  { key: "contrib:print", label: "Print projects" },
  { key: "contrib:calendar", label: "Add calendar events" },
];

// View — what a person may SEE (selectable independently).
export const VIEW_PERMS = [
  { key: "view:materials", label: "Suggested Materials" },
  { key: "view:domains", label: "Capability Domains" },
  { key: "view:progress", label: "Progress" },
  { key: "view:reports", label: "Reports" },
  { key: "view:calendar", label: "Calendar" },
  { key: "view:portfolio", label: "Portfolio" },
  { key: "view:projects", label: "Completed Projects" },
];

export const ALL_PERM_KEYS = [...CONTRIBUTION_PERMS, ...VIEW_PERMS].map(p => p.key);

// A sensible "educational contributor" starting set (mirrors the spec's example
// portal): can view and deliver the learning journey, but not configure it.
export const DEFAULT_CONTRIBUTOR_PERMS = [
  "contrib:viewChild", "contrib:generate", "contrib:editProjects", "contrib:milestones",
  "contrib:portfolio", "contrib:reflections", "contrib:observations", "contrib:print", "contrib:calendar",
  "view:materials", "view:domains", "view:progress", "view:reports", "view:portfolio",
];

/* ---- route → requirement ----------------------------------------------------
   Ordered, most-specific first. req is OWNER, ALWAYS, a perm key, or an array
   (any-of). Unmatched parent routes default to OWNER, so Contributors only ever
   see what's been explicitly granted. */
const PATH_RULES = [
  { p: "/vision", req: OWNER },
  { p: "/family-settings", req: OWNER },
  { p: "/style", req: OWNER },
  { p: "/technology", req: OWNER },
  { p: "/children", req: ["contrib:viewChild"] },
  { p: "/domains", req: ["view:domains"] },
  { p: "/inventory", req: ["view:materials"] },
  { p: "/materials", req: ["view:materials"] },
  { p: "/cart", req: ["view:materials", "contrib:print"] },
  { p: "/projects", req: ["view:projects", "contrib:generate", "contrib:editProjects", "contrib:milestones"] },
  { p: "/planner", req: ["view:projects", "contrib:editProjects"] },
  { p: "/rewards", req: ["view:projects", "contrib:generate", "contrib:editProjects", "contrib:milestones"] },
  { p: "/calendar", req: ["view:calendar", "contrib:calendar"] },
  { p: "/progress", req: ["view:progress"] },
  { p: "/reflections", req: ["view:progress", "contrib:reflections", "contrib:observations"] },
  { p: "/portfolio", req: ["view:portfolio", "contrib:portfolio"] },
  { p: "/reports", req: ["view:reports", "contrib:reports"] },
  { p: "/insights", req: ["view:reports"] },
  { p: "/guild", req: OWNER },
  { p: "/councils", req: OWNER },
  { p: "/legacy", req: OWNER },
  { p: "/settings", req: OWNER },
];

export function routeRequirement(path) {
  if (!path || path === "/") return ALWAYS;
  for (const r of PATH_RULES) {
    if (path === r.p || path.startsWith(r.p + "/")) return r.req;
  }
  return OWNER;   // unknown parent routes are Owner-only by default
}

/* ---- member normalisation + identity --------------------------------------- */
export function normalizeMember(m) {
  m = m || {};
  return {
    ...m,
    accessLevel: m.accessLevel === "owner" ? "owner" : "contributor",
    permissions: Array.isArray(m.permissions) ? m.permissions : [],
  };
}

export const isOwner = (member) => normalizeMember(member).accessLevel === "owner";

export function effectivePermissions(member) {
  const m = normalizeMember(member);
  return new Set(m.accessLevel === "owner" ? ALL_PERM_KEYS : m.permissions);
}

export function memberHasPerm(member, key) {
  if (isOwner(member)) return true;
  return effectivePermissions(member).has(key);
}

// Can this member reach this path?
export function canAccessPath(member, path) {
  if (isOwner(member)) return true;
  const req = routeRequirement(path);
  if (req === ALWAYS) return true;
  if (req === OWNER) return false;
  const perms = effectivePermissions(member);
  return Array.isArray(req) ? req.some(k => perms.has(k)) : perms.has(req);
}

/* ---- "current user" + Owner's View-as (session only) ------------------------ */
const VIEW_AS_KEY = "northstar::viewAs";
export function getViewAs() {
  try { return sessionStorage.getItem(VIEW_AS_KEY) || null; } catch { return null; }
}
export function setViewAs(memberId) {
  try { memberId ? sessionStorage.setItem(VIEW_AS_KEY, memberId) : sessionStorage.removeItem(VIEW_AS_KEY); } catch { /* ignore */ }
}
export function clearViewAs() { setViewAs(null); }

// The Owner account, as a member object (full access).
function ownerSelf(state) {
  return { id: OWNER, name: state?.family?.ownerName || "You (Owner)", accessLevel: "owner", permissions: ALL_PERM_KEYS };
}

// Map a real family_members row (DB) onto the engine's member shape. The existing
// role model maps cleanly: architect/co_architect → owner; everyone else is a
// contributor whose family_members.permissions drive their portal.
function memberFromRow(row) {
  const isOwnerRole = row.role === "architect" || row.role === "co_architect";
  return {
    id: row.id,
    name: row.display_name || "Member",
    accessLevel: isOwnerRole ? "owner" : "contributor",
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
    userId: row.user_id,
    role: row.role,
    isPrimary: !!row.is_primary,
  };
}

// The acting user:
//   1. a member being previewed via Owner "View as" (relationship config), else
//   2. the logged-in user's REAL membership (owner or accepted contributor), else
//   3. the Owner account fallback (pre-hydrate / solo owner).
export function currentMember(state) {
  const viewAs = getViewAs();
  if (viewAs) {
    const m = (state?.family?.relationships || []).find(r => r.id === viewAs);
    if (m) return normalizeMember(m);
  }
  const uid = currentUserId();
  if (uid) {
    const mine = (state?.familyMembers || []).find(m => m.user_id === uid && (m.status || "active") === "active");
    if (mine) return memberFromRow(mine);
  }
  return ownerSelf(state);
}

// Is the REAL account owner acting (i.e. not currently previewing a contributor)?
export function isOwnerActing(state) {
  return isOwner(currentMember(state));
}

/* ============================================================
   config.js — app-level configuration.

   APP_BASE_URL is the canonical, PRODUCTION base URL for anything that must
   work OUTSIDE the running app — above all, QR codes printed on paper. A
   parent scanning a printout needs to land on the real app no matter where
   the PDF was generated, so we deliberately DO NOT derive these links from
   location.origin (which is localhost in development and would print dead QR
   codes). Override here (or via the window.__NORTH_STAR_CONFIG hook) for
   white-label / staging domains.
   ============================================================ */

const RUNTIME = (typeof window !== "undefined" && window.__NORTH_STAR_CONFIG) || {};

// Single source of truth. Must never be a localhost/dev origin.
export const APP_BASE_URL = (RUNTIME.APP_BASE_URL || "https://www.northstar-family.com").replace(/\/+$/, "");

const LOCAL_RE = /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|file:)/i;

// True only when the project is genuinely SAVED — a real id that exists in the
// store (not a draft/preview/temporary project being previewed before accept).
export function hasValidProjectId(project, state) {
  const id = project && project.id;
  if (typeof id !== "string" || id.trim().length < 6) return false;
  if (/draft|temp|preview/i.test(id)) return false;
  if (state && Array.isArray(state.projects)) {
    return state.projects.some(p => p.id === id);
  }
  return true;   // no store to cross-check — trust a well-formed id
}

// Canonical, production deep link to a saved project. Returns null when no
// usable URL can be built, so callers fail gracefully (never a broken QR).
export function projectUrl(project, state) {
  if (!hasValidProjectId(project, state)) return null;
  if (!APP_BASE_URL || LOCAL_RE.test(APP_BASE_URL)) return null;
  // Hash route — the app is a static SPA with hash-based routing, so a bare
  // /projects/<id> path would 404 on Netlify. The "#/" makes it resolve.
  return `${APP_BASE_URL}/#/projects/${project.id}`;
}

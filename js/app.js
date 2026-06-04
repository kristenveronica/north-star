/* ============================================================
   app.js — Entry point.
   - Seeds sample data on first run.
   - Mounts the router.
   - Re-renders when state changes.
   ============================================================ */

import { getState } from "./store.js";
import { seedIfEmpty } from "./seed.js";
import { mountRouter, registerRoute, currentPath, navigate } from "./router.js";
import { renderSidebar } from "./components/sidebar.js";
import { startCountdownTicker } from "./components/ui.js";
import { enableAutoVoice } from "./components/voiceInput.js";
import { logoMarkSVG } from "./components/logo.js";

import { renderOnboarding } from "./views/onboarding.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderFamilyVision } from "./views/familyVision.js";
import { renderChildren, renderChildDetail } from "./views/children.js";
import { renderLearningStyle } from "./views/learningStyle.js";
import { renderDomains } from "./views/domains.js";
import { renderMaterials } from "./views/materials.js";
import { renderCart } from "./views/cart.js";
import { renderProjects, renderProjectDetail } from "./views/projects.js";
import { renderTermPlanner } from "./views/termPlanner.js";
import { renderCalendar } from "./views/calendar.js";
import { renderRewards } from "./views/rewards.js";
import { renderProgress } from "./views/progress.js";
import { renderPortfolio } from "./views/portfolio.js";
import { renderSettings } from "./views/settings.js";
import { renderChildPortal, renderChildLogin, renderChildProjectHQ } from "./views/childPortal.js";
import { renderReports, renderReportDetail } from "./views/reports.js";
import { renderInsights, renderInsightsReports, renderInsightReportDetail } from "./views/insights.js";
import { renderGuild, renderGuildSettings } from "./views/guild.js";
import { renderCouncils, renderCouncilDetail } from "./views/councils.js";
import { renderLegacy } from "./views/legacy.js";
import {
  renderPublicShell, renderHome, renderAbout, renderHowItWorks,
  renderFeaturesPublic, renderPricing, renderContact, renderLogin, renderSignup,
} from "./views/marketing.js";
import { hasAccount, isLoggedIn } from "./auth.js";

/* ---------- First-run seed ---------- */
seedIfEmpty();

/* ---------- Layout shells ---------- */
function withParentShell(container, viewFn, params) {
  if (!getState().meta.onboarded) {
    return renderOnboarding(container);
  }
  // Auth gate — if an account exists but the session has expired, send to /login.
  if (hasAccount() && !isLoggedIn()) {
    location.hash = "#/login";
    return;
  }
  const shell = document.createElement("div");
  shell.className = "app-shell";
  shell.innerHTML = `${renderSidebar()}<main class="main" id="main-content"></main>`;
  container.appendChild(shell);
  viewFn(shell.querySelector("#main-content"), params);
  // Wire sidebar logout (only present when an account exists)
  shell.querySelector("[data-logout]")?.addEventListener("click", async (e) => {
    e.preventDefault();
    const { logout } = await import("./auth.js");
    const { toast } = await import("./components/ui.js");
    logout();
    toast("Logged out");
    navigate("/login");
  });
}

function withChildShell(container, viewFn, params) {
  const root = document.createElement("div");
  root.className = "child-portal";
  container.appendChild(root);
  viewFn(root, params);
}

function withPublicShell(viewFn) {
  return (container) => renderPublicShell(container, viewFn);
}

// Smart root:
//  - not yet onboarded → marketing home
//  - onboarded + account exists + logged out → login
//  - onboarded + (no account OR logged in) → dashboard
function smartRoot(container, params) {
  if (!getState().meta.onboarded) {
    renderPublicShell(container, renderHome);
  } else if (hasAccount() && !isLoggedIn()) {
    location.hash = "#/login";
  } else {
    withParentShell(container, renderDashboard, params);
  }
}

/* ---------- Route table ---------- */
registerRoute("/",            smartRoot);
registerRoute("/reset", () => {
  if (confirm("Wipe all local data and start fresh as a new visitor?")) {
    localStorage.removeItem("northstar::v1");
    location.hash = "#/welcome";
    location.reload();
  } else {
    history.back();
  }
});
registerRoute("/welcome",      withPublicShell(renderHome));
registerRoute("/about",        withPublicShell(renderAbout));
registerRoute("/how-it-works", withPublicShell(renderHowItWorks));
registerRoute("/features",     withPublicShell(renderFeaturesPublic));
registerRoute("/pricing",      withPublicShell(renderPricing));
registerRoute("/contact",      withPublicShell(renderContact));
registerRoute("/login",        withPublicShell(renderLogin));
registerRoute("/signup",       withPublicShell(renderSignup));
registerRoute("/onboarding",   (c) => renderOnboarding(c));
registerRoute("/vision",    (c, p) => withParentShell(c, renderFamilyVision, p));
registerRoute("/children",  (c, p) => withParentShell(c, renderChildren, p));
registerRoute("/children/:id", (c, p) => withParentShell(c, renderChildDetail, p));
registerRoute("/style",     (c, p) => withParentShell(c, renderLearningStyle, p));
registerRoute("/domains",   (c, p) => withParentShell(c, renderDomains, p));
registerRoute("/materials", (c, p) => withParentShell(c, renderMaterials, p));
registerRoute("/cart",      (c, p) => withParentShell(c, renderCart, p));
registerRoute("/projects",  (c, p) => withParentShell(c, renderProjects, p));
registerRoute("/projects/:id", (c, p) => withParentShell(c, renderProjectDetail, p));
registerRoute("/planner",   (c, p) => withParentShell(c, renderTermPlanner, p));
registerRoute("/calendar",  (c, p) => withParentShell(c, renderCalendar, p));
registerRoute("/rewards",   (c, p) => withParentShell(c, renderRewards, p));
registerRoute("/progress",  (c, p) => withParentShell(c, renderProgress, p));
registerRoute("/portfolio", (c, p) => withParentShell(c, renderPortfolio, p));
registerRoute("/reports",   (c, p) => withParentShell(c, renderReports, p));
registerRoute("/reports/:id", (c, p) => withParentShell(c, renderReportDetail, p));
registerRoute("/insights",            (c, p) => withParentShell(c, renderInsights, p));
registerRoute("/insights-reports",    (c, p) => withParentShell(c, renderInsightsReports, p));
registerRoute("/insights-reports/:id", (c, p) => withParentShell(c, renderInsightReportDetail, p));
registerRoute("/guild",          (c, p) => withParentShell(c, renderGuild, p));
registerRoute("/guild/settings", (c, p) => withParentShell(c, renderGuildSettings, p));
registerRoute("/councils",       (c, p) => withParentShell(c, renderCouncils, p));
registerRoute("/councils/:id",   (c, p) => withParentShell(c, renderCouncilDetail, p));
registerRoute("/legacy",         (c, p) => withParentShell(c, renderLegacy, p));
registerRoute("/settings",  (c, p) => withParentShell(c, renderSettings, p));

// child portal
registerRoute("/kid",          (c)    => withChildShell(c, renderChildLogin));
registerRoute("/kid/:code",    (c, p) => withChildShell(c, renderChildPortal, p));
registerRoute("/kid/:code/project/:projectId", (c, p) => withChildShell(c, renderChildProjectHQ, p));

/* ---------- Boot ---------- */
const app = document.getElementById("app");
mountRouter(app);
startCountdownTicker();
enableAutoVoice();

// SVG favicon — Heirloom Compass mark.
(function installFavicon() {
  const svg = logoMarkSVG(64);
  const href = "data:image/svg+xml," + encodeURIComponent(svg);
  const existing = document.querySelector('link[rel~="icon"]');
  if (existing) existing.href = href;
  else {
    const link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    link.href = href;
    document.head.appendChild(link);
  }
})();

/* Expose helpers for debugging + cross-view re-render via window. */
export function rerender() {
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
window.HS = { getState, navigate, rerender };

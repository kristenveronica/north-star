/* ============================================================
   app.js — Entry point.
   - Seeds sample data on first run.
   - Mounts the router.
   - Re-renders when state changes.
   ============================================================ */

import { getState, setCloudSync, resetToLoggedOut } from "./store.js";
import { syncCore, ensureFamilyAndHydrate, setPendingCheckout, isOnboardingParked } from "./lib/repo.js";
import { mountRouter, registerRoute, currentPath, navigate } from "./router.js";
import { renderSidebar } from "./components/sidebar.js";
import { startCountdownTicker, esc } from "./components/ui.js";
import { currentMember, canAccessPath, getViewAs, setViewAs, clearViewAs } from "./lib/permissions.js";
import { enableAutoVoice } from "./components/voiceInput.js";
import { logoMarkSVG } from "./components/logo.js";

import { renderOnboarding } from "./views/onboarding.js";
import { renderInviteAccept } from "./views/inviteAccept.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderFamilyVision } from "./views/familyVision.js";
import { renderChildren, renderChildDetail } from "./views/children.js";
import { renderLearningStyle } from "./views/learningStyle.js";
import { renderTechAgreement } from "./views/technology.js";
import { renderDomains } from "./views/domains.js";
import { renderResources } from "./views/materials.js";
import { renderInventory } from "./views/inventory.js";
import { renderCart } from "./views/cart.js";
import { renderProjects, renderProjectDetail } from "./views/projects.js";
import { renderCalendar } from "./views/calendar.js";
import { renderRewards } from "./views/rewards.js";
import { renderPortfolio } from "./views/portfolio.js";
import { renderSettings } from "./views/settings.js";
import { renderChildPortal, renderChildLogin, renderChildProjectHQ } from "./views/childPortal.js";
import { renderReports, renderReportDetail } from "./views/reports.js";
import { renderInsights, renderInsightsReports, renderInsightReportDetail } from "./views/insights.js";
import { renderCouncils, renderCouncilDetail } from "./views/councils.js";
import { renderPlatformDiscovery } from "./views/platformDiscovery.js";
import { renderFamilySettings } from "./views/familySettings.js";
import { renderReflections } from "./views/reflections.js";
import {
  renderPublicShell, renderHome, renderAbout, renderHowItWorks,
  renderFeaturesPublic, renderTrustCharter, renderPricing, renderContact, renderLogin, renderSignup, renderResetPassword,
} from "./views/marketing.js";
import { initAuth, isLoggedIn, onAuthChange, currentUserId } from "./auth.js";

/* ---------- Layout shells ---------- */
// The sidebar is rebuilt on every navigation/rerender, which would reset its
// scroll to the top. We remember where the user scrolled it and restore that
// position after each rebuild, so deep menu items stay in view.
let _sidebarScroll = 0;

// Per-route main-content scroll memory (session only). Returning to a page
// restores the exact vertical position the user left it at — like a modern
// shopping site — while a first visit lands at the top.
const _scrollByPath = {};
let _scrollTrackingInit = false;
function initScrollTracking() {
  if (_scrollTrackingInit) return;
  _scrollTrackingInit = true;
  window.addEventListener("scroll", () => { _scrollByPath[location.hash] = window.scrollY; }, { passive: true });
}

export function withParentShell(container, viewFn, params) {
  // The parent app requires a real account.
  if (!isLoggedIn()) {
    location.hash = "#/login";
    return;
  }
  // Signed in but the family hasn't completed onboarding yet. We still send them
  // to onboarding on first run — UNLESS they've chosen to "park" it and look
  // around first, in which case they get the dashboard (with a resume banner)
  // and can finish onboarding whenever they're ready.
  if (!getState().meta.onboarded && !isOnboardingParked()) {
    return renderOnboarding(container);
  }

  // Permission guard: the CURRENT user (Owner, or a member being previewed via
  // View-as) must be allowed here. Disallowed pages don't exist for them — send
  // them to their dashboard (always permitted) rather than render a locked page.
  const member = currentMember(getState());
  const reqPath = (location.hash || "#/").slice(1).split("?")[0] || "/";
  if (!canAccessPath(member, reqPath) && reqPath !== "/") {
    location.hash = "#/";
    return;
  }

  const shell = document.createElement("div");
  shell.className = "app-shell";
  // Mobile/tablet: a top bar with a hamburger reveals the sidebar as a slide-in
  // drawer (the sidebar is off-canvas on small screens). Hidden on desktop via CSS.
  shell.innerHTML = `
    <header class="mobile-topbar">
      <button class="nav-toggle" aria-label="Open menu" aria-expanded="false">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <span class="mobile-topbar-brand">${logoMarkSVG(22)}<span>North Star</span></span>
    </header>
    <div class="nav-scrim" hidden></div>
    ${renderSidebar()}
    <main class="main" id="main-content"></main>`;
  container.appendChild(shell);

  // Drawer open/close (mobile only; harmless on desktop where these are hidden).
  const navToggle = shell.querySelector(".nav-toggle");
  const navScrim = shell.querySelector(".nav-scrim");
  const openNav = () => { shell.classList.add("nav-open"); navToggle?.setAttribute("aria-expanded", "true"); if (navScrim) navScrim.hidden = false; };
  const closeNav = () => { shell.classList.remove("nav-open"); navToggle?.setAttribute("aria-expanded", "false"); if (navScrim) navScrim.hidden = true; };
  navToggle?.addEventListener("click", () => shell.classList.contains("nav-open") ? closeNav() : openNav());
  navScrim?.addEventListener("click", closeNav);
  // Any sidebar link/action closes the drawer (navigation also rebuilds the shell).
  // The collapsible-section toggle is excluded — expanding "Set up" shouldn't
  // close the drawer out from under the user.
  shell.querySelectorAll(".sidebar a, .sidebar [data-view-as], .sidebar button:not([data-nav-toggle])").forEach(el => el.addEventListener("click", closeNav));

  // Collapsible "Set up your family" nav section — toggle open/closed and
  // remember the choice (so it stays put across navigation / re-renders).
  shell.querySelectorAll("[data-nav-toggle]").forEach(btn => btn.addEventListener("click", (e) => {
    e.preventDefault();
    const section = btn.closest(".nav-section");
    if (!section) return;
    const collapsed = section.classList.toggle("collapsed");
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    try { localStorage.setItem("ns::nav::setup", collapsed ? "closed" : "open"); } catch { /* ignore */ }
  }));

  // Owner-only "View as" — preview any member's portal. Set/clear is session-only.
  shell.querySelectorAll("[data-view-as]").forEach(a => a.addEventListener("click", (e) => {
    e.preventDefault();
    setViewAs(a.dataset.viewAs);
    location.hash = "#/";
    rerender();
  }));
  // Restore the sidebar's scroll position and keep tracking it as the user scrolls.
  const sidebarEl = shell.querySelector(".sidebar");
  if (sidebarEl) {
    sidebarEl.scrollTop = _sidebarScroll;
    sidebarEl.addEventListener("scroll", () => { _sidebarScroll = sidebarEl.scrollTop; }, { passive: true });
  }
  const mainEl = shell.querySelector("#main-content");
  viewFn(mainEl, params);

  // Previewing a member's portal? Show a calm banner with an exit (Owner only).
  if (getViewAs()) {
    mainEl.insertAdjacentHTML("afterbegin", `
      <div class="suggestion-banner" style="margin:0 0 16px;border-color:var(--gold)">
        <div class="row" style="gap:10px;align-items:center;flex-wrap:wrap">
          <span style="flex:1;min-width:220px">👁️ <strong>Previewing ${esc(member.name || "this member")}'s portal</strong> — you're seeing exactly what they see. You're still acting as the Owner; this is just a preview of their navigation and access.</span>
          <button class="btn btn-sm" data-exit-view>Exit preview</button>
        </div>
      </div>`);
    mainEl.querySelector("[data-exit-view]")?.addEventListener("click", () => {
      clearViewAs();
      location.hash = "#/";
      rerender();
    });
  }

  // Restore this route's main-content scroll position (0 on first visit).
  initScrollTracking();
  const savedY = _scrollByPath[location.hash] || 0;
  requestAnimationFrame(() => {
    window.scrollTo(0, savedY);
    requestAnimationFrame(() => window.scrollTo(0, savedY));
  });
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

export function withChildShell(container, viewFn, params) {
  const root = document.createElement("div");
  root.className = "child-portal";
  container.appendChild(root);
  viewFn(root, params);
}

function withPublicShell(viewFn) {
  return (container) => renderPublicShell(container, viewFn);
}

// Smart root:
//  - logged out → marketing home
//  - logged in + not onboarded → onboarding (via withParentShell)
//  - logged in + onboarded → dashboard
function smartRoot(container, params) {
  if (!isLoggedIn()) {
    renderPublicShell(container, renderHome);
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
registerRoute("/trust",        withPublicShell(renderTrustCharter));
registerRoute("/pricing",      withPublicShell(renderPricing));
registerRoute("/contact",      withPublicShell(renderContact));
registerRoute("/login",        withPublicShell(renderLogin));
registerRoute("/signup",       withPublicShell(renderSignup));
registerRoute("/reset-password", withPublicShell(renderResetPassword));
registerRoute("/onboarding",   (c) => renderOnboarding(c));
registerRoute("/invite/:token", (c, p) => renderInviteAccept(c, p));
// Ghost page: a standalone, unlinked white-label discovery form (no public nav/footer).
registerRoute("/discover",     (c) => renderPlatformDiscovery(c));
registerRoute("/vision",    (c, p) => withParentShell(c, renderFamilyVision, p));
registerRoute("/family-settings", (c, p) => withParentShell(c, renderFamilySettings, p));
registerRoute("/children",  (c, p) => withParentShell(c, renderChildren, p));
registerRoute("/children/:id", (c, p) => withParentShell(c, renderChildDetail, p));
// Learning Profile / Insights / Technology are tabs inside the child hub.
registerRoute("/children/:id/:tab", (c, p) => withParentShell(c, renderChildDetail, p));
registerRoute("/style",     (c, p) => withParentShell(c, renderLearningStyle, p));
registerRoute("/technology/:childId", (c, p) => withParentShell(c, renderTechAgreement, p));
registerRoute("/domains",   (c, p) => withParentShell(c, renderDomains, p));
registerRoute("/materials", (c, p) => withParentShell(c, renderResources, p));
registerRoute("/inventory", (c, p) => withParentShell(c, renderInventory, p));
registerRoute("/cart",      (c, p) => withParentShell(c, renderCart, p));
registerRoute("/projects",  (c, p) => withParentShell(c, renderProjects, p));
registerRoute("/projects/:id", (c, p) => withParentShell(c, renderProjectDetail, p));
registerRoute("/calendar",  (c, p) => withParentShell(c, renderCalendar, p));
registerRoute("/rewards",   (c, p) => withParentShell(c, renderRewards, p));
registerRoute("/portfolio", (c, p) => withParentShell(c, renderPortfolio, p));
registerRoute("/reflections", (c, p) => withParentShell(c, renderReflections, p));
registerRoute("/reports",   (c, p) => withParentShell(c, renderReports, p));
registerRoute("/reports/:id", (c, p) => withParentShell(c, renderReportDetail, p));
registerRoute("/insights",            (c, p) => withParentShell(c, renderInsights, p));
registerRoute("/insights-reports",    (c, p) => withParentShell(c, renderInsightsReports, p));
registerRoute("/insights-reports/:id", (c, p) => withParentShell(c, renderInsightReportDetail, p));
registerRoute("/councils",       (c, p) => withParentShell(c, renderCouncils, p));
registerRoute("/councils/:id",   (c, p) => withParentShell(c, renderCouncilDetail, p));
registerRoute("/settings",  (c, p) => withParentShell(c, renderSettings, p));

// child portal
registerRoute("/kid",          (c)    => withChildShell(c, renderChildLogin));
registerRoute("/kid/:code",    (c, p) => withChildShell(c, renderChildPortal, p));
registerRoute("/kid/:code/project/:projectId", (c, p) => withChildShell(c, renderChildProjectHQ, p));

/* ---------- Boot ---------- */
const app = document.getElementById("app");

// Wire write-behind cloud sync into the store.
setCloudSync(syncCore);

// If we returned from the public pricing-page checkout, stash the Stripe session
// id (survives the sign-up flow) so the next hydrate links the paid subscription
// to this account; then tidy the URL so it isn't re-processed.
(function captureCheckoutSession() {
  try {
    const sid = new URLSearchParams(location.search).get("checkout_session");
    if (!sid) return;
    setPendingCheckout(sid);
    const url = new URL(location.href);
    url.searchParams.delete("checkout_session");
    history.replaceState(null, "", url.pathname + url.search + url.hash);
  } catch { /* ignore */ }
})();

// Which user id the local store is currently hydrated for. Guards against
// re-hydrating on every auth event — Supabase fires onAuthStateChange for
// TOKEN_REFRESHED / INITIAL_SESSION / USER_UPDATED too, and a blind re-hydrate
// on those would overwrite the local store from the cloud, wiping any change
// (e.g. a just-generated project) that hasn't finished its debounced sync yet.
let _hydratedUid = null;

(async () => {
  await initAuth();
  if (isLoggedIn()) {
    try { await ensureFamilyAndHydrate(); _hydratedUid = currentUserId(); }
    catch (e) { console.error("[boot] hydrate failed", e); }
  }
  mountRouter(app);
  startCountdownTicker();
  enableAutoVoice();

  // React to login/logout happening from anywhere in the app.
  onAuthChange(async (session) => {
    const uid = session?.user?.id || null;
    if (!uid) {
      // Signed out.
      _hydratedUid = null;
      resetToLoggedOut();
      rerender();
      return;
    }
    // Same user as we're already hydrated for (token refresh, tab focus, etc.) —
    // do NOT re-hydrate: it would clobber unsynced local changes. Nothing to do.
    if (uid === _hydratedUid) return;
    // A genuine sign-in / account switch → hydrate that user's data.
    try { await ensureFamilyAndHydrate(); _hydratedUid = uid; }
    catch (e) { console.error("[auth] hydrate failed", e); }
    rerender();
  });
})();

// Favicon is now served statically (favicon.svg + PNG/apple-touch) from index.html.

/* Expose helpers for debugging + cross-view re-render via window. */
export function rerender() {
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
window.HS = { getState, navigate, rerender };

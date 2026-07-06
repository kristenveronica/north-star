/* ============================================================
   sidebar.js — Parent portal nav. Grouped sections.
   ============================================================ */
import { icon } from "./ui.js";
import { currentPath } from "../router.js";
import { getState } from "../store.js";
import { hasAccount, currentUserEmail } from "../auth.js";
import { logoLockup } from "./logo.js";
import { currentMember, canAccessPath, getViewAs } from "../lib/permissions.js";

const GROUPS = [
  {
    label: "Home",
    items: [
      { label: "Dashboard", path: "/", icon: "home" },
    ],
  },
  {
    // The "set up your family" tabs — configured during onboarding and revisited
    // only occasionally. Collapsed into a single expandable header once onboarding
    // is complete, so the daily-use pages below sit at the top of the nav.
    label: "Set up your family",
    key: "setup",
    collapsible: true,
    items: [
      { label: "Family North Star", path: "/vision", icon: "vision" },
      { label: "Family", path: "/family-settings", icon: "familySettings" },
      { label: "Children", path: "/children", icon: "children" },
      { label: "Capability Domains", path: "/domains", icon: "domains" },
      { label: "Family Inventory", path: "/inventory", icon: "inventory" },
      { label: "Learning Resources", path: "/materials", icon: "materials" },
      { label: "Family Councils", path: "/councils", icon: "council" },
    ],
  },
  {
    label: "Plan",
    items: [
      { label: "Projects", path: "/projects", icon: "projects" },
      { label: "Calendar", path: "/calendar", icon: "calendar" },
      { label: "Rewards & Tolls", path: "/rewards", icon: "reward" },
    ],
  },
  {
    label: "Track",
    items: [
      { label: "Reflections", path: "/reflections", icon: "vision" },
      { label: "Portfolio", path: "/portfolio", icon: "portfolio" },
      { label: "Growth Reports", path: "/reports", icon: "report" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Settings", path: "/settings", icon: "settings" },
    ],
  },
];

export function renderSidebar() {
  const path = currentPath();
  const s = getState();
  const plannedCount = (s.materials || []).filter(m => m.status === "planned").length;

  // Dynamic navigation: built from the CURRENT user's permissions. Pages they
  // can't access are omitted entirely (never shown disabled), and empty groups
  // disappear — so each person's portal feels intentionally designed for them.
  const member = currentMember(s);
  const viewing = getViewAs();
  const groups = GROUPS
    .map(g => ({ ...g, items: g.items.filter(item => canAccessPath(member, item.path)) }))
    .filter(g => g.items.length);

  // Collapsible "Set up your family" section: collapsed by default once the
  // family has finished onboarding (so daily pages sit at the top), expanded
  // while they're still setting up. An explicit user toggle is remembered.
  const onboarded = !!s.meta?.onboarded;
  let setupPref = null;
  try { setupPref = localStorage.getItem("ns::nav::setup"); } catch { /* ignore */ }
  const setupOpenByDefault = setupPref ? setupPref === "open" : !onboarded;
  const canSeeChildPortals = canAccessPath(member, "/children");
  const previewable = !viewing ? (s.family?.relationships || []).filter(r => r.name && r.id) : [];

  return `
    <aside class="sidebar">
      <div class="sidebar-brand-block">
        ${logoLockup({ size: 34, variant: "light", href: "#/", className: "sidebar-brand" })}
        <div class="sidebar-family-name">${escapeHtml(s.family?.familyName || "Your Family Journey")}</div>
      </div>

      ${groups.map(g => {
        const itemsHtml = g.items.map(item => `
            <a class="nav-item ${path === item.path || (item.path !== "/" && path.startsWith(item.path)) ? "active" : ""}" href="#${item.path}">
              <span class="ico">${icon(item.icon)}</span>
              <span>${item.label}</span>
              ${item.path === "/materials" && plannedCount ? `<span class="badge">${plannedCount}</span>` : ""}
              ${item.premium ? `<span class="badge" style="background:var(--gold-soft);color:var(--gold-ink)">Premium</span>` : ""}
            </a>
          `).join("");
        if (!g.collapsible) {
          return `
        <div class="nav-section">
          <div class="nav-label">${g.label}</div>
          ${itemsHtml}
        </div>`;
        }
        // Collapsible group: keep it open if the user is currently ON one of its
        // pages (so the active tab is always visible), else honour the default.
        const onOwnPage = g.items.some(i => path === i.path || (i.path !== "/" && path.startsWith(i.path)));
        const open = setupOpenByDefault || onOwnPage;
        return `
        <div class="nav-section nav-section--collapsible ${open ? "" : "collapsed"}">
          <button class="nav-label nav-label--toggle" data-nav-toggle="${g.key}" aria-expanded="${open ? "true" : "false"}">
            <span>${g.label}</span>
            <svg class="nav-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div class="nav-section-items">${itemsHtml}</div>
        </div>`;
      }).join("")}

      ${canSeeChildPortals && (s.children || []).length ? `
        <div class="nav-section">
          <div class="nav-label">Child Portals</div>
          ${(s.children || []).map(c => `
            <a class="nav-item" href="#/kid/${c.accessCode}">
              <span class="child-card-avatar avatar-${c.avatarIndex}" style="width:24px;height:24px;font-size:11px">${initials(c.name)}</span>
              <span>${escapeHtml(c.name)}'s view</span>
            </a>
          `).join("")}
        </div>` : ""}

      ${previewable.length ? `
        <div class="nav-section">
          <div class="nav-label">Preview a portal</div>
          ${previewable.map(r => `
            <a class="nav-item" href="#" data-view-as="${escapeHtml(r.id)}">
              <span class="ico">${icon("child")}</span>
              <span>View as ${escapeHtml(r.name)}</span>
              <span class="badge" style="background:var(--card-elev);color:var(--text-muted)">${r.accessLevel === "owner" ? "Owner" : "Contributor"}</span>
            </a>
          `).join("")}
        </div>` : ""}

      <div class="sidebar-footer">
        ${hasAccount() ? `
          <div class="sidebar-account">
            <div class="small text-muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(currentUserEmail() || "")}</div>
            <a href="#" data-logout class="btn btn-ghost btn-sm" style="padding:4px 8px;font-size:12px">Log out</a>
          </div>
        ` : `
          <a href="#/settings" class="small">Set up local login →</a>
        `}
        <div class="small text-muted" style="margin-top:6px">v1.0 MVP · ${new Date().getFullYear()}</div>
      </div>
    </aside>
  `;
}

function initials(name) {
  return (name || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
}
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

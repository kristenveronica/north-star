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
    label: "Plan",
    items: [
      { label: "Family North Star", path: "/vision", icon: "vision" },
      { label: "Family Settings", path: "/family-settings", icon: "familySettings" },
      { label: "Children", path: "/children", icon: "children" },
      { label: "Learning Profile", path: "/style", icon: "style" },
      { label: "Capability Domains", path: "/domains", icon: "domains" },
      { label: "Family Inventory", path: "/inventory", icon: "inventory" },
      { label: "Learning Resources", path: "/materials", icon: "materials" },
      { label: "Projects", path: "/projects", icon: "projects" },
      { label: "Learning Apps", path: "/apps", icon: "insights" },
      { label: "Term Planner", path: "/planner", icon: "plan" },
      { label: "Calendar", path: "/calendar", icon: "calendar" },
      { label: "Rewards & Tolls", path: "/rewards", icon: "reward" },
    ],
  },
  {
    label: "Track",
    items: [
      { label: "Progress", path: "/progress", icon: "progress" },
      { label: "Reflections", path: "/reflections", icon: "vision" },
      { label: "Portfolio", path: "/portfolio", icon: "portfolio" },
      { label: "Growth Reports", path: "/reports", icon: "report" },
      { label: "Child Insights", path: "/insights", icon: "insights", premium: true },
    ],
  },
  {
    label: "Community",
    items: [
      { label: "The Learning Guild", path: "/guild", icon: "guild", premium: true },
      { label: "Family Councils", path: "/councils", icon: "council" },
      { label: "Family Legacy", path: "/legacy", icon: "legacy" },
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
  const cartCount = s.cart.length;

  // Dynamic navigation: built from the CURRENT user's permissions. Pages they
  // can't access are omitted entirely (never shown disabled), and empty groups
  // disappear — so each person's portal feels intentionally designed for them.
  const member = currentMember(s);
  const viewing = getViewAs();
  const groups = GROUPS
    .map(g => ({ ...g, items: g.items.filter(item => canAccessPath(member, item.path)) }))
    .filter(g => g.items.length);
  const canSeeChildPortals = canAccessPath(member, "/children");
  const previewable = !viewing ? (s.family?.relationships || []).filter(r => r.name && r.id) : [];

  return `
    <aside class="sidebar">
      <div class="sidebar-brand-block">
        ${logoLockup({ size: 34, variant: "light", href: "#/", className: "sidebar-brand" })}
        <div class="sidebar-family-name">${escapeHtml(s.family?.familyName || "Your Family Journey")}</div>
      </div>

      ${groups.map(g => `
        <div class="nav-section">
          <div class="nav-label">${g.label}</div>
          ${g.items.map(item => `
            <a class="nav-item ${path === item.path || (item.path !== "/" && path.startsWith(item.path)) ? "active" : ""}" href="#${item.path}">
              <span class="ico">${icon(item.icon)}</span>
              <span>${item.label}</span>
              ${item.path === "/materials" && cartCount ? `<span class="badge">${cartCount}</span>` : ""}
              ${item.premium ? `<span class="badge" style="background:var(--gold-soft);color:var(--gold-ink)">Premium</span>` : ""}
            </a>
          `).join("")}
        </div>
      `).join("")}

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

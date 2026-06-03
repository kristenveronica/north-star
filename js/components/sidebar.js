/* ============================================================
   sidebar.js — Parent portal nav. Grouped sections.
   ============================================================ */
import { icon } from "./ui.js";
import { currentPath } from "../router.js";
import { getState } from "../store.js";
import { hasAccount, currentUserEmail } from "../auth.js";

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
      { label: "Children", path: "/children", icon: "children" },
      { label: "Learning Style", path: "/style", icon: "style" },
      { label: "Learning Domains", path: "/domains", icon: "domains" },
      { label: "Suggested Materials", path: "/materials", icon: "materials" },
      { label: "Projects", path: "/projects", icon: "projects" },
      { label: "Term Planner", path: "/planner", icon: "plan" },
      { label: "Calendar", path: "/calendar", icon: "calendar" },
      { label: "Rewards & Tolls", path: "/rewards", icon: "reward" },
    ],
  },
  {
    label: "Track",
    items: [
      { label: "Progress", path: "/progress", icon: "progress" },
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

  return `
    <aside class="sidebar">
      <a class="sidebar-brand" href="#/" style="text-decoration:none;color:inherit">
        <div class="brand-mark brand-mark-star">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 1l2.4 7.6L22 10l-6.2 4.6L18 22l-6-4.6L6 22l2.2-7.4L2 10l7.6-1.4z"/></svg>
        </div>
        <div>
          <div class="brand-text">North Star</div>
          <div class="brand-sub">${escapeHtml(s.family?.familyName || "Your Family Journey")}</div>
        </div>
      </a>

      ${GROUPS.map(g => `
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

      <div class="nav-section">
        <div class="nav-label">Child Portals</div>
        ${(s.children || []).map(c => `
          <a class="nav-item" href="#/kid/${c.accessCode}">
            <span class="child-card-avatar avatar-${c.avatarIndex}" style="width:24px;height:24px;font-size:11px">${initials(c.name)}</span>
            <span>${escapeHtml(c.name)}'s view</span>
          </a>
        `).join("")}
      </div>

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

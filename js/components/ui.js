/* ============================================================
   ui.js — Shared UI helpers (toast, modal, icons, formatting).
   ============================================================ */

/* ---------- Templating helpers ---------- */
export function el(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

export function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ---------- Toast ---------- */
export function toast(message, opts = {}) {
  const host = document.getElementById("toast-host");
  const t = el(`<div class="toast ${opts.type || ""}">${esc(message)}</div>`);
  host.appendChild(t);
  setTimeout(() => {
    t.style.transition = "opacity 0.3s ease";
    t.style.opacity = "0";
    setTimeout(() => t.remove(), 320);
  }, opts.duration || 2400);
}

/* ---------- Modal ---------- */
export function openModal({ title, body, footer, onClose }) {
  const host = document.getElementById("modal-host");
  const root = el(`
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-head">
          <h2>${esc(title)}</h2>
          <button class="btn btn-ghost btn-sm" data-close>✕</button>
        </div>
        <div class="modal-body"></div>
        ${footer ? '<div class="modal-foot"></div>' : ""}
      </div>
    </div>
  `);
  const bodyHost = root.querySelector(".modal-body");
  if (typeof body === "string") bodyHost.innerHTML = body;
  else if (body instanceof Node) bodyHost.appendChild(body);

  if (footer) {
    const footHost = root.querySelector(".modal-foot");
    if (typeof footer === "string") footHost.innerHTML = footer;
    else footHost.appendChild(footer);
  }

  const close = () => {
    root.remove();
    onClose?.();
  };
  root.addEventListener("click", (e) => {
    if (e.target === root || e.target.matches("[data-close]")) close();
  });
  host.appendChild(root);
  return { close, root };
}

/* ---------- Confirm dialog ---------- */
export function confirmDialog({ title, message, confirmLabel = "Confirm", danger = false }) {
  return new Promise(resolve => {
    // Settle exactly once. Closing the modal fires onClose → resolve(false); the
    // OK/Cancel handlers must record their answer BEFORE they close, or the
    // onClose(false) would clobber a "confirm" (the classic "Owner grant / delete
    // does nothing" bug — OK was silently resolving false).
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    const foot = el(`<div class="row" style="gap:10px;justify-content:flex-end;width:100%">
      <button class="btn" data-cancel>Cancel</button>
      <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-ok>${esc(confirmLabel)}</button>
    </div>`);
    const m = openModal({
      title,
      body: `<p class="text-muted">${esc(message)}</p>`,
      footer: foot,
      onClose: () => done(false),
    });
    foot.querySelector("[data-cancel]").addEventListener("click", () => { done(false); m.close(); });
    foot.querySelector("[data-ok]").addEventListener("click", () => { done(true); m.close(); });
  });
}

/* ---------- Icons (inline SVG) ---------- */
const ICONS = {
  home: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>`,
  vision: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/></svg>`,
  children: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20c0-3 3-5 6-5s6 2 6 5"/><path d="M14 20c0-2 2-3.5 4-3.5s4 1.5 4 3.5"/></svg>`,
  style: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18"/><circle cx="9" cy="12" r="3" fill="currentColor"/></svg>`,
  plan: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>`,
  domains: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5 7c3 1 11 1 14 0M5 17c3-1 11-1 14 0"/></svg>`,
  materials: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-6 9 6-9 6-9-6z"/><path d="M3 15l9 6 9-6"/></svg>`,
  projects: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l9-4 9 4v10l-9 4-9-4V7z"/><path d="M3 7l9 4 9-4M12 11v10"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>`,
  reward: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M8 13l-2 8 6-3 6 3-2-8"/></svg>`,
  progress: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-6M22 20h-20"/></svg>`,
  portfolio: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 6V4h8v2"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1c.6.5 1.3.9 2 1.2L10 21h4l.5-2.7c.7-.3 1.4-.7 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.2-.8.2-1.2z"/></svg>`,
  cart: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l3 12h12l2-8H6"/></svg>`,
  child: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"/></svg>`,
  star: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2l3 7 7 .8-5.3 4.9 1.6 7-6.3-3.7-6.3 3.7 1.6-7L2 9.8 9 9z"/></svg>`,
  starOutline: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 2l3 7 7 .8-5.3 4.9 1.6 7-6.3-3.7-6.3 3.7 1.6-7L2 9.8 9 9z"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  check: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5 11-12"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16z"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>`,
  report: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 14l3 3 5-5"/></svg>`,
  mic: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg>`,
  micFilled: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11h1.5a5.5 5.5 0 0 0 11 0H19a7 7 0 0 1-6 6.9V21h3v1.5H8V21h3v-3.1A7 7 0 0 1 5 11z"/></svg>`,
  insights: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M9 21h6M10 18h4"/><path d="M12 9v6"/></svg>`,
  guild: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 19c0-3 3-5 6-5s6 2 6 5"/><path d="M15 19c0-2 2-3.5 4-3.5s4 1.5 4 3.5"/></svg>`,
  council: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="9" width="16" height="9" rx="2"/><path d="M6 9V6h12v3M8 18v3M16 18v3"/></svg>`,
  legacy: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M4 8h16M8 4v16"/></svg>`,
  familySettings: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M12 14a2 2 0 1 0 0-.01"/><path d="M12 16v2"/></svg>`,
  inventory: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/><path d="M7.5 5.5l9 4"/></svg>`,
};
export function icon(name) {
  return ICONS[name] || "";
}

/* ---------- Line icon set (28×28, no emojis) ----------
   A consistent stroke-based icon vocabulary for the marketing
   site, dashboards and feature cards. Premium, calm, editorial.
*/
const _NS_ICON_SVG = {
  compass: `<circle cx="14" cy="14" r="10.5"/><circle cx="14" cy="14" r="6.5"/><path d="M14 7.5l2.4 4.8L14 14l-2.4-2.7L14 7.5z" fill="currentColor" stroke="none"/><path d="M14 14l2.4 2.7-2.4 4.8-2.4-4.8z"/><circle cx="14" cy="14" r="1" fill="currentColor" stroke="none"/>`,
  star: `<path d="M14 4l2.9 6.6 7.1.7-5.4 4.8 1.7 7-6.3-4-6.3 4 1.7-7L4 11.3l7.1-.7z"/>`,
  spark: `<path d="M14 3v6M14 19v6M3 14h6M19 14h6M6.5 6.5l3.5 3.5M18 18l3.5 3.5M6.5 21.5l3.5-3.5M18 10l3.5-3.5"/>`,
  child: `<circle cx="14" cy="9" r="4"/><path d="M5 24c0-5 4-8 9-8s9 3 9 8"/>`,
  family: `<circle cx="10" cy="9" r="3.5"/><circle cx="19" cy="10" r="2.5"/><path d="M3 22c0-3.5 3-6 7-6s7 2.5 7 6"/><path d="M16 22c0-2.5 2-4.5 5-4.5s5 2 5 4.5"/>`,
  growth: `<path d="M4 22V8M11 22V4M18 22v-8M25 22h-22"/>`,
  target: `<circle cx="14" cy="14" r="10"/><circle cx="14" cy="14" r="6"/><circle cx="14" cy="14" r="2" fill="currentColor" stroke="none"/>`,
  leaf: `<path d="M4 23c0-11 8-19 19-19 0 11-8 19-19 19zM4 23l9-9"/>`,
  book: `<path d="M4 5a2 2 0 0 1 2-2h6v20H6a2 2 0 0 1-2-2zM24 5a2 2 0 0 0-2-2h-6v20h6a2 2 0 0 0 2-2z"/><path d="M12 5v18M16 5v18"/>`,
  hammer: `<path d="M14 21l-7-7 3-3 3 3 5-5-3-3 3-3 7 7-3 3-3-3-5 5 3 3z"/>`,
  coin: `<circle cx="14" cy="14" r="9"/><path d="M11 11h5a2 2 0 0 1 0 4h-4a2 2 0 0 0 0 4h5M14 9v10"/>`,
  home: `<path d="M4 13l10-9 10 9v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M11 25v-7h6v7"/>`,
  hand: `<path d="M9 14V6a2 2 0 0 1 4 0v6M13 12V5a2 2 0 0 1 4 0v8M17 13V7a2 2 0 0 1 4 0v10c0 4-2 8-7 8s-9-3-9-8v-4a2 2 0 0 1 4 0"/>`,
  pulse: `<path d="M3 14h5l2-5 4 10 3-7 2 2h6"/>`,
  cross: `<path d="M11 4h6v8h8v6h-8v8h-6v-8h-8v-6h8z"/>`,
  slider: `<path d="M3 9h22M3 19h22"/><circle cx="9" cy="9" r="2.5" fill="currentColor"/><circle cx="20" cy="19" r="2.5" fill="currentColor"/>`,
  vision: `<path d="M2 14s4-9 12-9 12 9 12 9-4 9-12 9S2 14 2 14z"/><circle cx="14" cy="14" r="3.5"/>`,
  flag: `<path d="M5 25V4l13 3-3 5 3 5-13-3"/>`,
  feather: `<path d="M22 6c0 8-6 14-14 14H4l3-3M22 6c-4 0-12 1-15 12M9 21l13-13"/>`,
  ring: `<circle cx="14" cy="14" r="6"/><circle cx="14" cy="14" r="11"/>`,
  arrow: `<path d="M5 14h18M16 7l7 7-7 7"/>`,
  check: `<path d="M5 14l5 5 13-13" stroke-width="2.2"/>`,
  candle: `<path d="M12 18h4v8h-4z"/><path d="M12 18a2 2 0 0 1 4 0M14 13c-2-2-2-4 0-6 2 2 2 4 0 6z" fill="currentColor"/>`,
  reflection: `<circle cx="14" cy="11" r="6"/><path d="M8 22c0-3 3-5 6-5s6 2 6 5"/><path d="M6 25h16"/>`,
};

/**
 * North-Star line icon. Stroke-based, no emojis, 1 weight family.
 * Use:  nsIcon("compass") or nsIcon("star", { size: 22 })
 */
export function nsIcon(name, opts = {}) {
  const svg = _NS_ICON_SVG[name];
  if (!svg) return "";
  const size = opts.size || 28;
  return `<svg class="ns-icon" viewBox="0 0 28 28" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${svg}</svg>`;
}

export const NS_ICONS_AVAILABLE = Object.keys(_NS_ICON_SVG);

/* ---------- Formatting ---------- */
export function fmtDate(iso, opts = { short: true }) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (opts.short) return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

export function fmtMoney(n) {
  if (n == null) return "—";
  return "$" + Number(n).toFixed(2);
}

/* ---------- Countdown ---------- */
export function timeRemaining(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  const overdue = ms < 0;
  const abs = Math.abs(ms);
  const minutes = Math.floor(abs / 60000) % 60;
  const hours = Math.floor(abs / 3600000) % 24;
  const days = Math.floor(abs / 86400000) % 7;
  const weeks = Math.floor(abs / (86400000 * 7));
  return { overdue, weeks, days, hours, minutes, totalMs: ms };
}

export function renderCountdown(iso, opts = {}) {
  const r = timeRemaining(iso);
  if (!r) return `<span class="countdown ${opts.compact ? "compact" : ""}"><span class="seg">No due date</span></span>`;
  const cls = r.overdue ? "overdue" : "";
  const segs = [];
  if (r.weeks > 0) segs.push(`<span class="seg"><b>${r.weeks}</b>w</span>`);
  if (r.days > 0 || r.weeks > 0) segs.push(`<span class="seg"><b>${r.days}</b>d</span>`);
  segs.push(`<span class="seg"><b>${r.hours}</b>h</span>`);
  segs.push(`<span class="seg"><b>${r.minutes}</b>m</span>`);
  const label = r.overdue ? "Overdue by" : "Due in";
  return `<span class="countdown ${cls} ${opts.compact ? "compact" : ""}" title="${label}">${segs.join("")}</span>`;
}

/* Auto-refresh all countdowns on the page every 30s. */
export function startCountdownTicker() {
  setInterval(() => {
    document.querySelectorAll("[data-countdown]").forEach(node => {
      const iso = node.dataset.countdown;
      const compact = node.classList.contains("compact");
      node.outerHTML = `<span data-countdown="${iso}" ${compact ? 'class="compact"' : ""}>${renderCountdown(iso, { compact })}</span>`;
    });
  }, 30000);
}

/* ---------- Star sparkle animation ---------- */
export function sparkle(targetEl) {
  const emojis = ["✨", "⭐", "🌟", "💫"];
  for (let i = 0; i < 5; i++) {
    const s = document.createElement("span");
    s.className = "sparkle";
    s.textContent = emojis[i % emojis.length];
    s.style.setProperty("--dx", (Math.random() * 60 - 30) + "px");
    s.style.setProperty("--dy", (-Math.random() * 50 - 10) + "px");
    s.style.left = "50%";
    s.style.top = "50%";
    targetEl.appendChild(s);
    setTimeout(() => s.remove(), 900);
  }
}

/* ---------- Capability Domain colour helpers ----------
   Keyed by current Capability Domain ids, with legacy gig ids aliased so
   projects/children saved under the old model still render a coloured tag. */
// Each child's identity colour — the base of the .avatar-N gradients (styles/main.css)
// so a child reads as the SAME colour everywhere: avatar, calendar, project cards.
export const CHILD_COLORS = ["#C97B4E", "#7FA68A", "#9C7AB5", "#6FA9C4", "#E8B547"];
export function childColor(avatarIndex) {
  return CHILD_COLORS[(((avatarIndex || 1) - 1) % CHILD_COLORS.length + CHILD_COLORS.length) % CHILD_COLORS.length];
}

export const DOMAIN_COLOR_CLASS = {
  // Current Capability Domains
  literacy: "tag-plum",
  maths: "tag-sky",
  science: "tag-sage",
  creativity: "tag-coral",
  music: "tag-plum",
  digital: "tag-sky",
  practical: "tag-gold",
  enterprise: "tag-gold",
  health: "tag-coral",
  sport: "tag-sage",
  relationships: "tag-plum",
  leadership: "tag-sky",
  nature: "tag-sage",
  faith: "tag-plum",
  travel: "tag-sky",
  // Legacy gig ids → same colour as their mapped domain
  brain: "tag-plum",
  build: "tag-coral",
  money: "tag-gold",
  house: "tag-gold",
  community: "tag-sky",
  body: "tag-coral",
};

/* ============================================================
   logo.js — Heirloom Compass mark + wordmark lockups.

   The brand mark is a navy disc with a gold rim, holding an
   8-point compass rose: 4 long cream cardinal blades (kite
   shape) and 4 shorter gold intercardinal blades. A small
   gold pivot sits at the centre.

   The hero compass illustration on the homepage is a separate,
   larger and more detailed artefact (see marketing.js → compassSVG).
   This file owns the iconic brand mark that appears in headers,
   sidebars, footers and as the favicon.
   ============================================================ */

const PALETTE = {
  navyDark: "#0E1626",
  navyMid:  "#1B2538",
  navyLit:  "#3C507A",
  gold:     "#E8B547",
  goldHi:   "#F5D078",
  goldDeep: "#8C6612",
  cream:    "#FFF8E0",
  creamDeep:"#E8DAA2",
};

/**
 * Build one blade (kite shape) of the compass rose.
 *
 * @param {number} angleDeg   0 = up (N), 90 = right (E)
 * @param {number} length     tip distance from centre
 * @param {number} shoulder   shoulder distance from centre (0 < shoulder < length)
 * @param {number} halfWidth  shoulder half-width perpendicular to the blade axis
 * @returns {string} polygon points attribute
 */
function blade(angleDeg, length, shoulder, halfWidth) {
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const px = Math.cos(a);
  const py = Math.sin(a);
  const cx = 50, cy = 50;

  const tipX = cx + dx * length;
  const tipY = cy + dy * length;
  const sx = cx + dx * shoulder;
  const sy = cy + dy * shoulder;
  return [
    `${tipX.toFixed(2)},${tipY.toFixed(2)}`,
    `${(sx + px * halfWidth).toFixed(2)},${(sy + py * halfWidth).toFixed(2)}`,
    `${cx},${cy}`,
    `${(sx - px * halfWidth).toFixed(2)},${(sy - py * halfWidth).toFixed(2)}`,
  ].join(" ");
}

/**
 * Render the compass mark on its own.
 *
 * @param {number}  size     px (default 40)
 * @param {object}  opts
 * @param {string}  opts.title  accessible title (when used standalone)
 * @param {string}  opts.idPrefix  unique prefix for SVG gradient ids
 *                                  (set when rendering multiple marks on the same page)
 * @param {boolean} opts.decorative  true → aria-hidden, no role/img
 * @returns {string} SVG markup
 */
export function logoMark(size = 40, opts = {}) {
  const id = opts.idPrefix || "lm";
  const accessible = !opts.decorative;
  const ariaAttrs = accessible
    ? `role="img" aria-label="${escapeAttr(opts.title || "North Star Family Learning")}"`
    : `aria-hidden="true" focusable="false"`;

  // Detail level scales by size — keeps the mark legible at 18-24 px (favicon/sidebar) without losing
  // refinement at 40-80 px (header / footer).
  const showTicks = size >= 28;
  const showDots  = size >= 44;
  const showInnerRing = size >= 28;

  // Tick marks at the 4 cardinals (small notches outside the inner ring).
  const tickMarks = showTicks
    ? `<g class="lm-ticks" stroke="${PALETTE.gold}" stroke-width="0.7" stroke-linecap="round" opacity="0.85">
         <line x1="50" y1="5"  x2="50" y2="9"/>
         <line x1="95" y1="50" x2="91" y2="50"/>
         <line x1="50" y1="95" x2="50" y2="91"/>
         <line x1="5"  y1="50" x2="9"  y2="50"/>
       </g>`
    : "";

  // Tiny decorative dots at the 4 intercardinal positions on the rim.
  const dots = showDots
    ? `<g class="lm-dots" fill="${PALETTE.gold}" opacity="0.7">
         ${[45, 135, 225, 315].map(deg => {
           const a = (deg * Math.PI) / 180;
           const x = (50 + Math.sin(a) * 39).toFixed(2);
           const y = (50 - Math.cos(a) * 39).toFixed(2);
           return `<circle cx="${x}" cy="${y}" r="0.85"/>`;
         }).join("")}
       </g>`
    : "";

  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" ${ariaAttrs}
              xmlns="http://www.w3.org/2000/svg" class="ns-logo-mark" overflow="visible">
    <defs>
      <radialGradient id="${id}-bezel" cx="35%" cy="28%" r="80%">
        <stop offset="0%"   stop-color="${PALETTE.navyLit}"/>
        <stop offset="55%"  stop-color="${PALETTE.navyMid}"/>
        <stop offset="100%" stop-color="${PALETTE.navyDark}"/>
      </radialGradient>
      <linearGradient id="${id}-gold" x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%"   stop-color="${PALETTE.goldHi}"/>
        <stop offset="55%"  stop-color="${PALETTE.gold}"/>
        <stop offset="100%" stop-color="${PALETTE.goldDeep}"/>
      </linearGradient>
      <linearGradient id="${id}-cream" x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%"   stop-color="${PALETTE.cream}"/>
        <stop offset="100%" stop-color="${PALETTE.creamDeep}"/>
      </linearGradient>
    </defs>

    <!-- 1. Outer navy disc with a delicate gold rim -->
    <circle cx="50" cy="50" r="48"
            fill="url(#${id}-bezel)"
            stroke="${PALETTE.gold}" stroke-width="1.1"/>

    <!-- 2. Inner gold detail ring -->
    ${showInnerRing
      ? `<circle cx="50" cy="50" r="42" fill="none"
                 stroke="${PALETTE.gold}" stroke-width="0.45" opacity="0.55"/>`
      : ""}

    ${tickMarks}
    ${dots}

    <!-- 3. Four cream cardinal blades (long kite shape) -->
    <g class="lm-cardinals" fill="url(#${id}-cream)">
      <polygon points="${blade(0,   38, 8, 3.6)}"/>
      <polygon points="${blade(90,  38, 8, 3.6)}"/>
      <polygon points="${blade(180, 38, 8, 3.6)}"/>
      <polygon points="${blade(270, 38, 8, 3.6)}"/>
    </g>

    <!-- 4. Four gold intercardinal blades (shorter kite shape) -->
    <g class="lm-inter" fill="url(#${id}-gold)">
      <polygon points="${blade(45,  26, 6, 2.6)}"/>
      <polygon points="${blade(135, 26, 6, 2.6)}"/>
      <polygon points="${blade(225, 26, 6, 2.6)}"/>
      <polygon points="${blade(315, 26, 6, 2.6)}"/>
    </g>

    <!-- 5. Subtle highlight slivers on the cream blades to give a folded-paper feel -->
    <g class="lm-highlights" fill="${PALETTE.cream}" opacity="0.45">
      <polygon points="50,12 50,50 51,49.5 51.2,46"/>
      <polygon points="88,50 50,50 49.5,49 46,48.8"/>
    </g>

    <!-- 6. Centre gold pivot -->
    <circle cx="50" cy="50" r="3" fill="url(#${id}-gold)" stroke="${PALETTE.goldDeep}" stroke-width="0.35"/>
    <circle cx="48.8" cy="48.8" r="0.85" fill="${PALETTE.cream}" opacity="0.9"/>
  </svg>`;
}

/**
 * Horizontal lockup: mark on the left, wordmark on the right.
 *
 *  ┌──────┐   North Star
 *  │ ◈ │   FAMILY LEARNING
 *  └──────┘
 */
export function logoLockup({
  size = 40,
  showTagline = true,
  className = "",
  href = null,
  asHeaderBrand = true,
} = {}) {
  const tag = href ? "a" : "span";
  const attrs = href
    ? `href="${escapeAttr(href)}" aria-label="North Star Family Learning"`
    : `aria-label="North Star Family Learning"`;
  return `<${tag} class="ns-logo ns-logo-h ${className}" ${attrs}>
    <span class="ns-logo-mark-wrap" aria-hidden="true">${logoMark(size, { decorative: true })}</span>
    <span class="ns-logo-wordmark">
      <span class="ns-logo-name">North Star</span>
      ${showTagline ? `<span class="ns-logo-tag">FAMILY LEARNING</span>` : ""}
    </span>
  </${tag}>`;
}

/**
 * Stacked lockup: mark on top, wordmark below.
 * Used in the footer + occasional hero placements.
 */
export function logoStacked({ size = 56, className = "" } = {}) {
  return `<div class="ns-logo ns-logo-stacked ${className}" aria-label="North Star Family Learning">
    <span class="ns-logo-mark-wrap" aria-hidden="true">${logoMark(size, { decorative: true })}</span>
    <span class="ns-logo-wordmark">
      <span class="ns-logo-name">North Star</span>
      <span class="ns-logo-tag">FAMILY LEARNING</span>
    </span>
  </div>`;
}

/**
 * Returns the raw SVG for the mark — used for the favicon href as a data URL.
 */
export function logoMarkSVG(size = 64) {
  return logoMark(size, { idPrefix: "fv", decorative: true });
}

function escapeAttr(s) {
  return String(s).replace(/"/g, "&quot;");
}

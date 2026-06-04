/* ============================================================
   logo.js — North Star Heirloom Compass — brand system

   ONE underlying geometry, two surface variants:
     • dark variant  — navy face, cream cardinal cross, gold X
                       (footer · favicon · app icon · dark backgrounds)
     • light variant — cream face, navy cardinal cross, gold X
                       (header · sidebar · light backgrounds)

   The mark is hand-tuned to feel like an antique compass rose:
     - 4 long cardinal blades forming a cross
     - 4 shorter intercardinal blades on the diagonals
     - The NORTH blade is slightly longer and carries a small
       decorative diamond at its tip (the heirloom "north point")
     - A refined gold pivot sits at the centre
     - Delicate concentric ring + tick mark + rim dot details
   ============================================================ */

const PALETTE = {
  navyDark: "#0E1626",
  navyMid:  "#1B2538",
  navyLit:  "#3C507A",
  navy:     "#2A3954",
  gold:     "#E8B547",
  goldHi:   "#F5D078",
  goldDeep: "#8C6612",
  cream:    "#FFF8E0",
  creamMid: "#F4E9C5",
  creamDeep:"#E8DAA2",
  warmCard: "#FBF6EE",
  warmCard2:"#F4ECD8",
};

/* ----- Blade geometry helper ------------------------------------------------
   Each blade is a 4-vertex kite (tip → shoulder → centre → shoulder).
   Returns the polygon `points` attribute as a string.
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
 * Render the brand mark.
 *
 * @param {number} size     px (default 40)
 * @param {object} opts
 * @param {"dark"|"light"} opts.variant   default "dark"
 * @param {string} opts.title             accessible title
 * @param {boolean} opts.decorative       true → aria-hidden, no role
 * @param {string} opts.idPrefix          unique prefix for SVG gradient ids
 *                                        (auto-derived if omitted)
 * @returns {string} SVG markup
 */
export function logoMark(size = 40, opts = {}) {
  const variant = opts.variant === "light" ? "light" : "dark";
  const id = opts.idPrefix
    || (variant === "light" ? "lmL" : "lmD")
       + "-" + Math.random().toString(36).slice(2, 7);

  const accessible = !opts.decorative;
  const ariaAttrs = accessible
    ? `role="img" aria-label="${escapeAttr(opts.title || "North Star Family Learning")}"`
    : `aria-hidden="true" focusable="false"`;

  // Detail level scales with size — keep the mark legible at 18-24 px (favicon /
  // sidebar) without losing antique refinement at 40-80 px (header / footer).
  const showInnerRing = size >= 26;
  const showTicks     = size >= 28;
  const showRimDots   = size >= 44;
  const showNorthDiamond = size >= 22;

  // ---------- per-variant colours ----------
  const c = variant === "light"
    ? {
        faceA: "#FFFCF2",     // top of cream face gradient
        faceB: "#F5EBD5",     // bottom of cream face gradient
        rim: PALETTE.gold,
        ring: PALETTE.gold,
        tick: PALETTE.gold,
        dot: PALETTE.gold,
        cardinal: PALETTE.navy,         // navy cross on cream
        cardinalGradStops: [PALETTE.navyLit, PALETTE.navy, PALETTE.navyDark],
        intercardinal: PALETTE.gold,
        interGradStops: [PALETTE.goldHi, PALETTE.gold, PALETTE.goldDeep],
        pivot: PALETTE.gold,
        pivotInner: PALETTE.creamDeep,
      }
    : {
        faceA: "#3C507A",     // top of navy face gradient
        faceB: PALETTE.navyDark,
        rim: PALETTE.gold,
        ring: PALETTE.gold,
        tick: PALETTE.gold,
        dot: PALETTE.gold,
        cardinal: PALETTE.cream,        // cream cross on navy
        cardinalGradStops: [PALETTE.cream, PALETTE.creamMid, PALETTE.creamDeep],
        intercardinal: PALETTE.gold,
        interGradStops: [PALETTE.goldHi, PALETTE.gold, PALETTE.goldDeep],
        pivot: PALETTE.gold,
        pivotInner: PALETTE.cream,
      };

  // ---------- decoration: tick marks at the 4 cardinal positions ----------
  const tickMarks = showTicks
    ? `<g class="lm-ticks" stroke="${c.tick}" stroke-width="0.7" stroke-linecap="round" opacity="0.85">
         <line x1="50" y1="5"  x2="50" y2="9"/>
         <line x1="95" y1="50" x2="91" y2="50"/>
         <line x1="50" y1="95" x2="50" y2="91"/>
         <line x1="5"  y1="50" x2="9"  y2="50"/>
       </g>`
    : "";

  // ---------- decoration: tiny rim dots at the 4 intercardinal positions ----------
  const rimDots = showRimDots
    ? `<g class="lm-dots" fill="${c.dot}" opacity="0.75">
         ${[45, 135, 225, 315].map(deg => {
           const a = (deg * Math.PI) / 180;
           const x = (50 + Math.sin(a) * 39).toFixed(2);
           const y = (50 - Math.cos(a) * 39).toFixed(2);
           return `<circle cx="${x}" cy="${y}" r="0.85"/>`;
         }).join("")}
       </g>`
    : "";

  // ---------- north decoration: small lozenge above the north blade tip ----------
  // The lozenge sits between the cardinal blade tip (y=12) and the inner ring (y≈8).
  const northDiamond = showNorthDiamond
    ? `<g class="lm-north-mark">
         <polygon points="50,7.5 51.6,11 50,14.5 48.4,11" fill="${c.cardinal}" opacity="0.95"/>
       </g>`
    : "";

  // ---------- compass blades ----------
  // North blade is slightly longer (reaches further out) — the antique "north point"
  const cardinalLen = 38;
  const northLen    = 40;   // slightly longer
  const interLen    = 26;
  const shoulder    = 8;
  const interShoulder = 6;
  const cardinalHW  = 3.6;
  const interHW     = 2.6;

  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" ${ariaAttrs}
              xmlns="http://www.w3.org/2000/svg" class="ns-logo-mark ns-logo-mark--${variant}" overflow="visible">
    <defs>
      <radialGradient id="${id}-face" cx="35%" cy="28%" r="80%">
        <stop offset="0%"   stop-color="${c.faceA}"/>
        <stop offset="100%" stop-color="${c.faceB}"/>
      </radialGradient>
      <linearGradient id="${id}-card" x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%"   stop-color="${c.cardinalGradStops[0]}"/>
        <stop offset="55%"  stop-color="${c.cardinalGradStops[1]}"/>
        <stop offset="100%" stop-color="${c.cardinalGradStops[2]}"/>
      </linearGradient>
      <linearGradient id="${id}-inter" x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%"   stop-color="${c.interGradStops[0]}"/>
        <stop offset="55%"  stop-color="${c.interGradStops[1]}"/>
        <stop offset="100%" stop-color="${c.interGradStops[2]}"/>
      </linearGradient>
    </defs>

    <!-- 1. Disc face + delicate gold rim -->
    <circle cx="50" cy="50" r="48" fill="url(#${id}-face)" stroke="${c.rim}" stroke-width="1.1"/>

    <!-- 2. Inner gold detail ring -->
    ${showInnerRing
      ? `<circle cx="50" cy="50" r="42" fill="none" stroke="${c.ring}" stroke-width="0.45" opacity="0.55"/>`
      : ""}

    ${tickMarks}
    ${rimDots}

    <!-- 3. North decoration (subtle antique diamond just above the north blade tip) -->
    ${northDiamond}

    <!-- 4. Four cardinal blades — long cross (cream on dark, navy on light) -->
    <g class="lm-cardinals" fill="url(#${id}-card)">
      <polygon points="${blade(0,   northLen,    shoulder, cardinalHW)}"/>
      <polygon points="${blade(90,  cardinalLen, shoulder, cardinalHW)}"/>
      <polygon points="${blade(180, cardinalLen, shoulder, cardinalHW)}"/>
      <polygon points="${blade(270, cardinalLen, shoulder, cardinalHW)}"/>
    </g>

    <!-- 5. Four intercardinal blades — shorter gold diagonals -->
    <g class="lm-inter" fill="url(#${id}-inter)">
      <polygon points="${blade(45,  interLen, interShoulder, interHW)}"/>
      <polygon points="${blade(135, interLen, interShoulder, interHW)}"/>
      <polygon points="${blade(225, interLen, interShoulder, interHW)}"/>
      <polygon points="${blade(315, interLen, interShoulder, interHW)}"/>
    </g>

    <!-- 6. Subtle highlight sliver on the north cardinal blade -->
    <g class="lm-highlights" opacity="0.5" fill="${c.cardinal}">
      <polygon points="50,12 50,50 50.5,49.5 50.6,46"/>
    </g>

    <!-- 7. Centre gold pivot -->
    <circle cx="50" cy="50" r="3.1" fill="url(#${id}-inter)" stroke="${PALETTE.goldDeep}" stroke-width="0.4"/>
    <circle cx="48.8" cy="48.8" r="0.85" fill="${c.pivotInner}" opacity="0.95"/>
  </svg>`;
}

/**
 * Horizontal lockup: mark on the left, wordmark on the right.
 */
export function logoLockup({
  size = 40,
  variant = "dark",
  showTagline = true,
  className = "",
  href = null,
} = {}) {
  const tag = href ? "a" : "span";
  const attrs = href
    ? `href="${escapeAttr(href)}" aria-label="North Star Family Learning"`
    : `aria-label="North Star Family Learning"`;
  return `<${tag} class="ns-logo ns-logo-h ${className}" ${attrs}>
    <span class="ns-logo-mark-wrap" aria-hidden="true">${logoMark(size, { decorative: true, variant })}</span>
    <span class="ns-logo-wordmark">
      <span class="ns-logo-name">North Star</span>
      ${showTagline ? `<span class="ns-logo-tag">FAMILY&nbsp;LEARNING</span>` : ""}
    </span>
  </${tag}>`;
}

/**
 * Stacked lockup: mark on top, wordmark below.
 */
export function logoStacked({ size = 56, variant = "dark", className = "" } = {}) {
  return `<div class="ns-logo ns-logo-stacked ${className}" aria-label="North Star Family Learning">
    <span class="ns-logo-mark-wrap" aria-hidden="true">${logoMark(size, { decorative: true, variant })}</span>
    <span class="ns-logo-wordmark">
      <span class="ns-logo-name">North Star</span>
      <span class="ns-logo-tag">FAMILY&nbsp;LEARNING</span>
    </span>
  </div>`;
}

/**
 * Raw SVG for the favicon — always the dark variant at 64 px.
 */
export function logoMarkSVG(size = 64) {
  return logoMark(size, { idPrefix: "fv", decorative: true, variant: "dark" });
}

function escapeAttr(s) {
  return String(s).replace(/"/g, "&quot;");
}

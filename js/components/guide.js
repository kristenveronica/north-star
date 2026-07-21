/* ============================================================
   guide.js — the child's Guide, as a friendly character.

   A warm, glowing North-Star companion (the "navigate by your own star"
   idea, made into a face you'd trust). Pure inline SVG — no image, no
   network, crisp at any size, styled from the app's own palette. This is
   the Guide's face across the child portal, replacing the old spinner-ish
   spark glyph.
   ============================================================ */

/** The Guide avatar as an inline SVG string.
 *  @param {number} size  px (square). @param {boolean} glow  soft halo behind it. */
export function guideAvatar({ size = 48, glow = true } = {}) {
  return `<svg class="ns-guide" width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <radialGradient id="ngBody" cx="38%" cy="30%" r="78%">
        <stop offset="0%" stop-color="#FCEBB0"/>
        <stop offset="52%" stop-color="#F1C25C"/>
        <stop offset="100%" stop-color="#E29A3C"/>
      </radialGradient>
      <radialGradient id="ngGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#F6C85A" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="#F6C85A" stop-opacity="0"/>
      </radialGradient>
    </defs>
    ${glow ? `<circle class="ns-guide-glow" cx="32" cy="32" r="31" fill="url(#ngGlow)"/>` : ""}
    <path class="ns-guide-body" d="M32 5 C 35.5 20 44 28.5 59 32 C 44 35.5 35.5 44 32 59 C 28.5 44 20 35.5 5 32 C 20 28.5 28.5 20 32 5 Z"
      fill="url(#ngBody)" stroke="#E7A33F" stroke-width="0.6"/>
    <g class="ns-guide-face">
      <circle cx="26.4" cy="30.8" r="2.5" fill="#3A2A1A"/>
      <circle cx="37.6" cy="30.8" r="2.5" fill="#3A2A1A"/>
      <circle cx="27.2" cy="30" r="0.75" fill="#FFFBEF"/>
      <circle cx="38.4" cy="30" r="0.75" fill="#FFFBEF"/>
      <circle cx="22.2" cy="35" r="2.6" fill="#E8896A" opacity="0.5"/>
      <circle cx="41.8" cy="35" r="2.6" fill="#E8896A" opacity="0.5"/>
      <path d="M28.4 36.4 Q32 40.4 35.6 36.4" stroke="#3A2A1A" stroke-width="1.7" stroke-linecap="round" fill="none"/>
    </g>
    <circle class="ns-guide-spark" cx="50" cy="15" r="1.7" fill="#FCEBB0"/>
  </svg>`;
}

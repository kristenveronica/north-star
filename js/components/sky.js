/* ============================================================
   sky.js — the Child Dashboard "Sky" backdrop (V2 shell).

   Pure string builders: NO DOM, NO imports, NO state — so the same
   file is used by the browser view AND asserted under `node --test`.
   The Sky is an atmospheric header that fades into the warm --bg
   "Home" below it. All colour comes from existing tokens
   (--midnight / --sky / --gold / --starlight) via CSS classes.
   ============================================================ */

// A fixed star field — deterministic (no Math.random) so the sky never
// reflows between renders and can be asserted in tests. Each entry is
// [x%, y%, radiusPx, twinkleDelaySeconds].
const STARS = [
  [8, 16, 1.4, 0.0], [17, 9, 1.0, 1.1], [24, 22, 1.2, 2.3], [33, 12, 0.9, 0.6],
  [41, 26, 1.5, 1.8], [49, 8, 1.1, 3.0], [58, 19, 1.0, 0.9], [66, 11, 1.3, 2.1],
  [73, 24, 0.9, 1.4], [81, 14, 1.2, 0.3], [88, 21, 1.0, 2.7], [93, 10, 1.4, 1.6],
  [13, 30, 1.0, 2.0], [37, 33, 1.1, 0.4], [61, 31, 0.9, 1.9], [78, 34, 1.2, 1.2],
  [5, 25, 1.1, 2.5], [29, 5, 1.0, 0.8], [54, 28, 1.3, 3.2], [70, 6, 1.0, 1.5],
];

/** Local hour (0–23) → sky mood bucket. */
export function timeOfDay(hour) {
  const h = Number(hour);
  if (h >= 5 && h < 8) return "dawn";
  if (h >= 8 && h < 17) return "day";
  if (h >= 17 && h < 20) return "dusk";
  return "night";
}

/** The full Sky backdrop markup: time-of-day gradient + star field + a
 *  gathered-Light glow placeholder + the fade that blends into Home.
 *  Entirely decorative — hidden from assistive tech. */
export function renderSky(hour) {
  const tod = timeOfDay(hour);
  const stars = STARS.map(
    ([x, y, r, d]) => `<circle cx="${x}%" cy="${y}%" r="${r}" style="animation-delay:${d}s"/>`,
  ).join("");
  return `
    <div class="cd-sky cd-sky--${tod}" aria-hidden="true">
      <svg class="cd-stars" preserveAspectRatio="none">${stars}</svg>
      <div class="cd-sky-glow"></div>
      <div class="cd-sky-fade"></div>
    </div>`;
}

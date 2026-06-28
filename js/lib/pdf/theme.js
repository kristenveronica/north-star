/* ============================================================
   pdf/theme.js — North Star print theme.

   Tuned for beautiful HOME printing: a white page, vector text (so it
   prints crisp in black & white), minimal ink, generous spacing. Brand
   shows through the wordmark, restrained accent rules and the certificate
   — never heavy coloured fills. Colours degrade gracefully to greyscale.

   Everything visual is a token here, so a new template (dyslexia-friendly,
   colour edition, travel edition…) can re-theme without touching layout.
   ============================================================ */

// Page sizes in points (jsPDF unit "pt"). A4 is the default; Letter is offered
// so the same document prints cleanly either side of the Atlantic.
export const PAGE = {
  a4: { w: 595.28, h: 841.89 },
  letter: { w: 612, h: 792 },
};

// Built-in PDF fonts — no embedding, so files stay tiny and text stays vector.
// "times" gives the serif (a warm stand-in for Cormorant Garamond on paper);
// "helvetica" carries the body (in the spirit of Mulish).
export const THEME = {
  fonts: { serif: "times", sans: "helvetica" },

  // Mostly ink-light greys; brand hues used sparingly for accents only.
  color: {
    ink: [28, 32, 40],       // near-black headings
    body: [52, 56, 64],      // body copy
    muted: [120, 126, 136],  // captions, meta
    faint: [168, 173, 182],  // hints
    hair: [214, 217, 223],   // hairline rules
    line: [188, 192, 200],   // writing lines / checkboxes
    accent: [42, 57, 84],    // --midnight
    warm: [201, 123, 78],    // --primary (clay)
    gold: [150, 116, 56],    // muted, print-friendly gold (certificate)
    white: [255, 255, 255],
  },

  size: {
    eyebrow: 9,
    title: 27,
    h2: 14.5,
    h3: 11.5,
    body: 10.5,
    small: 9,
    tiny: 8,
    certEyebrow: 11,
    certName: 36,
    certTitle: 17,
  },

  margin: { x: 56, top: 60, bottom: 58 },

  lineHeight: 1.38,   // body line spacing
};

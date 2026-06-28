/* ============================================================
   pdf/templates.js — the print FORMAT registry.

   North Star offers three intentionally different print experiences. The two
   PORTRAIT documents are defined here as formats (which sections, in order);
   the LANDSCAPE Completion Certificate is handled specially by the orchestrator
   (index.js) because it's its own page geometry and carries no footer.

   Adding a new portrait format (dyslexia-friendly, colour edition, teacher
   edition, other languages) is just another entry here — no engine changes.
   ============================================================ */

import {
  sectionCover, sectionOverview, sectionQuickSummary,
  sectionMaterials, sectionMilestones, sectionParentNotes,
} from "./sections.js";

export const PDF_FORMATS = [
  {
    id: "summary",
    label: "Quick Summary",
    blurb: "A clean 1–2 page reference sheet. Minimal ink, prints fast — perfect for the kitchen bench.",
    build(doc, ctx) {
      sectionQuickSummary(doc, ctx);
    },
  },
  {
    id: "workbook",
    label: "Project Workbook",
    blurb: "A premium journal — beautiful cover, a page per milestone, reflection space and coaching notes.",
    recommended: true,
    build(doc, ctx) {
      sectionCover(doc, ctx);
      sectionOverview(doc, ctx);
      sectionMaterials(doc, ctx);
      sectionMilestones(doc, ctx);
      sectionParentNotes(doc, ctx);
    },
  },
];

export function getFormat(id) {
  return PDF_FORMATS.find(f => f.id === id) || PDF_FORMATS[1];
}

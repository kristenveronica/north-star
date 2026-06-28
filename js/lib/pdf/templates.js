/* ============================================================
   pdf/templates.js — the template registry.

   A template decides WHICH sections render and in what order. Adding a new
   one (dyslexia-friendly, colour workbook, minimal-ink, travel/teacher/mentor
   edition, other languages) is just another entry here — no engine changes.
   Each template exposes { id, label, description, build(doc, ctx) }.
   ============================================================ */

import {
  sectionOverview, sectionMilestones, sectionMaterials,
  sectionReflection, sectionParentNotes, sectionCertificate,
} from "./sections.js";

export const PDF_TEMPLATES = [
  {
    id: "home-print",
    label: "Home Print",
    description: "Minimal-ink, black-and-white friendly workbook for everyday home printing.",
    build(doc, ctx) {
      const o = ctx.options || {};
      if (o.overview) sectionOverview(doc, ctx);
      if (o.milestones) sectionMilestones(doc, ctx);
      if (o.materials) sectionMaterials(doc, ctx);
      if (o.reflection) sectionReflection(doc, ctx);
      if (o.parentNotes) sectionParentNotes(doc, ctx);
      if (o.certificate) sectionCertificate(doc, ctx);
    },
  },
  // Future: { id: "dyslexia-friendly", ... }, { id: "colour-workbook", ... },
  // { id: "travel-edition", ... }, { id: "teacher-edition", ... } …
];

export function getTemplate(id) {
  return PDF_TEMPLATES.find(t => t.id === id) || PDF_TEMPLATES[0];
}

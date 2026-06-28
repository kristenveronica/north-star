/* ============================================================
   pdf/index.js — public API for the Printable Project Generator.

   The rest of the app talks to PDFs only through here:
     • PROJECT_PDF_SECTIONS — the choosable sections (drives the modal)
     • isMilestoneProject()  — whether the Completion Certificate is offered
     • generateProjectPdf()  — assemble + download the document

   generateProjectPdf is the orchestrator: it gathers data, builds a reliable
   QR (only for genuinely saved projects, never broken), runs the chosen
   template, stamps the metadata footer on every page, and saves the file.
   ============================================================ */

import { createDoc } from "./pdfDoc.js";
import { getTemplate, PDF_TEMPLATES } from "./templates.js";
import { qrDataUrl } from "./qr.js";
import { projectUrl } from "../config.js";
import { coachingNotes, groupMaterials, firstName } from "./content.js";

export { PDF_TEMPLATES };
export { hasValidProjectId } from "../config.js";

export const PROJECT_PDF_SECTIONS = [
  { key: "overview", label: "Project Overview", note: "Recommended", default: true },
  { key: "milestones", label: "Detailed Milestones" },
  { key: "materials", label: "Materials Checklist" },
  { key: "reflection", label: "Reflection Pages" },
  { key: "parentNotes", label: "Parent Notes" },
  { key: "certificate", label: "Completion Certificate" },
];

// The Completion Certificate is, by definition, for a finished project. With no
// dedicated "milestone project" flag in the data yet, a completed project is
// the natural trigger; an explicit `isMilestone` flag is honoured if present.
export function isMilestoneProject(project) {
  return !!project && (project.status === "completed" || project.isMilestone === true);
}

function lastCompletedAt(milestones) {
  const ts = (milestones || []).filter(m => m.completedAt).map(m => new Date(m.completedAt).getTime());
  return ts.length ? new Date(Math.max(...ts)) : null;
}

function fileName(project, child) {
  const proj = (project.title || "project").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 48) || "project";
  const kid = firstName(child?.name).replace(/[^\w]+/g, "");
  return `NorthStar-${proj}${kid ? "-" + kid : ""}.pdf`;
}

export async function generateProjectPdf({ project, child, options = {}, templateId = "home-print", state = null }) {
  const tpl = getTemplate(templateId);
  const milestones = (state?.milestones || []).filter(m => m.projectId === project.id);
  const materials = groupMaterials(project, state);
  const notes = options.parentNotes ? coachingNotes(project, child) : [];

  // QR reliability — only for a genuinely saved project, and never fatal.
  let qr = null;
  if (options.overview) {
    const url = projectUrl(project, state);   // null when unsaved / temp / local-only
    if (url) {
      try { qr = { url, dataUrl: await qrDataUrl(url) }; }
      catch { qr = null; }                    // engine unavailable → overview shows fallback
    }
  }

  // Completion date: a real date only when the project is actually finished;
  // otherwise null, so the certificate prints a blank line to fill in by hand.
  const completedAt = project.completedAt || lastCompletedAt(milestones);
  const isComplete = project.status === "completed" || !!completedAt;

  const doc = await createDoc({ pageSize: options.pageSize || "a4" });
  const ctx = {
    project, child, milestones, materials,
    family: state?.family || {}, options, qr, coachingNotes: notes,
    completedDate: isComplete ? (completedAt || new Date()) : null,
    state,
  };
  tpl.build(doc, ctx);

  // Metadata footer on every page (future-proofed via the open meta bag).
  doc.footerAll({
    brand: "North Star",
    projectTitle: project.title,
    childFirst: firstName(child?.name),
    generatedLabel: new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }),
    version: project.version || "1.0",
    // extras: [family?.familyName, project.category, templateId] — enable later
  });

  doc.save(fileName(project, child));
  return { ok: true };
}

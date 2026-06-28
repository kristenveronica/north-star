/* ============================================================
   pdf/index.js — public API for the Printable Project Generator.

   Three intentionally different print experiences:
     • "summary"     — Quick Project Summary (1–2 pages, minimal ink)
     • "workbook"    — Project Workbook (premium journal, page per milestone)
     • "certificate" — Completion Certificate (landscape, framable, no footer)

   The rest of the app talks to PDFs only through here:
     • PDF_FORMATS            — the two portrait documents (drives the modal)
     • suggestParentMessage   — a warm parent affirmation for the certificate
     • generateProjectPdf()   — assemble + download the chosen experience

   generateProjectPdf gathers data, builds a reliable QR (only for genuinely
   saved projects, never broken), runs the chosen format, stamps the metadata
   footer on every PORTRAIT page, optionally appends the landscape certificate
   (which carries no footer), and saves the file.
   ============================================================ */

import { createDoc } from "./pdfDoc.js";
import { PDF_FORMATS, getFormat } from "./templates.js";
import { sectionCertificate } from "./sections.js";
import { qrDataUrl } from "./qr.js";
import { projectUrl } from "../config.js";
import { coachingNotes, groupMaterials, firstName, suggestParentMessage } from "./content.js";

export { PDF_FORMATS, suggestParentMessage };
export { hasValidProjectId } from "../config.js";

function lastCompletedAt(milestones) {
  const ts = (milestones || []).filter(m => m.completedAt).map(m => new Date(m.completedAt).getTime());
  return ts.length ? new Date(Math.max(...ts)) : null;
}

function fileName(project, child, suffix = "") {
  const proj = (project.title || "project").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 48) || "project";
  const kid = firstName(child?.name).replace(/[^\w]+/g, "");
  const tail = suffix ? "-" + suffix : "";
  return `NorthStar-${proj}${kid ? "-" + kid : ""}${tail}.pdf`;
}

export async function generateProjectPdf({ project, child, options = {}, state = null }) {
  const format = options.format || "workbook";
  const milestones = (state?.milestones || []).filter(m => m.projectId === project.id);
  const materials = groupMaterials(project, state);
  const notes = format === "workbook" ? coachingNotes(project, child) : [];

  // Completion date: a real date only when the project is actually finished;
  // otherwise null, so the certificate prints a blank line to fill in by hand.
  const completedAt = project.completedAt || lastCompletedAt(milestones);
  const isComplete = project.status === "completed" || !!completedAt;

  const ctx = {
    project, child, milestones, materials,
    family: state?.family || {}, options, qr: null, coachingNotes: notes,
    completedDate: isComplete ? (completedAt || new Date()) : null,
    state,
  };

  // ---- Certificate only → a single landscape page, no footer ----
  if (format === "certificate") {
    const doc = await createDoc({ pageSize: options.pageSize || "a4", orientation: "landscape" });
    sectionCertificate(doc, ctx);
    doc.save(fileName(project, child, "Certificate"));
    return { ok: true };
  }

  // ---- Portrait documents (summary / workbook) ----
  // QR reliability — only for a genuinely saved project, and never fatal.
  const url = projectUrl(project, state);          // null when unsaved / temp / local-only
  if (url) {
    try { ctx.qr = { url, dataUrl: await qrDataUrl(url) }; }
    catch { ctx.qr = null; }                       // engine unavailable → graceful fallback block
  }

  const doc = await createDoc({ pageSize: options.pageSize || "a4" });
  getFormat(format).build(doc, ctx);

  // Metadata footer on every PORTRAIT page (stamped BEFORE any landscape cert
  // page is appended, so the certificate stays footer-free).
  doc.footerAll({
    brand: "North Star",
    projectTitle: project.title,
    childFirst: firstName(child?.name),
    generatedLabel: new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }),
    version: project.version || "1.0",
  });

  // Optionally append the framable certificate as a landscape final page.
  if (options.certificate) {
    doc.landscapePage();
    sectionCertificate(doc, ctx);
  }

  doc.save(fileName(project, child, format === "summary" ? "Summary" : "Workbook"));
  return { ok: true };
}

/* ============================================================
   pdf/sections.js — the printable sections.

   Each builder takes (doc, ctx) and draws purely through PdfDoc primitives,
   so they stay layout-only and template-agnostic. ctx carries everything a
   section needs: { project, child, milestones, materials (grouped), family,
   options, qr:{url,dataUrl}|null, coachingNotes, completedDate }.
   ============================================================ */

import {
  whyItMatters, certificateStatement, durationLabel, fmtDate, fmtDateShort,
  firstName, domainNames, joinList,
} from "./content.js";

/* ---------------- Project Overview (≈2–3 pages) ---------------- */
export function sectionOverview(doc, ctx) {
  const { project, child } = ctx;
  const T = doc.t;

  doc.gap(8);
  doc.wordmark({ size: 12, gapAfter: 8 });
  doc.rule(doc.y, { inset: doc.cw * 0.42, color: T.color.warm, weight: 0.8 });
  doc.gap(16);

  doc.eyebrow("Project Workbook", { align: "center" });
  doc.title(project.title, { align: "center" });

  const meta = [child ? child.name : "", durationLabel(project)].filter(Boolean).join("   ·   ");
  doc.paragraph(meta, { align: "center", size: T.size.h3, color: T.color.muted, gapAfter: 4 });
  const doms = domainNames(project);
  if (doms.length) {
    doc.paragraph(joinList(doms), { align: "center", size: T.size.small, color: T.color.faint, gapAfter: 6 });
  }

  doc.divider({ gapBefore: 12, gapAfter: 14 });

  doc.h2("Why this project matters");
  doc.paragraph(whyItMatters(project, child), { gapAfter: 12 });

  const outcomes = (project.learningOutcomes || []).filter(Boolean);
  if (outcomes.length) {
    doc.h2(`What ${firstName(child?.name)} will learn`);
    doc.bullets(outcomes, { gapAfter: 12 });
  }

  const matNames = (project.materials || [])
    .map(m => (typeof m === "string" ? m : m?.name)).filter(Boolean);
  doc.h2("What you'll need");
  if (matNames.length) doc.bullets(matNames, { gapAfter: 12 });
  else doc.paragraph("Gathered along the way — see the Materials Checklist, or nothing special required.", { color: T.color.muted, gapAfter: 12 });

  if (project.description) {
    doc.h2("About this project");
    doc.paragraph(project.description, { gapAfter: 12 });
  }

  overviewQr(doc, ctx);
}

// QR block with a graceful, never-broken fallback.
function overviewQr(doc, ctx) {
  const T = doc.t;
  const size = 92;
  doc.divider({ gapBefore: 8, gapAfter: 14 });
  doc.ensure(size + 8);
  const top = doc.y;
  const textX = doc.mx + size + 18;
  const textW = doc.cw - size - 18;

  if (ctx.qr && ctx.qr.dataUrl) {
    doc.image(ctx.qr.dataUrl, doc.mx, top, size, size);
    doc._font(T.fonts.sans, "bold", T.size.body); doc._text(T.color.ink);
    doc.doc.text("Open the live project", textX, top + 4, { baseline: "top" });
    doc._font(T.fonts.sans, "normal", T.size.small); doc._text(T.color.muted);
    const cap = doc.doc.splitTextToSize(
      "Scan to open this project in North Star — track progress, add reflections and photos, and pick up exactly where the paper leaves off.",
      textW);
    doc.doc.text(cap, textX, top + 22, { baseline: "top", lineHeightFactor: T.lineHeight });
    doc.y = top + size + 6;
  } else {
    // No valid URL (unsaved/temporary project, or QR engine unavailable):
    // never print a broken code — show a clear, calm instruction instead.
    doc._draw(T.color.hair); doc.doc.setLineWidth(0.7);
    doc.doc.roundedRect(doc.mx, top, size, size, 6, 6, "S");
    doc.sparkle(doc.mx + size / 2, top + size / 2, 9, T.color.faint);
    doc._font(T.fonts.sans, "bold", T.size.body); doc._text(T.color.ink);
    doc.doc.text("Find this project online", textX, top + 4, { baseline: "top" });
    doc._font(T.fonts.serif, "italic", T.size.small); doc._text(T.color.muted);
    const cap = doc.doc.splitTextToSize("Open this project from your North Star dashboard.", textW);
    doc.doc.text(cap, textX, top + 22, { baseline: "top", lineHeightFactor: T.lineHeight });
    doc.y = top + size + 6;
  }
}

/* ---------------- Detailed Milestones (one per page) ---------------- */
export function sectionMilestones(doc, ctx) {
  const { project, milestones } = ctx;
  const list = milestones || [];

  if (!list.length) {
    doc.sectionBreak();
    doc.eyebrow("Milestones");
    doc.title("Milestones");
    doc.paragraph("No milestones have been added to this project yet. Add them in North Star and regenerate to print a worksheet for each step.",
      { color: doc.t.color.muted });
    return;
  }

  list.forEach((m, i) => {
    if (i === 0) doc.sectionBreak(); else doc.page();
    const T = doc.t;

    doc.eyebrow(`Milestone ${i + 1}`);
    doc.title(m.title || `Milestone ${i + 1}`);
    doc.metaRow([
      ["Project", project.title],
      ...(m.dueDate ? [["Due", fmtDate(m.dueDate)]] : []),
    ], { gapAfter: 12 });

    if (m.description) {
      doc.h3("Objective");
      doc.paragraph(m.description, { gapAfter: 10 });
    }

    doc.h3("Today's tasks");
    const tasks = (m.instructions || []).filter(Boolean);
    if (tasks.length) tasks.forEach(t => doc.checkbox(t));
    else { doc.checkbox(""); doc.checkbox(""); doc.checkbox(""); }
    doc.gap(8);

    doc.h3("Notes");
    doc.writingLines(3, { gapAfter: 12 });

    doc.h3("Reflection");
    doc.paragraph("What did you notice today?", { color: T.color.muted, style: "italic", family: T.fonts.serif, gapAfter: 6 });
    doc.writingLines(3);
  });
}

/* ---------------- Materials Checklist ---------------- */
export function sectionMaterials(doc, ctx) {
  const { materials } = ctx;
  doc.sectionBreak();
  doc.eyebrow("Materials Checklist");
  doc.title("What you'll need");
  doc.paragraph("Tick what you've gathered. North Star prioritises what you already own — buy or borrow only what's genuinely needed.",
    { color: doc.t.color.muted, gapAfter: 14 });

  const groups = [
    ["Already Have", materials.have],
    ["Need to Get", materials.get],
    ["Need to Borrow", materials.borrow],
  ].filter(([, arr]) => arr && arr.length);

  if (!groups.length) {
    doc.paragraph("No specific materials are listed for this project. Use the space below for anything you decide to gather.",
      { color: doc.t.color.muted, gapAfter: 10 });
  } else {
    groups.forEach(([label, arr]) => {
      doc.h3(label, { gapBefore: 6 });
      arr.forEach(name => doc.checkbox(name));
      doc.gap(6);
    });
  }

  doc.h3("Anything else", { gapBefore: 8 });
  doc.writingLines(3);
}

/* ---------------- Reflection Pages ---------------- */
export function sectionReflection(doc, ctx) {
  const T = doc.t;
  doc.sectionBreak();
  doc.eyebrow("Reflection Journal");
  doc.title("Today's Reflection");
  doc.metaRow([["Name", firstName(ctx.child?.name)], ["Date", "                              "]], { gapAfter: 14 });

  const prompts = [
    "What did I learn?",
    "What challenged me?",
    "What am I proud of?",
    "What do I want to try next?",
  ];
  prompts.forEach((p, i) => {
    doc.h3(p, { gapBefore: i ? 8 : 0 });
    doc.writingLines(3, { gapAfter: 10 });
  });
}

/* ---------------- Parent Notes ---------------- */
export function sectionParentNotes(doc, ctx) {
  const T = doc.t;
  doc.sectionBreak();
  doc.eyebrow("For the Parent");
  doc.title("Coaching Notes");
  doc.paragraph(`A few gentle reminders as you guide ${firstName(ctx.child?.name)} through this project. You don't need to teach every moment — often the most powerful thing is to step back and let the learning unfold.`,
    { color: T.color.muted, gapAfter: 14 });

  (ctx.coachingNotes || []).forEach(note => {
    doc.ensure(doc.lineHeightOf(T.size.body) + 2);
    const startY = doc.y;
    doc._fill(T.color.warm);
    doc.doc.circle(doc.mx + 4, startY + 6, 1.8, "F");
    doc.paragraph(note, { gapAfter: 9, x: doc.mx + 16, width: doc.cw - 16 });
  });

  doc.divider({ gapBefore: 8, gapAfter: 10 });
  doc.paragraph("Notice more than you correct. The observations you jot down here become some of the richest material in North Star's growth reports.",
    { color: T.color.muted, style: "italic", family: T.fonts.serif });
}

/* ---------------- Completion Certificate ---------------- */
export function sectionCertificate(doc, ctx) {
  const { project, child } = ctx;
  const T = doc.t;
  doc.sectionBreak();

  // Double frame — thin lines only, no heavy fills.
  const x0 = doc.mx - 16, y0 = doc.top - 14;
  const w = doc.cw + 32, h = (doc.ph - T.margin.bottom + 8) - y0;
  doc._draw(T.color.accent); doc.doc.setLineWidth(1.4);
  doc.doc.roundedRect(x0, y0, w, h, 12, 12, "S");
  doc._draw(T.color.gold); doc.doc.setLineWidth(0.7);
  doc.doc.roundedRect(x0 + 7, y0 + 7, w - 14, h - 14, 9, 9, "S");
  [[x0 + 22, y0 + 22], [x0 + w - 22, y0 + 22], [x0 + 22, y0 + h - 22], [x0 + w - 22, y0 + h - 22]]
    .forEach(([cx, cy]) => doc.sparkle(cx, cy, 5, T.color.gold));

  doc.y = y0 + 56;
  doc.wordmark({ size: 12 });
  doc.gap(18);
  doc.eyebrow("Certificate of Completion", { align: "center", color: T.color.gold, size: T.size.certEyebrow, charSpace: 3 });
  doc.gap(12);
  doc.paragraph("This certifies that", { align: "center", size: 12, family: T.fonts.serif, style: "italic", color: T.color.muted, gapAfter: 8 });
  doc.paragraph(firstName(child?.name), { align: "center", size: T.size.certName, family: T.fonts.serif, color: T.color.ink, gapAfter: 8 });
  doc.paragraph("has completed", { align: "center", size: 12, family: T.fonts.serif, style: "italic", color: T.color.muted, gapAfter: 6 });
  doc.paragraph(`“${project.title}”`, { align: "center", size: T.size.certTitle, family: T.fonts.serif, color: T.color.accent, gapAfter: 14 });

  doc.paragraph(certificateStatement(project, child), {
    align: "center", size: 11, color: T.color.body,
    width: doc.cw * 0.78, x: doc.mx + doc.cw * 0.11, gapAfter: 14,
  });

  const completedStr = ctx.completedDate ? fmtDateShort(ctx.completedDate) : "_____________________";
  doc.paragraph(`Completed  ${completedStr}`,
    { align: "center", size: 10.5, color: T.color.muted, family: T.fonts.sans });

  // Signature lines near the base of the frame.
  const sy = y0 + h - 70;
  const cols = [
    { label: "Parent", x: doc.mx, w: doc.cw * 0.3 },
    { label: "Child", x: doc.mx + doc.cw * 0.35, w: doc.cw * 0.3 },
    { label: "Mentor (optional)", x: doc.mx + doc.cw * 0.7, w: doc.cw * 0.3 },
  ];
  doc._draw(T.color.line); doc.doc.setLineWidth(0.7);
  cols.forEach(c => {
    doc.doc.line(c.x, sy, c.x + c.w, sy);
    doc._font(T.fonts.sans, "normal", T.size.tiny); doc._text(T.color.muted);
    doc.doc.setCharSpace(1.2);
    doc.doc.text(c.label.toUpperCase(), c.x, sy + 6, { baseline: "top" });
    doc.doc.setCharSpace(0);
  });
}

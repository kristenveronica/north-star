/* ============================================================
   pdf/sections.js — the printable sections.

   Each builder takes (doc, ctx) and draws purely through PdfDoc primitives,
   so they stay layout-only and template-agnostic. ctx carries everything a
   section needs: { project, child, milestones, materials (grouped), family,
   options, qr:{url,dataUrl}|null, coachingNotes, completedDate }.
   ============================================================ */

import {
  whyItMatters, certAffirmation, durationLabel, fmtDate, fmtDateShort,
  firstName, domainNames, joinList, quickOverview, coverLede,
} from "./content.js";

/* ---------------- Workbook Cover (page 1 — the invitation) ---------------- */
export function sectionCover(doc, ctx) {
  const { project, child } = ctx;
  const T = doc.t;

  doc.gap(22);
  doc.wordmark({ size: 12, gapAfter: 0 });

  // A calm compass motif as the focal illustration.
  const cx = doc.mx + doc.cw / 2;
  doc.gap(52);
  doc.compassMark(cx, doc.y + 22, 22, { weight: 1.1 });
  doc.gap(70);

  doc.eyebrow("Project Workbook", { align: "center", size: T.size.coverEyebrow, color: T.color.warm });
  doc.title(project.title, { align: "center", size: T.size.coverTitle, lineHeight: T.size.coverTitle * 1.08, gapAfter: 14 });

  const who = [child ? child.name : "", durationLabel(project)].filter(Boolean).join("    ·    ");
  doc.paragraph(who, { align: "center", size: T.size.coverName, color: T.color.muted, gapAfter: 6 });
  const doms = domainNames(project);
  if (doms.length) doc.paragraph(joinList(doms), { align: "center", size: T.size.small, color: T.color.faint, gapAfter: 0 });

  // Inviting lede — the child-facing description / why this was chosen for them.
  doc.gap(30);
  doc.rule(doc.y, { inset: doc.cw * 0.40, color: T.color.warm, weight: 0.8 });
  doc.gap(24);
  doc.paragraph(coverLede(project, child), {
    align: "center", size: T.size.coverLede, color: T.color.body, style: "italic", family: T.fonts.serif,
    width: doc.cw * 0.84, x: doc.mx + doc.cw * 0.08, lineHeight: T.size.coverLede * 1.5,
  });
}

/* ---------------- Project Overview (workbook, page 2+) ---------------- */
export function sectionOverview(doc, ctx) {
  const { project, child } = ctx;
  const T = doc.t;
  doc.sectionBreak();

  doc.eyebrow("The Project");
  doc.h2("Why this project matters", { gapBefore: 2 });
  doc.paragraph(whyItMatters(project, child), { gapAfter: 14 });

  const doms = domainNames(project);
  if (doms.length) {
    doc.h2("Capability domains");
    doc.paragraph("The real-world capabilities this project quietly grows:", { color: T.color.muted, gapAfter: 7 });
    doc.bullets(doms, { gapAfter: 14 });
  }

  const outcomes = (project.learningOutcomes || []).filter(Boolean);
  if (outcomes.length) {
    doc.h2(`What ${firstName(child?.name)} will learn`);
    doc.bullets(outcomes, { gapAfter: 14 });
  }

  if (project.description) {
    doc.h2("About this project");
    doc.paragraph(project.description, { gapAfter: 14 });
  }

  overviewQr(doc, ctx);
}

/* ---------------- Quick Project Summary (1–2 pages, minimal ink) ---------------- */
export function sectionQuickSummary(doc, ctx) {
  const { project, child, milestones } = ctx;
  const T = doc.t;

  doc.gap(4);
  doc.wordmark({ size: 11, gapAfter: 12 });
  doc.eyebrow("Quick Project Summary");
  doc.title(project.title, { gapAfter: 7 });
  const who = [child ? child.name : "", durationLabel(project)].filter(Boolean).join("    ·    ");
  doc.paragraph(who, { size: T.size.h3, color: T.color.muted, gapAfter: 4 });
  const doms = domainNames(project);
  if (doms.length) doc.paragraph(joinList(doms), { size: T.size.small, color: T.color.faint, gapAfter: 10 });

  doc.divider({ gapBefore: 4, gapAfter: 14 });

  doc.h3("Overview");
  doc.paragraph(quickOverview(project, child), { gapAfter: 14 });

  const mat = ctx.materials || {};
  const allMats = [...(mat.have || []), ...(mat.get || []), ...(mat.borrow || [])];
  doc.h3("Materials");
  if (allMats.length) allMats.forEach(n => doc.checkbox(n, { gapAfter: 4 }));
  else doc.paragraph("Nothing special required.", { color: T.color.muted, gapAfter: 6 });
  doc.gap(8);

  doc.h3("Milestones");
  const list = milestones || [];
  if (list.length) {
    list.forEach((m, i) => {
      const due = m.dueDate ? fmtDateShort(m.dueDate) : "";
      doc.checkbox(`${m.title || ("Milestone " + (i + 1))}${due ? "    —    due " + due : ""}`, { gapAfter: 5 });
    });
  } else {
    doc.paragraph("No milestones added yet.", { color: T.color.muted, gapAfter: 6 });
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

    doc.eyebrow(`Milestone ${i + 1} of ${list.length}`);
    doc.title(m.title || `Milestone ${i + 1}`);
    doc.metaRow([
      ["Project", project.title],
      ...(m.dueDate ? [["Due", fmtDate(m.dueDate)]] : []),
    ], { gapAfter: 10 });
    doc.divider({ gapBefore: 2, gapAfter: 14 });

    if (m.description) {
      doc.h3("Objective");
      doc.paragraph(m.description, { gapAfter: 12 });
    }

    doc.h3("Today's tasks");
    const tasks = (m.instructions || []).filter(Boolean);
    if (tasks.length) tasks.forEach(t => doc.checkbox(t));
    else { doc.checkbox(""); doc.checkbox(""); doc.checkbox(""); }
    doc.gap(10);

    doc.h3("Notes");
    doc.writingLines(3, { gapAfter: 14 });

    doc.h3("Reflection");
    doc.paragraph("What did you notice or feel proud of today?", { color: T.color.muted, style: "italic", family: T.fonts.serif, gapAfter: 8 });
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

/* ---------------- Completion Certificate (LANDSCAPE, framable) ----------------
   Assumes the orchestrator has already added a fresh landscape page. Premium,
   minimal, identity-first — and deliberately carries NO metadata footer. */
export function sectionCertificate(doc, ctx) {
  const { project, child } = ctx;
  const T = doc.t;

  const pw = doc.pw, ph = doc.ph;
  const inset = 34;
  const x0 = inset, y0 = inset, w = pw - inset * 2, h = ph - inset * 2;

  // Elegant double border + corner flourishes — thin lines, no heavy fills.
  doc._draw(T.color.accent); doc.doc.setLineWidth(1.6);
  doc.doc.rect(x0, y0, w, h, "S");
  doc._draw(T.color.gold); doc.doc.setLineWidth(0.7);
  doc.doc.rect(x0 + 8, y0 + 8, w - 16, h - 16, "S");
  [[x0 + 26, y0 + 26], [x0 + w - 26, y0 + 26], [x0 + 26, y0 + h - 26], [x0 + w - 26, y0 + h - 26]]
    .forEach(([cx, cy]) => doc.sparkle(cx, cy, 5, T.color.gold));

  const cx = pw / 2;
  // Centred text helper. Returns the y just below the drawn block.
  const center = (text, y, { size, font = "serif", style = "normal", color = T.color.ink, cs = 0, wrap = 0 } = {}) => {
    doc._font(T.fonts[font], style, size); doc._text(color);
    if (cs) doc.doc.setCharSpace(cs);
    let endY;
    if (wrap) {
      const lh = size * 1.42;
      const lines = doc.doc.splitTextToSize(String(text), wrap);
      let yy = y;
      lines.forEach(ln => { doc.doc.text(ln, cx, yy, { align: "center", baseline: "top" }); yy += lh; });
      endY = yy;
    } else {
      doc.doc.text(String(text), cx, y, { align: "center", baseline: "top" });
      endY = y + size * 1.3;
    }
    if (cs) doc.doc.setCharSpace(0);
    return endY;
  };

  let y = y0 + 42;
  doc.y = y; doc.wordmark({ size: 12, gapAfter: 0 }); y = doc.y + 10;

  y = center("CERTIFICATE OF COMPLETION", y, { size: T.size.certEyebrow, font: "sans", style: "bold", color: T.color.gold, cs: 3 }) + 16;
  y = center("This is proudly presented to", y, { size: 12, style: "italic", color: T.color.muted }) + 12;
  y = center(firstName(child?.name), y, { size: T.size.certName, color: T.color.ink }) + 12;
  y = center("for completing", y, { size: 12, style: "italic", color: T.color.muted }) + 6;
  y = center(`“${project.title}”`, y, { size: T.size.certTitle, color: T.color.accent }) + 20;

  // The ONE powerful, identity-affirming line.
  y = center(certAffirmation(project, child), y, { size: T.size.certAffirm, color: T.color.body, wrap: w * 0.72 }) + 14;

  // Optional parent message.
  const pm = (ctx.options?.parentMessage || "").trim();
  if (pm) y = center(`“${pm}”`, y, { size: T.size.certMessage, style: "italic", color: T.color.warm, wrap: w * 0.62 }) + 10;

  const dateStr = ctx.completedDate ? fmtDateShort(ctx.completedDate) : "____________________";
  center(`Completed  ${dateStr}`, y, { size: 10.5, font: "sans", color: T.color.muted });

  // Signature lines spread across the base of the frame.
  const sy = y0 + h - 54;
  const cols = [
    { label: "Parent", x: x0 + w * 0.12, w: w * 0.22 },
    { label: "Child", x: x0 + w * 0.39, w: w * 0.22 },
    { label: "Mentor (optional)", x: x0 + w * 0.66, w: w * 0.22 },
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

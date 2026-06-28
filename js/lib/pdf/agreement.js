/* ============================================================
   pdf/agreement.js — "The {Family} Technology Agreement" (per child).

   A calm, framable document a family is proud to display or revisit together
   — built on the same minimal-ink PdfDoc engine as the project workbooks.
   Lists the agreements the family adopted for this child, with space for
   parent + child signatures and a review date.
   ============================================================ */

import { createDoc } from "./pdfDoc.js";
import { firstName, fmtDateShort } from "./content.js";
import { TECH_SECTIONS, normalizeTechAgreement, sectionAgreements, childTechAgreement } from "../techAgreement.js";

export async function generateTechAgreementPdf({ child, family, pageSize = "a4" }) {
  const a = normalizeTechAgreement(childTechAgreement(child));
  const famName = (family?.familyName || "").trim();
  const T_title = famName ? `The ${famName} Technology Agreement` : "Our Technology Agreement";
  const doc = await createDoc({ pageSize });
  const T = doc.t;

  // --- header ---
  doc.gap(8);
  doc.wordmark({ size: 12, gapAfter: 8 });
  doc.rule(doc.y, { inset: doc.cw * 0.42, color: T.color.warm, weight: 0.8 });
  doc.gap(16);
  doc.eyebrow("Family Technology Agreement", { align: "center" });
  doc.title(T_title, { align: "center" });
  doc.paragraph(`for ${firstName(child?.name)}`, { align: "center", size: T.size.h2, family: T.fonts.serif, style: "italic", color: T.color.muted, gapAfter: 4 });
  doc.paragraph(`Agreed ${fmtDateShort(new Date())}`, { align: "center", size: T.size.small, color: T.color.faint, gapAfter: 8 });
  doc.divider({ gapBefore: 10, gapAfter: 12 });

  doc.paragraph("Technology is part of how we learn, create and connect. These are the agreements we've made together — not rules imposed, but choices we've talked through as a family. We can revisit them any time as we grow.",
    { color: T.color.muted, style: "italic", family: T.fonts.serif, gapAfter: 14 });

  // --- agreed sections ---
  let any = false;
  for (const s of TECH_SECTIONS) {
    const sec = a.sections[s.id];
    const lines = sectionAgreements(sec);
    if (sec.skipped || !lines.length) continue;
    any = true;
    doc.h2(s.title);   // built-in PDF fonts can't render emoji — title only
    lines.forEach(line => doc.checkbox(line, { gapAfter: 5 }));
    doc.gap(6);
  }
  if (!any) {
    doc.paragraph("This agreement is still a work in progress — add the agreements that matter to your family, then print it again to display together.",
      { color: T.color.muted, gapAfter: 12 });
  }

  // --- signatures + review ---
  doc.divider({ gapBefore: 10, gapAfter: 16 });
  doc.h3("Signed by", { gapBefore: 0 });
  doc.gap(20);
  signatureRow(doc, [
    { label: "Parent / Carer", x: doc.mx, w: doc.cw * 0.44 },
    { label: `${firstName(child?.name)}`, x: doc.mx + doc.cw * 0.56, w: doc.cw * 0.44 },
  ]);
  doc.gap(34);
  signatureRow(doc, [
    { label: "Parent / Carer", x: doc.mx, w: doc.cw * 0.44 },
    { label: "Witness (optional)", x: doc.mx + doc.cw * 0.56, w: doc.cw * 0.44 },
  ]);

  doc.gap(26);
  const reviewStr = a.reviewDate ? fmtDateShort(a.reviewDate) : "________________";
  doc.paragraph(`We'll revisit this agreement together on:  ${reviewStr}`,
    { size: T.size.small, color: T.color.muted, family: T.fonts.sans });

  doc.footerAll({
    brand: "North Star",
    projectTitle: famName ? `${famName} Technology Agreement` : "Technology Agreement",
    childFirst: firstName(child?.name),
    generatedLabel: new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }),
    version: "1.0",
  });

  const safe = (famName || firstName(child?.name) || "family").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-");
  doc.save(`NorthStar-Technology-Agreement-${safe}.pdf`);
  return { ok: true };
}

function signatureRow(doc, cols) {
  const T = doc.t;
  doc.ensure(24);
  const y = doc.y;
  doc._draw(T.color.line); doc.doc.setLineWidth(0.7);
  cols.forEach(c => {
    doc.doc.line(c.x, y, c.x + c.w, y);
    doc._font(T.fonts.sans, "normal", T.size.tiny); doc._text(T.color.muted);
    doc.doc.setCharSpace(1.1);
    doc.doc.text(c.label.toUpperCase(), c.x, y + 6, { baseline: "top" });
    doc.doc.setCharSpace(0);
  });
  doc.y = y + 6;
}

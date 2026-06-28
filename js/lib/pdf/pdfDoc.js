/* ============================================================
   pdf/pdfDoc.js — the layout engine.

   A thin, brand-aware wrapper over jsPDF (lazy-loaded from esm.sh, the
   same CDN pattern the app already uses for Supabase). It owns the cursor
   and page breaks and exposes a small vocabulary of primitives — wordmark,
   eyebrow, heading, paragraph, bullets, checkbox, writing lines, key/value,
   divider, image, sparkle. Templates and sections are written purely in
   terms of these, so adding a new template never touches jsPDF directly.

   Convention: this.y is the TOP of the next thing to draw (we render text
   with baseline:"top"), which keeps all the layout maths simple and additive.
   ============================================================ */

import { THEME, PAGE } from "./theme.js";

let _jsPDFCtor = null;
async function loadJsPDF() {
  if (_jsPDFCtor) return _jsPDFCtor;
  const mod = await import("https://esm.sh/jspdf@2.5.1");
  _jsPDFCtor = mod.jsPDF || mod.default?.jsPDF || mod.default;
  if (!_jsPDFCtor) throw new Error("Could not load the PDF engine.");
  return _jsPDFCtor;
}

export async function createDoc({ pageSize = "a4", orientation = "portrait" } = {}) {
  const jsPDF = await loadJsPDF();
  const fmt = pageSize === "letter" ? "letter" : "a4";
  const doc = new jsPDF({ unit: "pt", format: fmt, orientation, compress: true });
  return new PdfDoc(doc, fmt, orientation);
}

export class PdfDoc {
  constructor(doc, fmt, orientation = "portrait") {
    this.doc = doc;
    this.t = THEME;
    this.fmt = fmt;
    this._applyDims(orientation);
  }

  // Set page geometry for the current orientation. Shared by the constructor,
  // page() and landscapePage() so portrait/landscape maths stays in one place.
  _applyDims(orientation = "portrait") {
    const size = PAGE[this.fmt] || PAGE.a4;
    const landscape = orientation === "landscape";
    this.orientation = orientation;
    this.pw = landscape ? size.h : size.w;
    this.ph = landscape ? size.w : size.h;
    this.mx = THEME.margin.x;
    this.cw = this.pw - THEME.margin.x * 2;   // content width
    this.top = THEME.margin.top;
    this.bottom = this.ph - THEME.margin.bottom;
    this.y = this.top;
  }

  /* ---------- low-level helpers ---------- */
  _text(c) { this.doc.setTextColor(c[0], c[1], c[2]); }
  _draw(c) { this.doc.setDrawColor(c[0], c[1], c[2]); }
  _fill(c) { this.doc.setFillColor(c[0], c[1], c[2]); }
  _font(family, style, size) { this.doc.setFont(family, style); this.doc.setFontSize(size); }
  lineHeightOf(size) { return size * THEME.lineHeight; }

  /* ---------- flow control ---------- */
  page() { this.doc.addPage(this.fmt, "portrait"); this._applyDims("portrait"); return this; }
  // Append a LANDSCAPE page — used by the framable completion certificate.
  landscapePage() { this.doc.addPage(this.fmt, "landscape"); this._applyDims("landscape"); return this; }
  // Ensure `h` points fit before the bottom margin; otherwise break the page.
  ensure(h) { if (this.y + h > this.bottom) this.page(); return this; }
  gap(h) { this.y += h; return this; }
  // Start a fresh page for a new section unless we're already at the top.
  sectionBreak() { if (this.y > this.top + 0.5) this.page(); return this; }

  /* ---------- text primitives ---------- */
  // A run of wrapped text. Returns this for chaining.
  paragraph(text, opts = {}) {
    const o = {
      size: THEME.size.body, color: THEME.color.body, family: THEME.fonts.sans,
      style: "normal", align: "left", width: this.cw, x: this.mx, gapAfter: 6,
      charSpace: 0, lineHeight: null, ...opts,
    };
    if (text == null || text === "") { this.gap(o.gapAfter); return this; }
    this._font(o.family, o.style, o.size);
    this._text(o.color);
    if (o.charSpace) this.doc.setCharSpace(o.charSpace);
    const lh = o.lineHeight || this.lineHeightOf(o.size);
    const lines = this.doc.splitTextToSize(String(text), o.width);
    for (const ln of lines) {
      this.ensure(lh);
      let tx = o.x; const topt = { baseline: "top" };
      if (o.align === "center") { tx = o.x + o.width / 2; topt.align = "center"; }
      else if (o.align === "right") { tx = o.x + o.width; topt.align = "right"; }
      this.doc.text(ln, tx, this.y, topt);
      this.y += lh;
    }
    if (o.charSpace) this.doc.setCharSpace(0);
    this.gap(o.gapAfter);
    return this;
  }

  eyebrow(text, opts = {}) {
    return this.paragraph((text || "").toUpperCase(), {
      size: THEME.size.eyebrow, color: opts.color || THEME.color.warm,
      family: THEME.fonts.sans, style: "bold", charSpace: 2.2, gapAfter: 8,
      align: opts.align || "left", ...opts,
    });
  }

  title(text, opts = {}) {
    return this.paragraph(text, {
      size: THEME.size.title, color: THEME.color.ink, family: THEME.fonts.serif,
      style: "normal", lineHeight: THEME.size.title * 1.12, gapAfter: 10, ...opts,
    });
  }

  h2(text, opts = {}) {
    this.gap(opts.gapBefore != null ? opts.gapBefore : 8);
    return this.paragraph(text, {
      size: THEME.size.h2, color: THEME.color.accent, family: THEME.fonts.serif,
      style: "normal", gapAfter: 5, ...opts,
    });
  }

  h3(text, opts = {}) {
    return this.paragraph(text, {
      size: THEME.size.h3, color: THEME.color.ink, family: THEME.fonts.sans,
      style: "bold", gapAfter: 4, ...opts,
    });
  }

  bullets(items, opts = {}) {
    const list = (items || []).filter(Boolean);
    if (!list.length) return this;
    const size = opts.size || THEME.size.body;
    const lh = this.lineHeightOf(size);
    const indent = 16;
    for (const item of list) {
      this._font(THEME.fonts.sans, "normal", size);
      this._text(THEME.color.body);
      const lines = this.doc.splitTextToSize(String(item), this.cw - indent);
      const blockH = lines.length * lh;
      this.ensure(blockH + 2);
      // dot, vertically centred on the first line
      this._fill(THEME.color.warm);
      this.doc.circle(this.mx + 3, this.y + lh * 0.45, 1.6, "F");
      this.doc.text(lines, this.mx + indent, this.y, { baseline: "top", lineHeightFactor: THEME.lineHeight });
      this.y += blockH + 3;
    }
    this.gap(opts.gapAfter != null ? opts.gapAfter : 4);
    return this;
  }

  /* ---------- worksheet primitives ---------- */
  // A checkbox with a (wrapping) label. Empty square = minimal ink, easy to tick.
  checkbox(label, opts = {}) {
    const size = opts.size || THEME.size.body;
    const lh = this.lineHeightOf(size);
    const box = size * 0.95;
    const pad = 10;
    this._font(THEME.fonts.sans, "normal", size);
    const lines = this.doc.splitTextToSize(String(label || ""), this.cw - box - pad);
    const blockH = Math.max(box, lines.length * lh);
    this.ensure(blockH + 6);
    this._draw(THEME.color.line);
    this.doc.setLineWidth(0.9);
    this.doc.rect(this.mx, this.y + (lh - box) / 2, box, box, "S");
    this._text(THEME.color.body);
    this.doc.text(lines, this.mx + box + pad, this.y, { baseline: "top", lineHeightFactor: THEME.lineHeight });
    this.y += blockH + (opts.gapAfter != null ? opts.gapAfter : 7);
    return this;
  }

  // Generous ruled writing space.
  writingLines(count = 4, opts = {}) {
    const gap = opts.gap || 26;
    this._draw(opts.color || THEME.color.line);
    this.doc.setLineWidth(0.6);
    for (let i = 0; i < count; i++) {
      this.ensure(gap);
      const ly = this.y + gap * 0.72;
      this.doc.line(this.mx, ly, this.mx + this.cw, ly);
      this.y += gap;
    }
    this.gap(opts.gapAfter != null ? opts.gapAfter : 8);
    return this;
  }

  // A bordered, empty box (e.g. "space for notes" / illustration area).
  box(height, opts = {}) {
    this.ensure(height + 4);
    this._draw(opts.color || THEME.color.hair);
    this.doc.setLineWidth(0.7);
    this.doc.roundedRect(this.mx, this.y, this.cw, height, 5, 5, "S");
    if (opts.label) {
      this._font(THEME.fonts.sans, "italic", THEME.size.small);
      this._text(THEME.color.faint);
      this.doc.text(opts.label, this.mx + 10, this.y + 12, { baseline: "top" });
    }
    this.y += height + (opts.gapAfter != null ? opts.gapAfter : 10);
    return this;
  }

  // Label / value meta line (e.g. "Due  Monday 15 June").
  metaRow(pairs, opts = {}) {
    const size = opts.size || THEME.size.small;
    const lh = this.lineHeightOf(size);
    this.ensure(lh);
    let x = this.mx;
    for (const [label, value] of pairs) {
      this._font(THEME.fonts.sans, "bold", size); this._text(THEME.color.muted);
      this.doc.setCharSpace(0.6);
      const lw = this.doc.getTextWidth((label + "  ").toUpperCase());
      this.doc.text((label + "  ").toUpperCase(), x, this.y, { baseline: "top" });
      this.doc.setCharSpace(0);
      x += lw;
      this._font(THEME.fonts.sans, "normal", size); this._text(THEME.color.body);
      const vw = this.doc.getTextWidth(value + "");
      this.doc.text(value + "", x, this.y, { baseline: "top" });
      x += vw + 18;
    }
    this.y += lh + (opts.gapAfter != null ? opts.gapAfter : 6);
    return this;
  }

  divider(opts = {}) {
    this.gap(opts.gapBefore != null ? opts.gapBefore : 8);
    this.ensure(2);
    this._draw(opts.color || THEME.color.hair);
    this.doc.setLineWidth(opts.weight || 0.7);
    this.doc.line(this.mx, this.y, this.mx + this.cw, this.y);
    this.y += (opts.gapAfter != null ? opts.gapAfter : 12);
    return this;
  }

  // Full-width rule with custom inset (used in headers/certificate).
  rule(y, opts = {}) {
    const inset = opts.inset || 0;
    this._draw(opts.color || THEME.color.hair);
    this.doc.setLineWidth(opts.weight || 0.7);
    this.doc.line(this.mx + inset, y, this.mx + this.cw - inset, y);
    return this;
  }

  /* ---------- brand marks ---------- */
  // A clean 4-point star (✦) drawn as vectors, so it prints anywhere.
  sparkle(cx, cy, r, color = THEME.color.warm) {
    this._fill(color);
    const w = r * 0.32;
    this.doc.triangle(cx, cy - r, cx - w, cy, cx + w, cy, "F");
    this.doc.triangle(cx, cy + r, cx - w, cy, cx + w, cy, "F");
    this.doc.triangle(cx - r, cy, cx, cy - w, cx, cy + w, "F");
    this.doc.triangle(cx + r, cy, cx, cy - w, cx, cy + w, "F");
    return this;
  }

  // A small "North Star" compass motif: a thin ring with a 4-point star inside.
  // Used as the subtle illustration on the Workbook cover & certificate.
  compassMark(cx, cy, r, opts = {}) {
    this._draw(opts.stroke || THEME.color.warm);
    this.doc.setLineWidth(opts.weight || 1);
    this.doc.circle(cx, cy, r, "S");
    this.sparkle(cx, cy, r * 0.6, opts.star || THEME.color.accent);
    return this;
  }

  // Centred "✦ NORTH STAR" wordmark at vertical position this.y (advances y).
  wordmark(opts = {}) {
    const size = opts.size || 12;
    const color = opts.color || THEME.color.accent;
    const star = opts.star || THEME.color.warm;
    const label = "NORTH STAR";
    this._font(THEME.fonts.serif, "normal", size);
    this.doc.setCharSpace(size * 0.32);
    const tw = this.doc.getTextWidth(label);
    this.doc.setCharSpace(0);
    const starR = size * 0.42;
    const totalW = starR * 2 + size * 0.5 + tw;
    const cx = this.mx + this.cw / 2;
    const startX = cx - totalW / 2;
    const midY = this.y + size * 0.55;
    this.sparkle(startX + starR, midY, starR, star);
    this._text(color);
    this._font(THEME.fonts.serif, "normal", size);
    this.doc.setCharSpace(size * 0.32);
    this.doc.text(label, startX + starR * 2 + size * 0.5, this.y, { baseline: "top" });
    this.doc.setCharSpace(0);
    this.y += size * 1.3 + (opts.gapAfter != null ? opts.gapAfter : 0);
    return this;
  }

  /* ---------- images ---------- */
  image(dataUrl, x, y, w, h, fmt = "PNG") {
    try { this.doc.addImage(dataUrl, fmt, x, y, w, h); } catch (e) { /* skip on failure */ }
    return this;
  }

  /* ---------- finishing ---------- */
  /* A quiet metadata footer on EVERY page — small, minimal ink, a single thin
     divider. `meta` is an open bag so the line can grow later (family name,
     white-label org, category, language, template) without touching layout:
       { brand, projectTitle, childFirst, generatedLabel, version, extras:[] }
     The right edge always carries "Page i of n". The left line truncates with
     an ellipsis rather than wrapping, so the footer stays one calm line. */
  footerAll(meta = {}) {
    const n = this.doc.getNumberOfPages();
    const fy = this.ph - THEME.margin.bottom + 24;
    const size = THEME.size.tiny;
    const parts = [
      meta.brand || "North Star",
      meta.projectTitle,
      meta.childFirst,
      meta.generatedLabel ? `Generated ${meta.generatedLabel}` : "",
      meta.version ? `Version ${meta.version}` : "",
      ...(meta.extras || []),
    ].filter(Boolean);

    for (let i = 1; i <= n; i++) {
      this.doc.setPage(i);
      this._draw(THEME.color.hair);
      this.doc.setLineWidth(0.5);
      this.doc.line(this.mx, fy - 7, this.mx + this.cw, fy - 7);

      this._font(THEME.fonts.sans, "normal", size);
      this._text(THEME.color.muted);
      const right = `Page ${i} of ${n}`;
      const rightW = this.doc.getTextWidth(right);
      this.doc.text(right, this.mx + this.cw, fy, { baseline: "top", align: "right" });

      const avail = this.cw - rightW - 18;
      let left = parts.join("  ·  ");
      if (this.doc.getTextWidth(left) > avail) {
        while (left.length > 1 && this.doc.getTextWidth(left + "…") > avail) left = left.slice(0, -1);
        left = left.replace(/[\s·]+$/, "") + "…";
      }
      this._text(THEME.color.muted);
      this.doc.text(left, this.mx, fy, { baseline: "top" });
    }
    return this;
  }

  save(filename) { this.doc.save(filename); return this; }
}

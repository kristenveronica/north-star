/* ============================================================
   pdfModal.js — the "Generate PDF" modal.

   Lets a parent choose which sections to include, then assembles a
   beautifully formatted, print-ready PDF. The Completion Certificate option
   only appears for milestone (completed) projects. Refuses to run for an
   unsaved/temporary project so QR links never break.
   ============================================================ */

import { el, esc, openModal, toast } from "./ui.js";
import { getState } from "../store.js";
import {
  PROJECT_PDF_SECTIONS, PDF_TEMPLATES,
  generateProjectPdf, hasValidProjectId,
} from "../lib/pdf/index.js";

export function openProjectPdfModal(project, child) {
  const state = getState();

  // Reliability gate — an unsaved project can't produce a valid QR/route.
  if (!hasValidProjectId(project, state)) {
    toast("Please save this project before generating a PDF.", { type: "error", duration: 3400 });
    return;
  }

  // Every section is offered for every project — parents choose. The certificate
  // simply leaves the completion date blank until the project is finished.
  const sections = PROJECT_PDF_SECTIONS;
  const showTemplatePicker = PDF_TEMPLATES.length > 1;

  const body = el(`
    <div>
      <p class="text-muted small" style="margin:0 0 14px">Choose what to include. North Star builds a clean, beautifully formatted document designed to print well at home — even in black &amp; white.</p>
      <div class="stack" style="gap:10px" id="pdf-sections">
        ${sections.map(s => `
          <label class="checkbox" style="display:flex;align-items:flex-start;gap:10px;cursor:pointer">
            <input type="checkbox" data-sec="${esc(s.key)}" ${s.default ? "checked" : ""} style="margin-top:2px"/>
            <span><span class="fw-600">${esc(s.label)}</span>${s.note ? ` <span class="text-muted small">(${esc(s.note)})</span>` : ""}${s.key === "certificate" ? ` <span class="text-muted small">— a framable certificate of completion</span>` : ""}</span>
          </label>`).join("")}
      </div>

      <div class="divider"></div>
      <div class="row" style="gap:18px;flex-wrap:wrap;align-items:center">
        <div class="field" style="margin:0">
          <label class="small">Paper size</label>
          <select class="input" id="pdf-page" style="width:130px">
            <option value="a4" selected>A4</option>
            <option value="letter">Letter (US)</option>
          </select>
        </div>
        ${showTemplatePicker ? `
          <div class="field" style="margin:0">
            <label class="small">Style</label>
            <select class="input" id="pdf-template" style="min-width:180px">
              ${PDF_TEMPLATES.map(t => `<option value="${esc(t.id)}">${esc(t.label)}</option>`).join("")}
            </select>
          </div>` : ""}
      </div>
    </div>
  `);

  const foot = el(`<div class="row" style="gap:10px;justify-content:flex-end;width:100%">
    <button class="btn" data-cancel>Cancel</button>
    <button class="btn btn-primary" data-go>⬇ Generate PDF</button>
  </div>`);

  const modal = openModal({ title: "Generate PDF", body, footer: foot });

  foot.querySelector("[data-cancel]").addEventListener("click", () => modal.close());

  foot.querySelector("[data-go]").addEventListener("click", async () => {
    const options = {};
    body.querySelectorAll("[data-sec]").forEach(c => { options[c.dataset.sec] = c.checked; });
    if (!Object.values(options).some(Boolean)) {
      toast("Pick at least one section to include.", { type: "error" });
      return;
    }
    options.pageSize = body.querySelector("#pdf-page")?.value || "a4";
    const templateId = body.querySelector("#pdf-template")?.value || "home-print";

    const goBtn = foot.querySelector("[data-go]");
    goBtn.disabled = true;
    const original = goBtn.textContent;
    goBtn.textContent = "Generating…";
    try {
      await generateProjectPdf({ project, child, options, templateId, state: getState() });
      modal.close();
      toast("PDF ready — check your downloads.", { type: "success" });
    } catch (e) {
      console.error("PDF generation failed", e);
      goBtn.disabled = false;
      goBtn.textContent = original;
      toast("Couldn't generate the PDF just now. Please try again.", { type: "error", duration: 3400 });
    }
  });

  return modal;
}

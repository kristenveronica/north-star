/* ============================================================
   pdfModal.js — the "Print this project" modal.

   Offers three intentionally different print experiences — Quick Summary,
   Project Workbook, and a framable Completion Certificate — rather than a bag
   of optional sections. The certificate is available on EVERY project (so the
   experience is predictable) and can be printed on its own or appended to a
   document. Refuses to run for an unsaved project so QR links never break.
   ============================================================ */

import { el, esc, openModal, toast } from "./ui.js";
import { getState } from "../store.js";
import {
  PDF_FORMATS, generateProjectPdf, hasValidProjectId, suggestParentMessage,
} from "../lib/pdf/index.js";

export function openProjectPdfModal(project, child) {
  const state = getState();

  // Reliability gate — an unsaved project can't produce a valid QR/route.
  if (!hasValidProjectId(project, state)) {
    toast("Please save this project before printing.", { type: "error", duration: 3400 });
    return;
  }

  // The two portrait documents + the certificate as a third, equal choice.
  const formats = [
    ...PDF_FORMATS.map(f => ({ id: f.id, label: f.label, blurb: f.blurb, recommended: f.recommended })),
    { id: "certificate", label: "Completion Certificate", blurb: "A framable, landscape certificate celebrating who your child became through this project." },
  ];
  const defaultId = "workbook";

  const card = (f) => `
    <label class="pdf-fmt" style="display:flex;gap:12px;align-items:flex-start;padding:14px;border:1.5px solid var(--border);border-radius:var(--r-md);cursor:pointer">
      <input type="radio" name="pdf-format" value="${esc(f.id)}" ${f.id === defaultId ? "checked" : ""} style="margin-top:3px"/>
      <span style="flex:1">
        <span class="fw-700">${esc(f.label)}</span>${f.recommended ? ` <span class="tag tag-sage" style="font-size:11px">Recommended</span>` : ""}
        <span class="small text-muted" style="display:block;margin-top:3px">${esc(f.blurb)}</span>
      </span>
    </label>`;

  const body = el(`
    <div>
      <p class="text-muted small" style="margin:0 0 14px">Choose how you'd like to print this project. Each is designed to feel made for your child — not exported.</p>

      <div class="stack" id="pdf-formats" style="gap:10px">${formats.map(card).join("")}</div>

      <div id="cert-include" style="margin-top:12px">
        <label class="checkbox" style="display:flex;align-items:center;gap:10px;cursor:pointer">
          <input type="checkbox" id="pdf-cert"/>
          <span><span class="fw-600">Also include a completion certificate</span> <span class="small text-muted">— added as a final framable page</span></span>
        </label>
      </div>

      <div id="cert-msg" style="margin-top:12px;display:none">
        <div class="field" style="margin:0">
          <label class="small">Parent message <span class="text-muted">(optional)</span></label>
          <textarea class="textarea" id="pdf-parent-msg" rows="2" placeholder="Leave it blank, write your own, or let North Star suggest one."></textarea>
          <div class="row" style="gap:10px;margin-top:8px;align-items:center">
            <button class="btn btn-sm" id="pdf-suggest-msg" type="button">✨ Suggest one</button>
            <span class="small text-muted">One or two short sentences — it appears on the certificate.</span>
          </div>
        </div>
      </div>

      <div class="divider"></div>
      <div class="field" style="margin:0">
        <label class="small">Paper size</label>
        <select class="input" id="pdf-page" style="width:140px">
          <option value="a4" selected>A4</option>
          <option value="letter">Letter (US)</option>
        </select>
      </div>
    </div>
  `);

  const foot = el(`<div class="row" style="gap:10px;justify-content:flex-end;width:100%">
    <button class="btn" data-cancel>Cancel</button>
    <button class="btn btn-primary" data-go>⬇ Generate</button>
  </div>`);

  const modal = openModal({ title: "Print this project", body, footer: foot });

  const certInclude = body.querySelector("#cert-include");
  const certMsg = body.querySelector("#cert-msg");
  const certBox = body.querySelector("#pdf-cert");

  const selectedFormat = () => body.querySelector('input[name="pdf-format"]:checked')?.value || defaultId;
  function syncCertUI() {
    const fmt = selectedFormat();
    const isCert = fmt === "certificate";
    certInclude.style.display = isCert ? "none" : "";
    const showMsg = isCert || certBox.checked;
    certMsg.style.display = showMsg ? "" : "none";
    // Reflect the selected card with a clear ring.
    body.querySelectorAll(".pdf-fmt").forEach(l => {
      const on = l.querySelector("input").checked;
      l.style.borderColor = on ? "var(--primary)" : "var(--border)";
      l.style.background = on ? "var(--primary-soft)" : "transparent";
    });
  }
  body.querySelectorAll('input[name="pdf-format"]').forEach(r => r.addEventListener("change", syncCertUI));
  certBox.addEventListener("change", syncCertUI);
  syncCertUI();

  body.querySelector("#pdf-suggest-msg").addEventListener("click", () => {
    body.querySelector("#pdf-parent-msg").value = suggestParentMessage(project, child);
  });

  foot.querySelector("[data-cancel]").addEventListener("click", () => modal.close());

  foot.querySelector("[data-go]").addEventListener("click", async () => {
    const format = selectedFormat();
    const options = {
      format,
      certificate: format !== "certificate" && certBox.checked,
      parentMessage: (body.querySelector("#pdf-parent-msg")?.value || "").trim(),
      pageSize: body.querySelector("#pdf-page")?.value || "a4",
    };

    const goBtn = foot.querySelector("[data-go]");
    goBtn.disabled = true;
    const original = goBtn.textContent;
    goBtn.textContent = "Generating…";
    try {
      await generateProjectPdf({ project, child, options, state: getState() });
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

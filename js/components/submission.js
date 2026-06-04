/* ============================================================
   submission.js — "Submit your work" modal for milestone completion.

   Always optional. The child can:
     - Type or speak what they did
     - Upload photos, audio, video, PDFs, or written work
     - Hit "Skip & mark done" to use the lightning-fast tap path
   Or
     - Hit "Submit & earn star" to save evidence + complete
   ============================================================ */

import { esc, toast, openModal } from "./ui.js";

const MAX_IMAGE_PX = 1400;
const IMG_QUALITY = 0.8;
const HARD_CAP_BYTES = 2.5 * 1024 * 1024;  // 2.5 MB per file (after compression for images)

/**
 * Open the submission modal for one milestone.
 *
 * @param {object} options
 * @param {object} options.milestone — the milestone being completed
 * @param {object} options.project   — the parent project (for context strings)
 * @param {function(payload)} options.onSubmit — called with { submission, evidence }
 * @param {function()} options.onSkip — called when the child chooses "Skip & mark done"
 */
export function openSubmissionModal({ milestone, project, onSubmit, onSkip }) {
  const body = document.createElement("div");
  body.innerHTML = `
    <p class="text-muted small">${esc(project?.title || "")}${milestone.reflectionRequired ? " · this step asks for a reflection" : ""}</p>
    <h3 style="font-family:var(--font-serif);font-size:20px;margin:6px 0 14px">${esc(milestone.title)}</h3>

    <div class="field">
      <label>What did you do? <span class="text-muted small">(optional — type, or tap the mic to speak)</span></label>
      <textarea class="textarea" id="sub-text" rows="4" data-voice data-voice-label="Tell me what you did" placeholder="${esc(milestone.reflectionRequired ? "What did you do? What did you learn? What was hard? What surprised you?" : "Tell us about what you did. Skip if you want to.")}"></textarea>
    </div>

    <div class="field">
      <label>Upload evidence <span class="text-muted small">(optional — photos, audio, video, PDFs)</span></label>
      <div class="upload-zone" id="sub-drop">
        <input type="file" id="sub-files" multiple accept="image/*,audio/*,video/*,application/pdf,.txt,.md,.doc,.docx" style="display:none"/>
        <div class="upload-zone-inner">
          <div class="upload-zone-icon">⌃</div>
          <div class="fw-700">Drop files here or click to upload</div>
          <div class="small text-muted">Images get auto-resized. Each file under 2.5 MB.</div>
        </div>
      </div>
      <div id="sub-files-preview" class="upload-list mt-1"></div>
    </div>
  `;

  const foot = document.createElement("div");
  foot.style.cssText = "display:flex;gap:10px;width:100%;justify-content:space-between";
  foot.innerHTML = `
    <button class="btn" data-skip>Skip &amp; mark done</button>
    <button class="btn btn-primary" data-submit>Submit &amp; earn star ✦</button>
  `;

  const modal = openModal({
    title: "Mark this step done",
    body, footer: foot,
  });

  // ----- file handling -----
  const pending = []; // { id, kind, fileName, fileType, fileSize, dataUrl }
  const previewHost = body.querySelector("#sub-files-preview");
  const fileInput = body.querySelector("#sub-files");
  const dropZone = body.querySelector("#sub-drop");

  const repaintPreview = () => {
    if (pending.length === 0) {
      previewHost.innerHTML = "";
      return;
    }
    previewHost.innerHTML = pending.map(p => `
      <div class="upload-item" data-pid="${p.id}">
        ${p.fileType?.startsWith("image/") && p.dataUrl
          ? `<img src="${p.dataUrl}" alt="${esc(p.fileName)}"/>`
          : `<span class="upload-thumb">${fileTypeLabel(p.fileType)}</span>`}
        <div style="flex:1;min-width:0">
          <div class="fw-700" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.fileName)}</div>
          <div class="small text-muted">${humanSize(p.fileSize)}</div>
        </div>
        <button class="btn btn-ghost btn-sm" data-remove="${p.id}">Remove</button>
      </div>
    `).join("");
    previewHost.querySelectorAll("[data-remove]").forEach(b => {
      b.addEventListener("click", () => {
        const idx = pending.findIndex(p => p.id === b.dataset.remove);
        if (idx >= 0) pending.splice(idx, 1);
        repaintPreview();
      });
    });
  };

  const acceptFile = async (file) => {
    try {
      let dataUrl, fileSize = file.size, fileType = file.type, fileName = file.name;
      if (fileType.startsWith("image/")) {
        const compressed = await compressImage(file);
        dataUrl = compressed.dataUrl;
        fileSize = compressed.size;
      } else {
        if (file.size > HARD_CAP_BYTES) {
          toast(`"${file.name}" is too big (${humanSize(file.size)}). Cap is 2.5 MB.`, { type: "warning", duration: 4000 });
          return;
        }
        dataUrl = await fileToDataURL(file);
      }
      pending.push({
        id: "p_" + Math.random().toString(36).slice(2, 9),
        kind: "upload",
        fileName, fileType, fileSize, dataUrl,
      });
      repaintPreview();
    } catch (err) {
      toast("Couldn't read file: " + (err.message || err), { type: "warning" });
    }
  };

  dropZone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async (e) => {
    for (const f of e.target.files) await acceptFile(f);
    fileInput.value = "";
  });
  ;["dragenter", "dragover"].forEach(ev => dropZone.addEventListener(ev, (e) => {
    e.preventDefault(); dropZone.classList.add("dragover");
  }));
  ;["dragleave", "drop"].forEach(ev => dropZone.addEventListener(ev, (e) => {
    e.preventDefault(); dropZone.classList.remove("dragover");
  }));
  dropZone.addEventListener("drop", async (e) => {
    if (!e.dataTransfer?.files) return;
    for (const f of e.dataTransfer.files) await acceptFile(f);
  });

  // ----- button actions -----
  foot.querySelector("[data-skip]").addEventListener("click", () => {
    modal.close();
    onSkip?.();
  });
  foot.querySelector("[data-submit]").addEventListener("click", () => {
    const text = body.querySelector("#sub-text").value.trim();
    const evidence = pending.map(p => ({
      kind: "upload",
      fileName: p.fileName,
      fileType: p.fileType,
      fileSize: p.fileSize,
      dataUrl: p.dataUrl,
    }));
    if (text) evidence.unshift({ kind: "note", text });
    modal.close();
    onSubmit?.({
      submission: text ? { text } : null,
      evidence,
    });
  });

  // Focus the text box
  setTimeout(() => body.querySelector("#sub-text")?.focus(), 60);
}

/* ---------- helpers ---------- */
function humanSize(bytes) {
  if (bytes == null) return "—";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function fileTypeLabel(type) {
  if (!type) return "FILE";
  if (type.startsWith("audio/")) return "AUDIO";
  if (type.startsWith("video/")) return "VIDEO";
  if (type === "application/pdf") return "PDF";
  if (type.includes("word")) return "DOC";
  return type.split("/")[1]?.toUpperCase().slice(0, 4) || "FILE";
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function compressImage(file) {
  const original = await fileToDataURL(file);
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = original;
  });
  let { width, height } = img;
  const max = Math.max(width, height);
  if (max > MAX_IMAGE_PX) {
    const scale = MAX_IMAGE_PX / max;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);
  const dataUrl = canvas.toDataURL("image/jpeg", IMG_QUALITY);
  return { dataUrl, size: Math.round(dataUrl.length * 0.75) };
}

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
import { getState } from "../store.js";
import { uploadFamilyMedia, MAX_FILE_BYTES } from "../lib/storage.js";

const MAX_IMAGE_PX = 1400;
const IMG_QUALITY = 0.8;
const HARD_CAP_BYTES = MAX_FILE_BYTES;  // 50 MB per file (also enforced server-side on the bucket)

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
          <div class="small text-muted">Images are resized automatically · up to 50 MB each · saved privately to your family's cloud.</div>
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
  // Files are held locally (as blobs + object-URL previews) and only uploaded to
  // Storage on submit — so nothing is orphaned if the parent cancels.
  const pending = []; // { id, kind, blob, fileName, fileType, fileSize, previewUrl }
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
        ${p.fileType?.startsWith("image/") && p.previewUrl
          ? `<img src="${p.previewUrl}" alt="${esc(p.fileName)}"/>`
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
        if (idx >= 0) {
          try { URL.revokeObjectURL(pending[idx].previewUrl); } catch { /* ignore */ }
          pending.splice(idx, 1);
        }
        repaintPreview();
      });
    });
  };

  const acceptFile = async (file) => {
    try {
      let blob = file, fileType = file.type, fileSize = file.size, fileName = file.name;
      if (file.type.startsWith("image/")) {
        const c = await compressImage(file);   // resize big photos before upload
        blob = c.blob; fileType = c.type; fileSize = c.size; fileName = c.name;
      }
      if (fileSize > HARD_CAP_BYTES) {
        toast(`"${file.name}" is too big (${humanSize(fileSize)}). The limit is 50 MB.`, { type: "warning", duration: 4200 });
        return;
      }
      pending.push({
        id: "p_" + Math.random().toString(36).slice(2, 9),
        kind: "upload",
        blob, fileName, fileType, fileSize,
        previewUrl: URL.createObjectURL(blob),
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
  foot.querySelector("[data-submit]").addEventListener("click", async () => {
    const submitBtn = foot.querySelector("[data-submit]");
    const text = body.querySelector("#sub-text").value.trim();
    const familyId = getState()?.family?.id;
    const childId = project?.childId || null;

    if (pending.length && !familyId) {
      toast("Please make sure you're signed in before uploading files.", { type: "warning" });
      return;
    }

    submitBtn.disabled = true;
    const original = submitBtn.innerHTML;
    try {
      const evidence = [];
      if (text) evidence.push({ kind: "note", text });
      for (let i = 0; i < pending.length; i++) {
        const p = pending[i];
        submitBtn.textContent = pending.length > 1 ? `Uploading ${i + 1}/${pending.length}…` : "Uploading…";
        const fileObj = new File([p.blob], p.fileName, { type: p.fileType });
        const up = await uploadFamilyMedia(fileObj, { familyId, childId });
        evidence.push({
          kind: "upload",
          fileName: up.fileName,
          fileType: p.fileType,
          fileSize: p.fileSize,
          storagePath: up.path,   // durable cloud reference — never base64
        });
      }
      pending.forEach(p => { try { URL.revokeObjectURL(p.previewUrl); } catch { /* ignore */ } });
      modal.close();
      onSubmit?.({ submission: text ? { text } : null, evidence });
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = original;
      toast("Couldn't upload your files just now: " + (err.message || err) + " — please try again.", { type: "error", duration: 5000 });
    }
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

// Resize an oversized photo and return a JPEG blob ready to upload. Falls back to
// the original file if anything goes wrong — never blocks a submission over this.
async function compressImage(file) {
  const objUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = objUrl;
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
    canvas.getContext("2d").drawImage(img, 0, 0, width, height);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", IMG_QUALITY));
    if (!blob) return { blob: file, type: file.type, size: file.size, name: file.name };
    return {
      blob,
      type: "image/jpeg",
      size: blob.size,
      name: (file.name.replace(/\.[^.]+$/, "") || "image") + ".jpg",
    };
  } catch {
    return { blob: file, type: file.type, size: file.size, name: file.name };
  } finally {
    URL.revokeObjectURL(objUrl);
  }
}

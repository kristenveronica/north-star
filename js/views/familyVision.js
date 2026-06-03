/* ============================================================
   familyVision.js — Edit family mission, motto, core word, vision.
   ============================================================ */

import { getState, setFamily } from "../store.js";
import { esc, toast, nsIcon } from "../components/ui.js";
import { rerender } from "../app.js";

export function renderFamilyVision(container) {
  const fam = getState().family;
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Family North Star</h1>
        <div class="sub">The "why" behind everything this platform helps you build with your children.</div>
      </div>
    </div>

    <div class="card mb-3" style="background:linear-gradient(135deg, var(--midnight-deep), var(--midnight));color:var(--starlight);border-color:transparent;padding:28px 32px">
      <div class="row" style="gap:18px;align-items:flex-start;flex-wrap:wrap">
        <span class="ns-icon-wrap" style="background:rgba(244,233,197,0.12);color:var(--starlight);border-color:rgba(244,233,197,0.25)">${nsIcon("compass", { size: 24 })}</span>
        <div style="flex:1;min-width:260px">
          <div class="small" style="letter-spacing:0.18em;text-transform:uppercase;opacity:0.75">Your family's lens</div>
          <h2 style="color:var(--starlight);font-family:var(--font-serif);font-size:26px;margin:4px 0 8px">${esc(fam.coreWord || "Your Core Word")}${fam.motto ? ` · <span style="opacity:0.85;font-size:18px">${esc(fam.motto)}</span>` : ""}</h2>
          <p style="margin:0;opacity:0.85;max-width:620px">${esc(fam.mission || "Your mission, motto, core word and desired outcomes become the lens through which the platform suggests projects, materials, reports, and rhythms for each child.")}</p>
        </div>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 2fr 1fr; gap:18px">
      <div class="stack">
        <div class="card">
          <h3>Identity</h3>
          <div class="grid grid-2 mt-2">
            <div class="field"><label>Parent name</label><input class="input" id="parentName" value="${esc(fam.parentName)}"/></div>
            <div class="field"><label>Family name</label><input class="input" id="familyName" value="${esc(fam.familyName)}"/></div>
          </div>
          <div class="field"><label>Family motto</label><input class="input" id="motto" value="${esc(fam.motto || "")}"/></div>
          <div class="field"><label>Mission statement</label><textarea class="textarea" id="mission" data-voice data-voice-label="Speak your mission">${esc(fam.mission || "")}</textarea></div>
        </div>

        <div class="card">
          <h3>Core Word & Acronym</h3>
          <p class="text-muted small mb-2">A single word, broken into meanings. This becomes the lens for every project.</p>
          <div class="field" style="max-width: 240px">
            <label>Core word</label>
            <input class="input" id="coreWord" maxlength="12" value="${esc(fam.coreWord || "")}"/>
          </div>
          <div id="acronymRows" class="stack"></div>
        </div>

        <div class="card">
          <h3>Desired Outcomes</h3>
          <p class="text-muted small mb-2">What do you want this education to actually produce? One per line.</p>
          <textarea class="textarea" id="outcomes" rows="6">${esc((fam.desiredOutcomes || []).join("\n"))}</textarea>
        </div>

        <div class="card">
          <h3>Deeper Vision</h3>
          <p class="text-muted small mb-2">These quiet questions shape every AI suggestion the app makes.</p>
          ${visionField("adultsHoping", "What kind of adults are you hoping to raise?")}
          ${visionField("values", "What values matter most to your family?")}
          ${visionField("successLooksLike", "What does educational success look like for you?")}
          ${visionField("skills", "What skills do you want them to develop?")}
          ${visionField("qualities", "What qualities do you want them to embody?")}
          ${visionField("capableByEighteen", "What do you want them capable of by age 18?")}
          ${visionField("roles", "Roles of faith, service, entrepreneurship, creativity, academics, life skills and community?")}
        </div>

        <div class="row" style="justify-content:flex-end">
          <button class="btn btn-primary btn-lg" id="save">Save vision</button>
        </div>
      </div>

      <div class="card" style="position:sticky;top:24px;height:fit-content">
        <h3>Preview</h3>
        <div id="preview"></div>
      </div>
    </div>
  `;

  const renderAcronymRows = () => {
    const host = container.querySelector("#acronymRows");
    const word = container.querySelector("#coreWord").value.toUpperCase().slice(0, 12);
    const existing = fam.acronym || [];
    const rows = word.split("").map((L, i) => ({
      letter: L,
      meaning: existing[i]?.letter === L ? (existing[i].meaning || "") : (existing[i]?.meaning || ""),
    }));
    host.innerHTML = rows.map((r, i) => `
      <div class="row" style="gap:10px">
        <div class="brand-mark" style="width:36px;height:36px;font-size:18px">${esc(r.letter)}</div>
        <input class="input" data-i="${i}" placeholder="${esc(r.letter)}…" value="${esc(r.meaning)}" />
      </div>
    `).join("");
    paintPreview();
  };

  const paintPreview = () => {
    const word = container.querySelector("#coreWord").value.toUpperCase().slice(0, 12);
    const rows = Array.from(container.querySelectorAll("#acronymRows input")).map((inp, i) => ({
      letter: word[i] || "", meaning: inp.value,
    }));
    container.querySelector("#preview").innerHTML = `
      <div class="small text-muted" style="letter-spacing:0.1em;text-transform:uppercase">Core word</div>
      <div style="font-family:var(--font-serif);font-size:36px;font-weight:600;color:var(--primary-ink)">${esc(word) || "—"}</div>
      <div class="stack mt-2">
        ${rows.map(r => `<div class="row" style="gap:10px"><div class="brand-mark" style="width:30px;height:30px;font-size:14px">${esc(r.letter)}</div><div class="fw-600">${esc(r.meaning || "...")}</div></div>`).join("")}
      </div>
    `;
  };

  container.querySelector("#coreWord").addEventListener("input", renderAcronymRows);
  container.addEventListener("input", paintPreview);
  renderAcronymRows();

  container.querySelector("#save").addEventListener("click", () => {
    const word = container.querySelector("#coreWord").value.toUpperCase().slice(0, 12);
    const rows = Array.from(container.querySelectorAll("#acronymRows input")).map((inp, i) => ({
      letter: word[i] || "", meaning: inp.value.trim(),
    }));
    const patch = {
      parentName: container.querySelector("#parentName").value.trim(),
      familyName: container.querySelector("#familyName").value.trim(),
      motto: container.querySelector("#motto").value.trim(),
      mission: container.querySelector("#mission").value.trim(),
      coreWord: word,
      acronym: rows,
      desiredOutcomes: container.querySelector("#outcomes").value
        .split("\n").map(s => s.trim()).filter(Boolean),
      vision: {
        ...(fam.vision || {}),
        adultsHoping: container.querySelector("#adultsHoping").value.trim(),
        values: container.querySelector("#values").value.trim(),
        successLooksLike: container.querySelector("#successLooksLike").value.trim(),
        skills: container.querySelector("#skills").value.trim(),
        qualities: container.querySelector("#qualities").value.trim(),
        capableByEighteen: container.querySelector("#capableByEighteen").value.trim(),
        roles: container.querySelector("#roles").value.trim(),
      },
    };
    setFamily(patch);
    toast("Vision saved", { type: "success" });
    rerender();
  });
}

function visionField(id, label) {
  const v = getState().family?.vision?.[id] || "";
  return `<div class="field"><label>${esc(label)}</label><textarea class="textarea" id="${id}" data-voice data-voice-label="Speak your answer">${esc(v)}</textarea></div>`;
}

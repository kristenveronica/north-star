/* ============================================================
   learningStyle.js — Two sliders + dynamic explanation.
   Per-child + a family default.
   ============================================================ */

import { getState, updateChild, setFamily } from "../store.js";
import { describeLearningStyle, describeDIY, LEARNING_STYLE_LEVELS } from "../ai/suggestions.js";
import { esc, toast } from "../components/ui.js";
import { rerender } from "../app.js";

let _selectedChildId = null;

export function renderLearningStyle(container) {
  const s = getState();
  if (!_selectedChildId && s.children[0]) _selectedChildId = s.children[0].id;
  const child = s.children.find(c => c.id === _selectedChildId);

  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Learning Style</h1>
        <div class="sub">Two sliders that shape every project, material and rhythm we suggest.</div>
      </div>
    </div>

    ${s.children.length > 1 ? `
      <div class="row mb-2" style="gap:8px">
        ${s.children.map(c => `<button class="chip ${c.id === _selectedChildId ? "selected" : ""}" data-child="${c.id}">${esc(c.name)}</button>`).join("")}
      </div>
    ` : ""}

    ${child ? renderChildSliders(child) : `<div class="empty">Add a child first.</div>`}

    <div class="card mt-3">
      <h3 class="mb-1">Family defaults</h3>
      <p class="text-muted small mb-2">Used as the starting point when you add a new child.</p>
      ${renderFamilyDefaults(s.family)}
    </div>
  `;

  container.querySelectorAll("[data-child]").forEach(b => {
    b.addEventListener("click", () => { _selectedChildId = b.dataset.child; rerender(); });
  });

  if (child) wireSliders(container, child);
  wireFamilySliders(container);
}

function renderChildSliders(child) {
  const style = describeLearningStyle(child.learningStyle);
  const diy = describeDIY(child.diyMaterials);
  return `
    <div class="grid" style="grid-template-columns: 2fr 1fr; gap:18px">
      <div class="stack">
        <div class="card">
          <h3>Learning Style — ${esc(child.name)}</h3>
          <p class="text-muted small">Drag the slider from unschooling (1) to traditional academic (10).</p>
          <div class="slider-wrap">
            <input type="range" min="1" max="10" value="${child.learningStyle}" id="ls-slider" class="slider"/>
            <div class="slider-scale">
              <span>1 · Explorer</span><span>3 · Guided</span><span>5 · Hybrid</span><span>7 · Structured</span><span>10 · Traditional</span>
            </div>
          </div>
          <div class="card mt-2" style="background:var(--card-elev);padding:16px">
            <div class="row" style="gap:10px;align-items:center">
              <div class="brand-mark">${child.learningStyle}</div>
              <div>
                <div class="fw-700" id="ls-label">${esc(style.label)}</div>
                <div class="small text-muted" id="ls-summary">${esc(style.summary)}</div>
              </div>
            </div>
            <p class="mt-2" id="ls-flavour" style="font-style:italic;color:var(--text-muted)">${esc(style.flavour)}</p>
          </div>
        </div>

        <div class="card">
          <h3>DIY Materials Slider</h3>
          <p class="text-muted small">How much time and energy do you want to put into making your own materials?</p>
          <div class="slider-wrap">
            <input type="range" min="1" max="10" value="${child.diyMaterials}" id="diy-slider" class="slider"/>
            <div class="slider-scale">
              <span>1 · Buy everything</span><span>5 · Balanced</span><span>10 · Make most things</span>
            </div>
          </div>
          <div class="card mt-2" style="background:var(--card-elev);padding:16px">
            <div class="fw-700" id="diy-label">${esc(diy.label)}</div>
            <div class="small text-muted" id="diy-summary">${esc(diy.summary)}</div>
          </div>
        </div>
      </div>

      <div class="card" style="position:sticky;top:24px;height:fit-content">
        <h3 class="mb-2">Suggested materials at this level</h3>
        <ul id="ls-materials" style="padding-left:18px;margin:0;color:var(--text-muted)">
          ${style.materials.map(m => `<li>${esc(m)}</li>`).join("")}
        </ul>
        <div class="divider"></div>
        <a class="btn btn-primary btn-sm" href="#/materials">See full materials list →</a>
      </div>
    </div>
  `;
}

function renderFamilyDefaults(fam) {
  return `
    <div class="grid grid-2">
      <div>
        <label class="label">Default learning style: <span id="fam-ls-val" class="fw-700">${fam.learningStyleDefault}</span></label>
        <input type="range" min="1" max="10" value="${fam.learningStyleDefault}" id="fam-ls" class="slider mt-1"/>
      </div>
      <div>
        <label class="label">Default DIY preference: <span id="fam-diy-val" class="fw-700">${fam.diyMaterialsPreference}</span></label>
        <input type="range" min="1" max="10" value="${fam.diyMaterialsPreference}" id="fam-diy" class="slider mt-1"/>
      </div>
    </div>
  `;
}

function wireSliders(container, child) {
  const lsSlider = container.querySelector("#ls-slider");
  const diySlider = container.querySelector("#diy-slider");
  if (!lsSlider) return;

  const updateLS = (paintOnly = false) => {
    const v = parseInt(lsSlider.value, 10);
    const desc = describeLearningStyle(v);
    container.querySelector("#ls-label").textContent = desc.label;
    container.querySelector("#ls-summary").textContent = desc.summary;
    container.querySelector("#ls-flavour").textContent = desc.flavour;
    container.querySelector("#ls-materials").innerHTML =
      desc.materials.map(m => `<li>${esc(m)}</li>`).join("");
    container.querySelector(".brand-mark").textContent = v;
    if (!paintOnly) updateChild(child.id, { learningStyle: v });
  };
  const updateDIY = (paintOnly = false) => {
    const v = parseInt(diySlider.value, 10);
    const desc = describeDIY(v);
    container.querySelector("#diy-label").textContent = desc.label;
    container.querySelector("#diy-summary").textContent = desc.summary;
    if (!paintOnly) updateChild(child.id, { diyMaterials: v });
  };
  lsSlider.addEventListener("input", () => updateLS(true));
  lsSlider.addEventListener("change", () => { updateLS(false); toast("Style updated"); });
  diySlider.addEventListener("input", () => updateDIY(true));
  diySlider.addEventListener("change", () => { updateDIY(false); toast("Saved"); });
}

function wireFamilySliders(container) {
  const lsSlider = container.querySelector("#fam-ls");
  const diySlider = container.querySelector("#fam-diy");
  if (!lsSlider) return;
  lsSlider.addEventListener("input", () => {
    container.querySelector("#fam-ls-val").textContent = lsSlider.value;
  });
  lsSlider.addEventListener("change", () => {
    setFamily({ learningStyleDefault: parseInt(lsSlider.value, 10) });
    toast("Family default saved");
  });
  diySlider.addEventListener("input", () => {
    container.querySelector("#fam-diy-val").textContent = diySlider.value;
  });
  diySlider.addEventListener("change", () => {
    setFamily({ diyMaterialsPreference: parseInt(diySlider.value, 10) });
    toast("Family default saved");
  });
}

/* ============================================================
   familySettings.js — Family Settings (Parent Portal).

   Holds the family's PRACTICAL real-world context for project
   generation — kept deliberately separate from Family North Star
   (which holds the vision/identity). Sections:
     1. Home Location
     2. Family Members & Support People
     3. Travel / Worldschool Mode
     4. Faith Integration
     5. Family Rhythm

   The section bodies + wiring now live in js/views/familySections.js so
   the SAME sections power the Full Setup onboarding — edit once, both stay
   in sync. This page just composes them into calm accordions with autosave.
   ============================================================ */

import { getState, setFamily } from "../store.js";
import { toast } from "../components/ui.js";
import { autosize } from "./familyVision.js";
import { accSection, accToolbar, wireAccordion } from "../components/accordion.js";
import { makeFamilyState, gatherFamilyPatch, FAMILY_SECTIONS } from "./familySections.js";

// Re-exported so existing importers (e.g. onboarding) keep working.
export { REL_OPTIONS } from "./familySections.js";

export function renderFamilySettings(container) {
  const fam = getState().family || {};
  const children = getState().children || [];

  // Mutable working copies shared by every section body + its wiring.
  const st = makeFamilyState(fam);

  const PAGE = "family-settings";
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Family</h1>
        <div class="sub">The practical, real-world context North Star uses to personalise projects safely. (Your vision lives in Family North Star.)</div>
      </div>
    </div>

    <div style="max-width:860px">
      ${accToolbar(PAGE)}
      <div class="stack">
        ${FAMILY_SECTIONS.map(sec => accSection(
          PAGE,
          { id: sec.id, icon: sec.icon, title: sec.title, blurb: sec.blurb },
          sec.body(st, { fam }),
          { cls: "lt-acc--form" },
        )).join("")}
      </div>
      <div class="row" style="justify-content:flex-end;align-items:center;gap:14px;margin-top:28px">
        <span class="small text-muted" id="fs-autosave" aria-live="polite"></span>
        <button class="btn btn-primary btn-lg" id="fs-save">Save settings</button>
      </div>
    </div>
  `;

  /* ---------------- Persistence (autosave + explicit save) ---------------- */
  const statusEl = container.querySelector("#fs-autosave");
  let saveTimer;
  const commit = () => { setFamily(gatherFamilyPatch(st)); };
  const autosave = () => {
    clearTimeout(saveTimer);
    if (statusEl) statusEl.textContent = "Saving…";
    saveTimer = setTimeout(() => { commit(); if (statusEl) statusEl.textContent = "✓ All changes saved automatically"; }, 700);
  };
  container.addEventListener("input", autosave);
  container.addEventListener("change", autosave);

  /* ---------------- Wire every section (scoped to the page) ---------------- */
  const ctx = { onChange: autosave, commit, children, fam };
  FAMILY_SECTIONS.forEach(sec => sec.wire(container, st, ctx));

  /* ---------------- Save ---------------- */
  const saveBtn = container.querySelector("#fs-save");
  saveBtn.addEventListener("click", () => {
    clearTimeout(saveTimer);
    commit();
    saveBtn.textContent = "✓ Saved";
    saveBtn.disabled = true;
    toast("Family saved", { type: "success" });
    setTimeout(() => { saveBtn.textContent = "Save settings"; saveBtn.disabled = false; if (statusEl) statusEl.textContent = ""; }, 2000);
  });

  /* ---------------- Collapsible sections (calm, one-at-a-time) ---------------- */
  wireAccordion(container, PAGE);

  // Comfortable, scrollable textareas (matches the rest of the portal).
  container.querySelectorAll(".lt-acc__body textarea").forEach(el => autosize(el, 220));
}

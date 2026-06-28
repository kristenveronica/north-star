/* ============================================================
   techSections.js — the editable Technology Agreement sections.

   Mounts the 10 progressively-disclosed sections (shared .lt-acc accordion)
   into a host element, operating on a plain agreement object + an onChange
   callback (so it's decoupled from where the data is stored). Each section:
   short explanation, suggested agreements to adopt, free-text "add your own"
   with voice input, and a skip toggle.
   ============================================================ */

import { esc } from "./ui.js";
import { accSection, accToolbar, wireAccordion } from "./accordion.js";
import { TECH_SECTIONS, normalizeTechAgreement, sectionAgreements } from "../lib/techAgreement.js";

export function mountTechSections(host, agreement, onChange, { pageId = "tech-agreement" } = {}) {
  const a = normalizeTechAgreement(agreement);
  const emit = () => onChange && onChange(a);

  const countLabel = (sec) => sec.skipped ? "Skipped"
    : (sectionAgreements(sec).length ? `${sectionAgreements(sec).length} agreed` : "Not set");

  const sectionShell = (s) => {
    const sec = a.sections[s.id];
    const body = `
      <p class="small text-muted" style="margin:0 0 12px">${esc(s.explanation)}</p>
      <div class="small fw-600" style="color:var(--text-muted);margin-bottom:7px">Suggested agreements — adopt the ones that fit your family:</div>
      <div class="stack" style="gap:7px">
        ${s.suggestions.map(sug => `
          <label class="checkbox" style="display:flex;align-items:flex-start;gap:9px;cursor:pointer">
            <input type="checkbox" data-adopt="${esc(s.id)}" value="${esc(sug)}" ${sec.adopted.includes(sug) ? "checked" : ""} style="margin-top:2px"/>
            <span class="small">✓ ${esc(sug)}</span>
          </label>`).join("")}
      </div>
      <div class="field" style="margin:14px 0 0">
        <label class="small">Add your own <span class="text-muted">(one per line)</span></label>
        <textarea class="textarea" data-notes="${esc(s.id)}" rows="2" data-voice data-voice-label="Speak your agreement" placeholder="Anything specific to your family…">${esc(sec.notes)}</textarea>
      </div>
      <label class="checkbox small" style="margin-top:10px;cursor:pointer;color:var(--text-muted)"><input type="checkbox" data-skip="${esc(s.id)}" ${sec.skipped ? "checked" : ""}/> Skip this section for now</label>`;
    return accSection(pageId, { id: s.id, icon: s.icon, title: s.title, blurb: s.blurb, count: countLabel(sec) }, body, { cls: "lt-acc--form" });
  };

  const render = () => {
    host.innerHTML = `
      ${accToolbar(pageId)}
      <div class="stack">${TECH_SECTIONS.map(sectionShell).join("")}</div>`;
    wire();
    wireAccordion(host, pageId);
  };

  // Update just the count chip for a section (no re-render → keeps typing focus).
  const refreshCount = (id) => {
    const chip = host.querySelector(`.lt-acc[data-acc="${id}"] .lt-acc__count`);
    if (chip) chip.textContent = countLabel(a.sections[id]);
  };

  function wire() {
    host.querySelectorAll("[data-adopt]").forEach(cb => cb.addEventListener("change", () => {
      const id = cb.dataset.adopt; const sec = a.sections[id];
      if (cb.checked) { if (!sec.adopted.includes(cb.value)) sec.adopted.push(cb.value); }
      else sec.adopted = sec.adopted.filter(x => x !== cb.value);
      refreshCount(id); emit();
    }));
    host.querySelectorAll("[data-notes]").forEach(ta => {
      ta.addEventListener("input", () => { a.sections[ta.dataset.notes].notes = ta.value; emit(); });
      ta.addEventListener("blur", () => refreshCount(ta.dataset.notes));
    });
    host.querySelectorAll("[data-skip]").forEach(cb => cb.addEventListener("change", () => {
      a.sections[cb.dataset.skip].skipped = cb.checked;
      refreshCount(cb.dataset.skip); emit();
    }));
  }

  render();
  return { getAgreement: () => a };
}

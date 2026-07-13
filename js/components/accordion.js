/* ============================================================
   accordion.js — shared collapsible "bubble" sections.

   The same calm, premium visual language as the Learning Resources
   page (.lt-acc): a soft card, a serif title with a one-line blurb,
   a count or chevron on the right, smooth grid-rows open/close.

   Behaviour:
     • All sections load CLOSED.
     • One section open at a time (accordion) — opening one gently
       closes the others. An optional "Expand all" toggle overrides this.
     • Which section is open is remembered PER PAGE for the session, so
       returning to a page restores what you were working on. (Scroll is
       restored separately, per-route, in app.js.)
     • Opening/closing is pure DOM class-toggling — no re-render — so the
       page never jumps and focus/scroll stay exactly where they were.
     • When a section opens it dispatches a bubbling `acc:open` event, so
       contents that must measure themselves once visible (auto-sizing
       textareas) can refit.
   ============================================================ */

import { esc } from "./ui.js";

// pageId -> { open: sectionId|null, expandAll: bool }. Module-level so it
// survives re-renders and in-app navigation (resets on a full page reload).
const _state = {};
function pageState(pageId) {
  if (!_state[pageId]) _state[pageId] = { open: null, expandAll: false };
  return _state[pageId];
}

export function isAccOpen(pageId, id) {
  const s = pageState(pageId);
  return s.expandAll || s.open === id;
}

/* A single collapsible section.
   sec  = { id, title, blurb?, icon?, count? }   (count: string|number, optional)
   opts = { cls? }  — extra classes on the section (e.g. "lt-acc--form"). */
export function accSection(pageId, sec, bodyHtml, opts = {}) {
  const open = isAccOpen(pageId, sec.id);
  const cls = opts.cls ? ` ${opts.cls}` : "";
  const count = (sec.count != null && sec.count !== "")
    ? `<span class="lt-acc__count">${esc(String(sec.count))}</span>` : "";
  return `
    <section class="lt-acc${open ? " is-open" : ""}${cls}" data-acc="${esc(sec.id)}">
      <button type="button" class="lt-acc__head" data-acc-head="${esc(sec.id)}" aria-expanded="${open}">
        ${sec.icon ? `<span class="lt-acc__icon" aria-hidden="true">${sec.icon}</span>` : ""}
        <span class="lt-acc__titles">
          <span class="lt-acc__title">${esc(sec.title)}</span>
          ${sec.blurb ? `<span class="lt-acc__blurb">${esc(sec.blurb)}</span>` : ""}
        </span>
        ${count}
        <span class="lt-acc__chev" aria-hidden="true">&rsaquo;</span>
      </button>
      <div class="lt-acc__panel"><div class="lt-acc__inner"><div class="lt-acc__body">${bodyHtml}</div></div></div>
    </section>`;
}

/* The right-aligned "Expand all / Collapse all" toggle (optional). */
export function accToolbar(pageId) {
  const s = pageState(pageId);
  return `<div class="lt-toolbar"><button type="button" class="btn btn-sm btn-ghost" data-expand-all>${s.expandAll ? "Collapse all" : "Expand all"}</button></div>`;
}

/* Wire accordion behaviour inside `container` for `pageId`. Pure DOM class work:
   no re-render, so scroll & focus stay put. */
export function wireAccordion(container, pageId) {
  const s = pageState(pageId);

  const apply = (openedId) => {
    container.querySelectorAll(".lt-acc").forEach(sec => {
      const open = isAccOpen(pageId, sec.dataset.acc);
      const was = sec.classList.contains("is-open");
      sec.classList.toggle("is-open", open);
      sec.querySelector(".lt-acc__head")?.setAttribute("aria-expanded", String(open));
      // Tell freshly-opened sections to remeasure (auto-sizing textareas, etc.).
      if (open && (!was || sec.dataset.acc === openedId)) {
        sec.dispatchEvent(new CustomEvent("acc:open", { bubbles: true }));
      }
    });
    const allBtn = container.querySelector("[data-expand-all]");
    if (allBtn) allBtn.textContent = s.expandAll ? "Collapse all" : "Expand all";
  };

  container.querySelectorAll("[data-acc-head]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.accHead;
      // Remember where the clicked header sits in the viewport BEFORE the toggle.
      // Opening one section closes any other that was open — if that other section
      // was ABOVE this one, the page collapses upward and the viewport drops into
      // the middle/bottom of the section you just opened. Re-pin the header to its
      // original spot afterwards so you always land at the TOP of what you opened.
      const before = btn.getBoundingClientRect().top;
      if (s.expandAll) { s.expandAll = false; s.open = id; }
      else { s.open = (s.open === id) ? null : id; }
      apply(id);
      requestAnimationFrame(() => {
        const after = btn.getBoundingClientRect().top;
        const delta = after - before;
        if (Math.abs(delta) > 1) window.scrollBy(0, delta);
      });
    });
  });

  container.querySelector("[data-expand-all]")?.addEventListener("click", () => {
    s.expandAll = !s.expandAll;
    if (!s.expandAll) s.open = null;
    apply();
  });
}

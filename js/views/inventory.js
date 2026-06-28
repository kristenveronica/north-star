/* ============================================================
   inventory.js — Family Inventory (the living "Learning Toolkit").

   The family progressively tells North Star what they already own. It
   never needs to be completed in one sitting — it grows through quick-add
   chips here, "I already have this" in Learning Resources, and project
   completion. The inventory then feeds project generation so projects use
   what the family has before recommending purchases.

   Premium accordion UX: all categories start collapsed, open one at a
   time (smooth animated), session-remembered, scroll-stable.
   ============================================================ */

import {
  getState, toggleInventoryItem, addInventoryItem, removeInventoryItem,
  hasInventoryItem, setInventoryContext,
} from "../store.js";
import { INVENTORY_CATEGORIES, INVENTORY_CONTEXT } from "../lib/inventoryCatalog.js";
import { esc, toast } from "../components/ui.js";
import { rerender } from "../app.js";

let _openCat = null;       // single open category id (accordion), or null
let _expandAll = false;
const isOpen = (id) => _expandAll || _openCat === id;

const lc = (s) => String(s || "").trim().toLowerCase();

function rerenderKeepScroll(focusCat) {
  const y = window.scrollY;
  rerender();
  window.scrollTo(0, y);
  requestAnimationFrame(() => {
    window.scrollTo(0, y);
    if (focusCat) document.querySelector(`[data-add-input="${focusCat}"]`)?.focus({ preventScroll: true });
  });
}

export function renderInventory(container) {
  const s = getState();
  const inv = s.inventory || [];
  const total = inv.length;

  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Family Inventory</h1>
        <div class="sub">Your living learning toolkit. Tell North Star what you already own and it designs projects around what you have — before ever recommending a purchase.</div>
      </div>
    </div>

    <div class="card mb-2" style="background:var(--card-elev)">
      <div class="row" style="gap:12px;align-items:center;flex-wrap:wrap">
        <div class="brand-mark">${total}</div>
        <div style="flex:1;min-width:220px">
          <div class="fw-700">${total ? `${total} thing${total === 1 ? "" : "s"} in your toolkit` : "Your toolkit is empty — add a few things to get started"}</div>
          <div class="small text-muted">No need to do it all at once. The more you add over time, the smarter and more personal North Star's projects become.</div>
        </div>
      </div>
    </div>

    <div class="lt-toolbar">
      <button class="btn btn-sm btn-ghost" data-expand-all>${_expandAll ? "Collapse all" : "Expand all"}</button>
    </div>

    <div class="stack">
      ${INVENTORY_CATEGORIES.map(cat => categoryHtml(cat, inv)).join("")}
      ${otherHtml(inv)}
    </div>
  `;

  wire(container);
}

function categoryHtml(cat, inv) {
  const owned = inv.filter(i => i.category === cat.id);
  const ownedNames = new Set(owned.map(i => lc(i.name)));
  const custom = owned.filter(i => !cat.items.some(ci => lc(ci) === lc(i.name)));
  const ctx = cat.context ? INVENTORY_CONTEXT[cat.context] : null;
  const open = isOpen(cat.id);

  const body = `
    ${ctx ? contextHtml(cat.context, ctx) : ""}
    <div class="small text-muted" style="margin:2px 0 8px">Tap anything you own:</div>
    <div class="chip-group" data-chip-group="${cat.id}">
      ${cat.items.map(item => `
        <button type="button" class="chip ${ownedNames.has(lc(item)) ? "selected" : ""}" data-toggle-item data-cat="${cat.id}" data-name="${esc(item)}">${ownedNames.has(lc(item)) ? "✓ " : ""}${esc(item)}</button>
      `).join("")}
      ${custom.map(i => `<button type="button" class="chip selected" data-remove-inv="${i.id}" title="Remove">${esc(i.name)} ✕</button>`).join("")}
      <input class="input" data-add-input="${cat.id}" placeholder="+ add your own" style="width:160px;height:32px;padding:4px 10px;font-size:13px"/>
    </div>`;

  return accShell(cat.id, cat.icon, cat.title, cat.blurb, owned.length, body, open);
}

// Items captured outside the catalog categories (e.g. via "I already have this"
// in Learning Resources) get their own bucket so nothing is ever lost.
function otherHtml(inv) {
  const known = new Set(INVENTORY_CATEGORIES.map(c => c.id));
  const other = inv.filter(i => !known.has(i.category));
  if (!other.length) return "";
  const body = `
    <div class="chip-group">
      ${other.map(i => `<button type="button" class="chip selected" data-remove-inv="${i.id}" title="Remove">${esc(i.name)} ✕</button>`).join("")}
    </div>`;
  return accShell("other", "📦", "Also in your toolkit", "Things you've marked as owned elsewhere in North Star.", other.length, body, isOpen("other"));
}

function accShell(id, icon, title, blurb, count, bodyHtml, open) {
  return `
    <section class="lt-acc${open ? " is-open" : ""}" data-acc="${id}">
      <button type="button" class="lt-acc__head" data-acc-head="${id}" aria-expanded="${open}">
        <span class="lt-acc__icon">${icon}</span>
        <span class="lt-acc__titles">
          <span class="lt-acc__title">${esc(title)}</span>
          <span class="lt-acc__blurb">${esc(blurb)}</span>
        </span>
        <span class="lt-acc__count">${count} ${count === 1 ? "item" : "items"}</span>
        <span class="lt-acc__chev" aria-hidden="true">&rsaquo;</span>
      </button>
      <div class="lt-acc__panel"><div class="lt-acc__inner"><div class="lt-acc__body">${bodyHtml}</div></div></div>
    </section>`;
}

function contextHtml(ctxKey, ctx) {
  const stored = (getState().family?.inventoryContext || {})[ctxKey] || {};
  return `
    <div class="card" style="background:var(--card);margin-bottom:12px">
      <div class="fw-700 small" style="margin-bottom:8px">${esc(ctx.title)}</div>
      <div class="grid grid-2" style="gap:12px">
        ${ctx.fields.map(f => `
          <div class="field" style="margin:0">
            <label>${esc(f.label)}</label>
            ${f.type === "select"
              ? `<select class="input" data-ctx="${ctxKey}" data-field="${f.key}">${f.options.map(o => `<option value="${esc(o)}" ${stored[f.key] === o ? "selected" : ""}>${o || "—"}</option>`).join("")}</select>`
              : `<input class="input" data-ctx="${ctxKey}" data-field="${f.key}" value="${esc(stored[f.key] || "")}" placeholder="${esc(f.placeholder || "")}"/>`}
          </div>
        `).join("")}
      </div>
    </div>`;
}

/* ---------- accordion behaviour (smooth, no re-render) ---------- */

function toggleCat(container, id) {
  if (_expandAll) { _expandAll = false; _openCat = id; }
  else { _openCat = (_openCat === id) ? null : id; }
  applyOpenClasses(container);
}
function applyOpenClasses(container) {
  container.querySelectorAll(".lt-acc").forEach(sec => {
    const open = isOpen(sec.dataset.acc);
    sec.classList.toggle("is-open", open);
    sec.querySelector(".lt-acc__head")?.setAttribute("aria-expanded", String(open));
  });
  const allBtn = container.querySelector("[data-expand-all]");
  if (allBtn) allBtn.textContent = _expandAll ? "Collapse all" : "Expand all";
}
function refreshCount(container, catId) {
  const n = (getState().inventory || []).filter(i => i.category === catId).length;
  const el = container.querySelector(`.lt-acc[data-acc="${catId}"] .lt-acc__count`);
  if (el) el.textContent = `${n} ${n === 1 ? "item" : "items"}`;
}

function wire(container) {
  // Accordion open/close — pure class toggle for smooth animation + stable scroll.
  container.querySelectorAll("[data-acc-head]").forEach(btn => {
    btn.addEventListener("click", () => toggleCat(container, btn.dataset.accHead));
  });
  container.querySelector("[data-expand-all]")?.addEventListener("click", () => {
    _expandAll = !_expandAll;
    if (!_expandAll) _openCat = null;
    applyOpenClasses(container);
  });

  // Toggle a known item in place (no re-render → no flicker, scroll stays put).
  container.querySelectorAll("[data-toggle-item]").forEach(b => {
    b.addEventListener("click", () => {
      const owned = toggleInventoryItem(b.dataset.cat, b.dataset.name);
      b.classList.toggle("selected", owned);
      b.innerHTML = `${owned ? "✓ " : ""}${esc(b.dataset.name)}`;
      refreshCount(container, b.dataset.cat);
    });
  });

  // Remove a custom item (rare) — re-render but keep scroll.
  container.querySelectorAll("[data-remove-inv]").forEach(b => {
    b.addEventListener("click", () => { removeInventoryItem(b.dataset.removeInv); rerenderKeepScroll(); });
  });

  // Add your own — re-render and refocus the same category's input.
  container.querySelectorAll("[data-add-input]").forEach(inp => {
    inp.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const v = inp.value.trim();
      if (!v) return;
      const cat = inp.dataset.addInput;
      if (hasInventoryItem(cat, v)) { toast("Already in your toolkit"); return; }
      addInventoryItem({ category: cat, name: v });
      toast("Added", { type: "success" });
      rerenderKeepScroll(cat);
    });
  });

  // Structured context fields.
  container.querySelectorAll("[data-ctx]").forEach(el => {
    const handler = () => {
      const ctxKey = el.dataset.ctx;
      const current = (getState().family?.inventoryContext || {})[ctxKey] || {};
      setInventoryContext({ [ctxKey]: { ...current, [el.dataset.field]: el.value } });
    };
    el.addEventListener(el.tagName === "SELECT" ? "change" : "input", handler);
  });
}

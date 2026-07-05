/* ============================================================
   resources.js — Resources (unified).
   Merges the former "Learning Resources" + "Family Inventory" into one
   destination with a filter bar: Recommended · Owned · Wishlist · Borrowed
   · Downloads. Recommended mounts the rich Learning Resources view; Owned
   mounts the Family Inventory view; the three status filters are lightweight
   lists derived from the resource engine. One nav item, five lenses.
   ============================================================ */

import { getState } from "../store.js";
import { navigate } from "../router.js";
import { esc, icon, DOMAIN_COLOR_CLASS } from "../components/ui.js";
import { buildLearningResources } from "../lib/resources.js";
import { renderResources } from "./materials.js";
import { renderInventory } from "./inventory.js";

// Which lens is showing. Module-scoped so it survives a re-render of the shell.
let _seg = "recommended";

const SEGMENTS = [
  { id: "recommended", label: "Recommended" },
  { id: "owned",       label: "Owned" },
  { id: "wishlist",    label: "Wishlist" },
  { id: "borrowed",    label: "Borrowed" },
  { id: "downloads",   label: "Downloads" },
];

// Flatten the derived resource sections into one de-duped list.
function allResources() {
  const sections = buildLearningResources(getState());
  const seen = new Set();
  const out = [];
  for (const items of Object.values(sections)) {
    for (const it of (items || [])) {
      if (it && it.key && !seen.has(it.key)) { seen.add(it.key); out.push(it); }
    }
  }
  return out;
}

function segCounts() {
  const all = allResources();
  return {
    owned: (getState().inventory || []).length,
    wishlist: all.filter(i => i.status === "save").length,
    borrowed: all.filter(i => i.status === "borrow").length,
    downloads: all.filter(i => i.format === "printable" && i.status !== "dismissed").length,
  };
}

// A compact, read-only card for the status-filter lenses.
function miniCard(it) {
  const child = it.forChildId ? getState().children.find(c => c.id === it.forChildId) : null;
  const meta = [it.category, it.ageRange ? `ages ${it.ageRange}` : "", child ? child.name : ""].filter(Boolean).map(esc).join(" · ");
  const domains = (it.capabilityDomains || []).slice(0, 4);
  return `
    <div class="card" style="background:var(--card-elev)">
      <h3 style="font-family:var(--font-serif);font-size:16px;margin:0">${esc(it.name)}</h3>
      ${meta ? `<div class="small text-muted mb-1">${meta}</div>` : ""}
      ${it.reasonSuggested ? `<div class="small text-sage fw-600 mt-1">Why: ${esc(it.reasonSuggested)}</div>` : ""}
      ${domains.length ? `<div class="row" style="gap:5px;flex-wrap:wrap;margin-top:8px">${domains.map(d => `<span class="tag ${DOMAIN_COLOR_CLASS[d] || ""}" style="font-size:10px">${esc(d)}</span>`).join("")}</div>` : ""}
    </div>`;
}

function filteredList(predicate, emptyMsg, note) {
  const items = allResources().filter(predicate);
  if (!items.length) return `<div class="empty">${esc(emptyMsg)}</div>`;
  return `
    ${note ? `<div class="small text-muted mb-2">${esc(note)}</div>` : ""}
    <div class="grid grid-auto">${items.map(miniCard).join("")}</div>`;
}

// Paint the active lens into the panel.
function paintPanel(panel) {
  if (_seg === "recommended") { renderResources(panel, { embedded: true }); return; }
  if (_seg === "owned")       { renderInventory(panel, { embedded: true }); return; }
  if (_seg === "wishlist") {
    panel.innerHTML = filteredList(i => i.status === "save",
      "Nothing saved yet. Tap “Save for later” on a recommended resource and it lands here.",
      "Resources you’ve saved to consider later. Manage them under Recommended.");
    return;
  }
  if (_seg === "borrowed") {
    panel.innerHTML = filteredList(i => i.status === "borrow",
      "Nothing marked as borrowed. Mark a resource “Borrowing” and it appears here.",
      "Resources you’re borrowing rather than buying. Manage them under Recommended.");
    return;
  }
  if (_seg === "downloads") {
    panel.innerHTML = filteredList(i => i.format === "printable" && i.status !== "dismissed",
      "No printables available yet — they appear as your family’s projects unfold.",
      "Printable resources you can generate and download. Open one under Recommended to generate it.");
    return;
  }
}

export function renderResourcesPage(container) {
  const cartCount = getState().cart.length;
  const counts = segCounts();

  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Resources</h1>
        <div class="sub">Everything your family owns, needs or is considering — in one place. Filter by what you’re looking for.</div>
      </div>
      <button class="btn btn-primary" data-cart>${icon("cart")} Cart ${cartCount ? `(${cartCount})` : ""}</button>
    </div>

    <div class="chip-group mb-3" id="res-seg" role="tablist" aria-label="Resource filter">
      ${SEGMENTS.map(seg => {
        const n = counts[seg.id];
        return `<button class="chip ${_seg === seg.id ? "selected" : ""}" role="tab" aria-selected="${_seg === seg.id}" data-seg="${seg.id}">${esc(seg.label)}${n ? ` <span class="small text-muted">${n}</span>` : ""}</button>`;
      }).join("")}
    </div>

    <div id="res-panel"></div>
  `;

  const panel = container.querySelector("#res-panel");
  paintPanel(panel);

  container.querySelector("[data-cart]")?.addEventListener("click", () => navigate("/cart"));
  container.querySelectorAll("#res-seg [data-seg]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (_seg === btn.dataset.seg) return;
      _seg = btn.dataset.seg;
      container.querySelectorAll("#res-seg [data-seg]").forEach(b => {
        const on = b.dataset.seg === _seg;
        b.classList.toggle("selected", on);
        b.setAttribute("aria-selected", String(on));
      });
      paintPanel(panel);
    });
  });
}

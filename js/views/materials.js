/* ============================================================
   materials.js — Suggested materials per child, approve/reject, cart.
   ============================================================ */

import { getState, addMaterial, approveMaterial, rejectMaterial, getChild } from "../store.js";
import { suggestMaterialsForChild, describeDIY, describeLearningStyle } from "../ai/suggestions.js";
import { esc, fmtMoney, toast, icon } from "../components/ui.js";
import { navigate } from "../router.js";
import { rerender } from "../app.js";

let _selectedChildId = null;
let _filter = "all"; // all | buy | DIY

export function renderMaterials(container) {
  const s = getState();
  if (!_selectedChildId && s.children[0]) _selectedChildId = s.children[0].id;
  const child = s.children.find(c => c.id === _selectedChildId);

  // Lazily seed AI suggestions for this child if there are none yet (besides seed data).
  if (child) {
    const existing = s.materials.filter(m => m.forChildId === child.id);
    if (existing.length < 3) {
      suggestMaterialsForChild(child, s.family)
        .filter(sug => !existing.some(e => e.name === sug.name))
        .forEach(sug => addMaterial({
          name: sug.name, category: sug.category, description: sug.description,
          reasonSuggested: sug.reasonSuggested, ageRange: sug.ageRange,
          buyOrDIY: sug.buyOrDIY, estimatedPrice: sug.estimatedPrice,
          forChildId: child.id,
        }));
    }
  }

  const all = getState().materials.filter(m => !child || m.forChildId === child.id);
  const filtered = _filter === "all" ? all : all.filter(m => m.buyOrDIY === _filter);
  const cartCount = getState().cart.length;

  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Suggested Materials</h1>
        <div class="sub">Based on each child's age, passions, learning style and DIY preference.</div>
      </div>
      <button class="btn btn-primary" data-cart>${icon("cart")} Cart ${cartCount ? `(${cartCount})` : ""}</button>
    </div>

    ${s.children.length > 1 ? `
      <div class="row mb-2" style="gap:8px">
        ${s.children.map(c => `<button class="chip ${c.id === _selectedChildId ? "selected" : ""}" data-child="${c.id}">${esc(c.name)}</button>`).join("")}
      </div>
    ` : ""}

    ${child ? matchSummary(child) : ""}

    <div class="row mb-2" style="gap:8px">
      <button class="chip ${_filter === "all" ? "selected" : ""}" data-filter="all">All</button>
      <button class="chip ${_filter === "buy" ? "selected" : ""}" data-filter="buy">Buy ready-made</button>
      <button class="chip ${_filter === "DIY" ? "selected" : ""}" data-filter="DIY">DIY at home</button>
      <div style="flex:1"></div>
      <button class="btn btn-sm" id="refresh-suggestions">↻ Refresh suggestions</button>
    </div>

    <div class="grid grid-auto">
      ${filtered.length === 0
        ? `<div class="empty"><div class="emoji">📚</div>No materials yet. Click "Refresh suggestions" to generate some.</div>`
        : filtered.map(materialCard).join("")}
    </div>
  `;

  container.querySelector("[data-cart]").addEventListener("click", () => navigate("/cart"));
  container.querySelectorAll("[data-child]").forEach(b => {
    b.addEventListener("click", () => { _selectedChildId = b.dataset.child; rerender(); });
  });
  container.querySelectorAll("[data-filter]").forEach(b => {
    b.addEventListener("click", () => { _filter = b.dataset.filter; rerender(); });
  });
  container.querySelectorAll("[data-approve]").forEach(b => {
    b.addEventListener("click", () => {
      approveMaterial(b.dataset.approve);
      toast("Added to cart", { type: "success" });
      rerender();
    });
  });
  container.querySelectorAll("[data-reject]").forEach(b => {
    b.addEventListener("click", () => {
      rejectMaterial(b.dataset.reject);
      toast("Hidden");
      rerender();
    });
  });
  container.querySelector("#refresh-suggestions").addEventListener("click", () => {
    if (!child) return;
    suggestMaterialsForChild(child, getState().family).forEach(sug => {
      if (!getState().materials.find(m => m.name === sug.name && m.forChildId === child.id)) {
        addMaterial({
          name: sug.name, category: sug.category, description: sug.description,
          reasonSuggested: sug.reasonSuggested, ageRange: sug.ageRange,
          buyOrDIY: sug.buyOrDIY, estimatedPrice: sug.estimatedPrice,
          forChildId: child.id,
        });
      }
    });
    toast("New suggestions added");
    rerender();
  });
}

function matchSummary(child) {
  const style = describeLearningStyle(child.learningStyle);
  const diy = describeDIY(child.diyMaterials);
  return `
    <div class="card mb-2" style="background:var(--card-elev)">
      <div class="row" style="gap:14px;flex-wrap:wrap">
        <div class="child-card-avatar avatar-${child.avatarIndex}">${initials(child.name)}</div>
        <div style="flex:1">
          <div class="fw-700">${esc(child.name)} · ${esc(style.label)} · ${esc(diy.label)}</div>
          <div class="small text-muted">Suggestions tuned for age ${child.age}, ${(child.passions || []).slice(0, 4).join(", ")}.</div>
        </div>
      </div>
    </div>
  `;
}

function materialCard(m) {
  const tag = m.buyOrDIY === "buy" ? "tag-primary" : "tag-sage";
  return `
    <div class="card ${m.approved ? "" : ""}" style="${m.rejected ? "opacity:0.5" : ""}">
      <div class="row-between mb-1">
        <span class="tag ${tag}">${m.buyOrDIY === "buy" ? "Buy ready-made" : "DIY at home"}</span>
        <span class="fw-700">${fmtMoney(m.estimatedPrice)}</span>
      </div>
      <h3 style="font-family:var(--font-serif);font-size:17px">${esc(m.name)}</h3>
      <div class="small text-muted mb-1">${esc(m.category)} · ages ${esc(m.ageRange || "all")}</div>
      <p class="small">${esc(m.description)}</p>
      ${m.reasonSuggested ? `<div class="small text-sage fw-600 mt-1">Why: ${esc(m.reasonSuggested)}</div>` : ""}
      <div class="divider"></div>
      ${m.approved ? `
        <div class="row" style="gap:6px">
          <span class="tag tag-sage">${icon("check")} Approved · in cart</span>
        </div>
      ` : m.rejected ? `
        <div class="text-muted small">Hidden. <button class="btn btn-ghost btn-sm" data-approve="${m.id}">Restore</button></div>
      ` : `
        <div class="row" style="gap:8px">
          <button class="btn btn-primary btn-sm" data-approve="${m.id}">${m.buyOrDIY === "buy" ? "Approve + add to cart" : "Approve"}</button>
          <button class="btn btn-sm" data-reject="${m.id}">No thanks</button>
        </div>
      `}
    </div>
  `;
}

function initials(name) {
  return (name || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

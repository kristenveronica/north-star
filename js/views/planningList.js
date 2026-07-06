/* ============================================================
   planningList.js — the family's Planning List.

   The honest replacement for the old mock cart. North Star is not a shop,
   so this is a PLAN, not a checkout: the things the family has chosen to
   acquire for their learning journey, each marked buy / borrow / make, with
   a running estimated spend they can print or take to any store they like.
   ============================================================ */

import {
  getState, getPlannedResources, setResourcePlanMethod, setResourceStatusById,
} from "../store.js";
import { esc, fmtMoney, toast } from "../components/ui.js";
import { navigate } from "../router.js";
import { rerender } from "../app.js";

const METHODS = [
  { id: "buy", label: "Buy" },
  { id: "borrow", label: "Borrow" },
  { id: "make", label: "Make" },
];
const methodOf = (m) => m.planMethod || (m.buyOrDIY === "diy" ? "make" : "buy");
const priceOf = (m) => Number(m.estimatedPrice) || 0;
const thumbOf = (m) => (methodOf(m) === "make" ? "🧰" : methodOf(m) === "borrow" ? "🤝" : "📦");

function countryLabel(s) {
  return s.family?.location?.country || null;
}

export function renderPlanningList(container) {
  const s = getState();
  const items = getPlannedResources();

  const buys = items.filter(m => methodOf(m) === "buy");
  const borrows = items.filter(m => methodOf(m) === "borrow");
  const makes = items.filter(m => methodOf(m) === "make");
  const estSpend = buys.reduce((acc, m) => acc + priceOf(m), 0);
  const country = countryLabel(s);

  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Your Planning List</h1>
        <div class="sub">The resources you've chosen for your family's journey. Mark each one buy, borrow or make — North Star keeps a running estimate so you can plan your spend.</div>
      </div>
      <button class="btn" data-back>← Learning Resources</button>
    </div>

    ${items.length === 0
      ? `<div class="empty"><div class="emoji">🗒️</div><h3>Your planning list is empty</h3><p>Add resources from Learning Resources and they'll gather here as a simple plan you can print or shop from anywhere.</p><button class="btn btn-primary mt-2" data-back>Browse Learning Resources</button></div>`
      : `
        <div class="grid" style="grid-template-columns: minmax(0,2fr) minmax(240px,1fr); gap:18px; align-items:start">
          <div class="stack">
            ${country ? `<div class="suggestion-banner mb-1"><span>📍 Where you can, North Star favours the most affordable options in <strong>${esc(country)}</strong>. This is a plan — buy, borrow or make each item wherever suits you.</span></div>` : ""}
            ${items.map(planRow).join("")}
          </div>
          <div class="card" style="position:sticky;top:24px;height:fit-content">
            <h3 class="mb-2">Your plan</h3>
            <div class="row-between"><span>To buy</span><span class="fw-700">${buys.length}</span></div>
            <div class="row-between"><span>Estimated spend</span><span class="fw-700">${fmtMoney(estSpend)}</span></div>
            <div class="divider"></div>
            <div class="row-between small text-muted"><span>🤝 To borrow</span><span>${borrows.length}</span></div>
            <div class="row-between small text-muted"><span>🧰 To make</span><span>${makes.length}</span></div>
            <div class="divider"></div>
            <button class="btn btn-primary" data-print style="width:100%;justify-content:center">🖨️ Print / save list</button>
            <div class="small text-muted center mt-1">Estimates only — no checkout. Take your list to any store.</div>
          </div>
        </div>
      `}
  `;

  wire(container, s);
}

function planRow(m) {
  const method = methodOf(m);
  const showPrice = method === "buy" && priceOf(m) > 0;
  return `
    <div class="card plan-item">
      <div class="plan-item__thumb">${thumbOf(m)}</div>
      <div class="plan-item__body">
        <div class="fw-700">${esc(m.name)}</div>
        <div class="small text-muted">${[m.category, m.forChildName].filter(Boolean).map(esc).join(" · ")}</div>
        <div class="row" style="gap:10px;align-items:center;margin-top:8px;flex-wrap:wrap">
          <div class="plan-methods" role="group" aria-label="How you'll get this">
            ${METHODS.map(mt => `<button data-method="${mt.id}" data-id="${esc(m.id)}" class="${method === mt.id ? "is-active" : ""}">${mt.label}</button>`).join("")}
          </div>
          ${showPrice ? `<span class="small text-muted">~${fmtMoney(priceOf(m))}</span>` : ""}
        </div>
      </div>
      <div class="stack-tight" style="align-items:flex-end;gap:6px">
        <button class="btn btn-sage btn-sm" data-got="${esc(m.id)}">✓ Got it</button>
        <button class="btn btn-ghost btn-sm" data-remove="${esc(m.id)}">Remove</button>
      </div>
    </div>`;
}

function wire(container, s) {
  container.querySelectorAll("[data-back]").forEach(b => b.addEventListener("click", () => navigate("/materials")));

  container.querySelectorAll("[data-method]").forEach(b => b.addEventListener("click", () => {
    setResourcePlanMethod(b.dataset.id, b.dataset.method);
    rerender();
  }));

  container.querySelectorAll("[data-got]").forEach(b => b.addEventListener("click", () => {
    setResourceStatusById(b.dataset.got, "owned");
    toast("Nice — added to your Family Inventory", { type: "success" });
    rerender();
  }));

  container.querySelectorAll("[data-remove]").forEach(b => b.addEventListener("click", () => {
    setResourceStatusById(b.dataset.remove, "suggested");   // back to a suggestion, not lost
    toast("Removed from your list");
    rerender();
  }));

  container.querySelector("[data-print]")?.addEventListener("click", () => printList(s));
}

/* A clean, standalone print-ready list in a new tab (no app chrome). */
function printList(s) {
  const items = getPlannedResources();
  if (!items.length) return;
  const country = countryLabel(s);
  const buys = items.filter(m => methodOf(m) === "buy");
  const estSpend = buys.reduce((acc, m) => acc + priceOf(m), 0);
  const win = window.open("", "_blank");
  if (!win) { toast("Allow pop-ups to print your list.", { type: "warning" }); return; }

  const groups = METHODS.map(mt => ({
    label: { buy: "To buy", borrow: "To borrow", make: "To make" }[mt.id],
    rows: items.filter(m => methodOf(m) === mt.id),
  })).filter(g => g.rows.length);

  const rowsHtml = groups.map(g => `
    <h2>${g.label} <span class="c">${g.rows.length}</span></h2>
    <table>
      <tbody>
        ${g.rows.map(m => `<tr><td>${escH(m.name)}${m.category ? `<span class="cat"> · ${escH(m.category)}</span>` : ""}</td><td class="p">${g.label === "To buy" && priceOf(m) > 0 ? escH(fmtMoney(priceOf(m))) : ""}</td></tr>`).join("")}
      </tbody>
    </table>`).join("");

  win.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
    <title>Planning List — North Star</title>
    <style>
      body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
        color:#1a2233; max-width:660px; margin:36px auto; padding:0 22px; }
      .brand { font-size:12px; letter-spacing:.22em; text-transform:uppercase; color:#a6741e; font-weight:700; }
      .brand::before { content:"\\2726 "; }
      h1 { font-family:"Iowan Old Style",Georgia,serif; font-weight:600; font-size:26px; margin:6px 0 2px; }
      .sub { color:#5c6478; font-size:13px; margin:0 0 6px; }
      h2 { font-family:"Iowan Old Style",Georgia,serif; font-size:16px; margin:22px 0 6px;
        border-bottom:2px solid #d9cbb3; padding-bottom:4px; }
      h2 .c { color:#a6741e; font-size:13px; }
      table { width:100%; border-collapse:collapse; }
      td { padding:7px 0; border-bottom:1px solid #eadfcd; font-size:14px; vertical-align:top; }
      td.p { text-align:right; white-space:nowrap; color:#5c6478; font-variant-numeric:tabular-nums; }
      .cat { color:#8b91a1; font-size:12px; }
      .tot { margin-top:18px; font-weight:700; display:flex; justify-content:space-between;
        border-top:2px solid #d9cbb3; padding-top:10px; }
      .fine { color:#8b91a1; font-size:11px; margin-top:14px; }
      @media print { body { margin:0; } @page { margin:16mm; } }
    </style></head><body>
      <div class="brand">North Star</div>
      <h1>Your Planning List</h1>
      <div class="sub">${country ? `Prepared for a family in ${escH(country)} · ` : ""}${items.length} item${items.length === 1 ? "" : "s"}</div>
      ${rowsHtml}
      <div class="tot"><span>Estimated spend (to buy)</span><span>${escH(fmtMoney(estSpend))}</span></div>
      <div class="fine">Estimates only — actual prices vary by store and country. North Star is not a checkout; take this list wherever you like to buy, borrow or make each item.</div>
      <script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script>
    </body></html>`);
  win.document.close();
}

const escH = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

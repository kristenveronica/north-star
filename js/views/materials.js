/* ============================================================
   materials.js — Learning Resources.

   Not a product list — North Star's Learning Resources engine. Five
   expandable sections, derived dynamically from catalogs + live project
   and child data by lib/resources.js. Acting on any item materialises a
   persistent resource record (store.recordResourceAction) so ownership
   decisions stick and the page updates immediately.
   ============================================================ */

import {
  getState, addMaterial, recordResourceAction, getChild, ageOf,
} from "../store.js";
import { suggestMaterialsForChild } from "../ai/suggestions.js";
import { aiGeneratePrintable } from "../lib/ai.js";
import { openPrintableWindow, writeWorksheet, writeError } from "../lib/printableDoc.js";
import { buildLearningResources, newProjectResourceCount } from "../lib/resources.js";
import { RESOURCE_SECTIONS } from "../lib/resourceCatalog.js";
import { domainShort } from "../seed.js";
import { esc, fmtMoney, toast, icon, openModal, DOMAIN_COLOR_CLASS } from "../components/ui.js";
import { navigate } from "../router.js";
import { rerender } from "../app.js";

// Accordion state — session only (resets on full reload, persists across
// in-app navigation). All sections start collapsed; opening one closes others.
let _openSection = null;   // single open section id, or null
let _expandAll = false;
const isOpen = (id) => _expandAll || _openSection === id;

// Per-section count noun, so the badge reads "12 resources" not just "12".
const COUNT_NOUN = {
  essentials: "essentials", project: "resources", personalised: "recommendations",
  character: "resources", printable: "printables", marketplace: "suppliers",
};

// Per-render lookup of derived item specs by key (so action handlers can
// materialise the exact item the parent clicked).
let _specs = {};

function rerenderKeepScroll() {
  const y = window.scrollY;
  rerender();
  window.scrollTo(0, y);
  requestAnimationFrame(() => window.scrollTo(0, y));
}

// A premium expandable section. Body stays in the DOM (collapsed) so opening
// animates smoothly via CSS; opening/closing is pure class-toggling (no
// re-render), which keeps scroll perfectly stable.
function accShell(sec, count, bodyHtml) {
  const open = isOpen(sec.id);
  const noun = COUNT_NOUN[sec.id] || "resources";
  return `
    <section class="lt-acc${open ? " is-open" : ""}" data-acc="${sec.id}">
      <button type="button" class="lt-acc__head" data-acc-head="${sec.id}" aria-expanded="${open}">
        <span class="lt-acc__icon">${sec.icon}</span>
        <span class="lt-acc__titles">
          <span class="lt-acc__title">${esc(sec.title)}</span>
          <span class="lt-acc__blurb">${esc(sec.blurb)}</span>
        </span>
        <span class="lt-acc__count">${count} ${noun}</span>
        <span class="lt-acc__chev" aria-hidden="true">&rsaquo;</span>
      </button>
      <div class="lt-acc__panel"><div class="lt-acc__inner"><div class="lt-acc__body">${bodyHtml}</div></div></div>
    </section>`;
}

// Toggle a section open (accordion: others close). Pure DOM class work for a
// smooth, scroll-stable animation.
function toggleSection(container, id) {
  if (_expandAll) { _expandAll = false; _openSection = id; }
  else { _openSection = (_openSection === id) ? null : id; }
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

export function renderResources(container, opts = {}) {
  const s = getState();

  // Lazily ensure each child has a few personalised recommendations to start from.
  ensurePersonalisedSeed(s);

  const sections = buildLearningResources(getState());
  _specs = {};
  const cartCount = getState().cart.length;
  const needCount = newProjectResourceCount(getState());

  // `embedded` = rendered inside the unified Resources page (which owns the
  // page title + Cart button), so suppress this view's own topbar.
  container.innerHTML = `
    ${opts.embedded ? "" : `
    <div class="topbar">
      <div>
        <h1>Learning Resources</h1>
        <div class="sub">Everything your family needs to deliver the learning journey North Star has created — evolving with every project, profile and season.</div>
      </div>
      <button class="btn btn-primary" data-cart>${icon("cart")} Cart ${cartCount ? `(${cartCount})` : ""}</button>
    </div>`}

    ${needCount ? `
      <div class="suggestion-banner mb-2">
        <div class="row" style="gap:10px;flex-wrap:wrap;align-items:center">
          <span style="flex:1;min-width:240px"><strong>This week's projects require ${needCount} additional resource${needCount === 1 ? "" : "s"}.</strong> Review them under <em>Current Project Resources</em> below.</span>
          <button class="btn btn-sm btn-sage" data-jump="project">Review now</button>
        </div>
      </div>` : ""}

    <div class="lt-toolbar">
      <button class="btn btn-sm btn-ghost" data-expand-all>${_expandAll ? "Collapse all" : "Expand all"}</button>
    </div>

    <div class="stack">
      ${RESOURCE_SECTIONS.map(sec => sectionHtml(sec, sections[sec.id])).join("")}
    </div>
  `;

  wire(container);
}

/* ---------- section rendering ---------- */

function sectionHtml(sec, items) {
  if (sec.id === "marketplace") return marketplaceSection(sec, items);

  const visible = visibleItems(sec.id, items || []);
  const body = visible.length
    ? `<div class="grid grid-auto">${visible.map(it => { _specs[it.key] = it; return resourceCard(it); }).join("")}</div>`
    : `<div class="small text-muted">Nothing here right now — this section fills in automatically as your family's journey unfolds.</div>`;
  return accShell(sec, visible.length, body);
}

// Which items to show per section (resolved items drop out of the "needs" lists).
function visibleItems(sectionId, items) {
  if (sectionId === "project") return items.filter(i => i.status === "suggested" || i.status === "approved");
  return items.filter(i => i.status !== "dismissed");
}

function resourceCard(it) {
  const diyFirst = it.recommendation === "diy" && it.format !== "printable";
  const formatTag = it.format === "printable"
    ? `<span class="tag tag-sky">Printable</span>`
    : (it.kind === "diy" || diyFirst) ? `<span class="tag tag-sage">DIY-first</span>` : `<span class="tag tag-primary">Ready-made</span>`;
  const approvalTag = it.requiresApproval ? `<span class="tag tag-gold" style="font-size:10px">Parent-approved</span>` : "";
  const price = it.format === "printable" ? "Free" : (it.estimatedPrice ? fmtMoney(it.estimatedPrice) : "—");
  const child = it.forChildId ? getChild(it.forChildId) : null;
  const domains = (it.capabilityDomains || []).slice(0, 4);

  return `
    <div class="card" style="background:var(--card-elev)">
      <div class="row-between mb-1">
        <div class="row" style="gap:6px;flex-wrap:wrap">${formatTag}${approvalTag}${it.frequency ? `<span class="tag">${esc(freqLabel(it.frequency))}</span>` : ""}</div>
        <span class="fw-700">${price}</span>
      </div>
      <h3 style="font-family:var(--font-serif);font-size:16px;margin:0">${esc(it.name)}</h3>
      <div class="small text-muted mb-1">${[it.category, it.ageRange ? `ages ${it.ageRange}` : "", child ? child.name : ""].filter(Boolean).map(esc).join(" · ")}</div>
      ${it.description ? `<p class="small">${esc(it.description)}</p>` : ""}
      ${it.reasonSuggested ? `<div class="small text-sage fw-600 mt-1">Why: ${esc(it.reasonSuggested)}</div>` : ""}
      ${diyFirst ? `<div class="small text-muted mt-1">🛠️ Making this builds capability — buying ready-made is the easy alternative.</div>` : ""}
      ${(it.unlocks || []).length ? `<div class="small text-muted mt-1">Unlocks: ${it.unlocks.map(d => esc(domainShort(d))).join(", ")}</div>` : ""}
      ${domains.length ? `<div class="row" style="gap:5px;flex-wrap:wrap;margin-top:8px">${domains.map(d => `<span class="tag ${DOMAIN_COLOR_CLASS[d] || ""}" style="font-size:10px">${esc(domainShort(d))}</span>`).join("")}</div>` : ""}
      ${(it.projectTitles || []).length ? `<div class="small text-muted" style="margin-top:6px">For: ${it.projectTitles.map(esc).join(", ")}</div>` : ""}
      <div class="divider"></div>
      ${actionRow(it)}
    </div>
  `;
}

function actionRow(it) {
  if (it.status === "approved") {
    return `<div class="row" style="gap:8px;align-items:center"><span class="tag tag-sage">${icon("check")} Approved${it.inCart ? " · in cart" : ""}</span><button class="btn btn-ghost btn-sm" data-action="undo" data-key="${esc(it.key)}">Undo</button></div>`;
  }
  if (it.status === "owned") {
    return `<div class="row" style="gap:8px;align-items:center"><span class="tag tag-sage">✓ You have this</span><button class="btn btn-ghost btn-sm" data-action="undo" data-key="${esc(it.key)}">Undo</button></div>`;
  }
  if (it.status === "self-source") {
    return `<div class="row" style="gap:8px;align-items:center"><span class="tag">You're sourcing this</span><button class="btn btn-ghost btn-sm" data-action="undo" data-key="${esc(it.key)}">Undo</button></div>`;
  }
  if (it.status === "borrow") {
    return `<div class="row" style="gap:8px;align-items:center"><span class="tag">🤝 Borrowing this</span><button class="btn btn-ghost btn-sm" data-action="undo" data-key="${esc(it.key)}">Undo</button></div>`;
  }
  if (it.status === "save") {
    return `<div class="row" style="gap:8px;align-items:center"><span class="tag tag-gold">💰 Saved for later</span><button class="btn btn-ghost btn-sm" data-action="undo" data-key="${esc(it.key)}">Undo</button></div>`;
  }
  // suggested
  if (it.format === "printable") {
    return `
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" data-action="generate" data-key="${esc(it.key)}">⬇ Generate &amp; download</button>
        <button class="btn btn-sm" data-action="dismiss" data-key="${esc(it.key)}">Not needed</button>
      </div>`;
  }
  const primary = it.kind === "diy"
    ? `<button class="btn btn-primary btn-sm" data-action="approve" data-key="${esc(it.key)}">Approve</button>`
    : `<button class="btn btn-primary btn-sm" data-action="approve" data-key="${esc(it.key)}">Add to cart</button>`;
  return `
    <div class="row" style="gap:8px;flex-wrap:wrap">
      ${primary}
      <button class="btn btn-sm" data-action="owned" data-key="${esc(it.key)}">I already have</button>
      <button class="btn btn-sm" data-action="borrow" data-key="${esc(it.key)}">🤝 Borrow</button>
      <button class="btn btn-sm" data-action="self-source" data-key="${esc(it.key)}">I'll source it</button>
      <button class="btn btn-sm" data-action="save" data-key="${esc(it.key)}">💰 Save for later</button>
      <button class="btn btn-ghost btn-sm" data-action="dismiss" data-key="${esc(it.key)}">Dismiss</button>
    </div>`;
}

function marketplaceSection(sec, partners) {
  const list = partners || [];
  const countryLabel = list.find(p => p.countryLabel)?.countryLabel || null;
  const body = `
    <div class="small text-muted" style="margin-bottom:12px">${countryLabel ? `Prioritising suppliers local to <strong>${esc(countryLabel)}</strong>.` : "Set your home country in Family Settings to prioritise local suppliers."}</div>
    <div class="grid grid-auto">${list.map(partnerCard).join("")}</div>
    <p class="small text-muted" style="margin-top:12px">North Star compares suppliers on price, shipping, availability and reputation to surface the best value.</p>
    <p class="small text-muted" style="margin-top:4px"><em>Coming soon: independent creators uploading and selling their own resources.</em></p>`;
  return accShell(sec, list.length, body);
}

function partnerCard(p) {
  return `
    <div class="card" style="background:var(--card-elev)">
      <div class="row-between mb-1">
        <span class="tag">${esc(p.category)}</span>
        <div class="row" style="gap:5px">
          ${p.local ? `<span class="tag tag-sage" style="font-size:10px">📍 Local</span>` : ""}
          ${p.relevant ? `<span class="tag" style="font-size:10px">Your domains</span>` : ""}
        </div>
      </div>
      <h3 style="font-family:var(--font-serif);font-size:16px;margin:0">${esc(p.name)}</h3>
      <p class="small">${esc(p.description)}</p>
      ${(p.attributes || []).length ? `<div class="small text-muted" style="margin-top:4px">${p.attributes.map(esc).join(" · ")}</div>` : ""}
      ${(p.domains || []).length ? `<div class="row" style="gap:5px;flex-wrap:wrap;margin-top:6px">${p.domains.map(d => `<span class="tag ${DOMAIN_COLOR_CLASS[d] || ""}" style="font-size:10px">${esc(domainShort(d))}</span>`).join("")}</div>` : ""}
      <div class="divider"></div>
      <a class="btn btn-sm" href="#" data-partner="${esc(p.id)}">Browse ${esc(p.name)} →</a>
    </div>`;
}

/* ---------- wiring ---------- */

function wire(container) {
  // Cart button is absent in embedded mode (the Resources page owns it) — stay null-safe.
  container.querySelector("[data-cart]")?.addEventListener("click", () => navigate("/cart"));

  // Accordion: open one section at a time (smooth, no re-render).
  container.querySelectorAll("[data-acc-head]").forEach(btn => {
    btn.addEventListener("click", () => toggleSection(container, btn.dataset.accHead));
  });
  container.querySelector("[data-expand-all]")?.addEventListener("click", () => {
    _expandAll = !_expandAll;
    if (!_expandAll) _openSection = null;
    applyOpenClasses(container);
  });

  container.querySelectorAll("[data-jump]").forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.jump;
    _expandAll = false; _openSection = id;
    applyOpenClasses(container);
    const sec = container.querySelector(`.lt-acc[data-acc="${id}"]`);
    sec?.scrollIntoView({ behavior: "smooth", block: "start" });
  }));

  container.querySelectorAll("[data-partner]").forEach(a => a.addEventListener("click", (e) => {
    e.preventDefault();
    toast("Affiliate links activate when the partner ecosystem goes live.", { duration: 3000 });
  }));

  container.querySelectorAll("[data-action]").forEach(b => {
    b.addEventListener("click", () => {
      const it = _specs[b.dataset.key];
      if (!it) return;
      const action = b.dataset.action;
      if (action === "generate") { generateAiPrintable(it, b); return; }
      const statusMap = { approve: "approved", owned: "owned", borrow: "borrow", save: "save", "self-source": "self-source", dismiss: "dismissed", undo: "suggested" };
      recordResourceAction(it, statusMap[action] || "suggested");
      toast(actionToast(action), { type: action === "dismiss" ? "default" : "success" });
      rerenderKeepScroll();
    });
  });
}

/* ---------- helpers ---------- */

function ensurePersonalisedSeed(s) {
  (s.children || []).forEach(child => {
    const existing = s.materials.filter(m => m.forChildId === child.id && (m.section || "personalised") === "personalised");
    if (existing.length >= 3) return;
    suggestMaterialsForChild(child, s.family)
      .filter(sug => !existing.some(e => e.name === sug.name))
      .forEach(sug => addMaterial({
        name: sug.name, category: sug.category, description: sug.description,
        reasonSuggested: sug.reasonSuggested, ageRange: sug.ageRange,
        buyOrDIY: sug.buyOrDIY, estimatedPrice: sug.estimatedPrice,
        forChildId: child.id, section: "personalised",
      }));
  });
}

/* ---------- AI printable generation ----------
   A real, ready-to-print worksheet tailored to a specific child (age,
   interests, learning style, capability domains) — rendered in a new tab. */
function generateAiPrintable(it, btn) {
  const children = getState().children || [];
  if (!children.length) {
    toast("Add a child first — printables are tailored to each child.", { type: "warning" });
    return;
  }
  const target = it.forChildId ? children.find(c => c.id === it.forChildId) : null;
  if (target) return doGeneratePrintable(it, target, btn);
  if (children.length === 1) return doGeneratePrintable(it, children[0], btn);

  // Several children and no specific target → pick one. Each pick is its own
  // click gesture, so the print window still opens without the pop-up blocker.
  const body = document.createElement("div");
  body.innerHTML = `
    <p class="text-muted small">Who is this “${esc(it.name)}” worksheet for? North Star tailors it to their age, interests and learning style.</p>
    <div class="chip-group">${children.map(c => `<button class="chip" data-pick="${c.id}">${esc(c.name)}</button>`).join("")}</div>`;
  const modal = openModal({ title: "Generate a worksheet", body });
  body.querySelectorAll("[data-pick]").forEach(pb => pb.addEventListener("click", () => {
    const child = children.find(c => c.id === pb.dataset.pick);
    modal.close();
    doGeneratePrintable(it, child, btn);
  }));
}

async function doGeneratePrintable(it, child, btn) {
  const win = openPrintableWindow();               // opened inside the gesture (no pop-up block)
  if (!win) { toast("Allow pop-ups to open your printable worksheet.", { type: "warning" }); return; }
  if (btn) btn.disabled = true;
  try {
    const doc = await aiGeneratePrintable({
      child: {
        name: child.name,
        age: ageOf(child) ?? child.age ?? null,
        learningStyle: child.learningStyle,
        passions: child.passions,
        domains: child.domains,
      },
      printable: { name: it.name, description: it.description, domains: it.capabilityDomains },
    });
    writeWorksheet(win, doc, child);
    toast(`Worksheet ready for ${child.name} — print or save it from the new tab.`, { type: "success" });
  } catch (e) {
    writeError(win, e.message || "Couldn't create the worksheet just now. Please try again.");
    toast(e.message || "Couldn't generate the worksheet", { type: "warning" });
  } finally {
    if (btn) btn.disabled = false;
  }
}

function actionToast(action) {
  return {
    approve: "Approved",
    owned: "Marked as already owned",
    borrow: "You'll borrow this",
    save: "Saved for later",
    "self-source": "You'll source this yourself",
    dismiss: "Dismissed",
    undo: "Reset",
  }[action] || "Updated";
}

function freqLabel(f) {
  return { once: "one-off", occasional: "occasional", frequent: "used often", daily: "daily" }[f] || f;
}

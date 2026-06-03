/* ============================================================
   domains.js — Choose learning domains per child + balance nudges.
   ============================================================ */

import { getState, updateChild } from "../store.js";
import { DOMAIN_CATALOG } from "../seed.js";
import { suggestWellRoundedNudges } from "../ai/suggestions.js";
import { esc, icon, toast, DOMAIN_COLOR_CLASS } from "../components/ui.js";
import { rerender } from "../app.js";

let _selectedChildId = null;
let _dismissed = new Set();

export function renderDomains(container) {
  const s = getState();
  if (!_selectedChildId && s.children[0]) _selectedChildId = s.children[0].id;
  const child = s.children.find(c => c.id === _selectedChildId);

  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Learning Domains</h1>
        <div class="sub">Pick which gigs you want to include this term. We'll suggest balance as you go.</div>
      </div>
    </div>

    ${s.children.length > 1 ? `
      <div class="row mb-2" style="gap:8px">
        ${s.children.map(c => `<button class="chip ${c.id === _selectedChildId ? "selected" : ""}" data-child="${c.id}">${esc(c.name)}</button>`).join("")}
      </div>
    ` : ""}

    ${child ? renderDomainGrid(child, s) : `<div class="empty">Add a child first.</div>`}
  `;

  container.querySelectorAll("[data-child]").forEach(b => {
    b.addEventListener("click", () => { _selectedChildId = b.dataset.child; rerender(); });
  });

  if (child) wireDomainGrid(container, child, s);
}

function renderDomainGrid(child, state) {
  const family = state.family;
  const projects = state.projects.filter(p => p.childId === child.id && p.status !== "completed");
  const selected = new Set(child.domains || []);
  const nudges = suggestWellRoundedNudges(child.domains || [], projects)
    .filter(n => !_dismissed.has(n.id));

  return `
    ${nudges.length ? `
      <div class="suggestion-banner">
        <div class="label">Balance nudges</div>
        <div class="stack mt-1">
          ${nudges.map(n => `
            <div class="row" style="gap:10px;flex-wrap:wrap">
              <span style="flex:1;min-width:240px">${esc(n.text)}</span>
              ${n.addDomain ? `<button class="btn btn-sm btn-sage" data-add-domain="${n.addDomain}">Yes, add ${esc(domainName(n.addDomain))}</button>` : ""}
              <button class="btn btn-sm" data-dismiss="${n.id}">No thanks</button>
              <button class="btn btn-sm btn-ghost" data-show-alt="${n.id}">Show alternatives</button>
            </div>
          `).join("")}
        </div>
      </div>
    ` : ""}

    <div class="grid grid-auto">
      ${DOMAIN_CATALOG
        .filter(d => !d.optional || family.faithEnabled || child.faithEnabled)
        .map(d => {
          const on = selected.has(d.id);
          return `
            <div class="card card-hover ${on ? "" : ""}" data-domain="${d.id}" style="cursor:pointer; border-color: ${on ? "var(--primary)" : "var(--border)"}; background:${on ? "linear-gradient(135deg, var(--primary-soft), var(--card-elev))" : "var(--card)"}">
              <div class="row-between mb-1">
                <h3 style="font-family:var(--font-serif);font-size:18px">${esc(d.name)}</h3>
                <span class="tag ${DOMAIN_COLOR_CLASS[d.id] || ""}">${on ? "✓ Selected" : "Add"}</span>
              </div>
              <p class="text-muted small mb-2">${esc(d.description)}</p>
              <div class="chip-group">
                ${d.subSkills.slice(0, 6).map(s => `<span class="chip" style="font-size:11px;cursor:default;padding:3px 9px">${esc(s)}</span>`).join("")}
                ${d.subSkills.length > 6 ? `<span class="chip" style="font-size:11px;cursor:default">+${d.subSkills.length - 6}</span>` : ""}
              </div>
              ${d.optional ? `<div class="small text-muted mt-2">Optional · Faith Gigs require parent toggle.</div>` : ""}
            </div>
          `;
        }).join("")}
    </div>

    <div class="card mt-3" style="background:var(--card-elev)">
      <h4>What's "well-rounded" here?</h4>
      <p class="text-muted small">Pick 4–6 domains for most terms. Heavy academic + business plans benefit from at least one House Gig (real-life skill) and one Body Gig (movement, outdoors). Aim for one Community Gig per term.</p>
    </div>
  `;
}

function wireDomainGrid(container, child, state) {
  container.querySelectorAll("[data-domain]").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.dataset.domain;
      const selected = new Set(child.domains || []);
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      updateChild(child.id, { domains: Array.from(selected) });
      toast(selected.has(id) ? `Added ${domainName(id)}` : `Removed ${domainName(id)}`);
      rerender();
    });
  });
  container.querySelectorAll("[data-add-domain]").forEach(b => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = b.dataset.addDomain;
      const selected = new Set(child.domains || []);
      selected.add(id);
      updateChild(child.id, { domains: Array.from(selected) });
      toast(`${domainName(id)} added`, { type: "success" });
      rerender();
    });
  });
  container.querySelectorAll("[data-dismiss]").forEach(b => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      _dismissed.add(b.dataset.dismiss);
      rerender();
    });
  });
  container.querySelectorAll("[data-show-alt]").forEach(b => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      toast("Alternative ideas coming with real AI — for now, try a Community or Body Gig.", { duration: 3500 });
    });
  });
}

function domainName(id) {
  return DOMAIN_CATALOG.find(d => d.id === id)?.name || id;
}

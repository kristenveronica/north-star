/* ============================================================
   domains.js — Choose learning domains per child + balance nudges.
   ============================================================ */

import { getState, updateChild } from "../store.js";
import { availableDomains, domainDisplayName } from "../seed.js";
import { suggestWellRoundedNudges } from "../ai/suggestions.js";
import { esc, icon, toast, DOMAIN_COLOR_CLASS } from "../components/ui.js";
import { rerender } from "../app.js";

let _selectedChildId = null;
let _dismissed = new Set();
let _expanded = new Set();   // domain ids whose full skill list is expanded
let _addingFor = null;       // domain id currently showing the "add your own" input

const MAX_CUSTOM_SKILLS = 3; // per child, per domain

/* Custom skills live on the child's learning profile (existing jsonb — no
   migration). Shape: learningProfile.customSkills = { [domainId]: ["..."] }. */
function lpOf(child) {
  return (child.learningProfile && !Array.isArray(child.learningProfile)) ? child.learningProfile : {};
}
function getCustomSkills(child, domainId) {
  const cs = lpOf(child).customSkills || {};
  return Array.isArray(cs[domainId]) ? cs[domainId] : [];
}
function saveCustomSkills(child, domainId, skills) {
  const lp = { ...lpOf(child) };
  lp.customSkills = { ...(lp.customSkills || {}), [domainId]: skills };
  updateChild(child.id, { learningProfile: lp });
}
function addCustomSkill(child, domainId, raw) {
  const skill = (raw || "").trim();
  if (!skill) return false;
  const existing = getCustomSkills(child, domainId);
  if (existing.length >= MAX_CUSTOM_SKILLS) { toast(`Up to ${MAX_CUSTOM_SKILLS} of your own per domain`, { type: "warning" }); return false; }
  if (existing.some(x => x.toLowerCase() === skill.toLowerCase())) return false;
  saveCustomSkills(child, domainId, [...existing, skill]);
  return true;
}
function removeCustomSkill(child, domainId, idx) {
  const existing = getCustomSkills(child, domainId);
  saveCustomSkills(child, domainId, existing.filter((_, i) => i !== idx));
}

// Re-render the page without losing the reader's place. The in-card skill
// controls (expand "+N more", add/remove your own, select a domain) rebuild the
// whole view, which would otherwise jump back to the top — so we restore the
// window scroll position right after.
function rerenderKeepScroll() {
  const y = window.scrollY;
  rerender();
  window.scrollTo(0, y);
  requestAnimationFrame(() => window.scrollTo(0, y));
}

export function renderDomains(container) {
  const s = getState();
  if (!_selectedChildId && s.children[0]) _selectedChildId = s.children[0].id;
  const child = s.children.find(c => c.id === _selectedChildId);

  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Capability Domains</h1>
        <div class="sub">Choose the human capabilities you want to intentionally cultivate this season. We'll suggest balance as you go.</div>
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
    b.addEventListener("click", () => { _selectedChildId = b.dataset.child; _addingFor = null; rerender(); });
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
      ${availableDomains(family)
        .map(d => {
          const on = selected.has(d.id);
          return `
            <div class="card card-hover ${on ? "" : ""}" data-domain="${d.id}" style="cursor:pointer; border-color: ${on ? "var(--primary)" : "var(--border)"}; background:${on ? "linear-gradient(135deg, var(--primary-soft), var(--card-elev))" : "var(--card)"}">
              <div class="row-between mb-1">
                <h3 style="font-family:var(--font-serif);font-size:18px">${esc(d.name)}</h3>
                <span class="tag ${DOMAIN_COLOR_CLASS[d.id] || ""}">${on ? "✓ Selected" : "Add"}</span>
              </div>
              <p class="text-muted small mb-2">${esc(d.description)}</p>
              ${renderSkillChips(d, child)}
              ${d.optional ? `<div class="small text-muted mt-2">Optional · enable in Family Settings.</div>` : ""}
            </div>
          `;
        }).join("")}
    </div>

    <div class="card mt-3" style="background:var(--card-elev)">
      <h4>What's "well-rounded" here?</h4>
      <p class="text-muted small">Aim for 4–6 capability domains in most seasons. A child growing strong academic and enterprise capabilities benefits from at least one Practical Life capability (real-life skills) and one Health & Wellbeing capability (movement, outdoors). Weave in Leadership & Contribution regularly — capability grows fastest when it's used in service of others.</p>
    </div>
  `;
}

function renderSkillChips(d, child) {
  const expanded = _expanded.has(d.id);
  const all = d.subSkills || [];
  const visible = expanded ? all : all.slice(0, 6);
  const hidden = all.length - visible.length;
  const custom = getCustomSkills(child, d.id);
  const adding = _addingFor === d.id;
  const baseChip = s => `<span class="chip" style="font-size:11px;cursor:default;padding:3px 9px">${esc(s)}</span>`;
  const customChip = (s, i) =>
    `<span class="chip" style="font-size:11px;padding:3px 6px 3px 9px;background:var(--primary-soft);border-color:var(--primary);display:inline-flex;align-items:center;gap:5px">${esc(s)}<button type="button" data-remove-skill="${d.id}" data-skill-idx="${i}" aria-label="Remove ${esc(s)}" style="border:none;background:none;cursor:pointer;font-size:14px;line-height:1;color:var(--text-muted);padding:0">×</button></span>`;
  const dashed = "font-size:11px;cursor:pointer;border-style:dashed;color:var(--text-muted)";
  return `
    <div class="chip-group" data-skills>
      ${visible.map(baseChip).join("")}
      ${(!expanded && hidden > 0) ? `<button type="button" class="chip" data-expand="${d.id}" style="${dashed}">+${hidden} more</button>` : ""}
      ${(expanded && all.length > 6) ? `<button type="button" class="chip" data-expand="${d.id}" style="${dashed}">show less</button>` : ""}
      ${custom.map(customChip).join("")}
      ${adding
        ? `<input class="input" data-skill-input="${d.id}" maxlength="32" placeholder="Add a skill, then Enter" style="font-size:11px;padding:4px 9px;width:160px;height:auto"/>`
        : (custom.length < MAX_CUSTOM_SKILLS ? `<button type="button" class="chip" data-add-skill="${d.id}" style="${dashed}">+ Add your own</button>` : "")}
    </div>`;
}

function wireDomainGrid(container, child, state) {
  container.querySelectorAll("[data-domain]").forEach(card => {
    card.addEventListener("click", (e) => {
      // Clicks inside the skills area (chips, +more, add/remove your own) never
      // toggle the domain — they manage skills only.
      if (e.target.closest("[data-skills]")) return;
      const id = card.dataset.domain;
      const selected = new Set(child.domains || []);
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      updateChild(child.id, { domains: Array.from(selected) });
      toast(selected.has(id) ? `Added ${domainName(id)}` : `Removed ${domainName(id)}`);
      rerenderKeepScroll();
    });
  });

  // Expand / collapse the full skill list within a domain card.
  container.querySelectorAll("[data-expand]").forEach(b => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = b.dataset.expand;
      if (_expanded.has(id)) _expanded.delete(id); else _expanded.add(id);
      rerenderKeepScroll();
    });
  });

  // Reveal the inline input to add a custom skill, then focus it.
  container.querySelectorAll("[data-add-skill]").forEach(b => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      _addingFor = b.dataset.addSkill;
      rerenderKeepScroll();
      requestAnimationFrame(() => {
        const inp = container.querySelector(`[data-skill-input="${_addingFor}"]`);
        if (inp) inp.focus({ preventScroll: true });
      });
    });
  });

  // The custom-skill input: Enter commits, Escape/blur cancels.
  container.querySelectorAll("[data-skill-input]").forEach(inp => {
    const commit = () => {
      const id = inp.dataset.skillInput;
      const added = addCustomSkill(child, id, inp.value);
      _addingFor = null;
      if (added) toast("Skill added", { type: "success" });
      rerenderKeepScroll();
    };
    inp.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      else if (e.key === "Escape") { _addingFor = null; rerenderKeepScroll(); }
    });
    inp.addEventListener("blur", () => {
      // Commit a typed value on blur; if empty, just close the input.
      if (inp.value.trim()) commit(); else { _addingFor = null; rerenderKeepScroll(); }
    });
  });

  // Remove a custom skill.
  container.querySelectorAll("[data-remove-skill]").forEach(b => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      removeCustomSkill(child, b.dataset.removeSkill, Number(b.dataset.skillIdx));
      rerenderKeepScroll();
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
  return domainDisplayName(id);
}

/* ============================================================
   rewards.js — Per-project rewards + tolls overview.
   ============================================================ */

import { getState, updateProject } from "../store.js";
import { esc, toast, DOMAIN_COLOR_CLASS } from "../components/ui.js";
import { navigate } from "../router.js";
import { rerender } from "../app.js";

const REWARD_IDEAS = [
  "Family outing", "Hot chocolate date", "Movie night", "Special meal",
  "Small purchase", "Extra ski day", "Parent–child date", "Project showcase night",
];
const TOLL_IDEAS = [
  "Extra home contribution", "Complete unfinished project before unlocking next one",
  "Redo incomplete milestone", "Write a reflection on what got in the way",
  "Lose access to next reward until current project is complete",
];

let _frequency = "per-project"; // per-project | monthly | quarterly | custom

export function renderRewards(container) {
  const s = getState();
  const projects = s.projects.filter(p => p.status !== "completed");

  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Rewards &amp; Tolls</h1>
        <div class="sub">A reward celebrates honest, finished work. A toll is a natural consequence — not a punishment.</div>
      </div>
    </div>

    <div class="card mb-2">
      <h3 class="mb-2">Reward rhythm</h3>
      <div class="row" style="gap:8px">
        ${["per-project","monthly","quarterly","custom"].map(f => `
          <button class="chip ${_frequency === f ? "selected" : ""}" data-freq="${f}">${esc(f.replace("-", " "))}</button>
        `).join("")}
      </div>
      <p class="text-muted small mt-2">How often the celebration ritual lands. Per-project is the default — the reward is tied to actually finishing.</p>
    </div>

    <div class="grid grid-2 mb-2">
      <div class="card">
        <h3 class="mb-1">Reward ideas</h3>
        <p class="text-muted small mb-2">Click to copy into a project's reward field.</p>
        <div class="chip-group">
          ${REWARD_IDEAS.map(r => `<span class="chip" style="cursor:default">🎉 ${esc(r)}</span>`).join("")}
        </div>
      </div>
      <div class="card">
        <h3 class="mb-1">Toll ideas (responsibility, not punishment)</h3>
        <p class="text-muted small mb-2">Tied to ownership of the unfinished work.</p>
        <div class="chip-group">
          ${TOLL_IDEAS.map(r => `<span class="chip" style="cursor:default">⚖️ ${esc(r)}</span>`).join("")}
        </div>
      </div>
    </div>

    <h3 class="mb-2 mt-3">Active projects</h3>
    ${projects.length === 0 ? `<div class="empty">No active projects.</div>` : ""}
    <div class="stack">
      ${projects.map(p => projectRow(p, s)).join("")}
    </div>
  `;

  container.querySelectorAll("[data-freq]").forEach(b => {
    b.addEventListener("click", () => { _frequency = b.dataset.freq; rerender(); });
  });
  container.querySelectorAll("[data-save]").forEach(b => {
    b.addEventListener("click", () => {
      const id = b.dataset.save;
      const reward = container.querySelector(`#r-${id}`).value;
      const toll = container.querySelector(`#t-${id}`).value;
      const agreed = container.querySelector(`#a-${id}`).checked;
      updateProject(id, { reward, toll, childAgreed: agreed });
      toast("Saved", { type: "success" });
    });
  });
  container.querySelectorAll("[data-open-proj]").forEach(b => {
    b.addEventListener("click", () => navigate("/projects/" + b.dataset.openProj));
  });
}

function projectRow(p, s) {
  const child = s.children.find(c => c.id === p.childId);
  return `
    <div class="card">
      <div class="row" style="gap:14px;margin-bottom:10px">
        <div>
          <div class="fw-700">${esc(p.title)}</div>
          <div class="small text-muted">${child ? esc(child.name) : ""}</div>
        </div>
        <div class="row" style="gap:6px;flex-wrap:wrap">
          ${(p.domains || []).map(d => `<span class="tag ${DOMAIN_COLOR_CLASS[d] || ""}">${esc(d)}</span>`).join("")}
        </div>
        <div style="margin-left:auto">
          <button class="btn btn-ghost btn-sm" data-open-proj="${p.id}">Open project →</button>
        </div>
      </div>
      <div class="grid grid-2">
        <div class="field">
          <label>🎉 Reward</label>
          <input class="input" id="r-${p.id}" value="${esc(p.reward || "")}"/>
        </div>
        <div class="field">
          <label>⚖️ Toll</label>
          <input class="input" id="t-${p.id}" value="${esc(p.toll || "")}"/>
        </div>
      </div>
      <div class="row-between">
        <label class="checkbox"><input type="checkbox" id="a-${p.id}" ${p.childAgreed ? "checked" : ""}/> Child has agreed</label>
        <button class="btn btn-primary btn-sm" data-save="${p.id}">Save</button>
      </div>
    </div>
  `;
}

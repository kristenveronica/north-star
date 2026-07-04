/* ============================================================
   apps.js — Learning Apps (parent view).
   Turn satellite apps on per child, set daily time limits, and
   track the progress each app reports back. The child launches
   enabled apps from their portal.
   ============================================================ */

import { getState } from "../../js/store.js";
import { APP_CATALOG } from "../appsCatalog.js";
import {
  getChildApp, setAppEnabled, setAppLimit,
  minutesUsedToday, appWeekStats,
} from "../lib/appsHub.js";
import { esc, toast } from "../../js/components/ui.js";
import { rerender } from "../../js/app.js";

const LIMIT_OPTIONS = [10, 15, 20, 30, 45];

function progressBlock(childId, app) {
  const row = getChildApp(childId, app.id);
  if (!row?.enabled) return "";
  const week = appWeekStats(childId, app.id);
  const usedToday = minutesUsedToday(childId, app.id);
  const limit = row.dailyLimitMin ?? app.defaultLimitMin ?? 15;
  const last = row.lastSummary;
  const masteredUnique = [...new Set(week.mastered)];

  return `
    <div class="divider"></div>
    <div class="grid grid-3" style="gap:10px">
      <div class="metric"><div class="v">${week.sessions}</div><div class="l">Sessions this week</div></div>
      <div class="metric"><div class="v">${week.minutes} min</div><div class="l">Time this week</div></div>
      <div class="metric"><div class="v">${usedToday}/${limit} min</div><div class="l">Today</div></div>
    </div>
    ${masteredUnique.length ? `
      <div class="small mt-2">⭐ <strong>Mastered this week:</strong> ${masteredUnique.map(esc).join(", ")}</div>` : ""}
    ${last?.workingOn?.title ? `
      <div class="small text-muted mt-1">Working on: ${esc(last.workingOn.title)}${
        Number.isFinite(last.workingOn.pct) ? ` — ${Math.round(last.workingOn.pct)}% strength` : ""}</div>` : ""}
    ${!row.sessions.length ? `
      <div class="small text-muted mt-1">No sessions yet — the button is waiting on ${esc(childNameOf(childId))}'s portal.</div>` : ""}
  `;
}

function childNameOf(childId) {
  return getState().children.find(c => c.id === childId)?.name || "your child";
}

function appCard(child, app) {
  const row = getChildApp(child.id, app.id);
  const enabled = !!row?.enabled;
  const comingSoon = app.status !== "live";
  const limit = row?.dailyLimitMin ?? app.defaultLimitMin ?? 15;

  return `
    <div class="card ${comingSoon ? "" : "card-hover"}" style="${comingSoon ? "opacity:0.55" : ""}">
      <div class="row" style="gap:12px;align-items:flex-start">
        <div style="font-size:34px;line-height:1">${app.emoji}</div>
        <div style="flex:1;min-width:0">
          <div class="row" style="gap:8px;align-items:center;flex-wrap:wrap">
            <strong>${esc(app.name)}</strong>
            <span class="tag tag-sage">${esc(app.domain)}</span>
            <span class="small text-muted">Ages ${esc(app.ages)}</span>
          </div>
          <p class="small text-muted" style="margin:4px 0 0">${esc(app.tagline)}</p>
        </div>
        ${comingSoon
          ? `<span class="tag tag-sage">Coming soon</span>`
          : `<button class="btn btn-sm ${enabled ? "btn-sage" : "btn-primary"}"
               data-toggle-app="${app.id}" data-child="${child.id}">
               ${enabled ? "On ✓" : "Turn on"}
             </button>`}
      </div>
      ${enabled ? `
        <div class="row mt-2" style="gap:10px;align-items:center;flex-wrap:wrap">
          <label class="small text-muted" for="limit-${child.id}-${app.id}">Daily time limit</label>
          <select id="limit-${child.id}-${app.id}" data-limit-app="${app.id}" data-child="${child.id}" class="input" style="width:auto;padding:6px 10px">
            ${LIMIT_OPTIONS.map(m => `<option value="${m}" ${m === limit ? "selected" : ""}>${m} minutes</option>`).join("")}
          </select>
          <span class="small text-muted">Sessions warn near the end and wrap up on time — never mid-question.</span>
        </div>
        ${progressBlock(child.id, app)}
      ` : ""}
    </div>
  `;
}

export function renderApps(container) {
  const s = getState();
  const children = s.children || [];

  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Learning Apps</h1>
        <div class="sub">Turn on the apps you want woven into each child's journey. Enabled apps appear
        as a button on that child's portal; their progress reports back here and can feed future projects.</div>
      </div>
    </div>

    ${children.length === 0
      ? `<div class="empty"><div class="emoji">🧭</div><h3>No children yet</h3><p class="text-muted">Add a child first, then choose their apps.</p></div>`
      : children.map(child => `
        <h2 class="mb-2 ${children[0] === child ? "" : "mt-3"}">${esc(child.name)}</h2>
        <div class="stack">
          ${APP_CATALOG.map(app => appCard(child, app)).join("")}
        </div>
      `).join("")}
  `;

  container.querySelectorAll("[data-toggle-app]").forEach(btn => {
    btn.addEventListener("click", () => {
      const childId = btn.dataset.child, appId = btn.dataset.toggleApp;
      const nowEnabled = !getChildApp(childId, appId)?.enabled;
      setAppEnabled(childId, appId, nowEnabled);
      toast(nowEnabled
        ? `${childNameOf(childId)} can now see this app on their portal ✦`
        : "App turned off — it disappears from their portal");
      rerender();
    });
  });

  container.querySelectorAll("[data-limit-app]").forEach(sel => {
    sel.addEventListener("change", () => {
      setAppLimit(sel.dataset.child, sel.dataset.limitApp, Number(sel.value));
      toast(`Daily limit set to ${sel.value} minutes`);
    });
  });
}

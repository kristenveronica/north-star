/* ============================================================
   appsHub.js — hub-and-satellite integration layer.

   North Star is the hub: parents turn apps on per child and set
   daily time limits; children launch enabled apps from their
   portal; apps report a session summary back.

   The handshake (no shared backend needed; upgrades cleanly to
   shared Supabase tables later):
     OUT  <app launchUrl>/?ns_launch=<b64 json>
          { v, appId, childId, childName, dailyLimitMin,
            minutesUsedToday, returnUrl }
     BACK <returnUrl>?ns_result=<b64 json>
          { v, appId, childId, sessionId, day, minutes,
            attempts, correct, mastered[], workingOn{title,pct} }
   ============================================================ */

import { getState, update, ageOf } from "../../js/store.js";
import { getApp } from "../appsCatalog.js";

const todayKey = () => new Date().toISOString().slice(0, 10);

// Unicode-safe base64 helpers
const b64encode = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
const b64decode = (str) => JSON.parse(decodeURIComponent(escape(atob(str))));

function findRow(state, childId, appId) {
  return (state.childApps || []).find(r => r.childId === childId && r.appId === appId);
}

export function getChildApp(childId, appId) {
  return findRow(getState(), childId, appId) || null;
}

export function isAppEnabled(childId, appId) {
  return !!getChildApp(childId, appId)?.enabled;
}

export function enabledAppsForChild(childId) {
  return (getState().childApps || [])
    .filter(r => r.childId === childId && r.enabled)
    .map(r => ({ row: r, app: getApp(r.appId) }))
    .filter(x => x.app);
}

export function setAppEnabled(childId, appId, enabled) {
  update(s => {
    s.childApps = s.childApps || [];
    let row = findRow(s, childId, appId);
    if (!row) {
      row = {
        id: "capp_" + Math.random().toString(36).slice(2, 10),
        childId, appId,
        enabled: false,
        dailyLimitMin: getApp(appId)?.defaultLimitMin ?? 15,
        minutesByDay: {},
        sessions: [],
        lastSummary: null,
        createdAt: new Date().toISOString(),
      };
      s.childApps.push(row);
    }
    row.enabled = enabled;
  });
}

export function setAppLimit(childId, appId, minutes) {
  update(s => {
    const row = findRow(s, childId, appId);
    if (row) row.dailyLimitMin = minutes;
  });
}

export function minutesUsedToday(childId, appId) {
  const row = getChildApp(childId, appId);
  return Math.round(row?.minutesByDay?.[todayKey()] ?? 0);
}

export function minutesLeftToday(childId, appId) {
  const row = getChildApp(childId, appId);
  if (!row) return 0;
  return Math.max(0, (row.dailyLimitMin ?? 15) - minutesUsedToday(childId, appId));
}

/* ---- launch (child portal → app) ---- */
export function buildLaunchUrl(child, appId) {
  const app = getApp(appId);
  const row = getChildApp(child.id, appId);
  if (!app || !row) return null;
  const returnUrl = `${location.origin}${location.pathname}#/kid/${child.accessCode}`;
  const payload = {
    v: 1,
    appId,
    childId: child.id,
    childName: child.name,
    childAge: ageOf(child), // live age from birthday — drives the app's stage/placement
    dailyLimitMin: row.dailyLimitMin ?? 15,
    minutesUsedToday: minutesUsedToday(child.id, appId),
    returnUrl,
  };
  return `${app.launchUrl}/?ns_launch=${encodeURIComponent(b64encode(payload))}`;
}

/* ---- return (app → child portal) ----
   Called by the child portal when `ns_result` is present in the route query.
   Returns the parsed summary when a new session was recorded, else null. */
export function processAppReturn(nsResultParam) {
  let result;
  try { result = b64decode(nsResultParam); } catch { return null; }
  if (!result || result.v !== 1 || !result.appId || !result.childId) return null;

  let recorded = null;
  update(s => {
    s.childApps = s.childApps || [];
    const row = findRow(s, result.childId, result.appId);
    if (!row) return;
    // Idempotent: a reload with the same query must not double-count.
    if (result.sessionId && row.sessions.some(x => x.sessionId === result.sessionId)) return;
    const day = result.day || todayKey();
    const minutes = Math.max(0, Math.min(Number(result.minutes) || 0, 120));
    row.sessions.push({
      sessionId: result.sessionId || null,
      day, minutes,
      attempts: result.attempts ?? null,
      correct: result.correct ?? null,
      mastered: Array.isArray(result.mastered) ? result.mastered : [],
      recordedAt: new Date().toISOString(),
    });
    row.minutesByDay = row.minutesByDay || {};
    row.minutesByDay[day] = (row.minutesByDay[day] || 0) + minutes;
    row.lastSummary = result;
    recorded = result;
  });
  return recorded;
}

/* ---- parent-dashboard aggregates ---- */
export function appWeekStats(childId, appId) {
  const row = getChildApp(childId, appId);
  if (!row) return { sessions: 0, minutes: 0, mastered: [] };
  const weekStart = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const recent = row.sessions.filter(x => x.day >= weekStart);
  return {
    sessions: recent.length,
    minutes: Math.round(recent.reduce((n, x) => n + (x.minutes || 0), 0)),
    mastered: recent.flatMap(x => x.mastered || []),
  };
}

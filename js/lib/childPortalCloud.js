/* ============================================================
   childPortalCloud.js — cross-device child portal access.

   A child opening their portal on their own device has no local family data.
   This looks them up by access code via the `child-portal` edge function and
   loads ONLY their data (profile + projects + milestones) into the store, so
   the existing portal views render anywhere. Reuses the same row-mappers the
   parent hydrate uses, so the shape is identical.
   ============================================================ */

import { supabase } from "./supabase.js";
import { fromChildRow, fromProjectRow, fromMilestoneRow } from "./repo.js";
import { loadChildPortalSession } from "../store.js";

/** Look up a child by access code in the cloud and load their portal session.
    Returns the mapped child on success; throws Error("not_found") etc. */
export async function childPortalLogin(code) {
  const { data, error } = await supabase.functions.invoke("child-portal", {
    body: { action: "login", payload: { code } },
  });
  if (error) {
    let msg = error.message || "Lookup failed";
    try { const b = await error.context?.json?.(); if (b?.error) msg = b.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  if (!data?.child) throw new Error("not_found");

  const child = fromChildRow(data.child);
  const projects = (data.projects || []).map(fromProjectRow);
  const milestones = (data.milestones || []).map(fromMilestoneRow);
  loadChildPortalSession({ children: [child], projects, milestones });
  return child;
}

/** The child's one warm Guide line for today (≤ 1 AI call/child/local-day,
    cached server-side). Returns the line, or null on any failure — the caller
    just shows its evergreen greeting instead. Never throws. */
export async function fetchDailyGuideLine(code, localDate) {
  try {
    const { data, error } = await supabase.functions.invoke("child-portal", {
      body: { action: "daily-guide", payload: { code, localDate } },
    });
    if (error || !data) return null;
    return data.line || null;
  } catch { return null; }
}

/** Persist a milestone completion (or undo) done in the child portal, server-side.
    The child portal is an access-code session that can't write through RLS, so
    without this a completion is local-only (lost on reload) and never becomes
    Archive evidence. Fire-and-forget; never throws — the light already rose. */
export async function recordChildCompletion(code, milestoneId, completed = true) {
  try {
    const { data, error } = await supabase.functions.invoke("child-portal", {
      body: { action: "record-completion", payload: { code, milestoneId, completed } },
    });
    if (error || !data) return false;
    return !!data.ok;
  } catch { return false; }
}

/** AI narration for the mission read-aloud. `chunks` = [{ id, text }].
    Returns [{ id, audio }] (audio = base64 MP3, or null per chunk), or null if
    TTS is unavailable/unconfigured — caller then falls back to the browser voice. */
export async function fetchTts(code, chunks) {
  try {
    const { data, error } = await supabase.functions.invoke("child-portal", {
      body: { action: "tts", payload: { code, chunks } },
    });
    if (error || !data || data.error) return null;
    return Array.isArray(data.chunks) ? data.chunks : null;
  } catch { return null; }
}

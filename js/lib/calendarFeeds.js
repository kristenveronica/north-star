/* ============================================================
   calendarFeeds.js — external calendar subscriptions (read-only).

   The family can subscribe to secret ICS ("iCal format") URLs from
   Google Calendar, iCloud/Apple Calendar, Outlook, etc. We store the
   subscription (calendar_feeds, RLS family-scoped) and read the events
   through the `calendar-ics` edge function, which fetches + parses the
   .ics server-side (avoids browser CORS + keeps the secret URL off-page).

   One-way, read-only overlay. We never write back to the source calendar.
   ============================================================ */

import { supabase } from "./supabase.js";
import { getState } from "../store.js";

/** All feed subscriptions for the current family (newest first). */
export async function listFeeds() {
  const { data, error } = await supabase
    .from("calendar_feeds")
    .select("id, label, url, color, last_synced_at, last_error, created_at")
    .order("created_at", { ascending: false });
  if (error) { console.warn("[calendarFeeds] list", error.message); return []; }
  return data || [];
}

/** Subscribe to a new external calendar. Returns the created row or throws. */
export async function addFeed({ label, url, color }) {
  const familyId = getState().family?.id;
  if (!familyId) throw new Error("No family loaded.");
  const clean = (url || "").trim();
  if (!/^(https?|webcal):\/\//i.test(clean)) {
    throw new Error("That doesn't look like a calendar link. Paste the secret iCal/ICS URL from your calendar's settings.");
  }
  const { data, error } = await supabase
    .from("calendar_feeds")
    .insert({ family_id: familyId, label: (label || "Calendar").trim(), url: clean, color: color || null })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Remove a subscription (does not touch the external calendar). */
export async function removeFeed(id) {
  const { error } = await supabase.from("calendar_feeds").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Fetch external events for a window via the edge function.
 * @returns {Promise<{events:Array, feeds:Array}>} normalized events + per-feed status.
 *   event: { feedId, feedLabel, color, uid, title, location, start, end, allDay, recurring }
 */
export async function fetchExternalEvents({ from, to } = {}) {
  try {
    const { data, error } = await supabase.functions.invoke("calendar-ics", {
      body: { from: from ? new Date(from).getTime() : undefined, to: to ? new Date(to).getTime() : undefined },
    });
    if (error) { console.warn("[calendarFeeds] fetch", error.message); return { events: [], feeds: [] }; }
    return { events: data?.events || [], feeds: data?.feeds || [] };
  } catch (e) {
    console.warn("[calendarFeeds] fetch", e.message);
    return { events: [], feeds: [] };
  }
}

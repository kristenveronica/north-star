/* ============================================================
   drafts.js — Per-account local "safety net" drafts.

   These hold in-progress, not-yet-committed form input (e.g. a
   half-finished onboarding or a new child being typed) so nothing
   is lost if a tab closes mid-edit. Committed data lives in the
   store and syncs to Supabase per account; drafts are device-local.

   CRITICAL for multi-tenant scale: every draft key is namespaced by
   the signed-in user's id, so two accounts on the same browser can
   never read each other's drafts. clearAllDrafts() wipes them on
   logout so nothing personal lingers on a shared device.
   ============================================================ */

import { currentUserId } from "../auth.js";

const PREFIX = "northstar::draft::";

function keyFor(name) {
  return `${PREFIX}${name}::${currentUserId() || "anon"}`;
}

export function saveDraft(name, data) {
  try { localStorage.setItem(keyFor(name), JSON.stringify(data)); } catch { /* quota / private mode */ }
}

export function loadDraft(name) {
  try {
    const raw = localStorage.getItem(keyFor(name));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearDraft(name) {
  try { localStorage.removeItem(keyFor(name)); } catch { /* ignore */ }
}

/** Remove every draft on this device (called on logout). */
export function clearAllDrafts() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch { /* ignore */ }
}

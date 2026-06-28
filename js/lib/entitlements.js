/* ============================================================
   entitlements.js — What a family's subscription unlocks.

   Built to scale to tens of thousands of paying accounts. The
   SOURCE OF TRUTH is server-side: a Stripe subscription drives a
   per-family entitlement (`family.entitlements`) that the client
   only ever READS. The client must never raise its own limits —
   the UI here is for gating + upselling; the hard enforcement is
   the DB/edge function (see supabase/migrations + ARCHITECTURE).

   Billing model (per product direction):
     • Basic account includes 1 child profile.
     • Each additional child profile is a paid bolt-on seat.
   ============================================================ */

import { getState } from "../store.js";

// What the base plan includes before any bolt-ons.
export const DEFAULT_CHILD_PROFILE_LIMIT = 1;

/** How many child profiles this family is entitled to (base + paid bolt-ons). */
export function childProfileLimit(family = getState().family) {
  const n = family?.entitlements?.childProfileLimit;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_CHILD_PROFILE_LIMIT;
}

/** Child profiles currently in use. */
export function childSeatsUsed(state = getState()) {
  return (state.children || []).length;
}

/** True when there's an unused, paid-for seat available. */
export function canAddChild(state = getState()) {
  return childSeatsUsed(state) < childProfileLimit(state.family);
}

/** Remaining seats (never negative). */
export function childSeatsRemaining(state = getState()) {
  return Math.max(0, childProfileLimit(state.family) - childSeatsUsed(state));
}

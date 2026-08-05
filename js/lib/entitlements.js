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
import { PLANS, FEATURES, DEFAULT_PLAN, planRank } from "./plans.js";

// What the base plan includes before any bolt-ons.
export const DEFAULT_CHILD_PROFILE_LIMIT = 1;

/* ---------- Subscription tier / capability model ----------
   The family's plan drives BOTH feature access and how deeply the
   mentoring relationship runs. Components must never check a tier name
   directly — they ask hasFeature(...) / canAccess*(...) so packaging can
   change in plans.js without touching any UI. Server is the source of
   truth (family_billing.plan → family.entitlements.plan). */

/** The family's current plan key ("foundation" | "flourish" | "legacy"). */
export function currentPlan(state = getState()) {
  const ent = state?.family?.entitlements || {};
  if (ent.plan && PLANS[ent.plan]) return ent.plan;
  if (ent.isBeta) return "legacy";        // beta families get the full experience
  return DEFAULT_PLAN;                     // founding-launch grandfather (see plans.js)
}

/** Display name of the current plan. */
export function currentPlanName(state = getState()) {
  return PLANS[currentPlan(state)]?.name || "Foundation";
}

/** Does the family's plan include this feature? (rank comparison) */
export function hasFeature(featureKey, state = getState()) {
  const f = FEATURES[featureKey];
  if (!f) return true;                     // unknown/ungated feature is always allowed
  return planRank(currentPlan(state)) >= planRank(f.minPlan);
}

// Named convenience checks (thin wrappers over hasFeature — the spec's
// canAccess* surface). Prefer these in components over any tier name.
export const canAccessFamilyInventory = (s = getState()) => hasFeature("FAMILY_INVENTORY", s);
export const canAccessGrowthReports   = (s = getState()) => hasFeature("GROWTH_REPORTS", s);
export const canAccessRewards         = (s = getState()) => hasFeature("REWARDS", s);
export const canAccessFamilyNorthStar = (s = getState()) => hasFeature("FAMILY_NORTH_STAR", s);
export const canAccessFamilyCouncils  = (s = getState()) => hasFeature("FAMILY_COUNCILS", s);
export const canAccessChildInsights   = (s = getState()) => hasFeature("CHILD_INSIGHTS", s);
export const canAccessCommunity       = (s = getState()) => hasFeature("COMMUNITY", s);
export const canAccessGuideMentoring  = (s = getState()) => hasFeature("GUIDE_MENTORING", s);

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

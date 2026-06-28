/* ============================================================
   billing.js — Frontend gateway to the Stripe billing edge function.
   The function runs server-side and holds the Stripe secret; this
   only invokes it with the signed-in parent's session and redirects
   to Stripe-hosted Checkout / Billing Portal pages.
   ============================================================ */

import { supabase } from "./supabase.js";

async function invokeBilling(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke("billing", { body: { action, payload } });
  if (error) {
    let msg = error.message || "Billing request failed";
    try { const body = await error.context?.json?.(); if (body?.error) msg = body.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

/**
 * Start the base subscription checkout (includes 1 child).
 * interval: 'month' | 'year'. seats: extra child seats to buy in the same checkout.
 */
export async function startBaseCheckout(interval = "month", seats = 0) {
  const { url } = await invokeBilling("create-checkout", { interval, seats });
  if (url) window.location.href = url;
}

/**
 * Add one extra child-profile seat to the active subscription.
 * Returns { ok, extraSeats } on success, or { needsBase:true } if the family
 * hasn't subscribed to the base plan yet (caller should offer checkout).
 */
export function addChildSeat() {
  return invokeBilling("add-seat");
}

/** Link a subscription paid on the public pricing page to the signed-in family,
    verified by email. Returns { ok } / { skipped } / throws on email_mismatch. */
export function claimSubscription(sessionId) {
  return invokeBilling("claim-subscription", { sessionId });
}

/** Fetch configured prices so the app can show pricing + compute totals.
    Returns { month: { base, seat, aiseat }, year: {...} } where each is
    { amount, currency, interval } or null if that price isn't configured yet. */
export function getBillingPrices() {
  return invokeBilling("get-prices");
}

/** Open the Stripe Billing Portal to manage or cancel the subscription. */
export async function openBillingPortal() {
  const { url } = await invokeBilling("create-portal");
  if (url) window.location.href = url;
}

/* ---------- Adult contributor (AI) seats ----------
   An adult who can CONSUME AI credits is a billable seat: any co-owner, or a
   contributor granted Generate AI Projects / Request AI Reports. The Primary
   Owner is included in the base plan. The seat count is recomputed server-side
   on sync (the client value below is only for display). */
export const AI_PERMS = ["contrib:generate", "contrib:reports"];

export function memberConsumesAI(member) {
  if (!member) return false;
  if (member.role === "architect" || member.role === "co_architect") return true;
  const perms = member.permissions || [];
  return AI_PERMS.some(p => perms.includes(p));
}

// Billable adult seats = active members, excluding the Primary Owner, who consume AI.
export function billableAiAdults(state) {
  return (state?.familyMembers || []).filter(m =>
    (m.status || "active") === "active" && !m.is_primary && memberConsumesAI(m));
}
export function aiSeatCount(state) {
  return billableAiAdults(state).length;
}

/** Reconcile the Stripe AI-seat quantity with actual membership (server-computed).
    Returns { ok, aiSeats } or { skipped, reason } when billing isn't configured yet. */
export function syncAiSeats() {
  return invokeBilling("sync-ai-seats");
}

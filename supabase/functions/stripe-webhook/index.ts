// ============================================================================
// North Star — Stripe webhook.  verify_jwt: OFF  (Stripe signs, not Supabase)
//
// The SOURCE OF TRUTH for entitlements. On any subscription change it recomputes
// the family's base_interval + extra_seats + status and upserts family_billing;
// a DB trigger (0011) then sets family_profiles.child_profile_limit. The client
// can never raise its own limit — only verified Stripe events do.
//
// Set verify_jwt = false for this function (supabase/config.toml or CLI flag).
//
// Required env:
//   STRIPE_SECRET_KEY  STRIPE_WEBHOOK_SECRET
//   STRIPE_PRICE_SEAT_MONTH  STRIPE_PRICE_SEAT_YEAR   (to identify seat items)
//   SUPABASE_URL  SUPABASE_SERVICE_ROLE_KEY
// ============================================================================

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno&no-check";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

// .trim() so a stray newline/space pasted into any secret can never break it.
const env = (k: string) => (Deno.env.get(k) || "").trim();
// deno-lint-ignore no-explicit-any
const stripe: any = new Stripe(env("STRIPE_SECRET_KEY"), {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

const SEAT_PRICES = new Set([env("STRIPE_PRICE_SEAT_MONTH"), env("STRIPE_PRICE_SEAT_YEAR")].filter(Boolean));
const AISEAT_PRICES = new Set([env("STRIPE_PRICE_AISEAT_MONTH"), env("STRIPE_PRICE_AISEAT_YEAR")].filter(Boolean));

// current_period_end moved from the Subscription to its line items in Stripe API
// 2025-03-31+ (the webhook renders events at the account version, which may be
// newer than our SDK). Read it from either location, defensively.
// deno-lint-ignore no-explicit-any
const periodEndISO = (s: any): string | null => {
  const t = s?.current_period_end ?? s?.items?.data?.[0]?.current_period_end;
  return t ? new Date(t * 1000).toISOString() : null;
};

// ---- Subscription tiers: resolve a tier's base price for re-pricing ----
const PLAN_KEYS = ["foundation", "flourish", "legacy"];
const normalizePlan = (p: string) => (PLAN_KEYS.includes(String(p || "").toLowerCase()) ? String(p).toLowerCase() : "foundation");
function basePriceId(plan: string, interval: string): string {
  const P = normalizePlan(plan).toUpperCase();
  const I = interval === "year" ? "YEAR" : "MONTH";
  return env(`STRIPE_PRICE_${P}_${I}`) || env(`STRIPE_PRICE_BASE_${I}`) || "";
}

/** Write the subscription's current shape into family_billing (trigger sets the limit). */
// deno-lint-ignore no-explicit-any
async function syncSubscription(sub: any) {
  let familyId = sub.metadata?.family_id;
  if (!familyId) {
    // Fall back to the customer's metadata if the subscription wasn't tagged.
    const cust = await stripe.customers.retrieve(sub.customer as string);
    familyId = (cust as any)?.metadata?.family_id;
    if (!familyId) { console.warn("[webhook] no family_id on sub", sub.id); return; }
  }

  // Extra seats = summed quantity of any seat-price line items.
  let extraSeats = 0;
  let interval: string | null = null;
  for (const item of sub.items.data) {
    if (SEAT_PRICES.has(item.price.id)) extraSeats += item.quantity || 0;
    else interval = item.price.recurring?.interval || interval; // base item gives the interval
  }

  // 12-month commitment + beta exemption (see migration 0021 / billing fn).
  const isBeta = String(sub.metadata?.beta || "") === "1";
  let committedUntil: string | null = null;
  if (!isBeta && sub.start_date) {
    const d = new Date(sub.start_date * 1000);
    d.setMonth(d.getMonth() + 12);
    committedUntil = d.toISOString();
  }
  const pausedUntil = sub.pause_collection?.resumes_at
    ? new Date(sub.pause_collection.resumes_at * 1000).toISOString() : null;

  await admin.from("family_billing").upsert({
    family_id: familyId,
    stripe_customer_id: sub.customer as string,
    stripe_subscription_id: sub.id,
    base_interval: interval === "year" ? "year" : interval === "month" ? "month" : null,
    extra_seats: extraSeats,
    status: sub.status, // active | trialing | past_due | canceled | unpaid | ...
    current_period_end: periodEndISO(sub),
    is_beta: isBeta,
    committed_until: committedUntil,
    paused_until: pausedUntil,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    // Stamp the tier when the subscription carries it (don't clobber on a legacy
    // claim that predates tiers). The DB trigger denormalises this to the family.
    ...(sub.metadata?.plan ? { plan: normalizePlan(sub.metadata.plan) } : {}),
    updated_at: new Date().toISOString(),
  }, { onConflict: "family_id" });
}

// ---------------------------------------------------------------------------
// SPLIT PAYMENTS (blended families — two parents, one family).
//
// A co-payer's subscription is tagged metadata.payer_role = 'co'. It funds a
// SHARE of the base plan and is tracked in billing_payers — it never drives the
// family's entitlement (that rides on the guarantor's subscription, unchanged).
//
// Model: "guarantor backstops" (grace_then_primary). The guarantor keeps paying
// 100% until the co-payer's FIRST payment lands; then the guarantor's base item
// drops to their share so the two shares sum to the full price. If the co-payer
// ever lapses, the guarantor is restored to 100% automatically — the family is
// never locked out and revenue never dips below full.
// ---------------------------------------------------------------------------

function payerStatusFrom(s: string): string {
  if (s === "active" || s === "trialing") return "active";
  if (s === "past_due" || s === "unpaid" || s === "incomplete") return "past_due";
  return "canceled"; // canceled | incomplete_expired
}

/** Re-price the guarantor's base line item to `pct`% of the full base price.
    pct >= 100 restores the real base price id. Idempotent (no-ops when the
    amount already matches, so repeated co-payer events don't churn prices). */
// deno-lint-ignore no-explicit-any
async function adjustGuarantorBase(familyId: string, pct: number) {
  const { data: fb } = await admin.from("family_billing")
    .select("stripe_subscription_id, base_interval, plan").eq("family_id", familyId).maybeSingle();
  if (!fb?.stripe_subscription_id) return;

  const interval = fb.base_interval === "year" ? "year" : "month";
  const fullBaseId = basePriceId(fb.plan || "foundation", interval);
  if (!fullBaseId) return;

  const sub = await stripe.subscriptions.retrieve(fb.stripe_subscription_id);
  // The base item is the recurring item that is neither a child seat nor an AI seat.
  const baseItem = sub.items.data.find((it: any) =>
    !SEAT_PRICES.has(it.price.id) && !AISEAT_PRICES.has(it.price.id));
  if (!baseItem) return;

  const full = await stripe.prices.retrieve(fullBaseId);
  const target = pct >= 100 ? (full.unit_amount || 0) : Math.round((full.unit_amount || 0) * pct / 100);
  if ((baseItem.price.unit_amount || 0) === target && (pct < 100 || baseItem.price.id === fullBaseId)) {
    return; // already at the right price — nothing to do
  }

  const items = pct >= 100
    ? [{ id: baseItem.id, price: fullBaseId }]
    : [{
        id: baseItem.id,
        price_data: {
          currency: full.currency,
          unit_amount: target,
          recurring: { interval: full.recurring?.interval || interval },
          product: typeof full.product === "string" ? full.product : full.product?.id,
        },
      }];
  await stripe.subscriptions.update(fb.stripe_subscription_id, { items, proration_behavior: "create_prorations" });
  await admin.from("billing_payers")
    .update({ share_pct: pct, updated_at: new Date().toISOString() })
    .eq("family_id", familyId).eq("is_guarantor", true);
}

/** Handle a co-payer's subscription event: mirror it into billing_payers and
    (de)activate the guarantor's cost offset accordingly. */
// deno-lint-ignore no-explicit-any
async function syncCoPayer(sub: any) {
  const familyId = sub.metadata?.family_id;
  const email = (sub.metadata?.copayer_email || "").toLowerCase();
  if (!familyId || !email) { console.warn("[webhook] co-payer sub missing family/email", sub.id); return; }

  const status = payerStatusFrom(sub.status);
  const { data: existing } = await admin.from("billing_payers")
    .select("id, share_pct").eq("family_id", familyId).eq("email", email).maybeSingle();
  const sharePct = Number(sub.metadata?.share_pct) || existing?.share_pct || null;

  const row: Record<string, unknown> = {
    family_id: familyId, email, is_guarantor: false,
    stripe_customer_id: sub.customer as string, stripe_subscription_id: sub.id,
    status, updated_at: new Date().toISOString(),
  };
  if (sharePct) row.share_pct = sharePct;
  if (existing) await admin.from("billing_payers").update(row).eq("id", existing.id);
  else await admin.from("billing_payers").insert(row);

  try {
    if (status === "active") {
      await admin.from("invitations").update({ status: "accepted" })
        .eq("family_id", familyId).eq("email", email).eq("status", "pending");
      if (sharePct) await adjustGuarantorBase(familyId, 100 - sharePct); // guarantor covers the rest
    } else {
      // Lapse → grace_then_primary: the guarantor absorbs the full cost again.
      await adjustGuarantorBase(familyId, 100);
    }
  } catch (e) {
    console.error("[webhook] guarantor re-price failed:", (e as Error).message);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });

  const sig = req.headers.get("stripe-signature");
  const secret = env("STRIPE_WEBHOOK_SECRET");
  if (!sig || !secret) return new Response("Webhook not configured", { status: 500 });

  // deno-lint-ignore no-explicit-any
  let event: any;
  try {
    const body = await req.text();
    event = await stripe.webhooks.constructEventAsync(body, sig, secret);
  } catch (e) {
    console.error("[webhook] signature verification failed:", (e as Error).message);
    return new Response("Bad signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as any;
        if (sub.metadata?.payer_role === "co") await syncCoPayer(sub);
        else await syncSubscription(sub);
        break;
      }
      case "checkout.session.completed": {
        const s = event.data.object as any;
        if (s.subscription) {
          const sub = await stripe.subscriptions.retrieve(s.subscription as string);
          if (!sub.metadata?.family_id && s.metadata?.family_id) sub.metadata = s.metadata;
          if (sub.metadata?.payer_role === "co") await syncCoPayer(sub);
          else await syncSubscription(sub);
        }
        break;
      }
      default:
        break; // ignore the rest
    }
  } catch (e) {
    console.error("[webhook] handler error:", (e as Error).message);
    return new Response("Handler error", { status: 500 });
  }
  return new Response(JSON.stringify({ received: true }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});

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

const env = (k: string) => Deno.env.get(k) || "";
// deno-lint-ignore no-explicit-any
const stripe: any = new Stripe(env("STRIPE_SECRET_KEY"), {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

const SEAT_PRICES = new Set([env("STRIPE_PRICE_SEAT_MONTH"), env("STRIPE_PRICE_SEAT_YEAR")].filter(Boolean));

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
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    is_beta: isBeta,
    committed_until: committedUntil,
    paused_until: pausedUntil,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  }, { onConflict: "family_id" });
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
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object);
        break;
      case "checkout.session.completed": {
        const s = event.data.object as any;
        if (s.subscription) {
          const sub = await stripe.subscriptions.retrieve(s.subscription as string);
          if (!sub.metadata?.family_id && s.metadata?.family_id) sub.metadata = s.metadata;
          await syncSubscription(sub);
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

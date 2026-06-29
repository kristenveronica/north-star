// ============================================================================
// North Star — PUBLIC checkout (verify_jwt: OFF — see config.toml)
//
// Called by the public marketing/pricing page BEFORE the buyer has an account.
// It only (a) returns configured prices and (b) creates a Stripe Checkout
// Session. It never reads or writes app data, so running unauthenticated is safe.
//
// Flow:
//   public pricing page → POST { action:"prices" }          → show pricing
//   public pricing page → POST { action:"create", ... }     → redirect to Stripe
//   buyer pays → Stripe returns to APP_URL/?checkout_session={ID}
//   buyer signs up in the app → app calls billing "claim-subscription" { sessionId }
//   which links the paid subscription to their new family (verified by email).
//
// BETA PROMO: if the buyer enters the beta code (env BETA_PROMO_CODE) and the
// code window is still open (env BETA_PROMO_EXPIRES, ISO date), the subscription
// gets a 30-day FREE TRIAL (env BETA_PROMO_TRIAL_DAYS, default 30). A card is
// collected up front, so at day 30 they're billed the normal monthly/annual fee
// they chose — unless they cancel first. Outside the promo, checkout bills now.
//
// Required env:
//   STRIPE_SECRET_KEY
//   STRIPE_PRICE_BASE_MONTH  STRIPE_PRICE_BASE_YEAR
//   STRIPE_PRICE_SEAT_MONTH  STRIPE_PRICE_SEAT_YEAR
//   STRIPE_PRICE_AISEAT_MONTH  STRIPE_PRICE_AISEAT_YEAR
//   APP_URL            (where the app lives — buyers return here to sign up)
//   PUBLIC_SITE_URL    (marketing site — used for the cancel URL; falls back to APP_URL)
// Optional env (beta promo):
//   BETA_PROMO_CODE  BETA_PROMO_TRIAL_DAYS(=30)  BETA_PROMO_EXPIRES(ISO date)
// ============================================================================

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno&no-check";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const env = (k: string) => Deno.env.get(k) || "";

// deno-lint-ignore no-explicit-any
const stripe: any = new Stripe(env("STRIPE_SECRET_KEY"), {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const PRICES: Record<string, { base: string; seat: string; aiseat: string }> = {
  month:   { base: env("STRIPE_PRICE_BASE_MONTH"),   seat: env("STRIPE_PRICE_SEAT_MONTH"),   aiseat: env("STRIPE_PRICE_AISEAT_MONTH")   },
  quarter: { base: env("STRIPE_PRICE_BASE_QUARTER"), seat: env("STRIPE_PRICE_SEAT_QUARTER"), aiseat: env("STRIPE_PRICE_AISEAT_QUARTER") },
  year:    { base: env("STRIPE_PRICE_BASE_YEAR"),    seat: env("STRIPE_PRICE_SEAT_YEAR"),    aiseat: env("STRIPE_PRICE_AISEAT_YEAR")    },
};
const INTERVALS = ["month", "quarter", "year"];

/** Return amounts so the public page can show pricing without hard-coding it.
    Quarterly only appears once its prices are configured in Stripe (else null). */
async function getPrices() {
  const result: Record<string, Record<string, unknown>> = { month: {}, quarter: {}, year: {} };
  for (const interval of INTERVALS) {
    for (const key of ["base", "seat", "aiseat"] as const) {
      const id = PRICES[interval]?.[key] || "";
      if (!id) { result[interval][key] = null; continue; }
      try {
        const p = await stripe.prices.retrieve(id);
        result[interval][key] = { amount: p.unit_amount, currency: p.currency, interval: p.recurring?.interval || interval };
      } catch { result[interval][key] = null; }
    }
  }
  return json(result);
}

/** Is the supplied code the active beta promo, within its open window? */
function betaTrialDays(code: string): number {
  const want = env("BETA_PROMO_CODE").trim();
  if (!want || !code || code.trim().toLowerCase() !== want.toLowerCase()) return 0;
  const expires = env("BETA_PROMO_EXPIRES").trim();
  if (expires) {
    const exp = Date.parse(expires);
    // Compare against a request-time "now"; if the window has closed, no trial.
    if (!Number.isNaN(exp) && Date.parse(new Date().toISOString()) > exp) return 0;
  }
  const days = parseInt(env("BETA_PROMO_TRIAL_DAYS") || "30", 10);
  return Number.isFinite(days) && days > 0 ? days : 30;
}

async function createSession(payload: any) {
  const interval = INTERVALS.includes(payload?.interval) ? payload.interval : "month";
  const childSeats = Math.max(0, Math.floor(Number(payload?.childSeats) || 0)); // extra children beyond the 1 included
  const adultSeats = Math.max(0, Math.floor(Number(payload?.adultSeats) || 0)); // adult AI contributor seats
  const email = (payload?.email || "").toString().trim();
  const code = (payload?.promoCode || "").toString();

  const prices = PRICES[interval];
  if (!prices?.base) return json({ error: `No base price configured for '${interval}'.` }, 400);
  if (!email) return json({ error: "An email is required to start checkout." }, 400);

  const line_items: { price: string; quantity: number }[] = [{ price: prices.base, quantity: 1 }];
  if (childSeats > 0 && prices.seat)  line_items.push({ price: prices.seat,  quantity: childSeats });
  if (adultSeats > 0 && prices.aiseat) line_items.push({ price: prices.aiseat, quantity: adultSeats });

  const appUrl = env("APP_URL") || "http://localhost:8765";
  const siteUrl = env("PUBLIC_SITE_URL") || appUrl;
  const trialDays = betaTrialDays(code);

  // A buyer who redeems the beta code is a BETA family: exempt from the 12-month
  // commitment (they can leave freely). We stamp this on the subscription so the
  // webhook/claim can persist family_billing.is_beta.
  const isBeta = trialDays > 0;

  // deno-lint-ignore no-explicit-any
  const subscription_data: any = {
    metadata: { pending: "1", base_interval: interval, source: "public-checkout", beta: isBeta ? "1" : "0" },
  };
  if (trialDays > 0) {
    subscription_data.trial_period_days = trialDays;
    // If they somehow reach day 30 with no usable card, cancel rather than dunning.
    subscription_data.trial_settings = { end_behavior: { missing_payment_method: "cancel" } };
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: email,
    line_items,
    // Collect a card even during the trial, so billing resumes automatically at day 30.
    payment_method_collection: "always",
    allow_promotion_codes: false, // our beta code is handled here as a trial, not a Stripe coupon
    subscription_data,
    // Return into the APP so the buyer creates their account and we claim the sub.
    success_url: `${appUrl}/?checkout_session={CHECKOUT_SESSION_ID}#/welcome`,
    cancel_url: `${siteUrl}/?checkout=cancelled`,
    metadata: { pending: "1", base_interval: interval, child_seats: String(childSeats), adult_seats: String(adultSeats) },
  });

  return json({ url: session.url, trialDays });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!env("STRIPE_SECRET_KEY")) return json({ error: "Checkout is not configured." }, 500);

  try {
    const { action, payload } = await req.json();
    if (action === "prices") return await getPrices();
    if (action === "create") return await createSession(payload || {});
    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("[public-checkout] error:", e);
    return json({ error: (e as Error).message || "Checkout request failed" }, 500);
  }
});

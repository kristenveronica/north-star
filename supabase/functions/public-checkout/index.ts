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
// gets a FREE TRIAL. A card is collected up front, so when the trial ends they're
// billed the normal monthly/annual fee they chose — unless they cancel first.
// Outside the promo, checkout bills now.
//
// The trial can be defined two ways:
//   • BETA_PROMO_TRIAL_END (ISO date) — a FIXED end date: every beta family's
//     first charge lands on the same calendar day no matter when they sign up.
//     Preferred for a time-boxed beta. (Clamped to ≥3 days out per Stripe's rule.)
//   • BETA_PROMO_TRIAL_DAYS (int, default 30) — a rolling N-day trial from signup.
//     Used only when BETA_PROMO_TRIAL_END is not set.
//
// Required env:
//   STRIPE_SECRET_KEY
//   STRIPE_PRICE_BASE_MONTH  STRIPE_PRICE_BASE_YEAR
//   STRIPE_PRICE_SEAT_MONTH  STRIPE_PRICE_SEAT_YEAR
//   STRIPE_PRICE_AISEAT_MONTH  STRIPE_PRICE_AISEAT_YEAR
//   APP_URL            (where the app lives — buyers return here to sign up)
//   PUBLIC_SITE_URL    (marketing site — used for the cancel URL; falls back to APP_URL)
// Optional env (beta promo):
//   BETA_PROMO_CODE  BETA_PROMO_EXPIRES(ISO date)
//   BETA_PROMO_TRIAL_END(ISO date)  -or-  BETA_PROMO_TRIAL_DAYS(=30)
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

/** If `code` is the active beta promo (within its open window), return the trial
    config to apply: a fixed `trialEnd` (unix seconds) when BETA_PROMO_TRIAL_END is
    set, otherwise a rolling `trialDays`. Returns null when not eligible. */
function betaTrial(code: string): { trialEnd?: number; trialDays?: number } | null {
  const want = env("BETA_PROMO_CODE").trim();
  if (!want || !code || code.trim().toLowerCase() !== want.toLowerCase()) return null;

  const now = Date.now();
  const expires = env("BETA_PROMO_EXPIRES").trim();
  if (expires) {
    const exp = Date.parse(expires);
    if (!Number.isNaN(exp) && now > exp) return null; // code window has closed
  }

  // Preferred: a fixed trial-end date — same first-charge day for everyone.
  const endIso = env("BETA_PROMO_TRIAL_END").trim();
  if (endIso) {
    const end = Date.parse(endIso);
    if (!Number.isNaN(end)) {
      // Stripe requires the trial to be at least ~48h out; clamp up if we're
      // signing someone up very close to (or past) the configured end date.
      const minEnd = now + 3 * 24 * 60 * 60 * 1000;
      return { trialEnd: Math.floor(Math.max(end, minEnd) / 1000) };
    }
  }

  const days = parseInt(env("BETA_PROMO_TRIAL_DAYS") || "30", 10);
  return { trialDays: Number.isFinite(days) && days > 0 ? days : 30 };
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
  const trial = betaTrial(code);

  // A buyer who redeems the beta code is a BETA family: exempt from the 12-month
  // commitment (they can leave freely). We stamp this on the subscription so the
  // webhook/claim can persist family_billing.is_beta.
  const isBeta = !!trial;

  // deno-lint-ignore no-explicit-any
  const subscription_data: any = {
    metadata: { pending: "1", base_interval: interval, source: "public-checkout", beta: isBeta ? "1" : "0" },
  };
  if (trial?.trialEnd) {
    subscription_data.trial_end = trial.trialEnd;             // fixed calendar date
    subscription_data.trial_settings = { end_behavior: { missing_payment_method: "cancel" } };
  } else if (trial?.trialDays) {
    subscription_data.trial_period_days = trial.trialDays;    // rolling N days
    // If the trial ends with no usable card, cancel rather than dunning.
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
    // Return into the APP's SIGN-UP page so the buyer creates their account; the
    // session id is claimed on first hydrate (links the paid sub to their family).
    success_url: `${appUrl}/?checkout_session={CHECKOUT_SESSION_ID}#/signup`,
    cancel_url: `${siteUrl}/?checkout=cancelled#/pricing`,
    metadata: { pending: "1", base_interval: interval, child_seats: String(childSeats), adult_seats: String(adultSeats) },
  });

  return json({ url: session.url, isBeta, trialEnd: trial?.trialEnd, trialDays: trial?.trialDays });
}

/** Gateway helper for the sign-up page: does this email already have a LIVE
    subscription? Lets the app block account creation by people who haven't
    subscribed (they're sent to /pricing instead). Safe to run unauthenticated —
    it only returns a boolean, never any subscription detail. */
async function checkSubscription(payload: any) {
  const email = (payload?.email || "").toString().trim().toLowerCase();
  if (!email) return json({ active: false });
  const LIVE = ["active", "trialing", "past_due", "unpaid", "incomplete"];
  try {
    const customers = await stripe.customers.list({ email, limit: 5 });
    for (const c of customers.data) {
      const subs = await stripe.subscriptions.list({ customer: c.id, status: "all", limit: 10 });
      if (subs.data.some((s: any) => LIVE.includes(s.status))) return json({ active: true });
    }
  } catch (e) {
    // On a lookup error, fail OPEN is unsafe (would let anyone in); fail CLOSED
    // but signal it so the client can let them try checkout rather than hard-block.
    console.error("[public-checkout] check-subscription error:", e);
    return json({ active: false, error: "lookup_failed" });
  }
  return json({ active: false });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!env("STRIPE_SECRET_KEY")) return json({ error: "Checkout is not configured." }, 500);

  try {
    const { action, payload } = await req.json();
    if (action === "prices") return await getPrices();
    if (action === "create") return await createSession(payload || {});
    if (action === "check-subscription") return await checkSubscription(payload || {});
    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("[public-checkout] error:", e);
    return json({ error: (e as Error).message || "Checkout request failed" }, 500);
  }
});

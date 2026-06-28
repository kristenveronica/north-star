// ============================================================================
// North Star — Billing edge function (Stripe).  verify_jwt: ON
// Only signed-in parents call this. The Stripe secret never reaches the browser.
//
// Actions (POST { action, payload }):
//   create-checkout  { interval: 'month'|'year' }  → base subscription checkout
//                      (base plan includes 1 child). Returns { url }.
//   add-seat         {}  → add one extra child-profile seat to the active
//                      subscription (Stripe prorates). Returns { ok, extraSeats }.
//                      If no active base subscription, returns { needsBase:true }.
//   create-portal    {}  → Stripe Billing Portal session to manage/cancel.
//                      Returns { url }.
//
// Required env (set in Supabase → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY
//   STRIPE_PRICE_BASE_MONTH   STRIPE_PRICE_BASE_YEAR    (base plan, incl. 1 child)
//   STRIPE_PRICE_SEAT_MONTH   STRIPE_PRICE_SEAT_YEAR    (per extra child seat)
//   APP_URL                   (e.g. https://app.northstar... for success/cancel)
//   SUPABASE_URL  SUPABASE_ANON_KEY  SUPABASE_SERVICE_ROLE_KEY (auto-provided)
// ============================================================================

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno&no-check";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

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

const PRICES: Record<string, { base: string; seat: string }> = {
  month: { base: env("STRIPE_PRICE_BASE_MONTH"), seat: env("STRIPE_PRICE_SEAT_MONTH") },
  year:  { base: env("STRIPE_PRICE_BASE_YEAR"),  seat: env("STRIPE_PRICE_SEAT_YEAR")  },
};

// Per-adult AI contributor seat (co-owners + contributors who can generate/request reports).
const AISEAT: Record<string, string> = {
  month: env("STRIPE_PRICE_AISEAT_MONTH"),
  year:  env("STRIPE_PRICE_AISEAT_YEAR"),
};
const AI_PERMS = ["contrib:generate", "contrib:reports"];

// Service-role client for writing the family_billing mapping (bypasses RLS).
const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

/** Resolve the caller's user + their family_id from the JWT. */
async function resolveFamily(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return { user: null, familyId: null, email: "" };
  const { data: m } = await userClient
    .from("family_members").select("family_id")
    .eq("user_id", user.id).order("created_at", { ascending: true }).limit(1);
  return { user, familyId: m?.[0]?.family_id || null, email: user.email || "" };
}

/** Get-or-create the family's Stripe customer + family_billing row. */
async function ensureCustomer(familyId: string, email: string): Promise<string> {
  const { data: row } = await admin.from("family_billing")
    .select("stripe_customer_id").eq("family_id", familyId).maybeSingle();
  if (row?.stripe_customer_id) return row.stripe_customer_id;

  const customer = await stripe.customers.create({
    email: email || undefined,
    metadata: { family_id: familyId },
  });
  await admin.from("family_billing").upsert(
    { family_id: familyId, stripe_customer_id: customer.id, status: "none" },
    { onConflict: "family_id" },
  );
  return customer.id;
}

async function createCheckout(familyId: string, email: string, interval: string, seats = 0) {
  const prices = PRICES[interval];
  if (!prices?.base) return json({ error: `No base price configured for '${interval}'.` }, 400);
  const customerId = await ensureCustomer(familyId, email);
  const appUrl = env("APP_URL") || "http://localhost:8765";

  // Base plan (includes 1 child) + optional extra seats so a parent adding their
  // 2nd child can subscribe and unlock capacity in a single checkout.
  const line_items: { price: string; quantity: number }[] = [{ price: prices.base, quantity: 1 }];
  if (seats > 0 && prices.seat) line_items.push({ price: prices.seat, quantity: seats });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items,
    success_url: `${appUrl}/#/children?billing=success`,
    cancel_url: `${appUrl}/#/children?billing=cancelled`,
    subscription_data: { metadata: { family_id: familyId, base_interval: interval } },
    metadata: { family_id: familyId, base_interval: interval },
    allow_promotion_codes: true,
  });
  return json({ url: session.url });
}

async function addSeat(familyId: string) {
  const { data: row } = await admin.from("family_billing")
    .select("stripe_subscription_id, base_interval, extra_seats, status")
    .eq("family_id", familyId).maybeSingle();

  if (!row?.stripe_subscription_id || !["active", "trialing"].includes(row.status)) {
    return json({ needsBase: true }); // must subscribe to the base plan first
  }
  const interval = row.base_interval || "month";
  const seatPrice = PRICES[interval]?.seat;
  if (!seatPrice) return json({ error: `No seat price configured for '${interval}'.` }, 400);

  const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
  const seatItem = sub.items.data.find((it: any) => it.price.id === seatPrice);

  if (seatItem) {
    await stripe.subscriptionItems.update(seatItem.id, {
      quantity: (seatItem.quantity || 0) + 1,
      proration_behavior: "create_prorations",
    });
  } else {
    await stripe.subscriptionItems.create({
      subscription: row.stripe_subscription_id,
      price: seatPrice,
      quantity: 1,
      proration_behavior: "create_prorations",
    });
  }
  // The webhook is the source of truth, but reflect immediately for snappy UX.
  const extraSeats = (row.extra_seats || 0) + 1;
  await admin.from("family_billing").update({ extra_seats: extraSeats, updated_at: new Date().toISOString() })
    .eq("family_id", familyId);
  return json({ ok: true, extraSeats });
}

// Count billable adult AI seats from ACTUAL membership (never trust the client):
// active members, excluding the Primary Owner, who can consume AI.
async function computeAiSeats(familyId: string): Promise<number> {
  const { data: members } = await admin.from("family_members")
    .select("role, is_primary, status, permissions").eq("family_id", familyId);
  return (members || []).filter((m: any) =>
    (m.status || "active") === "active" && !m.is_primary &&
    (m.role === "architect" || m.role === "co_architect" ||
     (Array.isArray(m.permissions) && m.permissions.some((p: string) => AI_PERMS.includes(p))))
  ).length;
}

// Reconcile the Stripe AI-seat quantity with membership. Owner-gated by the
// caller's role; seat count computed server-side. Graceful no-op until the AI
// seat price + an active base subscription exist.
async function syncAiSeats(familyId: string, userId: string) {
  const { data: me } = await admin.from("family_members")
    .select("role").eq("family_id", familyId).eq("user_id", userId).maybeSingle();
  if (!me || !["architect", "co_architect"].includes(me.role)) {
    return json({ error: "Only owners can change billing seats." }, 403);
  }
  const desired = await computeAiSeats(familyId);

  const { data: row } = await admin.from("family_billing")
    .select("stripe_subscription_id, base_interval, status").eq("family_id", familyId).maybeSingle();
  if (!row?.stripe_subscription_id || !["active", "trialing"].includes(row.status)) {
    return json({ skipped: true, reason: "no_active_subscription", aiSeats: desired });
  }
  const interval = row.base_interval || "month";
  const price = AISEAT[interval];
  if (!price) return json({ skipped: true, reason: "no_aiseat_price", aiSeats: desired });

  const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
  const item = sub.items.data.find((it: any) => it.price.id === price);
  if (item) {
    await stripe.subscriptionItems.update(item.id, { quantity: desired, proration_behavior: "create_prorations" });
  } else if (desired > 0) {
    await stripe.subscriptionItems.create({ subscription: row.stripe_subscription_id, price, quantity: desired, proration_behavior: "create_prorations" });
  }
  return json({ ok: true, aiSeats: desired });
}

// Return the configured prices (amount + currency) so the app can SHOW pricing
// and compute a multi-child total before checkout. Missing prices come back null.
async function getPrices() {
  const result: Record<string, Record<string, unknown>> = { month: {}, year: {} };
  for (const interval of ["month", "year"]) {
    const ids: [string, string][] = [
      ["base", PRICES[interval]?.base || ""],
      ["seat", PRICES[interval]?.seat || ""],
      ["aiseat", AISEAT[interval] || ""],
    ];
    for (const [key, id] of ids) {
      if (!id) { result[interval][key] = null; continue; }
      try {
        const p = await stripe.prices.retrieve(id);
        result[interval][key] = {
          amount: p.unit_amount,                  // smallest currency unit (e.g. cents)
          currency: p.currency,
          interval: p.recurring?.interval || interval,
        };
      } catch { result[interval][key] = null; }
    }
  }
  return json(result);
}

// Link a subscription PAID on the public pricing page (before the buyer had an
// account) to the now-signed-in user's family. Verified by matching the paying
// email to the caller's email. Idempotent; rejects a sub already owned elsewhere.
async function claimSubscription(familyId: string, userEmail: string, sessionId: string) {
  if (!sessionId) return json({ error: "Missing checkout session." }, 400);

  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription", "customer"] });
  const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!subId || !customerId) return json({ skipped: true, reason: "not_a_subscription" });

  // The paying email MUST match the signed-in user (Stripe verified it at checkout).
  const paidEmail = (session.customer_details?.email || session.customer_email || (session.customer as any)?.email || "").toLowerCase();
  if (!paidEmail || paidEmail !== (userEmail || "").toLowerCase()) {
    return json({ error: "email_mismatch" }, 403);
  }

  // Don't let one paid subscription be claimed by two different families.
  const cust = await stripe.customers.retrieve(customerId);
  const existingFam = (cust as any)?.metadata?.family_id;
  if (existingFam && existingFam !== familyId) {
    return json({ error: "This subscription is already linked to another account." }, 409);
  }

  // Tag Stripe customer + subscription with the family so future webhooks sync it.
  await stripe.customers.update(customerId, { metadata: { family_id: familyId } });
  const sub = await stripe.subscriptions.retrieve(subId);
  await stripe.subscriptions.update(subId, { metadata: { ...(sub.metadata || {}), family_id: familyId } });

  // Write the current shape into family_billing now (trigger sets the child limit).
  const seatIds = new Set([env("STRIPE_PRICE_SEAT_MONTH"), env("STRIPE_PRICE_SEAT_YEAR")].filter(Boolean));
  let extraSeats = 0;
  let interval: string | null = null;
  for (const item of sub.items.data) {
    if (seatIds.has(item.price.id)) extraSeats += item.quantity || 0;
    else if (item.price.recurring?.interval) interval = item.price.recurring.interval;
  }
  await admin.from("family_billing").upsert({
    family_id: familyId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subId,
    base_interval: interval === "year" ? "year" : "month",
    extra_seats: extraSeats,
    status: sub.status,
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "family_id" });

  return json({ ok: true, status: sub.status, trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null });
}

async function createPortal(familyId: string) {
  const { data: row } = await admin.from("family_billing")
    .select("stripe_customer_id").eq("family_id", familyId).maybeSingle();
  if (!row?.stripe_customer_id) return json({ error: "No billing account yet." }, 400);
  const appUrl = env("APP_URL") || "http://localhost:8765";
  const session = await stripe.billingPortal.sessions.create({
    customer: row.stripe_customer_id,
    return_url: `${appUrl}/#/settings`,
  });
  return json({ url: session.url });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!env("STRIPE_SECRET_KEY")) return json({ error: "Billing is not configured." }, 500);

  try {
    const { action, payload } = await req.json();
    const { user, familyId, email } = await resolveFamily(req);
    if (!familyId) return json({ error: "Not signed in to a family." }, 401);

    if (action === "get-prices")      return await getPrices();
    if (action === "claim-subscription") return await claimSubscription(familyId, email, (payload?.sessionId || "").toString());
    if (action === "create-checkout") return await createCheckout(familyId, email, payload?.interval || "month", Math.max(0, Number(payload?.seats) || 0));
    if (action === "add-seat")        return await addSeat(familyId);
    if (action === "sync-ai-seats")   return await syncAiSeats(familyId, user!.id);
    if (action === "create-portal")   return await createPortal(familyId);
    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("[billing] error:", e);
    return json({ error: (e as Error).message || "Billing request failed" }, 500);
  }
});

# Connecting Stripe ↔ Supabase (plain-English setup)

## The mental model (read this first)

You're working with **two separate dashboards**:

- **Stripe** (`dashboard.stripe.com`, in **Sandbox/Test** mode) — where your
  **prices** and **money** live. Each price and key has a unique **ID**.
- **Supabase** (`supabase.com/dashboard/project/dsioaopybvbfukouljej`) — where your
  app's **server code** (the edge functions) runs.

Setup = **copy a handful of IDs/keys OUT of Stripe and paste them INTO Supabase**,
so your server code knows *which* Stripe prices to charge and *how* to trust
messages from Stripe. That's the whole job. Nothing is copied the other way.

After pasting, you do **not** need to redeploy anything — the functions read
these values live.

---

## Where to paste (Supabase) — do this once, keep the tab open

1. Go to **supabase.com/dashboard** → open your **North Star** project.
2. Left sidebar → **Edge Functions** → **Secrets** tab.
   (If you don't see it there: **Project Settings** (gear) → **Edge Functions** → **Secrets**.)
3. For each row in the table below: **Add new secret** → paste the **Name**
   exactly as written → paste the **Value** you copied from Stripe → Save.

Names must match **exactly** (they're case-sensitive).

---

## The 11 values to copy from Stripe → paste into Supabase

| Secret name (paste in Supabase) | Where to get it in Stripe (Test mode) | Looks like |
|---|---|---|
| `STRIPE_SECRET_KEY` | **Developers → API keys → Secret key** → Reveal → copy | `sk_test_51…` |
| `STRIPE_WEBHOOK_SECRET` | **Workbench → Webhooks → (your endpoint) → Signing secret** → Reveal | `whsec_…` |
| `STRIPE_PRICE_BASE_MONTH` | Product **“North Star — Family plan”** → its **Monthly** price → copy price ID | `price_…` |
| `STRIPE_PRICE_BASE_YEAR` | Same product → its **Annual** price → copy price ID | `price_…` |
| `STRIPE_PRICE_SEAT_MONTH` | Product **“Child profile seat”** → **Monthly** price | `price_…` |
| `STRIPE_PRICE_SEAT_YEAR` | Same product → **Annual** price | `price_…` |
| `STRIPE_PRICE_AISEAT_MONTH` | Product **“Adult contributor seat”** → **Monthly** price | `price_…` |
| `STRIPE_PRICE_AISEAT_YEAR` | Same product → **Annual** price | `price_…` |
| `APP_URL` | *(not from Stripe — type it)* the app's address | `http://localhost:8765` |
| `PUBLIC_SITE_URL` | *(not from Stripe — type it)* the marketing/pricing page address | `http://localhost:8765` |
| `ANTHROPIC_API_KEY` | *(already set — leave it)* | `sk-ant-…` |

### How to copy a Price ID
Stripe → **Product catalogue** → click a product → you'll see its prices (e.g.
"$X / month" and "$Y / year"). Click a price → its **API ID** (`price_…`) is shown
and copyable. Each product has **two** prices, so you'll copy **6 price IDs total**.
(Shortcut: the **“Export prices”** button gives you all of them in one CSV.)

---

## Optional: the 30-day beta promo (3 more secrets)

These turn a promo code into a **30-day free trial** (card collected up front;
the chosen monthly/annual plan auto-bills at day 30 unless they cancel):

| Secret name | Value to type | Notes |
|---|---|---|
| `BETA_PROMO_CODE` | a code you invent, e.g. `NSBETA` | testers type this on the pricing page |
| `BETA_PROMO_TRIAL_DAYS` | `30` | length of the free trial |
| `BETA_PROMO_EXPIRES` | an ISO date ~30 days out, e.g. `2026-07-28` | after this date the code stops granting trials |

(These aren't Stripe coupons — North Star applies the trial itself, so there's
nothing to create in Stripe for the promo.)

---

## Order of operations

1. Create the **webhook** (Stripe → Workbench → Webhooks) → copy its signing secret.
   Endpoint URL: `https://dsioaopybvbfukouljej.supabase.co/functions/v1/stripe-webhook`
2. Copy the **secret key** + **6 price IDs**.
3. Paste **all of them** + `APP_URL` (+ optional promo secrets) into Supabase Secrets.
4. (Optional) Clear the **“Needs info”** tax category on each Stripe product.
5. Test (below).

---

## How to test the two flows

### A) In-app upgrade (existing logged-in parent)
1. Hard-reload the app.
2. Children → **Add a child profile** → the plan modal now shows **live prices**.
3. Pick a count + interval → **Continue to payment** → pay with test card
   `4242 4242 4242 4242` (any future expiry, any CVC).
4. You're returned to the app; **Manage subscription** now opens the Stripe portal.

### B) Public pricing page → new account (the new pathway)
1. Open **`pricing.html`** (the stand-in for your future marketing site).
2. Enter an email you'll sign up with, choose plan/children/adults, optionally
   type your `BETA_PROMO_CODE` → **Continue to checkout** → pay with `4242…`.
3. You're returned to the app at `/?checkout_session=…#/welcome`.
4. **Sign up using the same email** → on first load the app **links the paid
   subscription to your new family automatically** (check Settings → Subscription).

> Why it must be the same email: the link is verified by matching the paying
> email to the account email — that's the security check.

---

## Going live (later)
Everything above is in **Test mode**. At launch you redo steps 1–3 in **Live mode**
(new `sk_live_…` key, new live price IDs, a new live webhook secret) and update the
same Supabase secret names, plus set `APP_URL`/`PUBLIC_SITE_URL` to the real URLs.

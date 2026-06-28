# North Star — Billing (Stripe) setup

Subscription model:
- **Base account** is a paid subscription that **includes 1 child profile**.
- **Additional child profiles** are quantity-based **add-on seats**.
- Parent chooses **monthly or annual** at checkout; seats use the same interval.
- Entitlement: `family_profiles.child_profile_limit = 1 + extra seats` — set
  server-side by the Stripe webhook. The client only ever **reads** it.

## 1. Stripe dashboard
Create **one product** ("North Star") with **two recurring prices** for the base
plan and **two** for the seat:

| Env var | What it is |
|---|---|
| `STRIPE_PRICE_BASE_MONTH` | Base plan, monthly (includes 1 child) |
| `STRIPE_PRICE_BASE_YEAR`  | Base plan, annual |
| `STRIPE_PRICE_SEAT_MONTH` | Additional child seat, monthly |
| `STRIPE_PRICE_SEAT_YEAR`  | Additional child seat, annual |

Set the actual dollar amounts on these prices in Stripe — no amounts are hard-coded.
Enable the **Billing Customer Portal** (Settings → Billing → Customer portal) so
"Manage subscription" works.

## 2. Supabase secrets (Edge Functions → Secrets)
```
STRIPE_SECRET_KEY=sk_live_...            # or sk_test_... while testing
STRIPE_WEBHOOK_SECRET=whsec_...          # from the webhook you create in step 4
STRIPE_PRICE_BASE_MONTH=price_...
STRIPE_PRICE_BASE_YEAR=price_...
STRIPE_PRICE_SEAT_MONTH=price_...
STRIPE_PRICE_SEAT_YEAR=price_...
APP_URL=https://your-app-url            # used for checkout success/cancel + portal return
```
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.

## 3. Apply migrations
```
0010_child_profile_entitlements.sql   # child_profile_limit + hard insert cap
0011_billing.sql                       # family_billing table + entitlement trigger
```
(These weren't applied automatically — the Supabase MCP was disconnected when they
were written. Apply them via the MCP `apply_migration` or `supabase db push`.)

## 4. Deploy functions + webhook
```
supabase functions deploy billing          # verify_jwt ON  (parent actions)
supabase functions deploy stripe-webhook    # verify_jwt OFF (see supabase/config.toml)
```
Then in Stripe → Developers → Webhooks, add an endpoint pointing at the deployed
`stripe-webhook` URL, subscribed to:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy its signing secret into `STRIPE_WEBHOOK_SECRET` (step 2).

## How the flow runs
- **1st child** works with no subscription (entitlement floors at 1 so beta/free
  families aren't locked out).
- Adding another child → upgrade prompt. If subscribed, `billing:add-seat` raises
  the seat quantity (Stripe prorates). If not subscribed, the parent picks
  monthly/annual and `billing:create-checkout` opens Stripe Checkout for the base
  plan **plus** the needed seat in one go.
- The **webhook** is the source of truth: on any subscription change it writes
  `family_billing`, and the `0011` trigger updates `child_profile_limit`.
- **Settings → Subscription** → "Manage subscription" opens the Stripe Billing Portal.

## Making the base plan a hard paywall (optional, later)
Today the entitlement floors at 1 child even without a subscription (beta-friendly).
To require a paid base plan before *any* child, change the `ELSE` branch in
`apply_billing_entitlement()` (migration 0011) from `1` to `0`, and lower the
`children` insert-cap default accordingly.

## Open design decisions — PARKED (2026-06-22, revisit before launch)
The current scaffold is the simple version: monthly/annual cadence, no commitment
term, no summer handling, basic refund stance. The following were raised and
deliberately deferred — implement once decided. Key reframe: **payment cadence
(how often charged) is separate from commitment term (minimum you pay for)**.

- **Payment cadences:** add **quarterly** alongside monthly/annual
  (needs `STRIPE_PRICE_*_QUARTER` for base + seat, and `'quarter'` added to the
  `family_billing.base_interval` check constraint).
- **Commitment term + instalments:** leaning toward a **12-month commitment** with
  three payment cadences (pay annually upfront = cheapest, or quarterly/monthly
  instalments held to the term via a Stripe **subscription schedule** with fixed
  iterations). Decide: commit-only, commit + flexible month-to-month, or no commitment.
- **Summer / holidays:** ~2-month break. Recommendation: **bake ~10 months of value
  into the annual price** rather than literally pausing — a fixed summer pause breaks
  across the AU (Dec–Jan) vs CA/US (Jun–Aug) beta cohort. Alternative: Stripe
  `pause_collection` with a family-set, hemisphere-aware window (more complexity).
- **Refund policy:** recommendation **30-day money-back guarantee, then term-committed
  (non-refundable for change of mind)**. ⚠️ Must be written to preserve **Australian
  Consumer Law** + Canadian provincial statutory guarantees — **get legal review**;
  this is not legal advice.

## Security notes
- `child_profile_limit` and `family_billing` are **service-role only** — no client
  RLS write policies. Clients can read their own billing row for status display.
- The `children` insert trigger (0010) hard-enforces the cap in the database, so the
  UI gate can't be bypassed by a crafted request.

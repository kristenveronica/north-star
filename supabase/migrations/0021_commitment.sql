-- ============================================================
-- 0021_commitment.sql — 12-month commitment + beta exemption.
--
-- North Star asks full-price families to commit to a 12-month rhythm: a full
-- year gives the family time to explore the platform and gives the platform
-- time to get to know the family. This is enforced SOFTLY — not a contractual
-- Stripe lock. A family can still leave, but only after a retention "gauntlet"
-- (commitment reminder → offer a pause → final confirmation) handled in-app.
--
-- Beta families (those who joined on the 30-day beta promo / trial) are EXEMPT:
-- they can leave freely with a simple confirm.
--
-- These columns are written ONLY by the service role (billing fn + webhook),
-- like the rest of family_billing. Families can read their own row.
-- ============================================================

alter table public.family_billing
  add column if not exists is_beta         boolean     not null default false,
  add column if not exists committed_until timestamptz,           -- null = no commitment (beta / not yet known)
  add column if not exists paused_until    timestamptz,           -- set while pause_collection is active
  add column if not exists cancel_at_period_end boolean not null default false;

-- ============================================================================
-- North Star — Split payments (blended families) · migration 0040
-- ----------------------------------------------------------------------------
-- Additive & safe. The billing_payers / invitations schema already exists
-- (migration 0019). This migration only adds the uniqueness the edge functions
-- rely on to upsert payer rows idempotently:
--
--   • one payer row per (family_id, email)  — lets billing/webhook upsert by
--     onConflict "family_id,email" (guarantor row + co-payer row are distinct
--     because their emails differ).
--   • at most one guarantor per family.
--
-- Emails are normalised to lower-case by the edge functions before write, so a
-- plain-column unique index is correct (and PostgREST on_conflict compatible).
-- ============================================================================

create unique index if not exists pay_family_email
  on billing_payers (family_id, email);

create unique index if not exists pay_one_guarantor
  on billing_payers (family_id) where is_guarantor;

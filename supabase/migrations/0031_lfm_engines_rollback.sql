-- ============================================================================
-- 0031 ROLLBACK · Living Family Model engine substrate
-- ----------------------------------------------------------------------------
-- Reverses 0031_lfm_engines.sql. Drops the two NEW tables and the columns ADDed
-- to `understandings`. Safe because 0031 was additive-only: no existing 0027
-- column was altered, so removing 0031's additions restores the pre-0031 shape
-- exactly. NOTE: dropping the tables/columns discards any data written to them.
-- ============================================================================

drop table if exists public.reports;
drop table if exists public.recommendations;

drop index if exists public.idx_understandings_surfaced;
drop index if exists public.idx_understandings_review;

alter table public.understandings drop column if exists provenance;
alter table public.understandings drop column if exists surfaced_at;
alter table public.understandings drop column if exists surface_status;
alter table public.understandings drop column if exists noticing;
alter table public.understandings drop column if exists review_at;

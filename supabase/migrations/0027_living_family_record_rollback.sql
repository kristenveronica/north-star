-- ============================================================================
-- 0027 ROLLBACK · remove the Living Family Model substrate.
-- Safe because 0027 is purely additive and (in Sprint 1) unpopulated by any
-- engine. Dropping the tables cascades their policies, indexes, and evidence.
-- WARNING: if any understanding/archive data has since been written, this
-- destroys it — check before running in a populated environment.
-- ============================================================================
drop table if exists public.understanding_evidence cascade;
drop table if exists public.understandings         cascade;
drop table if exists public.family_archive          cascade;

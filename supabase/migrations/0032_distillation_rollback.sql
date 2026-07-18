-- ============================================================================
-- 0032 ROLLBACK · Distillation
-- Drops the distill_family function. Additive-only (created no tables/columns),
-- so removing the function fully restores the pre-0032 state. Understanding rows
-- it may have written remain (they are valid data); delete them separately if a
-- clean slate is wanted:
--   delete from understandings where provenance='inferred' and domain='interest';
-- ============================================================================

drop function if exists public.distill_family(uuid, uuid);

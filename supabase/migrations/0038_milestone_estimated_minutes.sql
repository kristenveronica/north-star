-- ============================================================================
-- 0038 · milestone estimated_minutes — honest per-mission time
-- ----------------------------------------------------------------------------
-- Generation now sets an explicit estimatedMinutes for each mission (the real
-- time this child would spend doing all its steps well). It drives milestone
-- depth at generation time and is the foundation for daily-load intelligence
-- (summing minutes across projects to fill a target daily learning time).
-- Nullable + no default: existing milestones fall back to the momentum-points
-- estimate until regenerated.
-- ============================================================================

alter table public.milestones add column if not exists estimated_minutes int;

comment on column public.milestones.estimated_minutes is
  'Honest minutes for the child to complete the whole mission (all steps). Set by generation; null for legacy rows (fall back to momentum-based estimate).';

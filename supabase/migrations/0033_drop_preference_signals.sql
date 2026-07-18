-- ============================================================================
-- 0033 · Retire preference_signals — backfill into Archive, then drop
-- ----------------------------------------------------------------------------
-- The family learning loop is now the canonical Archive → Understanding path
-- (docs/lfm-architecture.md). preference_signals has no writers and, after the
-- teardown (commit 914b8dc), no code readers. This migration retires it.
--
-- DATA-LOSS IS A CARDINAL SIN (engineering-principles.md): we do NOT discard the
-- existing rows. Each is first PRESERVED as a canonical family_archive entry
-- (idempotent, md5-keyed), so its meaning survives — and, because an accepted
-- signal's project_snapshot carries `domains`, distillation can even use them.
-- Only then is the table dropped.
--
-- Mapping (accepted → project_decision; completed → milestone_progress; other →
-- feedback), preserving child/family scope, timestamp, snapshot, note, reasons.
-- ============================================================================

-- 1 · Preserve every preference_signals row as an Archive entry (idempotent)
insert into public.family_archive
  (id, family_id, scope, subject_id, source_type, occurred_at, metadata)
select
  md5('pref_backfill:'||ps.id)::uuid,
  ps.family_id,
  case when ps.child_id is not null then 'child' else 'family' end,
  ps.child_id,
  case ps.type
    when 'accepted'  then 'project_decision'
    when 'completed' then 'milestone_progress'
    else 'feedback'
  end,
  ps.created_at,
  jsonb_strip_nulls(jsonb_build_object(
    'event',    case ps.type when 'rejected' then 'declined' else ps.type end,
    'source',   'preference_signals_backfill',
    'proposed', nullif(ps.project_snapshot, '{}'::jsonb),
    'projectId', ps.project_id,
    'note',     nullif(ps.note, ''),
    'reasons',  case when jsonb_array_length(coalesce(ps.reasons,'[]'::jsonb)) > 0 then ps.reasons else null end
  ))
from public.preference_signals ps
on conflict (id) do nothing;

-- 2 · Drop the retired table (no writers, no readers)
drop table if exists public.preference_signals cascade;

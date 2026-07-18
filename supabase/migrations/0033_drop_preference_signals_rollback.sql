-- ============================================================================
-- 0033 ROLLBACK · Retire preference_signals
-- ----------------------------------------------------------------------------
-- Recreates the (empty) preference_signals table shell for schema parity if a
-- rollback is ever needed. NOTE: rollback does NOT restore the original rows into
-- this table — they were PRESERVED as family_archive entries
-- (metadata.source = 'preference_signals_backfill') by the forward migration and
-- remain there. No production code references this table any more (commit 914b8dc).
-- ============================================================================

create table if not exists public.preference_signals (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references public.families(id) on delete cascade,
  child_id       uuid references public.children(id) on delete cascade,
  type           text not null default 'rejected',
  reasons        jsonb not null default '[]'::jsonb,
  note           text,
  project_id     uuid,
  project_snapshot jsonb not null default '{}'::jsonb,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
alter table public.preference_signals enable row level security;
drop policy if exists preference_signals_rw on public.preference_signals;
create policy preference_signals_rw on public.preference_signals
  for all using (is_family_member(family_id)) with check (is_family_member(family_id));
grant select, insert, update, delete on public.preference_signals to authenticated;
revoke all on public.preference_signals from anon;

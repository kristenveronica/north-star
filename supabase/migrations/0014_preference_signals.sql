-- ============================================================
-- 0014_preference_signals.sql — The family learning loop.
--
-- One event log capturing how a family responds to generated projects:
--   • EXPLICIT — rejection reasons + optional notes (from the "Help North Star
--     Learn" modal).
--   • IMPLICIT — accepted / regenerated / edited / completed / abandoned /
--     milestone-completed / photo-uploaded / reward-selected …
-- Future project generation aggregates these into a richer understanding of
-- each family's preferences. Capture now; deepen AI use over time.
-- Family-scoped, RLS-protected via is_family_member().
-- ============================================================

create table if not exists public.preference_signals (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references public.families(id) on delete cascade,
  child_id         uuid references public.children(id) on delete cascade,
  type             text not null default 'rejected',  -- rejected | accepted | regenerated | edited | completed | abandoned | milestone-completed | photo-uploaded | reward-selected
  reasons          jsonb not null default '[]',        -- explicit selected reasons
  note             text,                               -- explicit free text
  project_id       uuid references public.projects(id) on delete set null,
  project_snapshot jsonb not null default '{}',         -- size/domains/pathway/cost/etc. for pattern learning
  metadata         jsonb not null default '{}',
  created_at       timestamptz not null default now()
);
create index if not exists preference_signals_family_idx on public.preference_signals(family_id);
create index if not exists preference_signals_child_idx  on public.preference_signals(child_id);
create index if not exists preference_signals_type_idx   on public.preference_signals(type);

alter table public.preference_signals enable row level security;
drop policy if exists preference_signals_rw on public.preference_signals;
create policy preference_signals_rw on public.preference_signals
  for all using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));

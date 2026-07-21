-- ============================================================================
-- 0034 · Daily Guide line — once-per-day cache
-- ----------------------------------------------------------------------------
-- The child dashboard greets the child with ONE warm, honest line from their
-- Guide ("it remembers me"). It is generated at most once per child per local
-- day and cached here, so the AI is called ~1×/child/day (cost + consistency:
-- the line must not change if they reopen the portal later the same day).
--
-- Keyed by (child_id, local_date) where local_date is the CHILD's local day,
-- passed by the client — the function runs in UTC and must not roll the day at
-- the wrong hour. Written by the `child-portal` edge function via the service
-- role. RLS is ENABLED with NO policies, so the table is service-role-only
-- (anon/authenticated clients can neither read nor write it).
-- ============================================================================

create table if not exists public.daily_guide (
  child_id   uuid        not null references public.children(id) on delete cascade,
  local_date date        not null,
  line       text        not null,
  created_at timestamptz not null default now(),
  primary key (child_id, local_date)
);

alter table public.daily_guide enable row level security;
-- Intentionally no policies: only the service role (edge function) may touch it.

comment on table public.daily_guide is
  'Cache of the once-per-day child Guide greeting line, keyed (child_id, local_date). Written by the child-portal edge function via service role; RLS-enabled with no policies = service-role-only.';

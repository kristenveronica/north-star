-- ============================================================
-- 0013_rhythm_reflections_media_calendar.sql
-- Long-term architecture for the Family Rhythm Engine + Reflection System.
--
-- Phase 1 = structure + persistence only. No AI generation, no workload
-- rebalancing, no video rendering yet — these tables/columns are the
-- foundation those systems will layer onto without a backend redesign.
--
-- The app already works on these shapes via localStorage; this migration
-- makes them cloud-synced + RLS-protected per family. All family-scoped and
-- protected by the existing is_family_member() helper.
-- ============================================================

-- 1) Family Rhythm config (school year, hemisphere, days/hours, learning window).
alter table public.family_profiles
  add column if not exists rhythm jsonb not null default '{}'::jsonb;

-- 2) Reflection reports — monthly / quarterly / annual (distinct from milestone
--    reflections). Dates are derived from each family's school-year config.
create table if not exists public.reflection_reports (
  id                  uuid primary key default gen_random_uuid(),
  family_id           uuid not null references public.families(id) on delete cascade,
  child_id            uuid references public.children(id) on delete cascade,
  type                text not null check (type in ('monthly','quarterly','annual')),
  school_year         text,
  quarter             int  check (quarter between 1 and 4),
  generated_date      timestamptz,
  status              text not null default 'scheduled' check (status in ('scheduled','generating','ready')),
  summary             text,
  strengths           jsonb not null default '[]',
  growth_opportunities jsonb not null default '[]',
  ai_observations     jsonb not null default '[]',
  suggested_next_steps jsonb not null default '[]',
  metadata            jsonb not null default '{}',
  created_at          timestamptz not null default now()
);
create index if not exists reflection_reports_family_idx on public.reflection_reports(family_id);
create index if not exists reflection_reports_child_idx  on public.reflection_reports(child_id);

-- 3) Media assets — photos/videos/voice/docs linked to projects/milestones.
--    The actual bytes live in a Supabase Storage bucket (see note below); this
--    table is the index that feeds Annual Reflections + the Annual Video.
create table if not exists public.media_assets (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  child_id      uuid references public.children(id) on delete cascade,
  project_id    uuid references public.projects(id) on delete set null,
  milestone_id  uuid references public.milestones(id) on delete set null,
  kind          text not null default 'photo' check (kind in ('photo','video','voice','document')),
  storage_path  text,           -- path within the Storage bucket
  caption       text,
  captured_at   timestamptz,
  school_year   text,
  metadata      jsonb not null default '{}',  -- size, mime, dimensions, duration, compression info
  created_at    timestamptz not null default now()
);
create index if not exists media_assets_family_idx on public.media_assets(family_id);
create index if not exists media_assets_child_idx  on public.media_assets(child_id);

-- 4) Calendar events — family-added activities (dance/sport/music/church/…) and,
--    in future, imports from external calendars (Google/Apple/Outlook).
create table if not exists public.calendar_events (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families(id) on delete cascade,
  child_id     uuid references public.children(id) on delete cascade,
  type         text not null default 'event',
  title        text not null,
  starts_at    timestamptz,
  ends_at      timestamptz,
  all_day      boolean not null default false,
  recurrence   text,            -- future: RRULE
  source       text not null default 'manual' check (source in ('manual','google','apple','outlook')),
  external_id  text,            -- de-dupe key for external imports
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create index if not exists calendar_events_family_idx on public.calendar_events(family_id);

-- 5) RLS — a family only ever sees its own rows.
do $$
declare t text;
begin
  foreach t in array array['reflection_reports','media_assets','calendar_events'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I_rw on public.%I;', t, t);
    execute format(
      'create policy %I_rw on public.%I for all using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));',
      t, t);
  end loop;
end$$;

-- 6) Storage bucket for media bytes (run once; here for reference — create via
--    dashboard or storage API). Bucket: 'family-media', private, RLS by family path.
--   insert into storage.buckets (id, name, public) values ('family-media','family-media', false)
--     on conflict do nothing;
--   Policies should scope object paths to `${family_id}/...` via is_family_member().

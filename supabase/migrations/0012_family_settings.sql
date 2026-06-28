-- ============================================================
-- 0012_family_settings.sql — Family Settings (practical real-world context).
--
-- The beta app stores Family Settings denormalized on EXISTING, already-RLS'd
-- columns, so most of this is live today with no schema change:
--   • Home Location        → family_profiles.location   (jsonb)   [0008]
--   • Family Members        → family_profiles.relationships (jsonb)[0009]
--   • Travel / Worldschool  → family_profiles.travel     (jsonb)   [0008]
--   • Faith on/off + tradition → family_profiles.faith_enabled / faith_tradition
--   • Child Mobility        → children.mobility_profile  (jsonb)   [0008]
--
-- This migration adds the ONE missing piece (extended faith detail) and the
-- forward-looking NORMALISED tables for when these move off jsonb. Everything
-- is scoped to the family and protected by the existing is_family_member() RLS.
-- (org_id columns are included nullable for the future white-label tenant layer;
-- the current tenant boundary is the family.)
-- ============================================================

-- 1) Extended faith detail (denomination, church name, website, notes).
alter table public.family_profiles
  add column if not exists faith jsonb not null default '{}'::jsonb;

-- 2) Future-ready normalised tables (not yet used by the beta app, which uses
--    the jsonb columns above — kept in sync-ready shape for a later migration).

create table if not exists public.family_settings (
  family_id  uuid primary key references public.families(id) on delete cascade,
  org_id     uuid,
  travel_mode text not null default 'off' check (travel_mode in ('off','short','long','fulltime')),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_locations (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families(id) on delete cascade,
  org_id     uuid,
  kind       text not null default 'home',   -- home | other
  display    text, city text, region text, country text, postcode text,
  latitude   double precision, longitude double precision,
  created_at timestamptz not null default now()
);

create table if not exists public.travel_destinations (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families(id) on delete cascade,
  org_id     uuid,
  city text, country text,
  latitude double precision, longitude double precision,
  arrival date, departure date,
  preference text default 'both' check (preference in ('local','projects','both')),
  position int default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.faith_settings (
  family_id   uuid primary key references public.families(id) on delete cascade,
  org_id      uuid,
  enabled     boolean not null default false,
  tradition   text, denomination text, church_name text, church_website text, notes text,
  updated_at  timestamptz not null default now()
);

create table if not exists public.child_mobility_settings (
  child_id    uuid primary key references public.children(id) on delete cascade,
  family_id   uuid not null references public.families(id) on delete cascade,
  org_id      uuid,
  permissions text[] not null default '{}',
  notes       text,
  updated_at  timestamptz not null default now()
);

-- (family_members already exists from 0008; the beta uses the relationships
--  jsonb. No new family_members table is created here to avoid a name clash.)

-- 3) RLS: a family can only ever see/modify its own settings.
do $$
declare t text;
begin
  foreach t in array array[
    'family_settings','family_locations','travel_destinations','faith_settings','child_mobility_settings'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I_rw on public.%I;', t, t);
    execute format(
      'create policy %I_rw on public.%I for all using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));',
      t, t
    );
  end loop;
end$$;

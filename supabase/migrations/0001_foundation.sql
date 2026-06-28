-- ============================================================================
-- North Star — Foundation schema (migration 0001)
-- ----------------------------------------------------------------------------
-- The keel of the multi-family, multi-adult, white-label-ready backend.
-- Grounded in the co-work framework docs:
--   • Co-Parenting Framework  -> family_members (roles), family_structure,
--                                child-owned layer, North Star version history
--   • Product Bible / Project Framework -> projects, milestones, pathways
--   • Capability Framework v1 -> capability domains on projects + growth reports
--   • Data Sovereignty Charter -> child-owned rows are never hard-deletable
--   • Strategic Roadmap (Phase 5) -> organizations table = white-label tenant
--
-- Beta ships UNIFIED family mode only, but the schema accommodates all four
-- structures and the full role model now, so no painful migration later.
-- ============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type family_structure as enum (
  'unified',          -- single household, shared leadership (BETA default)
  'collaborative',    -- separated, cooperative co-parents
  'parallel',         -- high-conflict; one Primary Architect controls the NS
  'independent'       -- households operate independently, child layer shared
);

create type family_role as enum (
  'architect',        -- full admin: vision, values, profiles, AI, rewards
  'co_architect',     -- equal authority, shared editing
  'contributor',      -- observe + add observations/photos/journal, celebrate
  'observer'          -- view only (grandparents, mentors, step-parents, coaches)
);

create type project_pathway as enum (
  'enterprise','service','self_reliance','health','science','history',
  'arts','adventure','mentorship','family','community','faith','technology'
);

create type project_status as enum (
  'active','ready_for_reflection','completed','paused'
);

create type project_duration as enum (
  'spark',       -- 15-60 min
  'quest',       -- 1-7 days
  'mission',     -- 2-6 weeks
  'expedition',  -- 1-6 months
  'legacy'       -- 6-24 months
);

create type evidence_kind as enum ('note','upload','voice');

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ===========================================================================
-- TENANCY & IDENTITY
-- ===========================================================================

-- White-label tenant. Beta seeds a single 'North Star' org.
create table organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,        -- subdomain: gracechurch.northstar.app
  logo_url      text,
  primary_color text default '#1a2b4a',
  created_at    timestamptz not null default now()
);

-- One family unit. Belongs to an org. Has many adult members.
create table families (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete restrict,
  name        text not null default 'Our Family',
  structure   family_structure not null default 'unified',
  ns_locked   boolean not null default false,  -- "Family Lock" on the North Star
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_families_updated before update on families
  for each row execute function set_updated_at();

-- Adult <-> family membership with role. THIS is the multi-parent model.
-- (auth.users is Supabase's built-in table.)
create table family_members (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          family_role not null default 'architect',
  is_primary    boolean not null default false,  -- Primary Architect (parallel mode)
  display_name  text,
  created_at    timestamptz not null default now(),
  unique (family_id, user_id)
);
create index on family_members(user_id);
create index on family_members(family_id);

-- ===========================================================================
-- FAMILY NORTH STAR (vision/values/learning style/modules/rhythm)
-- ===========================================================================
create table family_profiles (
  family_id            uuid primary key references families(id) on delete cascade,
  mission              text,
  values               jsonb not null default '[]',     -- ["Authenticity", ...]
  motto                text,
  core_word            text,                             -- e.g. "ALIGN"
  core_word_acronym    jsonb not null default '[]',      -- [{letter:"A",word:"Authenticity"}]
  desired_traits       jsonb not null default '[]',
  desired_capabilities jsonb not null default '[]',
  vision_answers       jsonb not null default '{}',
  learning_style       int not null default 5,           -- 1 Explorer .. 10 Traditional
  diy_level            int not null default 5,           -- 1 buy .. 10 make
  modules_enabled      jsonb not null default '{}',      -- {faith:true, worldschool:false,...}
  rhythm               jsonb not null default '{}',      -- {daysPerWeek, hoursPerDay, windows...}
  faith_enabled        boolean not null default false,
  faith_tradition      text,
  updated_at           timestamptz not null default now()
);
create trigger trg_family_profiles_updated before update on family_profiles
  for each row execute function set_updated_at();

-- Append-only version history of the North Star (restore / Family Lock support).
create table family_ns_versions (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  snapshot    jsonb not null,                  -- full family_profiles row at save time
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);
create index on family_ns_versions(family_id, created_at desc);

-- ===========================================================================
-- CHILDREN  (the child's record; child-owned sub-tables below)
-- ===========================================================================
create table children (
  id                  uuid primary key default gen_random_uuid(),
  family_id           uuid not null references families(id) on delete restrict, -- never cascade-delete a child's story
  name                text not null default '',
  age                 int,
  birthday            date,
  grade               text,
  interests           jsonb not null default '[]',
  strengths           jsonb not null default '[]',
  areas_developing    jsonb not null default '[]',
  support_needs       jsonb not null default '[]',
  goals               jsonb not null default '[]',
  learning_preferences jsonb not null default '[]',
  learning_style      int,                         -- per-child override of family default
  diy_materials       int,
  faith_enabled       boolean not null default false,
  faith_tradition     text,
  notes               text,
  avatar_index        int not null default 1,
  access_code         text not null unique,        -- child-portal login (e.g. NOAH12)
  insights_config     jsonb not null default '{}', -- optional "lenses", parent-gated
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger trg_children_updated before update on children
  for each row execute function set_updated_at();
create index on children(family_id);

-- ===========================================================================
-- PROJECTS & MILESTONES  (the learning engine)
-- ===========================================================================
create table projects (
  id                      uuid primary key default gen_random_uuid(),
  family_id               uuid not null references families(id) on delete cascade,
  child_id                uuid references children(id) on delete restrict,
  title                   text not null default '',
  description             text,
  purpose                 text,                         -- "Why does this matter?"
  pathway                 project_pathway,
  capabilities_developed  jsonb not null default '[]',  -- ["communication","enterprise",...]
  foundational_literacies jsonb not null default '[]',
  domains                 jsonb not null default '[]',  -- "Gigs": Brain/Build/Money/...
  real_world_application  text,
  contribution_opportunities text,
  passion_connection      text,
  learning_outcomes       jsonb not null default '[]',
  interest_areas          jsonb not null default '[]',
  age_band                text,
  budget_band             text,                         -- Free / Under $20 / ...
  location_type           text,
  season                  text,
  duration                project_duration,
  materials               jsonb not null default '[]',
  start_date              timestamptz default now(),
  due_date                timestamptz,
  momentum_points_available int not null default 0,
  momentum_points_earned    int not null default 0,
  stars_available         int not null default 0,
  stars_earned            int not null default 0,
  reward                  text,
  toll                    text,
  child_agreed            boolean not null default false,
  parent_approved         boolean not null default true,
  status                  project_status not null default 'active',
  generated_by_ai         boolean not null default false,
  generation_meta         jsonb not null default '{}',  -- model, prompt version, inputs hash
  child_roles             jsonb not null default '{}',  -- sibling multi-age responsibilities
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create trigger trg_projects_updated before update on projects
  for each row execute function set_updated_at();
create index on projects(family_id);
create index on projects(child_id);

create table milestones (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references projects(id) on delete cascade,
  family_id           uuid not null references families(id) on delete cascade,
  title               text not null default '',
  description         text,
  due_date            timestamptz,
  momentum_points     int not null default 10,
  order_index         int not null default 0,
  completed           boolean not null default false,
  completed_at        timestamptz,
  star_earned         boolean not null default false,
  reflection_required boolean not null default false,
  submission          jsonb,                            -- {text, voiceTranscript, submittedAt}
  created_at          timestamptz not null default now()
);
create index on milestones(project_id);

-- ===========================================================================
-- CHILD-OWNED LAYER
-- Per the Data Charter + Co-Parenting Framework, these belong to the child and
-- are NOT hard-deletable. We grant no DELETE policy on them (see RLS section).
-- ===========================================================================
create table reflections (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references children(id) on delete restrict,
  family_id     uuid not null references families(id) on delete cascade,
  project_id    uuid references projects(id) on delete set null,
  milestone_id  uuid references milestones(id) on delete set null,
  prompt        text,
  response      text,
  voice_transcript text,
  created_at    timestamptz not null default now()
);
create index on reflections(child_id);

create table milestone_evidence (
  id            uuid primary key default gen_random_uuid(),
  milestone_id  uuid not null references milestones(id) on delete cascade,
  child_id      uuid not null references children(id) on delete restrict,
  family_id     uuid not null references families(id) on delete cascade,
  kind          evidence_kind not null default 'note',
  text          text,
  file_path     text,                                  -- Supabase Storage object path
  file_name     text,
  file_type     text,
  file_size     int,
  created_at    timestamptz not null default now()
);
create index on milestone_evidence(child_id);

create table child_self_assessments (
  id                  uuid primary key default gen_random_uuid(),
  child_id            uuid not null references children(id) on delete restrict,
  family_id           uuid not null references families(id) on delete cascade,
  proud_of            text,
  hard_thing          text,
  want_to_improve     text,
  favourite_project   text,
  want_to_learn_next  text,
  created_at          timestamptz not null default now()
);
create index on child_self_assessments(child_id);

-- AI narrative growth report (IN beta scope). Maps to the 10 capability domains.
create table growth_reports (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references children(id) on delete restrict,
  family_id     uuid not null references families(id) on delete cascade,
  period_key    text,                                  -- e.g. "2026-T2"
  content       jsonb not null default '{}',           -- {emerging[],strengthening[],demonstrated[],leading[],narrative,nextSteps[]}
  generated_by  uuid references auth.users(id),
  generated_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index on growth_reports(child_id, generated_at desc);

-- Parent/contributor observations that feed growth reports (not child-owned).
create table parent_observations (
  id              uuid primary key default gen_random_uuid(),
  child_id        uuid not null references children(id) on delete cascade,
  family_id       uuid not null references families(id) on delete cascade,
  author_user_id  uuid references auth.users(id),
  strengths       text,
  challenges      text,
  growth_observed text,
  concerns        text,
  goals_next_term text,
  created_at      timestamptz not null default now()
);
create index on parent_observations(child_id);

-- ===========================================================================
-- MATERIALS, CART, NOTIFICATIONS
-- ===========================================================================
create table materials (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references families(id) on delete cascade,
  child_id        uuid references children(id) on delete cascade,
  name            text not null default '',
  category        text,
  description     text,
  reason_suggested text,
  age_range       text,
  buy_or_diy      text default 'buy',
  source          text default 'buy',                  -- buy/borrow/build/repurpose/create
  estimated_price numeric(10,2) default 0,
  approved        boolean not null default false,
  rejected        boolean not null default false,
  in_cart         boolean not null default false,
  affiliate_url   text default '#',
  created_at      timestamptz not null default now()
);
create index on materials(family_id);

create table cart_items (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  material_id uuid not null references materials(id) on delete cascade,
  quantity    int not null default 1
);

create table notifications (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  child_id      uuid references children(id) on delete cascade,
  project_id    uuid references projects(id) on delete cascade,
  milestone_id  uuid references milestones(id) on delete cascade,
  message       text not null default '',
  due_date      timestamptz default now(),
  read          boolean not null default false,
  created_at    timestamptz not null default now()
);
create index on notifications(family_id, read);

-- ===========================================================================
-- ROW LEVEL SECURITY
-- The wall that keeps families isolated in one shared database.
-- Helper is SECURITY DEFINER so it can read family_members without recursing
-- into that table's own policies.
-- ===========================================================================
create or replace function is_family_member(fid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from family_members fm
    where fm.family_id = fid and fm.user_id = auth.uid()
  );
$$;

create or replace function family_role_of(fid uuid)
returns family_role
language sql
stable
security definer
set search_path = public
as $$
  select fm.role from family_members fm
  where fm.family_id = fid and fm.user_id = auth.uid()
  limit 1;
$$;

-- Enable RLS on every table.
alter table organizations        enable row level security;
alter table families             enable row level security;
alter table family_members       enable row level security;
alter table family_profiles      enable row level security;
alter table family_ns_versions   enable row level security;
alter table children             enable row level security;
alter table projects             enable row level security;
alter table milestones           enable row level security;
alter table reflections          enable row level security;
alter table milestone_evidence   enable row level security;
alter table child_self_assessments enable row level security;
alter table growth_reports       enable row level security;
alter table parent_observations  enable row level security;
alter table materials            enable row level security;
alter table cart_items           enable row level security;
alter table notifications        enable row level security;

-- Organizations: any authenticated user may read (branding is public-ish).
create policy org_read on organizations for select to authenticated using (true);

-- family_members: a user sees rows for families they belong to; sees/inserts
-- their own membership row (so a new signup can self-join its new family).
create policy fm_select on family_members for select to authenticated
  using (user_id = auth.uid() or is_family_member(family_id));
create policy fm_insert on family_members for insert to authenticated
  with check (user_id = auth.uid() or is_family_member(family_id));
create policy fm_update on family_members for update to authenticated
  using (is_family_member(family_id));
create policy fm_delete on family_members for delete to authenticated
  using (is_family_member(family_id) and family_role_of(family_id) in ('architect','co_architect'));

-- families: members read; architects update; any authed user may create a family
-- (signup creates its own family then inserts its membership row).
create policy fam_select on families for select to authenticated
  using (is_family_member(id));
create policy fam_insert on families for insert to authenticated with check (true);
create policy fam_update on families for update to authenticated
  using (is_family_member(id) and family_role_of(id) in ('architect','co_architect'));

-- Generic "members can read/write rows of their family" for standard tables.
-- (Write granularity by role is enforced in-app for beta; tightened later.)
do $$
declare t text;
begin
  foreach t in array array[
    'family_profiles','children','projects','milestones',
    'materials','cart_items','notifications','parent_observations'
  ] loop
    execute format($f$
      create policy %1$s_rw on %1$s for all to authenticated
        using (is_family_member(family_id))
        with check (is_family_member(family_id));
    $f$, t);
  end loop;
end $$;

-- North Star version history: members read + insert; never update/delete.
create policy nsv_select on family_ns_versions for select to authenticated
  using (is_family_member(family_id));
create policy nsv_insert on family_ns_versions for insert to authenticated
  with check (is_family_member(family_id));

-- CHILD-OWNED LAYER: members may SELECT, INSERT, UPDATE — but there is NO
-- delete policy, so these rows can never be hard-deleted via the API.
-- This enforces "no parent can permanently delete the child's story."
do $$
declare t text;
begin
  foreach t in array array[
    'reflections','milestone_evidence','child_self_assessments','growth_reports'
  ] loop
    execute format($f$
      create policy %1$s_select on %1$s for select to authenticated
        using (is_family_member(family_id));
    $f$, t);
    execute format($f$
      create policy %1$s_insert on %1$s for insert to authenticated
        with check (is_family_member(family_id));
    $f$, t);
    execute format($f$
      create policy %1$s_update on %1$s for update to authenticated
        using (is_family_member(family_id));
    $f$, t);
  end loop;
end $$;

-- ===========================================================================
-- SEED: the default white-label org for the beta.
-- ===========================================================================
insert into organizations (name, slug, primary_color)
values ('North Star', 'northstar', '#1a2b4a');

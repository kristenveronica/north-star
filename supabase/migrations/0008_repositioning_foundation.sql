-- ============================================================================
-- North Star — Repositioning foundation (migration 0008)
-- ----------------------------------------------------------------------------
-- Additive, non-breaking. Lays the data-model groundwork for the 2026-06-21
-- repositioning (human-development platform led by GUIDES, not an AI curriculum
-- generator). Sources: Product Bible, Human Development / Learning Frameworks,
-- Family Operating System, Family Structures & Co-Parenting Framework.
--
-- Adds:
--   • guides            — the illustrated characters children journey with
--   • children          — guide_id, learning_profile, mobility_profile
--   • family_profiles   — travel/worldschool, location, family_type
--   • family_members    — relationship_type (mother/father/...)
--   • family_relationships — the Relationship Map (incl. non-login people)
--   • households        — co-parenting independent/parallel scoping (unused in beta)
--   • projects          — project_category, experience_type
-- Nothing is dropped; faith stays family-level (family_profiles.faith_enabled
-- already exists) and the per-child faith columns are simply left unused.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type guide_age_band as enum ('3-7', '8-12', '13-18');

-- Guide media-evolution ladder (Product Bible): Image -> ... -> Lifelong Companion.
create type guide_media_tier as enum (
  'image', 'voice', 'interactive_avatar', 'conversational', 'video_avatar', 'companion'
);

-- ===========================================================================
-- GUIDES  (global reference data; child-facing personas. No PII.)
-- ===========================================================================
create table guides (
  id          text primary key,                  -- slug, e.g. 'finn'
  name        text not null,
  archetype   text not null,                      -- "The Explorer"
  age_band    guide_age_band not null,
  gender      text,                               -- 'male' | 'female' (parent filter only)
  blurb       text,                               -- short description
  persona     jsonb not null default '{}',        -- {tone, encouragement, celebration, reflection, voice}
  media_tier  guide_media_tier not null default 'image',
  is_legacy   boolean not null default false,
  sort_index  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ===========================================================================
-- CHILDREN  — guide choice + learning profile + mobility
-- ===========================================================================
alter table children add column if not exists guide_id text references guides(id) on delete set null;
-- Learning Profile (NOT "disabilities"). Array of {profile, status?} where
-- status is 'diagnosed' | 'suspected' for the clinical ones. Personalizes, never labels.
alter table children add column if not exists learning_profile jsonb not null default '[]';
-- Mobility / freedom level slug: supervised | parent_drives | walk_local |
-- bike_independent | public_transport | drives. Projects must respect this.
alter table children add column if not exists mobility_profile text;

-- ===========================================================================
-- FAMILY PROFILE  — travel/worldschool, location, family type
-- ===========================================================================
-- Travel/Worldschool mode: {mode:'off'|'short_trip'|'long_stay'|'worldschool',
--   destination, arrival, departure, scope:'local_only'|'destination'|'full'}
alter table family_profiles add column if not exists travel jsonb not null default '{}';
-- Location: precise address kept private; coarse city/region/country for future
-- localization & community discovery. {address, city, region, country, lat, lng}.
alter table family_profiles add column if not exists location jsonb not null default '{}';
-- Family type for future community segmentation: homeschool | worldschool |
-- gap_year | travelling | temporary_leave | traditional_travelling.
alter table family_profiles add column if not exists family_type text;

-- ===========================================================================
-- RELATIONSHIP MAP
-- App-user adults already live in family_members; tag their relationship.
-- ===========================================================================
alter table family_members add column if not exists relationship_type text;  -- mother/father/step_parent/co_parent/...

-- Households: support Independent / Parallel co-parenting scoping later.
-- Beta is Unified mode, so this stays effectively unused but available.
create table households (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  label       text not null default 'Home',
  created_at  timestamptz not null default now()
);
create index on households(family_id);

-- The child's "village": important people, including those who are NOT app
-- users (grandparents, siblings, mentors, caregivers). Drives personalized
-- rewards/celebrations that reflect the real family. Never assume structure.
create table family_relationships (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,   -- optional link to an app adult
  child_id      uuid references children(id) on delete cascade,      -- optional: specific to one child
  household_id  uuid references households(id) on delete set null,   -- optional household scoping
  name          text not null,
  relationship  text not null,   -- mother/father/step_parent/grandparent/sibling/mentor/teacher/therapist/caregiver/co_parent/other
  is_support    boolean not null default true,   -- part of the active support network
  notes         text,
  created_at    timestamptz not null default now()
);
create index on family_relationships(family_id);
create index on family_relationships(child_id);

-- ===========================================================================
-- PROJECTS  — category + experience type (supersede/extend the 7 "gigs")
-- ===========================================================================
-- project_category: enterprise | service | self_reliance | creative | adventure |
--   community | family | mentorship | faith | travel | environmental
alter table projects add column if not exists project_category text;
-- experience_type: project | business | service | mentorship | apprenticeship |
--   worldschooling | nature | family_project | community | adventure
alter table projects add column if not exists experience_type text;

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table guides enable row level security;
-- Reference data, no PII: readable pre-login (parent picker) and by the child portal.
create policy guides_read on guides for select to anon, authenticated using (true);

alter table households enable row level security;
create policy hh_rw on households for all to authenticated
  using (is_family_member(family_id)) with check (is_family_member(family_id));

alter table family_relationships enable row level security;
create policy fr_rw on family_relationships for all to authenticated
  using (is_family_member(family_id)) with check (is_family_member(family_id));

-- ===========================================================================
-- SEED — the 18 Guides (3 age bands x 6). Persona left {} to enrich later.
-- ===========================================================================
insert into guides (id, name, archetype, age_band, gender, blurb, sort_index) values
  ('finn',    'Finn',    'The Explorer',     '3-7',   'male',   'Curious and adventurous.',          1),
  ('leo',     'Leo',     'The Helper',       '3-7',   'male',   'Kind and encouraging.',             2),
  ('oliver',  'Oliver',  'The Builder',      '3-7',   'male',   'Creative and practical.',           3),
  ('lily',    'Lily',    'The Encourager',   '3-7',   'female', 'Warm and nurturing.',               4),
  ('hazel',   'Hazel',   'The Creator',      '3-7',   'female', 'Creative and artistic.',            5),
  ('ava',     'Ava',     'The Nature Friend','3-7',   'female', 'Calm and curious.',                 6),
  ('rowan',   'Rowan',   'The Adventurer',   '8-12',  'male',   'Courage and curiosity.',            7),
  ('caleb',   'Caleb',   'The Builder',      '8-12',  'male',   'Inventor and problem solver.',      8),
  ('elias',   'Elias',   'The Mentor',       '8-12',  'male',   'Wisdom and perseverance.',          9),
  ('grace',   'Grace',   'The Creator',      '8-12',  'female', 'Artistic and expressive.',          10),
  ('clara',   'Clara',   'The Naturalist',   '8-12',  'female', 'Animals, plants, stewardship.',     11),
  ('sophie',  'Sophie',  'The Storyteller',  '8-12',  'female', 'Meaning and reflection.',           12),
  ('kerwin',  'Kerwin',  'The Entrepreneur', '13-18', 'male',   'Leadership and value creation.',    13),
  ('dominic', 'Dominic', 'The Navigator',    '13-18', 'male',   'Strategy and independent thinking.',14),
  ('charlie', 'Charlie', 'The Coach',        '13-18', 'male',   'Character and resilience.',         15),
  ('emma',    'Emma',    'The Innovator',    '13-18', 'female', 'Creativity and experimentation.',   16),
  ('abigail', 'Abigail', 'The Leader',       '13-18', 'female', 'Confidence and responsibility.',    17),
  ('hannah',  'Hannah',  'The Guide',        '13-18', 'female', 'Identity, purpose and contribution.',18)
on conflict (id) do nothing;

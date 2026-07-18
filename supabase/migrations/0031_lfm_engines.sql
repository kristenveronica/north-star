-- ============================================================================
-- 0031 · Living Family Model — engine substrate (extend 0027, don't duplicate)
-- ----------------------------------------------------------------------------
-- Canonical architecture: docs/lfm-architecture.md — North Star reasons with
-- FOUR nouns. This migration completes the substrate for all four:
--
--   Archive         family_archive          (exists, 0027) — what happened
--   Understanding   understandings          (exists, 0027) — what NS believes   ← EXTENDED here
--   Recommendation  recommendations         (NEW here)     — what NS suggests
--   Report          reports                 (NEW here)     — what NS communicates
--
-- The consolidation audit (docs/lfm-consolidation-audit.md) established that the
-- Archive/Understanding two-layer model ALREADY EXISTS (migration 0027). We do
-- NOT create a parallel model. This migration:
--   1. ADDs the engine columns to `understandings` (provenance + the surfacing
--      lifecycle that makes a belief a "surfaced Understanding" — what we used to
--      call an observation — + review_at for the Rhythm Engine's self-restore).
--   2. CREATEs `recommendations` — the three-question contract as a record. The
--      ONE genuinely new table (0027 deferred it by design).
--   3. CREATEs `reports` — one table unifying the former growth_reports +
--      reflection_reports + client-only insightReports.
--
-- PRINCIPLES (same as 0027): ADDITIVE ONLY — no existing column altered, no data
-- can be lost. Enumerated sets are text + CHECK (extensible via ALTER), never
-- rigid enums. Open-ended axes (source_type, domain, type) stay free text so new
-- kinds never require a migration. Strictly family-scoped RLS; anon revoked.
--
-- RLS SAFETY (the migration 0030 gotcha): every SELECT policy below uses
-- is_family_member(family_id), which reads family_members — NOT the table being
-- inserted. There is NO self-reference, so INSERT ... RETURNING is safe. (0030
-- broke only because children's SELECT policy re-queried children itself.)
--
-- RLS SCOPE NOTE: like 0027's own tables, these use family-level RLS
-- (is_family_member). Per-child gating (can_access_child on child-scoped rows)
-- is a DELIBERATE later hardening pass applied uniformly across ALL LFM tables
-- at once — not mixed in here, where it would make the substrate inconsistent.
-- ============================================================================

-- ---------- 1 · Extend Understanding with the engine columns ------------------
-- provenance: the axis Project Generation reads to know how hard to lean on a
-- belief (declared/confirmed drive confidently; inferred only tints). Distinct
-- from family_verdict (the parent's correction), which already exists.
alter table public.understandings
  add column if not exists provenance text not null default 'inferred'
    check (provenance in ('declared','inferred','confirmed','corrected'));

-- Surfacing lifecycle — a belief North Star chose to SPEAK is a "surfaced
-- Understanding" (the former "observation"). Null surface_status = an internal
-- belief that was never shown. `statement` stays the internal belief; `noticing`
-- is its humble phrasing for the parent (Observation Framework voice).
alter table public.understandings
  add column if not exists surfaced_at timestamptz;
alter table public.understandings
  add column if not exists surface_status text
    check (surface_status is null or
           surface_status in ('draft','offered','confirmed','corrected','dismissed','expired'));
alter table public.understandings
  add column if not exists noticing text;

-- review_at — for seasonal/temporary beliefs and Moment-derived beliefs the
-- Rhythm Engine must revisit. This is the self-restore trigger: a passing Moment
-- (a broken wrist) yields a temporary Understanding with review_at set, and the
-- Rhythm Engine schedules its own return to restore what it paused.
alter table public.understandings
  add column if not exists review_at timestamptz;

-- Partial indexes for the two engine hot paths (only the relevant rows).
create index if not exists idx_understandings_surfaced
  on public.understandings(family_id, surface_status)
  where surface_status is not null;
create index if not exists idx_understandings_review
  on public.understandings(family_id, review_at)
  where review_at is not null;

-- ---------- 2 · Recommendation (NEW) · what North Star suggests ---------------
-- The three-question contract, made a record: what changed · what it affects ·
-- what we suggest. Nothing significant mutates projects/rhythm without one.
create table if not exists public.recommendations (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families(id) on delete cascade,
  scope           text not null default 'family'
                    check (scope in ('family','child')),
  subject_id      uuid,                             -- the child; null for family scope
  -- What prompted this proposal (an Archive Moment, an Understanding, or feedback).
  trigger_type    text check (trigger_type is null or
                               trigger_type in ('moment','understanding','feedback')),
  trigger_id      uuid,
  what_changed    text,                             -- question 1
  what_it_affects jsonb not null default '{}'::jsonb, -- question 2 (project ids, rhythm keys)
  recommendation  text not null,                    -- question 3, in plain language
  -- Structured actions the parent decides on (suggestions only, never auto-applied).
  proposed_actions jsonb not null default '[]'::jsonb, -- [{type:'pause_project'|'resize_rhythm'|'redirect_domain'|'add_project'|'lighten'|'restore', ...}]
  status          text not null default 'proposed'
                    check (status in ('proposed','accepted','edited','declined','expired')),
  decision_note   text,                             -- the parent's edit/reason (also logged as an Archive feedback entry)
  applied_at      timestamptz,                      -- when accepted actions executed
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------- 3 · Report (NEW, unified) · what North Star communicates ----------
-- One table for the period read over Understanding — replaces growth_reports +
-- reflection_reports + client insightReports. A Report is a CACHE of a generated
-- document; it is always rebuildable from Understanding + Archive.
create table if not exists public.reports (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families(id) on delete cascade,
  scope           text not null default 'child'
                    check (scope in ('family','child')),
  subject_id      uuid,                             -- the child; null for family scope
  type            text not null default 'growth'
                    check (type in ('growth','monthly','quarterly','annual','milestone')),
  period_key      text,                             -- e.g. '2026-T2' (school_year/quarter in metadata)
  content         jsonb not null default '{}'::jsonb, -- {narrative, strengths[], growth[], demonstrated[], nextSteps[], surfaced_understanding_ids[]}
  status          text not null default 'ready'
                    check (status in ('scheduled','generating','ready')),
  metadata        jsonb not null default '{}'::jsonb,
  generated_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------- Indexes (family-scoped access + common lookups) ------------------
create index if not exists idx_recommendations_family  on public.recommendations(family_id);
create index if not exists idx_recommendations_scope   on public.recommendations(family_id, scope, subject_id);
create index if not exists idx_recommendations_status  on public.recommendations(family_id, status);
create index if not exists idx_reports_family          on public.reports(family_id);
create index if not exists idx_reports_scope           on public.reports(family_id, scope, subject_id);
create index if not exists idx_reports_period          on public.reports(family_id, subject_id, type, period_key);

-- ---------- RLS · strictly family-scoped, non-self-referential ---------------
alter table public.recommendations enable row level security;
alter table public.reports         enable row level security;

-- recommendations
create policy rec_sel on public.recommendations for select using (is_family_member(family_id));
create policy rec_ins on public.recommendations for insert with check (is_family_member(family_id));
create policy rec_upd on public.recommendations for update using (is_family_member(family_id)) with check (is_family_member(family_id));
create policy rec_del on public.recommendations for delete using (is_family_member(family_id));

-- reports
create policy rep_sel on public.reports for select using (is_family_member(family_id));
create policy rep_ins on public.reports for insert with check (is_family_member(family_id));
create policy rep_upd on public.reports for update using (is_family_member(family_id)) with check (is_family_member(family_id));
create policy rep_del on public.reports for delete using (is_family_member(family_id));

-- ---------- Grants · authenticated (RLS governs); anon has no access ---------
grant select, insert, update, delete on public.recommendations to authenticated;
grant select, insert, update, delete on public.reports         to authenticated;
revoke all on public.recommendations from anon;
revoke all on public.reports         from anon;

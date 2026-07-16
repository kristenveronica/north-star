-- ============================================================================
-- 0027 · Living Family Model — durable memory substrate (Sprint 1, task B2)
-- ----------------------------------------------------------------------------
-- The smallest secure foundation for the Living Family Model. It CAPTURES and
-- ORGANISES context; it does not yet produce observations, recommendations, or
-- memory-aware generation (those are deferred by design).
--
-- Blueprint: docs/living-family-record.md — the two-layer model.
--   Layer 1  family_archive        — "what happened" (durable source material)
--   Layer 2  understandings         — "what it may mean" (provisional beliefs)
--            understanding_evidence  — provenance: belief ⇄ source, with stance
--
-- PRINCIPLES ENCODED HERE (not engines — just a schema that permits them later):
--   • Source provenance — every understanding is traceable to evidence.
--   • Meaning ≠ evidence — beliefs live apart from the source that supports them.
--   • Scope — family / child / adult / relationship / project (never only child_id).
--   • Lifespan — permanent…momentary is representable (no automated decay yet).
--   • Status & confidence — inferred belief is never treated as permanent fact.
--   • Contradicting evidence — retained via stance='contradicting'.
--   • Family correction — family_verdict + excluded_from_ai (suppression).
--   • Retention — parent-controlled states on archived source material.
--   • Explainability — evidence linkage answers "why did North Star think this?".
--   • Security — strictly family-scoped RLS; server-authorised; anon revoked.
--
-- ADDITIVE ONLY. No existing table is altered → no existing data can be lost.
-- Enumerated sets are text + CHECK (extensible via ALTER), not rigid enums; the
-- open-ended `domain`/`source_type` axes are free text so new kinds of
-- understanding never require a migration.
-- ============================================================================

-- ---------- Layer 1 · The Family Archive ("what happened") -------------------
create table if not exists public.family_archive (
  id                 uuid primary key default gen_random_uuid(),
  family_id          uuid not null references public.families(id) on delete cascade,
  -- Scope model — deliberately NOT hard-wired to child_id.
  scope              text not null default 'family'
                       check (scope in ('family','child','adult','relationship','project')),
  subject_id         uuid,            -- primary subject (child/member/project); null for family scope
  related_subject_id uuid,            -- second party, for relationship scope
  source_type        text not null default 'note',  -- 'note','conversation','event',... (extensible)
  title              text,
  content            text,            -- original source text (null if summary-only / excluded)
  summary            text,            -- distilled summary (for retain_summary_only)
  -- Parent-controlled retention (deliverable #8). Full UI deferred; schema must never PREVENT it.
  retention_state    text not null default 'retain_original'
                       check (retention_state in ('retain_original','retain_summary_only',
                                                   'use_temporarily_then_delete','exclude_from_ai')),
  occurred_at        timestamptz,     -- when it happened (vs created_at = when recorded)
  metadata           jsonb not null default '{}'::jsonb,
  created_by         uuid,            -- who recorded it (nullable; AI-added later)
  created_at         timestamptz not null default now()
);

-- ---------- Layer 2 · Living Understanding ("what it may mean") --------------
create table if not exists public.understandings (
  id                 uuid primary key default gen_random_uuid(),
  family_id          uuid not null references public.families(id) on delete cascade,
  scope              text not null default 'family'
                       check (scope in ('family','child','adult','relationship','project')),
  subject_id         uuid,
  related_subject_id uuid,
  -- The KIND of understanding is open-ended (free text, NOT a rigid enum):
  -- interests, capabilities, relationships, culture, growth, preferences,
  -- challenges, patterns, … New kinds must not require a migration.
  domain             text,
  statement          text not null,   -- the belief, in plain terms ("moves toward challenge")
  -- Conceptual lifespan (Living Family Record). Representable now; automated decay deferred.
  lifespan           text not null default 'temporary'
                       check (lifespan in ('permanent','slow_changing','seasonal','temporary','momentary')),
  -- Lifecycle — inferred understanding is never a permanent fact.
  status             text not null default 'emerging'
                       check (status in ('emerging','strengthening','established','weakening','contradicted','retired')),
  confidence         real check (confidence is null or (confidence >= 0 and confidence <= 1)),
  -- Family correction (deliverable #7). Full UI deferred; the model supports it now.
  family_verdict     text check (family_verdict is null or
                                  family_verdict in ('accurate','partly_accurate','no_longer_true','incorrect')),
  excluded_from_ai   boolean not null default false,   -- "do not use this" / suppression
  first_noticed_at   timestamptz not null default now(),
  last_reinforced_at timestamptz,
  metadata           jsonb not null default '{}'::jsonb,
  created_by         uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ---------- Provenance · evidence links (belief ⇄ source) --------------------
-- Keeps MEANING (understandings) separate from EVIDENCE (source rows). A source
-- event is not itself an observation. Contradicting evidence is retained, never
-- discarded — the model must be able to weaken its own conclusions.
create table if not exists public.understanding_evidence (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references public.families(id) on delete cascade,  -- denormalised for RLS
  understanding_id uuid not null references public.understandings(id) on delete cascade,
  -- Polymorphic pointer into the Archive OR an existing durable source table
  -- (project/reflection/milestone/media/family_archive/...). Not FK'd because it
  -- is polymorphic; family_id + RLS is the security boundary.
  source_type      text not null,    -- 'archive','project','reflection','milestone','media',...
  source_id        uuid,             -- the source row (null for a free-text evidence note)
  stance           text not null default 'supporting'
                     check (stance in ('supporting','contradicting','neutral')),
  note             text,
  created_at       timestamptz not null default now()
);

-- ---------- Indexes (family-scoped access + evidence lookups) ----------------
create index if not exists idx_family_archive_family  on public.family_archive(family_id);
create index if not exists idx_family_archive_scope   on public.family_archive(family_id, scope, subject_id);
create index if not exists idx_understandings_family  on public.understandings(family_id);
create index if not exists idx_understandings_scope   on public.understandings(family_id, scope, subject_id);
create index if not exists idx_understandings_status  on public.understandings(family_id, status);
create index if not exists idx_uevidence_family       on public.understanding_evidence(family_id);
create index if not exists idx_uevidence_understanding on public.understanding_evidence(understanding_id);
create index if not exists idx_uevidence_source       on public.understanding_evidence(source_type, source_id);

-- ---------- RLS · strictly family-scoped, server-authorised -----------------
alter table public.family_archive         enable row level security;
alter table public.understandings         enable row level security;
alter table public.understanding_evidence enable row level security;

-- family_archive
create policy fa_sel on public.family_archive for select using (is_family_member(family_id));
create policy fa_ins on public.family_archive for insert with check (is_family_member(family_id));
create policy fa_upd on public.family_archive for update using (is_family_member(family_id)) with check (is_family_member(family_id));
create policy fa_del on public.family_archive for delete using (is_family_member(family_id));

-- understandings
create policy un_sel on public.understandings for select using (is_family_member(family_id));
create policy un_ins on public.understandings for insert with check (is_family_member(family_id));
create policy un_upd on public.understandings for update using (is_family_member(family_id)) with check (is_family_member(family_id));
create policy un_del on public.understandings for delete using (is_family_member(family_id));

-- understanding_evidence
create policy ue_sel on public.understanding_evidence for select using (is_family_member(family_id));
create policy ue_ins on public.understanding_evidence for insert with check (is_family_member(family_id));
create policy ue_upd on public.understanding_evidence for update using (is_family_member(family_id)) with check (is_family_member(family_id));
create policy ue_del on public.understanding_evidence for delete using (is_family_member(family_id));

-- ---------- Grants · authenticated (RLS governs); anon has no access --------
grant select, insert, update, delete on public.family_archive         to authenticated;
grant select, insert, update, delete on public.understandings         to authenticated;
grant select, insert, update, delete on public.understanding_evidence to authenticated;
revoke all on public.family_archive         from anon;
revoke all on public.understandings         from anon;
revoke all on public.understanding_evidence from anon;

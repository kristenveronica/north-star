-- ============================================================================
-- 0032 · Distillation — Archive evidence → provisional Understanding (v1)
-- ----------------------------------------------------------------------------
-- The first production-safe path that turns factual Archive records into
-- North Star's current interpretation (docs/lfm-architecture.md: "distillation
-- raises Understanding"). It READS Archive and WRITES understandings; it never
-- mutates Archive evidence.
--
-- DELIBERATELY DETERMINISTIC (no AI). v1 distils exactly two categories that
-- materially improve project generation, via three provenance routes:
--   • interest      (child, INFERRED)  — repeated accepted-project domains (>=2)
--   • circumstance  (DECLARED)         — a parent-stated Moment, true immediately,
--                                        temporary, carrying review_at/expiry
-- CONFIRMED understanding is produced elsewhere (the Observation Engine's confirm
-- flow); distillation only RESPECTS it — it never downgrades a declared/confirmed/
-- corrected/excluded belief back to inferred.
--
-- Thresholds are explicit (not hidden in judgment):
--   interest:      >= 2 distinct accepted projects sharing a domain  → emerging
--                  >= 4                                              → strengthening
--                  confidence = least(0.9, 0.3 + 0.15 * n)  (RECOMPUTED, never inflated)
--   circumstance:  1 declaration is enough (declared route)
--
-- Idempotent: understanding ids and evidence ids are deterministic (md5 of the
-- concept key), so re-running upserts the SAME rows and recomputes (does not
-- inflate) confidence. Correction/contradiction is preserved: a belief the parent
-- corrected (family_verdict incorrect/no_longer_true), excluded, or that became
-- declared/confirmed is left untouched (ON CONFLICT DO UPDATE ... WHERE provenance
-- still inferred & not excluded & not corrected).
--
-- Auth: SECURITY DEFINER, but the FIRST thing it does is is_family_member() — an
-- outsider (or anon) calling it raises 42501. EXECUTE granted to authenticated only.
-- ============================================================================

create or replace function public.distill_family(p_family_id uuid, p_child_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_written integer := 0;
  v_n       integer;
begin
  -- ---- authorization: only a member of this family (or a definer-invoked backfill) ----
  if not is_family_member(p_family_id) then
    raise exception 'distill_family: not authorized for family %', p_family_id
      using errcode = '42501';
  end if;

  -- ======================================================================
  -- Category 1 · INFERRED INTERESTS (child) from repeated accepted projects
  -- ======================================================================
  with events as (
    select a.subject_id as child_id,
           lower(trim(jsonb_array_elements_text(a.metadata->'proposed'->'domains'))) as domain,
           a.id as archive_id, a.occurred_at
    from family_archive a
    where a.family_id = p_family_id
      and a.source_type = 'project_decision'
      and a.metadata->>'event' = 'accepted'
      and a.scope = 'child'
      and a.subject_id is not null
      and (p_child_id is null or a.subject_id = p_child_id)
  ),
  agg as (
    select child_id, domain,
           count(distinct archive_id) as n,
           min(occurred_at) as first_at,
           max(occurred_at) as last_at
    from events
    where domain is not null and domain <> ''
    group by child_id, domain
    having count(distinct archive_id) >= 2         -- THRESHOLD: one project is not a pattern
  )
  insert into understandings
    (id, family_id, scope, subject_id, domain, statement, lifespan, status,
     confidence, provenance, first_noticed_at, last_reinforced_at, metadata)
  select md5('interest:'||p_family_id||':'||child_id||':'||domain)::uuid,
         p_family_id, 'child', child_id, 'interest',
         'Shows repeated interest in '||domain,
         'seasonal',
         case when n >= 4 then 'strengthening' else 'emerging' end,
         least(0.9, 0.3 + 0.15 * n),
         'inferred', first_at, last_at,
         jsonb_build_object('interestDomain', domain, 'eventCount', n)
  from agg
  on conflict (id) do update set
     status             = excluded.status,
     confidence         = excluded.confidence,       -- recomputed, not incremented
     last_reinforced_at = excluded.last_reinforced_at,
     metadata           = excluded.metadata,
     updated_at         = now()
  where understandings.provenance = 'inferred'         -- never downgrade declared/confirmed
    and understandings.excluded_from_ai = false        -- respect suppression
    and coalesce(understandings.family_verdict,'') not in ('no_longer_true','incorrect'); -- respect correction
  get diagnostics v_n = row_count;  v_written := v_written + v_n;

  -- provenance links: every contributing accepted-project Archive row (idempotent)
  insert into understanding_evidence (id, family_id, understanding_id, source_type, source_id, stance)
  select md5('ev:'||md5('interest:'||p_family_id||':'||e.child_id||':'||e.domain)||':'||e.archive_id)::uuid,
         p_family_id,
         md5('interest:'||p_family_id||':'||e.child_id||':'||e.domain)::uuid,
         'archive', e.archive_id, 'supporting'
  from (
    select a.subject_id as child_id,
           lower(trim(jsonb_array_elements_text(a.metadata->'proposed'->'domains'))) as domain,
           a.id as archive_id
    from family_archive a
    where a.family_id = p_family_id and a.source_type = 'project_decision'
      and a.metadata->>'event' = 'accepted' and a.scope = 'child' and a.subject_id is not null
      and (p_child_id is null or a.subject_id = p_child_id)
  ) e
  where e.domain is not null and e.domain <> ''
    and exists (select 1 from understandings u
                where u.id = md5('interest:'||p_family_id||':'||e.child_id||':'||e.domain)::uuid)
  on conflict (id) do nothing;

  -- ======================================================================
  -- Category 2 · DECLARED TEMPORARY CONSTRAINTS from Moments
  -- ======================================================================
  insert into understandings
    (id, family_id, scope, subject_id, domain, statement, lifespan, status,
     confidence, provenance, first_noticed_at, last_reinforced_at, review_at, metadata)
  select md5('circumstance:'||p_family_id||':'||coalesce(a.subject_id::text,'family')||':'||a.id)::uuid,
         p_family_id, a.scope, a.subject_id, 'circumstance',
         coalesce(nullif(a.title,''), nullif(a.content,''), 'A temporary constraint'),
         'temporary', 'established', 1.0, 'declared',
         a.occurred_at, a.occurred_at,
         nullif(a.metadata->>'reviewAt','')::timestamptz,     -- expiry / review date, if declared
         jsonb_build_object('momentKind', a.metadata->>'kind')
  from family_archive a
  where a.family_id = p_family_id
    and a.source_type = 'moment'
    and coalesce(a.metadata->>'status','active') <> 'resolved'
    and (p_child_id is null or a.subject_id = p_child_id or a.scope = 'family')
  on conflict (id) do update set
     review_at          = excluded.review_at,
     statement          = excluded.statement,
     last_reinforced_at = excluded.last_reinforced_at,
     updated_at         = now()
  where understandings.excluded_from_ai = false;
  get diagnostics v_n = row_count;  v_written := v_written + v_n;

  -- provenance links for the Moments (idempotent)
  insert into understanding_evidence (id, family_id, understanding_id, source_type, source_id, stance)
  select md5('ev:circumstance:'||a.id)::uuid,
         p_family_id,
         md5('circumstance:'||p_family_id||':'||coalesce(a.subject_id::text,'family')||':'||a.id)::uuid,
         'archive', a.id, 'supporting'
  from family_archive a
  where a.family_id = p_family_id and a.source_type = 'moment'
    and coalesce(a.metadata->>'status','active') <> 'resolved'
    and (p_child_id is null or a.subject_id = p_child_id or a.scope = 'family')
    and exists (select 1 from understandings u
                where u.id = md5('circumstance:'||p_family_id||':'||coalesce(a.subject_id::text,'family')||':'||a.id)::uuid)
  on conflict (id) do nothing;

  return v_written;
end $$;

-- Callable by authenticated family members (RLS-equivalent gate is inside the fn);
-- never by anon. A future server-side backfill/cron can call it as the definer.
revoke all on function public.distill_family(uuid, uuid) from public, anon;
grant execute on function public.distill_family(uuid, uuid) to authenticated;

comment on function public.distill_family(uuid, uuid) is
  'Distillation v1: reads Archive, writes provisional Understanding (interest, circumstance). Deterministic, idempotent, is_family_member-gated. Never mutates Archive. See migration 0032.';

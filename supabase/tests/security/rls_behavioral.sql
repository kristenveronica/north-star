-- ============================================================================
-- North Star · Security Regression Harness · Layer 2: Behavioural RLS Attacks
-- ----------------------------------------------------------------------------
-- Simulates real attackers at the RLS layer by switching to the `authenticated`
-- role and setting a forged JWT claim, then attempting each exploit.
--
-- SAFETY: the whole script runs inside ONE transaction that ends in ROLLBACK.
-- All fixtures are synthetic (fixed 1111…/2222… UUIDs) and NOTHING persists.
-- The role-simulation mechanism (set local role authenticated + request.jwt.claims
-- → auth.uid()) was validated 2026-07-15. Intended to run in STAGING during
-- task A3, and against prod only inside this rolled-back transaction.
--
-- Expectation: every [ATTACK] prints RED before 0025 and GREEN after.
--              every [LEGIT] prints GREEN both before and after (no regression).
--
-- Run:  psql "$DATABASE_URL" -f rls_behavioral.sql   (reads NOTICEs)
-- ============================================================================
\set ON_ERROR_STOP off
begin;

-- ---- synthetic fixtures (created as the privileged runner, before any role switch) ----
-- Uses the existing 'northstar' org to satisfy the families.org_id FK.
insert into families (id, org_id, name)
  values ('11111111-1111-1111-1111-111111111111',
          (select id from organizations where slug='northstar' limit 1), 'HARNESS Victim Family');
insert into family_profiles (family_id, child_profile_limit)
  values ('11111111-1111-1111-1111-111111111111', 5);
insert into family_members (family_id, user_id, role, is_primary, status) values
  ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','architect',true,'active'),
  ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333','contributor',false,'active');
insert into children (id, family_id, name, access_code)
  values ('55555555-5555-5555-5555-555555555555','11111111-1111-1111-1111-111111111111','HarnessKid','HARNESS-SYNTHETIC-CODE-1');

-- helper: run a statement as a simulated user and report RED/GREEN
create or replace function pg_temp.as_user(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub',p_uid,'role','authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

-- [ATTACK C5] contributor raises the child-profile limit ----------------------
do $$ declare n int; begin
  perform pg_temp.as_user('33333333-3333-3333-3333-333333333333');
  update family_profiles set child_profile_limit=999 where family_id='11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count; execute 'reset role';
  raise notice '[ATTACK C5] child-limit tamper: %', case when n>0 then 'RED (updated '||n||' row)' else 'GREEN (blocked)' end;
exception when others then execute 'reset role'; raise notice '[ATTACK C5] child-limit tamper: GREEN (blocked: %)', sqlerrm; end $$;

-- [ATTACK C4] contributor promotes self to architect -------------------------
do $$ declare n int; begin
  perform pg_temp.as_user('33333333-3333-3333-3333-333333333333');
  update family_members set role='architect', is_primary=true
    where user_id='33333333-3333-3333-3333-333333333333' and family_id='11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count; execute 'reset role';
  raise notice '[ATTACK C4] self-promotion: %', case when n>0 then 'RED (promoted)' else 'GREEN (blocked)' end;
exception when others then execute 'reset role'; raise notice '[ATTACK C4] self-promotion: GREEN (blocked: %)', sqlerrm; end $$;

-- [ATTACK C2] stranger inserts self into the family as architect -------------
do $$ declare n int; begin
  perform pg_temp.as_user('44444444-4444-4444-4444-444444444444');
  insert into family_members (family_id, user_id, role, is_primary, status)
    values ('11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444444','architect',true,'active');
  get diagnostics n = row_count; execute 'reset role';
  raise notice '[ATTACK C2] stranger self-join: %', case when n>0 then 'RED (joined as owner)' else 'GREEN (blocked)' end;
exception when others then execute 'reset role'; raise notice '[ATTACK C2] stranger self-join: GREEN (blocked: %)', sqlerrm; end $$;

-- [ATTACK M5] architect mutates org_id / ns_locked ---------------------------
do $$ declare n int; begin
  perform pg_temp.as_user('22222222-2222-2222-2222-222222222222');
  update families set ns_locked = not ns_locked where id='11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count; execute 'reset role';
  raise notice '[ATTACK M5] families config mutate (note: WITH CHECK gap): %', case when n>0 then 'observed-writable' else 'blocked' end;
exception when others then execute 'reset role'; raise notice '[ATTACK M5] families config mutate: blocked (%)', sqlerrm; end $$;

-- [LEGIT] architect updates their own family profile (must always work) -------
do $$ declare n int; begin
  perform pg_temp.as_user('22222222-2222-2222-2222-222222222222');
  update family_profiles set mission='harness legit write' where family_id='11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count; execute 'reset role';
  raise notice '[LEGIT] architect profile write: %', case when n>0 then 'GREEN (ok)' else 'RED (unexpectedly blocked)' end;
exception when others then execute 'reset role'; raise notice '[LEGIT] architect profile write: RED (unexpected error: %)', sqlerrm; end $$;

-- [LEGIT] contributor reads a child they belong to (must always work) --------
do $$ declare ok boolean; begin
  perform pg_temp.as_user('33333333-3333-3333-3333-333333333333');
  select can_access_child('55555555-5555-5555-5555-555555555555') into ok; execute 'reset role';
  raise notice '[LEGIT] contributor reads own-family child: %', case when ok then 'GREEN (ok)' else 'RED (unexpectedly blocked)' end;
exception when others then execute 'reset role'; raise notice '[LEGIT] contributor child read: RED (unexpected error: %)', sqlerrm; end $$;

-- ============================================================================
-- B2 · Living Family Model substrate (migration 0027) — cross-family isolation.
-- Seeds one understanding for the victim family (1111) as the privileged runner,
-- then proves an outsider cannot read or write it, and a member can.
-- ============================================================================
insert into understandings (id, family_id, scope, domain, statement, lifespan, status)
  values ('66666666-6666-6666-6666-666666666666','11111111-1111-1111-1111-111111111111',
          'family','culture','HARNESS — comes alive building outdoors','seasonal','emerging');
insert into family_archive (id, family_id, scope, source_type, content, retention_state)
  values ('77777777-7777-7777-7777-777777777777','11111111-1111-1111-1111-111111111111',
          'family','note','HARNESS source note','retain_original');
insert into understanding_evidence (family_id, understanding_id, source_type, source_id, stance)
  values ('11111111-1111-1111-1111-111111111111','66666666-6666-6666-6666-666666666666',
          'archive','77777777-7777-7777-7777-777777777777','supporting');

-- [ATTACK LFM-1] outsider reads another family's understanding ----------------
do $$ declare n int; begin
  perform pg_temp.as_user('44444444-4444-4444-4444-444444444444');
  select count(*) into n from understandings where id='66666666-6666-6666-6666-666666666666';
  execute 'reset role';
  raise notice '[ATTACK LFM-1] outsider reads understanding: %', case when n>0 then 'RED (leaked '||n||')' else 'GREEN (blocked)' end;
exception when others then execute 'reset role'; raise notice '[ATTACK LFM-1] outsider reads understanding: GREEN (blocked: %)', sqlerrm; end $$;

-- [ATTACK LFM-2] outsider reads another family's archive ----------------------
do $$ declare n int; begin
  perform pg_temp.as_user('44444444-4444-4444-4444-444444444444');
  select count(*) into n from family_archive where id='77777777-7777-7777-7777-777777777777';
  execute 'reset role';
  raise notice '[ATTACK LFM-2] outsider reads archive: %', case when n>0 then 'RED (leaked '||n||')' else 'GREEN (blocked)' end;
exception when others then execute 'reset role'; raise notice '[ATTACK LFM-2] outsider reads archive: GREEN (blocked: %)', sqlerrm; end $$;

-- [ATTACK LFM-3] outsider injects an understanding into another family --------
do $$ declare n int; begin
  perform pg_temp.as_user('44444444-4444-4444-4444-444444444444');
  insert into understandings (family_id, statement) values ('11111111-1111-1111-1111-111111111111','attacker inject');
  get diagnostics n = row_count; execute 'reset role';
  raise notice '[ATTACK LFM-3] outsider injects understanding: %', case when n>0 then 'RED (inserted)' else 'GREEN (blocked)' end;
exception when others then execute 'reset role'; raise notice '[ATTACK LFM-3] outsider injects understanding: GREEN (blocked: %)', sqlerrm; end $$;

-- [LEGIT] a family member reads their own family's understanding -------------
do $$ declare n int; begin
  perform pg_temp.as_user('33333333-3333-3333-3333-333333333333');
  select count(*) into n from understandings where id='66666666-6666-6666-6666-666666666666';
  execute 'reset role';
  raise notice '[LEGIT] member reads own-family understanding: %', case when n=1 then 'GREEN (ok)' else 'RED (saw '||n||')' end;
exception when others then execute 'reset role'; raise notice '[LEGIT] member understanding read: RED (unexpected error: %)', sqlerrm; end $$;

-- [ATTACK LFM-4] outsider injects an ARCHIVE project-decision into another family
do $$ declare n int; begin
  perform pg_temp.as_user('44444444-4444-4444-4444-444444444444');
  insert into family_archive (family_id, scope, subject_id, source_type, title)
    values ('11111111-1111-1111-1111-111111111111','child','55555555-5555-5555-5555-555555555555','project_decision','attacker inject');
  get diagnostics n = row_count; execute 'reset role';
  raise notice '[ATTACK LFM-4] outsider injects archive project-decision: %', case when n>0 then 'RED (inserted)' else 'GREEN (blocked)' end;
exception when others then execute 'reset role'; raise notice '[ATTACK LFM-4] outsider injects archive: GREEN (blocked: %)', sqlerrm; end $$;

-- [LEGIT] member records a project-decision via INSERT…RETURNING (the real write
-- path; also re-verifies the 0030 gotcha does NOT bite family_archive) ---------
do $$ declare n int; begin
  perform pg_temp.as_user('33333333-3333-3333-3333-333333333333');
  insert into family_archive (id, family_id, scope, subject_id, source_type, title, metadata)
    values ('88888888-8888-4888-8888-000000000001','11111111-1111-1111-1111-111111111111','child',
            '55555555-5555-5555-5555-555555555555','project_decision','The Gear Inventor','{"event":"accepted"}'::jsonb)
    on conflict (id) do update set title = excluded.title
    returning 1 into n;   -- RETURNING must pass the SELECT policy
  execute 'reset role';
  raise notice '[LEGIT] member records project-decision (insert…returning): %', case when n=1 then 'GREEN (ok)' else 'RED (blocked)' end;
exception when others then execute 'reset role'; raise notice '[LEGIT] member records project-decision: RED (unexpected error: %)', sqlerrm; end $$;

-- [LEGIT] idempotent retry: upserting the SAME deterministic id keeps ONE row ---
do $$ declare n int; begin
  perform pg_temp.as_user('33333333-3333-3333-3333-333333333333');
  insert into family_archive (id, family_id, scope, subject_id, source_type, title)
    values ('88888888-8888-4888-8888-000000000001','11111111-1111-1111-1111-111111111111','child',
            '55555555-5555-5555-5555-555555555555','project_decision','The Gear Inventor (retry)')
    on conflict (id) do update set title = excluded.title;
  select count(*) into n from family_archive where id='88888888-8888-4888-8888-000000000001';
  execute 'reset role';
  raise notice '[LEGIT] idempotent retry (upsert same id) → rows: %', case when n=1 then 'GREEN (1 row)' else 'RED ('||n||' rows)' end;
exception when others then execute 'reset role'; raise notice '[LEGIT] idempotent retry: RED (unexpected error: %)', sqlerrm; end $$;

-- [LFM-6] milestone completion history: member writes complete→undo→re-complete
-- as THREE distinct factual rows; a retry of the first completion de-dupes ------
do $$ declare n int; begin
  perform pg_temp.as_user('33333333-3333-3333-3333-333333333333');
  -- complete @ T1, undo @ T2, re-complete @ T3 (distinct deterministic ids)
  insert into family_archive (id, family_id, scope, subject_id, source_type, title, metadata) values
    ('a1111111-1111-4111-8111-000000000001','11111111-1111-1111-1111-111111111111','child','55555555-5555-5555-5555-555555555555','milestone_progress','Build the frame','{"event":"milestone_completed"}'::jsonb),
    ('a2222222-2222-4222-8222-000000000002','11111111-1111-1111-1111-111111111111','child','55555555-5555-5555-5555-555555555555','milestone_progress','Build the frame','{"event":"milestone_uncompleted"}'::jsonb),
    ('a3333333-3333-4333-8333-000000000003','11111111-1111-1111-1111-111111111111','child','55555555-5555-5555-5555-555555555555','milestone_progress','Build the frame','{"event":"milestone_completed"}'::jsonb);
  -- retry of the FIRST completion (same id) — must not add a 4th row
  insert into family_archive (id, family_id, scope, subject_id, source_type, title, metadata)
    values ('a1111111-1111-4111-8111-000000000001','11111111-1111-1111-1111-111111111111','child','55555555-5555-5555-5555-555555555555','milestone_progress','Build the frame','{"event":"milestone_completed"}'::jsonb)
    on conflict (id) do update set title = excluded.title;
  select count(*) into n from family_archive where source_type='milestone_progress'
    and family_id='11111111-1111-1111-1111-111111111111';
  execute 'reset role';
  raise notice '[LFM-6] completion history (complete/undo/recomplete, retry de-dupes) → rows: %', case when n=3 then 'GREEN (3 distinct)' else 'RED ('||n||')' end;
exception when others then execute 'reset role'; raise notice '[LFM-6] completion history: RED (unexpected error: %)', sqlerrm; end $$;

-- [ATTACK LFM-5] outsider injects a milestone_progress row into another family --
do $$ declare n int; begin
  perform pg_temp.as_user('44444444-4444-4444-4444-444444444444');
  insert into family_archive (family_id, scope, subject_id, source_type, title, metadata)
    values ('11111111-1111-1111-1111-111111111111','child','55555555-5555-5555-5555-555555555555','milestone_progress','ATTACK','{"event":"milestone_completed"}'::jsonb);
  get diagnostics n = row_count; execute 'reset role';
  raise notice '[ATTACK LFM-5] outsider injects milestone_progress: %', case when n>0 then 'RED (inserted)' else 'GREEN (blocked)' end;
exception when others then execute 'reset role'; raise notice '[ATTACK LFM-5] outsider injects milestone_progress: GREEN (blocked: %)', sqlerrm; end $$;

rollback;  -- nothing above persists

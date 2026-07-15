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

rollback;  -- nothing above persists

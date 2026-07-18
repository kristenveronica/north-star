-- ============================================================================
-- North Star · Distillation regression harness (migration 0032 · distill_family)
-- ----------------------------------------------------------------------------
-- Controlled Archive evidence → distill_family() → Understanding, asserting the
-- deterministic rules. Simulates the `authenticated` role with a forged JWT claim
-- so the is_family_member() auth path is exercised for real.
--
-- SAFETY: the whole script runs inside ONE transaction that ends in ROLLBACK.
-- Fixtures are synthetic; the member uid must be a REAL auth.users id (FK), so set
-- :member to a known test user before running. NOTHING persists.
--
-- Run:  psql "$DATABASE_URL" -v member="'<real-auth-uid>'" -f distillation.sql
-- Expectation: every [DISTILL] line prints GREEN.
-- ============================================================================
\set ON_ERROR_STOP off
begin;

\set D '''dddddddd-dddd-dddd-dddd-dddddddddddd'''
\set A '''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'''
\set B '''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'''
\set outsider '''ffffffff-ffff-ffff-ffff-ffffffffffff'''

insert into organizations (id, slug, name) values (:D, 'harness-distill', 'Harness Distill Org') on conflict do nothing;
insert into families (id, org_id, name) values (:D, :D, 'Harness Distill Family');
insert into family_profiles (family_id, child_profile_limit) values (:D, 5);
insert into family_members (family_id, user_id, role, is_primary, status) values (:D, :member, 'architect', true, 'active');
insert into children (id, family_id, name, access_code) values (:A, :D, 'Ada', 'HARNESS-DISTILL-A'), (:B, :D, 'Ben', 'HARNESS-DISTILL-B');

-- Ada: 2 accepted science (→ interest), 1 accepted art (→ below threshold)
-- Ben: 1 accepted science (→ nothing; must not contaminate Ada)
-- Ada: 2 accepted music (pre-CONFIRMED) + 2 accepted history (pre-CONTRADICTED)
insert into family_archive (family_id, scope, subject_id, source_type, metadata, occurred_at) values
  (:D,'child',:A,'project_decision','{"event":"accepted","proposed":{"domains":["science"]}}'::jsonb, now()-interval '5 days'),
  (:D,'child',:A,'project_decision','{"event":"accepted","proposed":{"domains":["science"]}}'::jsonb, now()-interval '2 days'),
  (:D,'child',:A,'project_decision','{"event":"accepted","proposed":{"domains":["art"]}}'::jsonb, now()-interval '1 day'),
  (:D,'child',:B,'project_decision','{"event":"accepted","proposed":{"domains":["science"]}}'::jsonb, now()-interval '3 days'),
  (:D,'child',:A,'project_decision','{"event":"accepted","proposed":{"domains":["music"]}}'::jsonb, now()-interval '9 days'),
  (:D,'child',:A,'project_decision','{"event":"accepted","proposed":{"domains":["music"]}}'::jsonb, now()-interval '8 days'),
  (:D,'child',:A,'project_decision','{"event":"accepted","proposed":{"domains":["history"]}}'::jsonb, now()-interval '7 days'),
  (:D,'child',:A,'project_decision','{"event":"accepted","proposed":{"domains":["history"]}}'::jsonb, now()-interval '6 days');
insert into family_archive (family_id, scope, subject_id, source_type, title, metadata, occurred_at) values
  (:D,'child',:A,'moment','Broken wrist','{"status":"active","kind":"injury","reviewAt":"2026-08-15T00:00:00Z"}'::jsonb, now()),
  (:D,'family',null,'moment','Travelling for three weeks','{"status":"active","kind":"travel","reviewAt":"2026-08-08T00:00:00Z"}'::jsonb, now());

-- beliefs distillation must RESPECT (never downgrade / resurrect)
insert into understandings (id, family_id, scope, subject_id, domain, statement, lifespan, status, confidence, provenance)
  values (md5('interest:'||:D||':'||:A||':music')::uuid, :D,'child',:A,'interest','Loves music','seasonal','established',0.95,'confirmed');
insert into understandings (id, family_id, scope, subject_id, domain, statement, lifespan, status, confidence, provenance, family_verdict)
  values (md5('interest:'||:D||':'||:A||':history')::uuid, :D,'child',:A,'interest','Into history','seasonal','contradicted',0.20,'inferred','incorrect');

create or replace function pg_temp.as_user(p_uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub',p_uid,'role','authenticated')::text, true);
  execute 'set local role authenticated'; end $$;

-- run distillation twice (idempotency), as the member
do $$ declare r1 int; r2 int; begin
  perform pg_temp.as_user((select user_id::text from family_members where family_id='dddddddd-dddd-dddd-dddd-dddddddddddd' limit 1));
  r1 := distill_family('dddddddd-dddd-dddd-dddd-dddddddddddd');
  r2 := distill_family('dddddddd-dddd-dddd-dddd-dddddddddddd');
  execute 'reset role';
  raise notice '[DISTILL idempotent] runs wrote %/%: %', r1, r2, case when r1=r2 then 'GREEN' else 'RED' end;
end $$;

-- assertions
do $$ declare ok boolean; c numeric; begin
  select round(confidence::numeric,2) into c from understandings where id=md5('interest:dddddddd-dddd-dddd-dddd-dddddddddddd:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa:science')::uuid;
  select count(*)=1 and bool_and(provenance='inferred' and status='emerging') into ok from understandings where family_id='dddddddd-dddd-dddd-dddd-dddddddddddd' and subject_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and metadata->>'interestDomain'='science';
  raise notice '[DISTILL repeated→inferred interest] science conf=% : %', c, case when ok and c=0.60 then 'GREEN' else 'RED' end;

  select count(*)=0 into ok from understandings where family_id='dddddddd-dddd-dddd-dddd-dddddddddddd' and metadata->>'interestDomain'='art';
  raise notice '[DISTILL one event insufficient] art absent: %', case when ok then 'GREEN' else 'RED' end;

  select count(*)=0 into ok from understandings where subject_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' and domain='interest';
  raise notice '[DISTILL no cross-child contamination] Ben has none: %', case when ok then 'GREEN' else 'RED' end;

  select count(*)=1 and bool_and(provenance='declared' and lifespan='temporary' and review_at is not null) into ok from understandings where scope='child' and subject_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and domain='circumstance';
  raise notice '[DISTILL declared→immediate temporary + review_at] wrist: %', case when ok then 'GREEN' else 'RED' end;

  select count(*)=1 and bool_and(scope='family') into ok from understandings where family_id='dddddddd-dddd-dddd-dddd-dddddddddddd' and scope='family' and domain='circumstance';
  raise notice '[DISTILL family vs child distinct] family travel circumstance: %', case when ok then 'GREEN' else 'RED' end;

  select round(confidence::numeric,2)=0.95 and provenance='confirmed' into ok from understandings where id=md5('interest:dddddddd-dddd-dddd-dddd-dddddddddddd:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa:music')::uuid;
  raise notice '[DISTILL confirmed outranks inferred] music untouched: %', case when ok then 'GREEN' else 'RED' end;

  select round(confidence::numeric,2)=0.20 and family_verdict='incorrect' into ok from understandings where id=md5('interest:dddddddd-dddd-dddd-dddd-dddddddddddd:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa:history')::uuid;
  raise notice '[DISTILL contradiction preserved] history not resurrected: %', case when ok then 'GREEN' else 'RED' end;
end $$;

-- outsider cannot execute
do $$ begin
  perform pg_temp.as_user('ffffffff-ffff-ffff-ffff-ffffffffffff');
  perform distill_family('dddddddd-dddd-dddd-dddd-dddddddddddd');
  execute 'reset role'; raise notice '[DISTILL unauthorized] RED (outsider executed)';
exception when others then execute 'reset role'; raise notice '[DISTILL unauthorized] GREEN (blocked: %)', sqlerrm; end $$;

rollback;  -- nothing above persists

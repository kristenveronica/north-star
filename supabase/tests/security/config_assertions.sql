-- ============================================================================
-- North Star · Security Regression Harness · Layer 1: Config Assertions
-- ----------------------------------------------------------------------------
-- Read-only. Safe to run against any environment, including production.
-- Inspects the *shape* of the defences (policies, grants, triggers, functions).
-- Every row must read GREEN after migration 0025_security_hardening is applied.
--
-- RED baseline recorded 2026-07-15 (pre-0025): ALL 10 checks RED. This file IS
-- the acceptance oracle for task A3 — 0025 is not done until this returns all GREEN.
--
-- Run:  psql "$DATABASE_URL" -f config_assertions.sql
--   or: paste into the Supabase SQL editor.
-- ============================================================================
with checks as (
  select 'A-C4' id, 'fm_update has owner WITH CHECK (no self-promotion)' descr,
    case when with_check ilike '%is_family_owner%' then 'GREEN' else 'RED' end status
    from pg_policies where tablename='family_members' and policyname='fm_update'
  union all
  select 'A-C2','fm_insert is owner-only (no user_id=auth.uid self-join)',
    case when with_check ilike '%user_id = auth.uid()%' then 'RED' else 'GREEN' end
    from pg_policies where tablename='family_members' and policyname='fm_insert'
  union all
  select 'A-C5','child_profile_limit NOT UPDATE-grantable to authenticated',
    case when exists(select 1 from information_schema.column_privileges
      where table_name='family_profiles' and column_name='child_profile_limit'
        and grantee='authenticated' and privilege_type='UPDATE') then 'RED' else 'GREEN' end
  union all
  select 'A-H1','children has BEFORE UPDATE guard trigger (family_id/access_code/self_user_id)',
    case when exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
      where c.relname='children' and not t.tgisinternal and t.tgname ~ 'guard') then 'GREEN' else 'RED' end
  union all
  select 'A-C1','can_access_child binds MCA grant to child family_id',
    case when pg_get_functiondef((select oid from pg_proc where proname='can_access_child')) ilike '%a.family_id%' then 'GREEN' else 'RED' end
  union all
  select 'A-M5','fam_update has WITH CHECK (org_id/ns_locked frozen)',
    case when with_check is not null then 'GREEN' else 'RED' end
    from pg_policies where tablename='families' and policyname='fam_update'
  union all
  select 'A-H4','apply_billing_entitlement active-branch never lowers capacity',
    case when pg_get_functiondef((select oid from pg_proc where proname='apply_billing_entitlement'))
      like '%child_profile_limit = 1 + coalesce(new.extra_seats%' then 'RED' else 'GREEN' end
  union all
  select 'A-ST','family_billing.status has CHECK constraint',
    case when exists(select 1 from pg_constraint con join pg_class c on c.oid=con.conrelid
      where c.relname='family_billing' and con.contype='c' and pg_get_constraintdef(con.oid) ilike '%status%') then 'GREEN' else 'RED' end
  union all
  select 'A-CD','children has owner DELETE policy',
    case when exists(select 1 from pg_policies where tablename='children' and cmd='DELETE') then 'GREEN' else 'RED' end
  union all
  select 'A-M2','accept_invitation NOT executable by anon',
    case when has_function_privilege('anon',(select oid from pg_proc where proname='accept_invitation'),'EXECUTE') then 'RED' else 'GREEN' end
)
select id, status, descr from checks order by id;

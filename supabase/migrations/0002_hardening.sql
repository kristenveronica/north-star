-- ============================================================================
-- North Star — Security hardening (migration 0002)
-- Addresses Supabase advisor findings on top of 0001_foundation.sql.
-- ============================================================================

-- 1. Pin search_path on the trigger function (advisor: function_search_path_mutable)
create or replace function set_updated_at() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- 2. Replace the permissive families INSERT policy with a controlled signup RPC.
--    Families can now only be created via this function, which also wires up the
--    creator as the Primary Architect and seeds an empty North Star profile.
drop policy if exists fam_insert on families;

create or replace function create_family_for_current_user(p_family_name text default 'Our Family')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org    uuid;
  v_family uuid;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;

  select id into v_org from organizations where slug = 'northstar' limit 1;

  insert into families (org_id, name)
    values (v_org, coalesce(nullif(p_family_name, ''), 'Our Family'))
    returning id into v_family;

  insert into family_members (family_id, user_id, role, is_primary)
    values (v_family, auth.uid(), 'architect', true);

  insert into family_profiles (family_id) values (v_family);

  return v_family;
end $$;

revoke execute on function create_family_for_current_user(text) from anon, public;
grant  execute on function create_family_for_current_user(text) to authenticated;

-- 3. Lock the RLS helper functions to signed-in users only (advisor:
--    anon_security_definer_function_executable). They still run inside policies
--    for authenticated users; anon has no business calling them directly.
revoke execute on function is_family_member(uuid) from anon, public;
revoke execute on function family_role_of(uuid)  from anon, public;
grant  execute on function is_family_member(uuid) to authenticated;
grant  execute on function family_role_of(uuid)  to authenticated;

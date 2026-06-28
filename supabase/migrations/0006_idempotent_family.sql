-- ============================================================================
-- North Star — idempotent family creation (migration 0006)
-- Fixes a race where two near-simultaneous calls (direct + auth-state listener)
-- each created a family. The function now returns the user's existing family if
-- one is present, so it can never create a duplicate.
-- ============================================================================
create or replace function create_family_for_current_user(p_family_name text default 'Our Family')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org      uuid;
  v_family   uuid;
  v_existing uuid;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;

  -- Already have a family? Return the oldest one; never create another.
  select family_id into v_existing
  from family_members
  where user_id = auth.uid()
  order by created_at asc
  limit 1;
  if v_existing is not null then
    return v_existing;
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

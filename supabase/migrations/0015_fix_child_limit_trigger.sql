-- ============================================================
-- 0015_fix_child_limit_trigger.sql
-- Fix: the child-profile-limit trigger (0010) fires on every child INSERT,
-- including the INSERT half of an upsert when the app re-syncs EXISTING
-- children. That wrongly blocked existing children from syncing once a family
-- was at/over its limit. Now it only enforces the cap for GENUINELY NEW
-- children (ids not already in the table); upserts of existing children pass.
-- ============================================================

create or replace function public.enforce_child_profile_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int;
  v_count int;
begin
  -- An upsert of an existing child (same id already present) is not a new
  -- profile — let it through so re-syncs never break.
  if exists (select 1 from public.children where id = new.id) then
    return new;
  end if;

  select coalesce(child_profile_limit, 1) into v_limit
    from public.family_profiles
   where family_id = new.family_id;
  if v_limit is null then v_limit := 1; end if;

  select count(*) into v_count
    from public.children
   where family_id = new.family_id;

  if v_count >= v_limit then
    raise exception
      'Child profile limit reached for this family (% of % used). Add a child-profile seat to your subscription.',
      v_count, v_limit
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

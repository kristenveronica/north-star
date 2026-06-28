-- ============================================================
-- 0010_child_profile_entitlements.sql
-- Subscription gating for child profiles.
--
-- Billing model: the basic account includes 1 child profile;
-- additional profiles are paid bolt-on seats. The entitlement is
-- the SERVER's source of truth — clients read it but cannot raise
-- it. A Stripe webhook (added with billing) updates the column;
-- a DB trigger hard-enforces the cap so the UI gate can't be bypassed.
-- ============================================================

-- 1) The per-family entitlement. Defaults to the base plan (1).
alter table public.family_profiles
  add column if not exists child_profile_limit int not null default 1;

-- Guard against nonsense values from any path.
alter table public.family_profiles
  drop constraint if exists family_profiles_child_limit_positive;
alter table public.family_profiles
  add constraint family_profiles_child_limit_positive
  check (child_profile_limit >= 1 and child_profile_limit <= 50);

-- 2) Hard server-side enforcement: block inserting a child beyond the
--    family's entitlement, regardless of what the client attempts.
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

drop trigger if exists trg_enforce_child_profile_limit on public.children;
create trigger trg_enforce_child_profile_limit
  before insert on public.children
  for each row execute function public.enforce_child_profile_limit();

-- NOTE: child_profile_limit is intentionally NOT exposed for client writes.
-- Keep RLS update policies on family_profiles from allowing this column to be
-- changed by the family; only the billing webhook (service role) sets it.

-- ============================================================
-- 0023_beta_child_seats.sql
--
-- Two fixes to child-profile seating:
--
-- 1. Re-apply the "same-id guard" from 0015. The live DB was still running the
--    0010 version of enforce_child_profile_limit() (no guard), so re-syncing an
--    EXISTING child (the INSERT half of an upsert) failed once a family was at
--    or over its limit — silently blocking all child writes. The guard lets
--    upserts of existing children through; only GENUINELY new profiles are capped.
--
-- 2. Beta seating. The base plan includes 1 child profile, which is far too few
--    for real beta families (most have 2+ children). While the beta trial runs,
--    trialing/unbilled families get a generous included allowance so they can add
--    their whole family. This is a TEMPORARY beta policy — after beta, revert the
--    base back to 1 (and remove the default bump) to restore paid-seat economics.
-- ============================================================

-- 1) Correct the enforcement trigger (idempotent). ----------------------------
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
  -- profile — let it through so re-syncs never break, even at/over the limit.
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

-- 2) Beta included allowance. -------------------------------------------------
-- Base beta grant (change back to 1 to end the beta policy).
alter table public.family_profiles
  alter column child_profile_limit set default 10;

-- Trialing / beta families get the beta base + any extra seats; genuinely paid
-- ('active') families keep real seat economics (1 + seats).
create or replace function public.apply_billing_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' then
    -- Genuinely paid: exact seat economics (1 base + purchased seats).
    update public.family_profiles
       set child_profile_limit = 1 + coalesce(new.extra_seats, 0)
     where family_id = new.family_id;
  elsif new.status = 'trialing' then
    -- Beta trial: generous grant; never lower an existing grant mid-beta.
    update public.family_profiles
       set child_profile_limit = greatest(child_profile_limit, 10 + coalesce(new.extra_seats, 0))
     where family_id = new.family_id;
  else
    -- Lapsed/none: keep a safe floor; don't lock a beta family out.
    update public.family_profiles
       set child_profile_limit = greatest(child_profile_limit, 1)
     where family_id = new.family_id;
  end if;

  return new;
end;
$$;

-- Backfill existing beta families (no billing row, or trialing) up to the beta
-- allowance. greatest() ensures this only ever RAISES a limit, never lowers one.
update public.family_profiles fp
   set child_profile_limit = greatest(fp.child_profile_limit, 10)
 where not exists (
   select 1 from public.family_billing fb
    where fb.family_id = fp.family_id and fb.status = 'active'
 );

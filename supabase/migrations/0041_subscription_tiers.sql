-- ============================================================================
-- North Star — Subscription tiers (Foundation / Flourish / Legacy) · 0041
-- ----------------------------------------------------------------------------
-- The capability model. A family's PLAN drives feature access (client reads
-- family_profiles.plan → js/lib/plans.js). Stripe is the source of truth:
-- family_billing.plan is stamped from the subscription's metadata by the
-- webhook, and this trigger denormalises it onto family_profiles so the client
-- can read it in the same family load (no extra round-trip).
--
-- Capacity: ALL tiers include 5 children + 2 contributing adults. So the child
-- limit no longer depends on tier — it's 5 + extra seats. The trigger stays
-- MONOTONIC (greatest(...)) so it can never reduce a family's existing limit.
--
-- Founding-launch GRANDFATHER: any active/trialing family without a tier stamped
-- (and every beta family) is treated as Legacy, so nobody currently in loses
-- access. New checkouts stamp the real tier. Tighten when the hard paywall lands.
-- ============================================================================

alter table family_billing  add column if not exists plan text;   -- foundation|flourish|legacy
alter table family_profiles add column if not exists plan text;

create or replace function public.apply_billing_entitlement()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if new.status = 'active' then
    update public.family_profiles
       set child_profile_limit = greatest(coalesce(child_profile_limit, 1), 5 + coalesce(new.extra_seats, 0)),
           plan = coalesce(new.plan, 'legacy')
     where family_id = new.family_id;
  elsif new.status = 'trialing' then
    update public.family_profiles
       set child_profile_limit = greatest(coalesce(child_profile_limit, 1), 10 + coalesce(new.extra_seats, 0)),
           plan = coalesce(new.plan, 'legacy')      -- beta/trialing = full experience
     where family_id = new.family_id;
  else
    update public.family_profiles
       set child_profile_limit = greatest(coalesce(child_profile_limit, 1), 1)
     where family_id = new.family_id;               -- leave plan unchanged (no mid-flight downgrade)
  end if;
  return new;
end $function$;

-- Backfill existing live families → grandfather to Legacy (one-time).
update public.family_profiles fp
   set plan = coalesce(fb.plan, 'legacy')
  from public.family_billing fb
 where fb.family_id = fp.family_id
   and fp.plan is null
   and fb.status in ('active', 'trialing');

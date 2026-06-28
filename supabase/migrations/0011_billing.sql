-- ============================================================
-- 0011_billing.sql — Stripe subscription billing for North Star.
--
-- Model (per product direction):
--   • Base account is a PAID subscription that includes 1 child profile.
--   • Additional child profiles are quantity-based add-on "seats".
--   • Parent chooses monthly or annual at checkout; seats match that interval.
--   • Entitlement: family_profiles.child_profile_limit = 1 + extra seats.
--
-- The Stripe customer/subscription <-> family mapping lives in family_billing.
-- It is written ONLY by the service role (the billing fn + webhook); families
-- can read their own row for status display but can never edit it.
-- ============================================================

create table if not exists public.family_billing (
  family_id              uuid primary key references public.families(id) on delete cascade,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  base_interval          text check (base_interval in ('month','year')),
  extra_seats            int  not null default 0 check (extra_seats >= 0),
  status                 text not null default 'none',  -- none | active | trialing | past_due | canceled | unpaid
  current_period_end     timestamptz,
  updated_at             timestamptz not null default now()
);

alter table public.family_billing enable row level security;

-- Family members may READ their billing row (for status / "manage subscription").
drop policy if exists family_billing_select on public.family_billing;
create policy family_billing_select on public.family_billing
  for select using (public.is_family_member(family_id));

-- No client INSERT/UPDATE/DELETE policies → only the service role can write.

-- Keep the entitlement column (added in 0010) in lockstep with billing state.
-- Active/trialing base subscription → 1 included + extra seats; otherwise the
-- safe floor (1) so existing/beta families are never locked out. To hard-paywall
-- the base plan later, change the ELSE branch to 0.
create or replace function public.apply_billing_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int;
begin
  if new.status in ('active','trialing') then
    v_limit := 1 + coalesce(new.extra_seats, 0);
  else
    v_limit := 1;  -- safe floor; set to 0 to require a paid base subscription
  end if;

  update public.family_profiles
     set child_profile_limit = greatest(1, v_limit)
   where family_id = new.family_id;

  return new;
end;
$$;

drop trigger if exists trg_apply_billing_entitlement on public.family_billing;
create trigger trg_apply_billing_entitlement
  after insert or update on public.family_billing
  for each row execute function public.apply_billing_entitlement();

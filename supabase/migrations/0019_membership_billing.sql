-- ============================================================================
-- North Star — Membership, Permissions & Billing foundation (migration 0019)
-- ----------------------------------------------------------------------------
-- Layer 1, step 1 of docs/membership-billing-design.md.
--
-- ADDITIVE & SAFE BY DESIGN: this migration only ADDS columns/tables/policies
-- and refines membership helpers in a backward-compatible way. It does NOT
-- tighten the existing child-scoped RLS (that lands in 0020, AFTER the app is
-- membership-aware and the owner's primary membership is confirmed) — so it
-- cannot lock anyone out of data they can reach today.
--
-- Reuses the existing role model rather than reinventing it:
--   Primary Owner  = family_members.role 'architect'    + is_primary = true
--   Co-Owner       = family_members.role 'co_architect'
--   Contributor    = family_members.role 'contributor'
--   Viewer         = family_members.role 'observer'
--   Self-learner   = family_members.role 'self_learner'  (new — child age-out)
-- Fine-grained capabilities live in family_members.permissions /
-- member_child_access.permissions and are enforced by the app + ai edge fn.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums (new). ADD VALUE to family_role is committed here; it is NOT compared
-- against in this same migration (Postgres forbids using a freshly-added enum
-- value in the same transaction), so this is safe.
-- ---------------------------------------------------------------------------
alter type family_role add value if not exists 'self_learner';

do $$ begin
  create type member_status as enum ('active','pending','revoked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type child_access_level as enum ('child_owner','contributor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payer_status as enum ('active','pending','past_due','canceled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invite_status as enum ('pending','accepted','expired','revoked');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- families: lapse policy (locked in as grace_then_primary)
-- ---------------------------------------------------------------------------
alter table families
  add column if not exists billing_lapse_policy text not null default 'grace_then_primary';

-- ---------------------------------------------------------------------------
-- family_members: the role axis. Allow DESCRIPTIVE-ONLY people (no login, e.g.
-- Grandma the AI may reference) by making user_id nullable, and add status +
-- fine-grained permissions + invite provenance.
-- ---------------------------------------------------------------------------
alter table family_members alter column user_id drop not null;
alter table family_members
  add column if not exists status        member_status not null default 'active',
  add column if not exists permissions   text[]        not null default '{}',
  add column if not exists relationship  text,
  add column if not exists invited_email text,
  add column if not exists invited_by    uuid references auth.users(id),
  add column if not exists updated_at     timestamptz   not null default now();

-- one Primary Owner per family
create unique index if not exists one_primary_owner
  on family_members(family_id) where is_primary;

-- ---------------------------------------------------------------------------
-- member_child_access: per-child scoping for contributors / self-learners.
-- Owners (architect/co_architect) need NO rows here — they reach all children.
-- ---------------------------------------------------------------------------
create table if not exists member_child_access (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references families(id) on delete cascade,
  member_id    uuid not null references family_members(id) on delete cascade,
  child_id     uuid not null references children(id) on delete cascade,
  access_level child_access_level not null default 'contributor',
  permissions  text[] not null default '{}',
  created_at   timestamptz not null default now(),
  unique (member_id, child_id)
);
create index if not exists mca_family on member_child_access(family_id);
create index if not exists mca_child  on member_child_access(child_id);

-- ---------------------------------------------------------------------------
-- invitations: unified member-invite AND/OR invite-to-pay (single-use token).
-- ---------------------------------------------------------------------------
create table if not exists invitations (
  id                    uuid primary key default gen_random_uuid(),
  family_id             uuid not null references families(id) on delete cascade,
  email                 text not null,
  intended_role         family_role not null default 'contributor',
  intended_permissions  text[] not null default '{}',
  intended_child_access jsonb not null default '[]',   -- [{child_id, access_level, permissions[]}]
  billing_share_pct     numeric(5,2),                  -- null = not a payer; set = invite-to-pay
  token                 text not null unique,
  status                invite_status not null default 'pending',
  expires_at            timestamptz not null default (now() + interval '14 days'),
  invited_by            uuid not null references auth.users(id),
  created_at            timestamptz not null default now()
);
create index if not exists inv_family on invitations(family_id);
create index if not exists inv_token  on invitations(token);

-- ---------------------------------------------------------------------------
-- billing_payers: the payer axis (decoupled from role). Shares sum to 100 per
-- family; Primary Owner is the guarantor. Stripe ids written by the billing
-- edge fn via the service role (no client write policy below).
-- ---------------------------------------------------------------------------
create table if not exists billing_payers (
  id                     uuid primary key default gen_random_uuid(),
  family_id              uuid not null references families(id) on delete cascade,
  user_id                uuid references auth.users(id),   -- payer-only adults may lack membership
  email                  text,
  stripe_customer_id     text,
  stripe_subscription_id text,                              -- Phase 2: one sub per payer
  share_pct              numeric(5,2) not null default 100,
  is_guarantor           boolean not null default false,
  status                 payer_status not null default 'pending',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists pay_family on billing_payers(family_id);

-- ---------------------------------------------------------------------------
-- children: age-out — the learner managing their own account.
-- ---------------------------------------------------------------------------
alter table children
  add column if not exists self_user_id uuid references auth.users(id);

-- ---------------------------------------------------------------------------
-- Membership helpers (security definer; reuse the existing role model).
-- is_family_member is refined to honour the new status column (existing rows
-- default to 'active', so this is backward-compatible — no lockout).
-- ---------------------------------------------------------------------------
create or replace function is_family_member(fid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from family_members fm
    where fm.family_id = fid and fm.user_id = auth.uid()
      and coalesce(fm.status, 'active') = 'active'
  );
$$;

create or replace function is_family_owner(fid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from family_members fm
    where fm.family_id = fid and fm.user_id = auth.uid()
      and coalesce(fm.status, 'active') = 'active'
      and fm.role in ('architect','co_architect')
  );
$$;

create or replace function is_primary_owner(fid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from family_members fm
    where fm.family_id = fid and fm.user_id = auth.uid()
      and coalesce(fm.status, 'active') = 'active' and fm.is_primary
  );
$$;

-- A child is reachable if you own the family, OR you ARE that learner (age-out),
-- OR you hold an explicit per-child grant.
create or replace function can_access_child(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from children c
    where c.id = cid and (
      is_family_owner(c.family_id)
      or c.self_user_id = auth.uid()
      or exists (
        select 1 from member_child_access a
        join family_members m on m.id = a.member_id
        where a.child_id = cid and m.user_id = auth.uid()
          and coalesce(m.status,'active') = 'active'
      )
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS on the NEW tables (existing tables/policies untouched — see 0020).
-- ---------------------------------------------------------------------------
alter table member_child_access enable row level security;
alter table invitations         enable row level security;
alter table billing_payers       enable row level security;

drop policy if exists mca_select on member_child_access;
drop policy if exists mca_write  on member_child_access;
create policy mca_select on member_child_access for select to authenticated
  using (is_family_member(family_id));
create policy mca_write on member_child_access for all to authenticated
  using (is_family_owner(family_id)) with check (is_family_owner(family_id));

drop policy if exists inv_owner on invitations;
create policy inv_owner on invitations for all to authenticated
  using (is_family_owner(family_id)) with check (is_family_owner(family_id));

drop policy if exists pay_select on billing_payers;
drop policy if exists pay_write  on billing_payers;
create policy pay_select on billing_payers for select to authenticated
  using (is_family_member(family_id));
-- Owners may configure shares; Stripe ids are written by the edge fn (service role).
create policy pay_write on billing_payers for all to authenticated
  using (is_primary_owner(family_id)) with check (is_primary_owner(family_id));

-- updated_at triggers for the new mutable tables
drop trigger if exists trg_billing_payers_updated on billing_payers;
create trigger trg_billing_payers_updated before update on billing_payers
  for each row execute function set_updated_at();
drop trigger if exists trg_family_members_updated on family_members;
create trigger trg_family_members_updated before update on family_members
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- accept_invitation(token): the invitee is not yet a member, so normal RLS
-- would block them. This runs elevated, validates the token + that the caller's
-- email matches, then provisions membership + per-child grants. The billing
-- side (Stripe Checkout → billing_payers) is handled by the billing edge fn.
-- ---------------------------------------------------------------------------
create or replace function accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  inv  invitations%rowtype;
  mid  uuid;
  g    jsonb;
begin
  select * into inv from invitations
    where token = p_token and status = 'pending' and expires_at > now();
  if not found then raise exception 'invalid_or_expired_invitation'; end if;

  if lower(coalesce(inv.email,'')) <> lower(coalesce(auth.jwt() ->> 'email','')) then
    raise exception 'invitation_email_mismatch';
  end if;

  -- Primary ownership can never be granted via invite.
  insert into family_members (family_id, user_id, role, is_primary, status, permissions, invited_email, invited_by)
    values (inv.family_id, auth.uid(), inv.intended_role, false, 'active', inv.intended_permissions, inv.email, inv.invited_by)
    on conflict (family_id, user_id) do update
      set role = excluded.role, status = 'active', permissions = excluded.permissions
    returning id into mid;

  for g in select * from jsonb_array_elements(inv.intended_child_access) loop
    insert into member_child_access (family_id, member_id, child_id, access_level, permissions)
      values (
        inv.family_id, mid, (g->>'child_id')::uuid,
        coalesce((g->>'access_level')::child_access_level, 'contributor'),
        coalesce((select array_agg(value::text) from jsonb_array_elements_text(g->'permissions')), '{}')
      )
      on conflict (member_id, child_id) do update
        set access_level = excluded.access_level, permissions = excluded.permissions;
  end loop;

  update invitations set status = 'accepted' where id = inv.id;
  return mid;
end; $$;

revoke all on function accept_invitation(text) from public;
grant execute on function accept_invitation(text) to authenticated;

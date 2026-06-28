# North Star — Membership, Permissions & Billing — Design Doc

Status: **Draft for review** · Owner: Kristen · Supabase project `dsioaopybvbfukouljej`
Supersedes the family-level-only permission notes; extends the engine already shipped in `js/lib/permissions.js`.

---

## 1. Goals & principles

1. **One educational vision (the Owner's), many trusted adults delivering it.**
2. **Four decoupled axes** — identity, role, child-scope, and payer are independent. A person can be any combination.
3. **Cloud-first**: Supabase is the source of truth; localStorage becomes a cache. Required because contributors sign in on their own devices and can't read the Owner's localStorage.
4. **Per-child scoping**: blended families (one parent, two children, two other parents) must scope a contributor to specific children.
5. **Asymmetric ownership**: a Primary Owner who can't be locked out, plus an optional Co-Owner — never co-equal owners (which create deadlock/lockout risk).
6. **Billing shares (%)**, decoupled from role; Primary Owner is always the guarantor of record.
7. **Safety for high-conflict parallel parenting** without the system ever modelling "conflict": safe defaults (Contributor + per-child + instant unilateral revoke) + isolated payment data.
8. **Child age-out**: a learner can grow into managing their own account, and eventually take their record with them.

> **Layering split (RLS vs engine).** RLS enforces *coarse, row-level* access: family scoping, child scoping, role. The permission engine (client) + the `ai` edge function (server) enforce *fine-grained action gating* (generate vs view, edit vs read) and navigation. **Both are always applied**, and the edge function independently re-verifies membership + permissions before spending AI credits — never trust the client.

---

## 2. The four decoupled axes

| Axis | Question it answers | Where it lives |
|---|---|---|
| **Identity** | Who is this person? | `auth.users` (Supabase) |
| **Role** | What is their standing in the family? | `family_members.role` = `primary_owner` \| `co_owner` \| `contributor` \| `self_learner` |
| **Child-scope** | Which children, and what may they do for them? | `member_child_access` (per child + permissions) |
| **Payer** | Do they pay, and how much? | `billing_payers.share_pct` |

A person may be a member without paying, a payer without portal access ("payer-only"), a Co-Owner who pays 50%, or a child-1 contributor who pays 100%. The Primary Owner is the billing **guarantor** regardless of who actually pays.

> **"Owner of child 1 only"** is expressed as a **Contributor scoped to child 1 with child-level config permissions** — not a third role. Owner stays strictly family-level (max 2). One coherent hierarchy.

---

## 3. Schema (target shape)

Postgres. `families` and `family_members` already exist (migration 0001). **Implementation note:** rather than a new `member_role` enum, we **reuse the existing `family_role` enum** (`architect | co_architect | contributor | observer`) + `is_primary`, mapping: Primary Owner = `architect`+`is_primary`, Co-Owner = `co_architect`, Contributor = `contributor`, Viewer = `observer`, Self-learner = new `self_learner` value. The DDL sketch below is conceptual; the applied form is `supabase/migrations/0019_membership_billing.sql` (additive & non-breaking; child-scoped RLS tightening deferred to 0020 after membership backfill).

```sql
-- enums
create type member_role  as enum ('primary_owner','co_owner','contributor','self_learner');
create type member_status as enum ('active','pending','revoked');
create type child_access_level as enum ('child_owner','contributor');   -- child_owner = full child-level config
create type payer_status as enum ('active','pending','past_due','canceled');
create type invite_status as enum ('pending','accepted','expired','revoked');

-- families (existing; ensure these columns)
alter table families
  add column if not exists primary_owner_id uuid references auth.users(id),
  add column if not exists billing_lapse_policy text not null default 'grace_then_primary'; -- see §6

-- family_members (EXTEND existing) — the role axis + descriptive people
-- A member may be ACCOUNT-LINKED (user_id set) or DESCRIPTIVE-ONLY (user_id null,
-- e.g. Grandma who never logs in but whom the AI may reference).
alter table family_members
  add column if not exists user_id      uuid references auth.users(id),         -- null = descriptive-only
  add column if not exists role         member_role   not null default 'contributor',
  add column if not exists status       member_status not null default 'active',
  add column if not exists permissions  text[]        not null default '{}',     -- family-wide contrib perms
  add column if not exists display_name text,
  add column if not exists relationship text,
  add column if not exists invited_email text,
  add column if not exists invited_by   uuid references auth.users(id),
  add column if not exists created_at   timestamptz not null default now();
-- at most one primary_owner and one co_owner per family:
create unique index if not exists one_primary_owner on family_members(family_id) where role = 'primary_owner';
create unique index if not exists one_co_owner      on family_members(family_id) where role = 'co_owner';

-- member_child_access — per-child scoping for contributors / self_learner
create table if not exists member_child_access (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  member_id  uuid not null references family_members(id) on delete cascade,
  child_id   uuid not null references children(id) on delete cascade,
  access_level child_access_level not null default 'contributor',
  permissions  text[] not null default '{}',   -- overrides/refines family_members.permissions for this child
  created_at timestamptz not null default now(),
  unique (member_id, child_id)
);
-- Owners (primary/co) need NO rows here — they implicitly access all children.

-- invitations — unified: member invite and/or invite-to-pay
create table if not exists invitations (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  email       text not null,
  intended_role member_role not null default 'contributor',
  intended_child_access jsonb not null default '[]',   -- [{child_id, access_level, permissions[]}]
  intended_permissions  text[] not null default '{}',
  billing_share_pct numeric(5,2),                      -- null = not a payer; set = invite-to-pay
  token       text not null unique,                    -- single-use, random
  status      invite_status not null default 'pending',
  expires_at  timestamptz not null default (now() + interval '14 days'),
  invited_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);

-- billing_payers — the payer axis (independent of role)
create table if not exists billing_payers (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  user_id     uuid references auth.users(id),          -- payer-only adults may have no membership
  email       text,                                    -- for payer-only before signup
  stripe_customer_id     text,
  stripe_subscription_id text,                          -- Phase 2: one sub per payer
  share_pct   numeric(5,2) not null default 100,        -- shares for a family sum to 100
  is_guarantor boolean not null default false,          -- Primary Owner = true
  status      payer_status not null default 'pending',
  created_at  timestamptz not null default now()
);
-- enforce shares ≤ 100 via app/RPC; a partial check trigger validates sum on write.

-- children (EXTEND) — age-out
alter table children
  add column if not exists self_user_id uuid references auth.users(id);  -- set when the learner manages their own account
```

Everything child-scoped that already exists (`projects`, `milestones`, `materials`, `reflections`, reports, media/portfolio, `inventory_items`, `calendar_events`) already carries `family_id`/`child_id` and needs only the RLS in §4. Family config (`family_profiles`: North Star, settings; `children.learning_profile`) is owner/child-config gated.

---

## 4. RLS

Helper functions (security definer, stable):

```sql
create or replace function is_family_member(fid uuid) returns boolean language sql stable as $$
  select exists (select 1 from family_members m
                 where m.family_id = fid and m.user_id = auth.uid() and m.status = 'active');
$$;

create or replace function is_family_owner(fid uuid) returns boolean language sql stable as $$
  select exists (select 1 from family_members m
                 where m.family_id = fid and m.user_id = auth.uid()
                   and m.status = 'active' and m.role in ('primary_owner','co_owner'));
$$;

create or replace function is_primary_owner(fid uuid) returns boolean language sql stable as $$
  select exists (select 1 from family_members m
                 where m.family_id = fid and m.user_id = auth.uid()
                   and m.status = 'active' and m.role = 'primary_owner');
$$;

-- A child is accessible if you own the family, OR you have an explicit child grant,
-- OR you ARE that learner (age-out).
create or replace function can_access_child(cid uuid) returns boolean language sql stable as $$
  select exists (
    select 1 from children c
    where c.id = cid and (
      is_family_owner(c.family_id)
      or c.self_user_id = auth.uid()
      or exists (select 1 from member_child_access a
                 join family_members m on m.id = a.member_id
                 where a.child_id = cid and m.user_id = auth.uid() and m.status = 'active')
    ));
$$;
```

Representative policies:

```sql
-- families: members read; owners update; primary deletes
alter table families enable row level security;
create policy fam_sel on families for select using (is_family_member(id));
create policy fam_upd on families for update using (is_family_owner(id));
create policy fam_del on families for delete using (is_primary_owner(id));

-- family_members: members read; primary manages everyone; co-owner manages only contributors
create policy fm_sel on family_members for select using (is_family_member(family_id));
create policy fm_write_primary on family_members for all
  using (is_primary_owner(family_id)) with check (is_primary_owner(family_id));
create policy fm_write_coowner on family_members for all
  using (is_family_owner(family_id) and role = 'contributor')
  with check (is_family_owner(family_id) and role = 'contributor');

-- member_child_access + children + child-scoped tables: gate by can_access_child
create policy mca_sel on member_child_access for select using (is_family_member(family_id));
create policy mca_write on member_child_access for all
  using (is_family_owner(family_id)) with check (is_family_owner(family_id));

create policy child_sel on children for select using (can_access_child(id));
create policy child_upd on children for update using (is_family_owner(family_id) or self_user_id = auth.uid());

-- example for projects (repeat shape for milestones/materials/reflections/reports/portfolio/calendar)
create policy proj_sel on projects for select using (can_access_child(child_id));
create policy proj_write on projects for all using (can_access_child(child_id)) with check (can_access_child(child_id));

-- family config (owners only client-side; the AI edge fn uses the service role and bypasses RLS)
create policy profile_sel on family_profiles for select using (is_family_owner(family_id));
create policy profile_write on family_profiles for all using (is_family_owner(family_id)) with check (is_family_owner(family_id));

-- billing_payers: members see the split (no card data lives here); writes via server/RPC only
create policy pay_sel on billing_payers for select using (is_family_member(family_id));
-- no client insert/update policy → only service role (edge fn) writes.

-- invitations: owners manage; acceptance is a SECURITY DEFINER RPC (invitee isn't a member yet)
create policy inv_owner on invitations for all using (is_family_owner(family_id)) with check (is_family_owner(family_id));
```

**Accept-invitation RPC** (the invitee is not yet a member, so normal RLS would block them — this runs elevated and validates the token + email):

```sql
create or replace function accept_invitation(p_token text)
returns uuid language plpgsql security definer as $$
declare inv invitations; mid uuid;
begin
  select * into inv from invitations where token = p_token and status = 'pending' and expires_at > now();
  if not found then raise exception 'invalid_or_expired'; end if;
  if lower(inv.email) <> lower(auth.jwt() ->> 'email') then raise exception 'email_mismatch'; end if;

  insert into family_members (family_id, user_id, role, status, permissions, invited_email, invited_by)
    values (inv.family_id, auth.uid(), inv.intended_role, 'active', inv.intended_permissions, inv.email, inv.invited_by)
    returning id into mid;

  insert into member_child_access (family_id, member_id, child_id, access_level, permissions)
    select inv.family_id, mid, (g->>'child_id')::uuid,
           coalesce((g->>'access_level')::child_access_level,'contributor'),
           coalesce((select array_agg(value::text) from jsonb_array_elements_text(g->'permissions')), '{}')
    from jsonb_array_elements(inv.intended_child_access) g;

  -- payer side handled separately by the billing edge fn after Stripe Checkout completes.
  update invitations set status = 'accepted' where id = inv.id;
  return mid;
end; $$;
```

---

## 5. Billing — model

- **Stripe product/price**: base plan + per-child seats (existing) + **per-AI-adult seat** (new). A seat becomes billable when a member is granted an AI-consuming permission (`contrib:generate` or `contrib:reports`). Granting that permission in the UI shows *"This adds a contributor seat — $X/mo."*
- **Credit pool**: shared family pool in Layer 1 (with usage caps/alerts so one contributor can't burn the pool). Private per-seat pools deferred to a later layer.
- **Payer axis** (`billing_payers`): shares sum to 100% per family; Primary Owner is the default `is_guarantor`.

### Layer 1 — single payer (+ pass-billing-to-another-adult)
One subscription, one active payer (share 100%). The payer may be the Primary Owner **or** a delegated adult: the Owner sets the payer and sends an **invite-to-pay**; Parent B opens Stripe Checkout, puts *their own* card on file as their own Stripe customer, and becomes payer of record. Primary Owner remains guarantor.

### Layer 2 — percentage split
Stripe cannot split one invoice across two cards, so a true split = **one Stripe subscription per payer**, each sized to `share_pct` of the total, each its own Stripe customer (payment data isolated — a privacy win for high-conflict cases). Owners see the breakdown + paid/past_due per payer; nobody sees another's card.

---

## 6. Lapse policy (recommended default)

`families.billing_lapse_policy = 'grace_then_primary'` (recommended default):
1. A payer's share fails → **grace period (14 days)** with nudges to that payer **and** the Primary Owner; access continues.
2. Unresolved at end of grace → Primary Owner is prompted to **cover the shortfall in one tap**; if they decline, the account suspends (read-only) until resolved.
- Alternative settings to support: `suspend` (no auto-cover) and `primary_auto_cover` (Primary's card silently covers a failed share). **Decision still open — recommend `grace_then_primary`.**

---

## 7. Invitations & revocation (unified flow)

One invite can carry role + child access + billing share (e.g., "Co-Owner who pays 50%").

```
Owner configures in Family Settings → creates invitation (token, email)
  → email (edge fn + provider, e.g. Resend) → /invite/:token
  → invitee signs up / logs in → accept_invitation(token) RPC
  → family_members (+ member_child_access) created
  → if billing_share set: Stripe Checkout → billing edge fn writes billing_payers
  → invitation = accepted
```

**Revocation**: Owner sets `family_members.status='revoked'` (or deletes) → RLS cuts access immediately. Removing a payer cancels their Stripe subscription and triggers §6.

**Owner powers**: Primary can promote/demote/remove the Co-Owner and owns billing + family deletion; Co-Owner has full educational edit but **cannot** remove the Primary, delete the family, or take over billing (encoded in the `fm_write_*` policies).

---

## 8. Child age-out / graduation

- `children.self_user_id` + role `self_learner` + the `can_access_child` self-clause make age-out **native** from day one.
- **Mode A — in-family self-management (teen):** Owner enables self-management → invite-to-self → the learner gets their own login as `self_learner`, scoped via `member_child_access` to their own `child_id` with a configurable permission set (manage own projects/reflections/portfolio; not billing/family config). *(Layer 2.)*
- **Mode B — graduation / fork (adulthood):** `graduate_child(child_id)` provisions a **new family owned by the now-adult** and transfers/copies their record (projects, portfolio, reports, learning profile) for portability, with consent handling. *(Layer 3.)*

---

## 9. Migration: localStorage-first → cloud-first

1. **Apply additive schema** (members extensions, `member_child_access`, `invitations`, `billing_payers`, `children.self_user_id`, RLS, RPCs) as migrations `0019+`. Nothing dropped.
2. **Backfill on first load post-upgrade** (idempotent, safe to re-run):
   - ensure a `families` row + a `family_members` row for the current user as `primary_owner`;
   - migrate `family.relationships[]` → `family_members` (descriptive-only where no login) carrying the `accessLevel`/`permissions` already captured in the shipped UI; family-wide grants → `member_child_access` across all children;
   - move localStorage-only fields (member permissions, child `printPermission`) into their cloud homes (tech agreement already lives in synced `learning_profile`).
3. **Flip the store to Supabase-first**: hydrate authoritative on login (RLS scopes to membership/child-access), optimistic local writes + persist, refresh on navigation; localStorage stays as offline cache.
4. **Concurrency**: `updated_at` + last-write-wins for v1; optional Supabase Realtime for live multi-user updates.
5. **Data-loss safety**: never clear localStorage during migration; take a one-time backup snapshot first; feature-flag the cutover; migrate the Owner's own family and **verify new-device hydration** (the durability test) before enabling any contributor.

---

## 10. Build layers

**Layer 1 — foundation + single payer**
Schema + RLS + RPCs + migration; cloud-first store; wire the shipped permission engine to real `family_members`/`member_child_access` rows; invite + accept flow; single payer incl. pass-billing-to-another-adult; AI-seat billing (shared pool); per-child scoping data model + UI filtering of child-scoped views.

**Layer 2 — advanced**
Percentage-split billing (one Stripe sub per payer) + lapse policy; in-family child self-management (`self_learner`); Realtime concurrency.

**Layer 3 — future**
Child graduation/fork to own account (portability); cross-family shared tutors; private per-seat AI credit pools.

---

## 11. Open decisions / risks

- **Lapse policy default** — recommend `grace_then_primary` (§6). *Needs confirmation.*
- **Co-Owner scope** — confirmed: manages contributors, not the Primary/billing.
- **AI cost control** — shared pool needs hard caps + alerts so a contributor can't drain credits.
- **Legal/contractual liability** = Primary Owner (guarantor); reflect in ToS.
- **Stripe Connect not required** (separate customers, not marketplace payouts).
- **Edge-function trust** — `ai` must re-verify caller membership + `contrib:generate` server-side before spending credits.

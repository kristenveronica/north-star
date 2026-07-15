-- ============================================================================
-- 0025_security_hardening_rollback
-- Restores every object 0025 changed to its pre-0025 definition
-- (captured verbatim in supabase/baseline/2026-07-15-pre-0025.md).
-- Apply only to undo 0025.
-- ============================================================================

-- C1: restore can_access_child (no family_id binding)
create or replace function public.can_access_child(cid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $fn$
  select exists (select 1 from children c where c.id = cid and (
      is_family_owner(c.family_id) or c.self_user_id = auth.uid()
      or exists (select 1 from member_child_access a join family_members m on m.id = a.member_id
        where a.child_id = cid and m.user_id = auth.uid() and coalesce(m.status,'active') = 'active')));
$fn$;
drop trigger if exists trg_mca_same_family on public.member_child_access;
drop function if exists public.enforce_mca_same_family();

-- C2 / C4: restore original family_members policies
drop policy if exists fm_insert on public.family_members;
create policy fm_insert on public.family_members for insert to authenticated
  with check ((user_id = auth.uid()) or is_family_member(family_id));
drop policy if exists fm_update on public.family_members;
create policy fm_update on public.family_members for update to authenticated
  using (is_family_member(family_id));

-- H1: drop children guard
drop trigger if exists trg_children_guard on public.children;
drop function if exists public.enforce_children_guard();

-- M5: restore families fam_update (no WITH CHECK); drop guard
drop policy if exists fam_update on public.families;
create policy fam_update on public.families for update to authenticated
  using (is_family_member(id) and (family_role_of(id) = any (array['architect'::family_role,'co_architect'::family_role])));
drop trigger if exists trg_families_guard on public.families;
drop function if exists public.enforce_families_guard();

-- H4: restore original entitlement trigger fn (active branch lowers)
create or replace function public.apply_billing_entitlement()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
begin
  if new.status = 'active' then
    update public.family_profiles set child_profile_limit = 1 + coalesce(new.extra_seats, 0) where family_id = new.family_id;
  elsif new.status = 'trialing' then
    update public.family_profiles set child_profile_limit = greatest(child_profile_limit, 10 + coalesce(new.extra_seats, 0)) where family_id = new.family_id;
  else
    update public.family_profiles set child_profile_limit = greatest(child_profile_limit, 1) where family_id = new.family_id;
  end if; return new; end $fn$;

-- status CHECK
alter table public.family_billing drop constraint if exists family_billing_status_check;

-- children DELETE policy
drop policy if exists child_del on public.children;

-- family_profiles: restore single ALL policy + table-level UPDATE grants
drop policy if exists family_profiles_sel on public.family_profiles;
drop policy if exists family_profiles_ins on public.family_profiles;
drop policy if exists family_profiles_upd on public.family_profiles;
drop policy if exists family_profiles_rw on public.family_profiles;
create policy family_profiles_rw on public.family_profiles for all to authenticated
  using (is_family_member(family_id)) with check (is_family_member(family_id));
grant update on public.family_profiles to authenticated, anon;

-- invitation RPC anon execute
grant execute on function public.accept_invitation(text) to anon;
grant execute on function public.preview_invitation(text) to anon;

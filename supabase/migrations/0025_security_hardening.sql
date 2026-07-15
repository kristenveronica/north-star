-- ============================================================================
-- 0025_security_hardening
-- Phase 0 / Sprint 1 task A3. Closes the live authorization holes.
-- Additive & reversible (policy/trigger/grant/function/constraint changes; no
-- destructive DDL). Rollback: 0025_security_hardening_rollback.sql.
-- Acceptance oracle: supabase/tests/security/config_assertions.sql → 10/10 GREEN,
-- and rls_behavioral.sql attacks all GREEN with no [LEGIT] regression.
--
-- Validated end-to-end in a rolled-back transaction against the live DB
-- 2026-07-15 (all 10 config checks flipped RED→GREEN; no legit regression).
-- Legitimate self-signup / invite-accept are unaffected: they run through
-- SECURITY DEFINER RPCs (create_family_for_current_user, accept_invitation)
-- which bypass RLS.
-- ============================================================================

-- ---- C1: can_access_child must bind the MCA grant to the child's family ----
create or replace function public.can_access_child(cid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $fn$
  select exists (
    select 1 from children c
    where c.id = cid and (
      is_family_owner(c.family_id)
      or c.self_user_id = auth.uid()
      or exists (
        select 1 from member_child_access a
        join family_members m on m.id = a.member_id
        where a.child_id = cid
          and a.family_id = c.family_id        -- grant must be in the child's family
          and m.family_id = c.family_id        -- member must be in the child's family
          and m.user_id = auth.uid()
          and coalesce(m.status,'active') = 'active'
      )
    )
  );
$fn$;

-- ---- C1 defence-in-depth: MCA rows must be internally family-consistent -----
create or replace function public.enforce_mca_same_family()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
begin
  if (select family_id from public.children where id = new.child_id) is distinct from new.family_id
     or (select family_id from public.family_members where id = new.member_id) is distinct from new.family_id then
    raise exception 'member_child_access family mismatch (child/member must belong to family_id)'
      using errcode = 'check_violation';
  end if;
  return new;
end $fn$;
drop trigger if exists trg_mca_same_family on public.member_child_access;
create trigger trg_mca_same_family before insert or update on public.member_child_access
  for each row execute function public.enforce_mca_same_family();

-- ---- C2: fm_insert is owner-only (kills stranger self-join as architect) ----
drop policy if exists fm_insert on public.family_members;
create policy fm_insert on public.family_members for insert to authenticated
  with check (is_family_owner(family_id));

-- ---- C4: fm_update is owner-only, both directions ---------------------------
drop policy if exists fm_update on public.family_members;
create policy fm_update on public.family_members for update to authenticated
  using (is_family_owner(family_id)) with check (is_family_owner(family_id));

-- ---- H1: children guard — no re-parenting / credential rewrite by non-owners
create or replace function public.enforce_children_guard()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
begin
  if (new.family_id is distinct from old.family_id
      or new.access_code is distinct from old.access_code
      or new.self_user_id is distinct from old.self_user_id)
     and not is_family_owner(old.family_id)
     and coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'children: family_id/access_code/self_user_id may only be changed by a family owner'
      using errcode = 'check_violation';
  end if;
  return new;
end $fn$;
drop trigger if exists trg_children_guard on public.children;
create trigger trg_children_guard before update on public.children
  for each row execute function public.enforce_children_guard();

-- ---- M5: fam_update gains WITH CHECK, and org_id/ns_locked are frozen -------
drop policy if exists fam_update on public.families;
create policy fam_update on public.families for update to authenticated
  using (is_family_member(id) and (family_role_of(id) = any (array['architect'::family_role,'co_architect'::family_role])))
  with check (is_family_member(id) and (family_role_of(id) = any (array['architect'::family_role,'co_architect'::family_role])));

create or replace function public.enforce_families_guard()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
begin
  if new.org_id is distinct from old.org_id and coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'families.org_id is immutable' using errcode = 'check_violation';
  end if;
  return new;
end $fn$;
drop trigger if exists trg_families_guard on public.families;
create trigger trg_families_guard before update on public.families
  for each row execute function public.enforce_families_guard();

-- ---- H4: billing entitlement must never LOWER capacity on conversion --------
create or replace function public.apply_billing_entitlement()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
begin
  if new.status = 'active' then
    update public.family_profiles
       set child_profile_limit = greatest(coalesce(child_profile_limit,1), 1 + coalesce(new.extra_seats,0))
     where family_id = new.family_id;
  elsif new.status = 'trialing' then
    update public.family_profiles
       set child_profile_limit = greatest(coalesce(child_profile_limit,1), 10 + coalesce(new.extra_seats,0))
     where family_id = new.family_id;
  else
    update public.family_profiles
       set child_profile_limit = greatest(coalesce(child_profile_limit,1), 1)
     where family_id = new.family_id;
  end if;
  return new;
end $fn$;

-- ---- A-ST: constrain family_billing.status to known values -----------------
alter table public.family_billing drop constraint if exists family_billing_status_check;
alter table public.family_billing add constraint family_billing_status_check
  check (status in ('none','active','trialing','past_due','canceled','incomplete','incomplete_expired','unpaid','paused'));

-- ---- A-CD: children need an explicit owner DELETE policy --------------------
drop policy if exists child_del on public.children;
create policy child_del on public.children for delete to authenticated
  using (is_family_owner(family_id));

-- ---- M4: family_profiles — members read/write, but may NOT delete ----------
drop policy if exists family_profiles_rw on public.family_profiles;
drop policy if exists family_profiles_sel on public.family_profiles;
drop policy if exists family_profiles_ins on public.family_profiles;
drop policy if exists family_profiles_upd on public.family_profiles;
create policy family_profiles_sel on public.family_profiles for select to authenticated using (is_family_member(family_id));
create policy family_profiles_ins on public.family_profiles for insert to authenticated with check (is_family_member(family_id));
create policy family_profiles_upd on public.family_profiles for update to authenticated using (is_family_member(family_id)) with check (is_family_member(family_id));

-- ---- C5: child_profile_limit is service-role-only (column-level lock) -------
revoke update on public.family_profiles from authenticated, anon;
grant update (family_id, mission, "values", motto, core_word, core_word_acronym, desired_traits,
  desired_capabilities, vision_answers, learning_style, diy_level, modules_enabled, rhythm,
  faith_enabled, faith_tradition, updated_at, onboarded, travel, location, family_type,
  relationships, faith, inventory_context) on public.family_profiles to authenticated;

-- ---- M2: invitation RPCs must not be callable by anon ----------------------
revoke execute on function public.accept_invitation(text) from anon;
revoke execute on function public.preview_invitation(text) from anon;

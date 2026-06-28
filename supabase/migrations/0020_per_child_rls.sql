-- ============================================================================
-- North Star — Per-child RLS scoping (migration 0020)
-- ----------------------------------------------------------------------------
-- Tightens the child-scoped tables so a CONTRIBUTOR only reaches the children
-- the Owner granted them (member_child_access); OWNERS are unaffected because
-- can_access_child() returns true for any family owner (is_family_owner), and a
-- learner reaches their own record via children.self_user_id.
--
-- SAFE FOR THE EXISTING OWNER: an architect passes is_family_owner → every
-- child-scoped row stays reachable. Family-level rows with a NULL child_id fall
-- back to is_family_member. Child-owned tables keep their no-hard-delete
-- invariant (select/insert/update only — no delete policy).
--
-- Run AFTER 0019. Family-level tables (family_profiles, cart_items) intentionally
-- keep their is_family_member policies (config hiding is enforced in the
-- app/nav; splitting config out of family_profiles is a later refinement).
-- ============================================================================

-- ---- children: read by access; owners create; owners or the learner edit ----
drop policy if exists children_rw on children;
drop policy if exists child_sel  on children;
drop policy if exists child_ins  on children;
drop policy if exists child_upd  on children;
create policy child_sel on children for select to authenticated
  using (can_access_child(id));
create policy child_ins on children for insert to authenticated
  with check (is_family_owner(family_id));
create policy child_upd on children for update to authenticated
  using (is_family_owner(family_id) or self_user_id = auth.uid())
  with check (is_family_owner(family_id) or self_user_id = auth.uid());

-- ---- projects (child_id nullable → family fallback) ----
drop policy if exists projects_rw on projects;
create policy projects_rw on projects for all to authenticated
  using ((child_id is null and is_family_member(family_id)) or can_access_child(child_id))
  with check ((child_id is null and is_family_member(family_id)) or can_access_child(child_id));

-- ---- milestones (scoped through their project's child) ----
drop policy if exists milestones_rw on milestones;
create policy milestones_rw on milestones for all to authenticated
  using (exists (select 1 from projects p where p.id = milestones.project_id
                 and ((p.child_id is null and is_family_member(p.family_id)) or can_access_child(p.child_id))))
  with check (exists (select 1 from projects p where p.id = milestones.project_id
                 and ((p.child_id is null and is_family_member(p.family_id)) or can_access_child(p.child_id))));

-- ---- materials (child_id nullable → family fallback) ----
drop policy if exists materials_rw on materials;
create policy materials_rw on materials for all to authenticated
  using ((child_id is null and is_family_member(family_id)) or can_access_child(child_id))
  with check ((child_id is null and is_family_member(family_id)) or can_access_child(child_id));

-- ---- notifications (child_id nullable → family fallback) ----
drop policy if exists notifications_rw on notifications;
create policy notifications_rw on notifications for all to authenticated
  using ((child_id is null and is_family_member(family_id)) or can_access_child(child_id))
  with check ((child_id is null and is_family_member(family_id)) or can_access_child(child_id));

-- ---- parent_observations (child_id not null) ----
drop policy if exists parent_observations_rw on parent_observations;
create policy parent_observations_rw on parent_observations for all to authenticated
  using (can_access_child(child_id))
  with check (can_access_child(child_id));

-- ---- child-owned layer: scope by child, KEEP no-delete (select/insert/update only) ----
do $$
declare t text;
begin
  foreach t in array array['reflections','milestone_evidence','child_self_assessments','growth_reports'] loop
    execute format('drop policy if exists %1$s_select on %1$s', t);
    execute format('drop policy if exists %1$s_insert on %1$s', t);
    execute format('drop policy if exists %1$s_update on %1$s', t);
    execute format($f$create policy %1$s_select on %1$s for select to authenticated using (can_access_child(child_id));$f$, t);
    execute format($f$create policy %1$s_insert on %1$s for insert to authenticated with check (can_access_child(child_id));$f$, t);
    execute format($f$create policy %1$s_update on %1$s for update to authenticated using (can_access_child(child_id));$f$, t);
  end loop;
end $$;

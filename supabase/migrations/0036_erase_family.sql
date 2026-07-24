-- 0036_erase_family
--
-- RIGHT TO ERASURE (Trust Charter: "their work leaves with them… never create
-- dependency through data lock-in"). A deliberate, ordered, all-or-nothing delete
-- of one family's entire footprint in the database.
--
-- Why a function and not `DELETE FROM families`:
--   The schema deliberately GUARDS a child's story against accidental cascade.
--     children            → families  ON DELETE RESTRICT
--     projects            → children  ON DELETE RESTRICT
--     reflections         → children  ON DELETE RESTRICT
--     growth_reports      → children  ON DELETE RESTRICT
--     child_self_assessments → children ON DELETE RESTRICT
--     milestone_evidence  → children  ON DELETE RESTRICT
--   So a plain family delete FAILS by design. Erasure is the one place we are
--   ALLOWED to override those guards — but only explicitly, in dependency order,
--   inside one transaction, so it can never partial-fail and leave orphans.
--
-- What this does NOT do: it cannot reach Storage object bytes (deletion from the
-- storage schema is blocked to SQL). The `erase-family` edge function garbage-
-- collects the family-media bucket BEFORE calling this, using the Storage API.
--
-- Security: SECURITY DEFINER (bypasses RLS + the RESTRICT ordering). EXECUTE is
-- revoked from every client role and granted ONLY to service_role, so it can be
-- invoked exclusively from the edge function — which does the Owner authZ first.

create or replace function public.erase_family(p_family_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_reflections   int := 0;
  c_selfassess    int := 0;
  c_growth        int := 0;
  c_evidence      int := 0;
  c_projects      int := 0;
  c_children      int := 0;
  c_family        int := 0;
begin
  if p_family_id is null then
    raise exception 'erase_family: family id is required';
  end if;

  -- 1. Remove the child-RESTRICT referrers first, so the children can be deleted.
  --    (Each of these also cascades from families, but we clear them explicitly
  --    and in order so the child rows are unblocked deterministically.)
  delete from reflections            where family_id = p_family_id;
  get diagnostics c_reflections = row_count;

  delete from child_self_assessments where family_id = p_family_id;
  get diagnostics c_selfassess = row_count;

  delete from growth_reports         where family_id = p_family_id;
  get diagnostics c_growth = row_count;

  delete from milestone_evidence     where family_id = p_family_id;
  get diagnostics c_evidence = row_count;

  -- 2. Projects cascade → milestones (→ any remaining milestone_evidence, notifications).
  delete from projects               where family_id = p_family_id;
  get diagnostics c_projects = row_count;

  -- 3. Children are now unblocked. This cascades every child-CASCADE table
  --    (calendar_events, child_mobility_settings, daily_guide, family_relationships,
  --     materials, media_assets, member_child_access, notifications,
  --     parent_observations, reflection_reports).
  delete from children               where family_id = p_family_id;
  get diagnostics c_children = row_count;

  -- 4. Finally the family itself cascades everything else family-scoped
  --    (family_members, family_profiles, family_billing, billing_payers,
  --     family_archive, settings, locations, households, understandings,
  --     inventory_items, invitations, recommendations, reports, …).
  delete from families               where id = p_family_id;
  get diagnostics c_family = row_count;

  return jsonb_build_object(
    'family_id',    p_family_id,
    'family_found', c_family,
    'reflections',  c_reflections,
    'self_assessments', c_selfassess,
    'growth_reports',   c_growth,
    'milestone_evidence', c_evidence,
    'projects',     c_projects,
    'children',     c_children
  );
end;
$$;

-- Lock the door: only the service_role (the edge function) may run this.
revoke all on function public.erase_family(uuid) from public;
revoke all on function public.erase_family(uuid) from anon;
revoke all on function public.erase_family(uuid) from authenticated;
grant execute on function public.erase_family(uuid) to service_role;

comment on function public.erase_family(uuid) is
  'Right-to-erasure: deletes one family''s entire DB footprint in dependency '
  'order (overriding the child-story RESTRICT guards) in a single transaction. '
  'Service-role only; the erase-family edge function does Owner authZ + Storage '
  'GC around it. See docs/data-charter-compliance.md.';

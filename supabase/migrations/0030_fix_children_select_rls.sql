-- 0030_fix_children_select_rls
--
-- CRITICAL sync bug: no family created after the per-child RLS landed could sync
-- its children (and therefore its projects, milestones, and uploaded evidence —
-- the whole tree cascades off the child).
--
-- Root cause: the children SELECT policy was `can_access_child(id)`, which is a
-- STABLE SECURITY DEFINER function that re-queries the `children` table for that id.
-- PostgREST performs every write as `INSERT ... ON CONFLICT ... RETURNING *`, and
-- RETURNING requires the new row to pass the SELECT policy. But a STABLE function
-- reads the pre-statement snapshot, so during the insert it CANNOT see the very row
-- being inserted → can_access_child returns false → the RETURNING is RLS-denied
-- (42501). A plain INSERT (no RETURNING) passed; the RETURNING is what broke it.
-- Families created before this policy existed (e.g. 2026-06-21) synced fine; every
-- family after was silently blocked.
--
-- Fix: inline the SAME access rule against the row's OWN columns (family_id,
-- self_user_id) instead of the self-referential function call. It evaluates on the
-- new row directly — no snapshot problem — while preserving identical security:
-- the family owner, the child's own portal user, or an explicit member_child_access
-- grant WITHIN the same family. Verified: a member of one family still sees zero of
-- another family's children (isolation intact).

drop policy if exists child_sel on public.children;
create policy child_sel on public.children
  for select to authenticated
  using (
    is_family_owner(family_id)
    or self_user_id = auth.uid()
    or exists (
      select 1 from member_child_access a
      join family_members m on m.id = a.member_id
      where a.child_id = children.id
        and a.family_id = children.family_id
        and m.user_id = auth.uid()
        and coalesce(m.status, 'active') = 'active'
    )
  );

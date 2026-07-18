-- Rollback 0030 — restore the previous (self-referential) children SELECT policy.
-- NOTE: this reintroduces the INSERT...RETURNING sync bug; here only for parity.
drop policy if exists child_sel on public.children;
create policy child_sel on public.children
  for select to authenticated
  using (can_access_child(id));

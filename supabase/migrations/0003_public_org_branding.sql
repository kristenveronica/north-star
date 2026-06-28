-- ============================================================================
-- North Star — public org branding (migration 0003)
-- White-label branding (name, logo, colour) must be readable BEFORE login so
-- the marketing/login page can theme itself per organization. Allow anon read
-- on organizations only. No other table is exposed to anon.
-- ============================================================================
drop policy if exists org_read on organizations;
create policy org_read on organizations
  for select to anon, authenticated using (true);

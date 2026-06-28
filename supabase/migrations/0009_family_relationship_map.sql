-- ============================================================================
-- North Star — Family Relationship Map (migration 0009)
-- ----------------------------------------------------------------------------
-- Denormalized relationship map on family_profiles so it rides the existing
-- family-profile sync (no new sync plumbing). The normalized family_relationships
-- table (0008) remains for future per-child / per-household scoping.
--   relationships: [{id, name, relationship, roleNote}]
-- ============================================================================
alter table family_profiles add column if not exists relationships jsonb not null default '[]';

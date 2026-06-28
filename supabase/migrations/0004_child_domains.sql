-- ============================================================================
-- North Star — per-child domains (migration 0004)
-- The app stores each child's selected learning domains ("Gigs") as an array.
-- ============================================================================
alter table children add column if not exists domains jsonb not null default '[]';

-- ============================================================================
-- North Star — milestone instructions + project quest role (migration 0007)
-- Milestones carry concrete, measurable action-step instructions a child can
-- open and follow. Projects carry a "quest role" (the child as hero).
-- ============================================================================
alter table milestones add column if not exists instructions jsonb not null default '[]';
alter table projects   add column if not exists quest_role text;

-- ============================================================================
-- North Star — onboarded flag (migration 0005)
-- Lets the app decide onboarding-vs-dashboard after a cloud login, instead of
-- relying on a device-local meta flag.
-- ============================================================================
alter table family_profiles add column if not exists onboarded boolean not null default false;

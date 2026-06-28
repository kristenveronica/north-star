-- ============================================================
-- 0016_project_capability_map.sql
-- Capability Domains become a core intelligence layer of North Star.
-- Every generated project now maps against the Capability Domains it
-- develops. This metadata powers reflection reports, capability
-- visualisations, emerging-strengths detection and long-term growth
-- tracking.
--
-- Shape of capability_map (jsonb):
--   {
--     "primary":   ["literacy", "enterprise"],     -- ids it most develops
--     "secondary": ["leadership", "practical"],     -- ids it also touches
--     "skills":    ["budgeting", "public speaking"], -- specific skills grown
--     "competencyGrowth": { "literacy": 15, ... }    -- est. growth 0–100
--   }
--
-- The existing `domains` jsonb column is retained (= primary ∪ secondary)
-- so every current view keeps rendering. Academic/curriculum context is
-- stored inside children.learning_profile (jsonb) — no column needed.
-- ============================================================

alter table public.projects
  add column if not exists capability_map jsonb not null default '{}'::jsonb;

comment on column public.projects.capability_map is
  'Capability Domain mapping: { primary[], secondary[], skills[], competencyGrowth{} }. Powers reflections, capability visualisations and growth tracking.';

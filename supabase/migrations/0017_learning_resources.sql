-- ============================================================
-- 0017_learning_resources.sql
-- "Suggested Materials" evolves into the Learning Resources engine.
-- Resource records now carry which of the five sections they belong to,
-- a richer ownership lifecycle (status), and a metadata blob that powers
-- the intelligence connecting Learning Resources to projects, capability
-- domains, printables and the partner marketplace.
--
--   section : essentials | project | personalised | printable | marketplace
--   status  : suggested | approved | owned | self-source | dismissed
--   meta    : { catalogId, format, frequency, capabilityDomains[],
--               projectIds[], affiliateAvailable, purchased }
--
-- The legacy approved/rejected/in_cart booleans are retained and kept in
-- sync, so existing data and the cart keep working unchanged.
-- ============================================================

alter table public.materials
  add column if not exists section text not null default 'personalised',
  add column if not exists status  text not null default 'suggested',
  add column if not exists meta    jsonb not null default '{}'::jsonb;

comment on column public.materials.section is 'Learning Resources section: essentials | project | personalised | printable | marketplace';
comment on column public.materials.status  is 'Ownership lifecycle: suggested | approved | owned | self-source | dismissed';
comment on column public.materials.meta    is 'Resource metadata: { catalogId, format, frequency, capabilityDomains[], projectIds[], affiliateAvailable, purchased }';

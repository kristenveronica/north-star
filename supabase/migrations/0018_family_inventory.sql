-- ============================================================
-- 0018_family_inventory.sql
-- The living Family Inventory ("Learning Toolkit") — North Star's
-- understanding of what each family already owns and has access to.
-- Feeds project generation (use what they have before recommending
-- purchases), resource recommendations, rewards and printables.
--
--   inventory_items : one row per owned item, tagged by category
--   family_profiles.inventory_context : light structured context
--     (music lessons, sports clubs, reading memberships, etc.)
-- ============================================================

create table if not exists public.inventory_items (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  category    text not null,
  name        text not null,
  owned       boolean not null default true,
  note        text,
  meta        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists inventory_items_family_idx on public.inventory_items(family_id);

-- RLS — a family only ever sees its own rows.
do $$
declare t text;
begin
  foreach t in array array['inventory_items'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I_rw on public.%I;', t, t);
    execute format(
      'create policy %I_rw on public.%I for all using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));',
      t, t);
  end loop;
end$$;

-- Structured inventory context lives on the family profile.
alter table public.family_profiles
  add column if not exists inventory_context jsonb not null default '{}'::jsonb;

comment on table  public.inventory_items is 'Living Family Inventory: what the family already owns, by category. Feeds project generation and resource recommendations.';
comment on column public.family_profiles.inventory_context is 'Light structured inventory context: { music:{lessons,teaching,app,genres,artists}, sports:{played,clubs,coaching,favourites}, books:{library,kindle,audible,authors} }';

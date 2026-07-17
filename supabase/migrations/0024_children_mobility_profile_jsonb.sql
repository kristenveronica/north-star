-- 0024_children_mobility_profile_jsonb
--
-- Recovered from production (supabase_migrations.schema_migrations version
-- 20260704212047) on 2026-07-17 to reconcile repo ↔ prod: this migration was
-- applied to production but its file was never committed. SQL below is the exact
-- statement production ran; verified live (children.mobility_profile is jsonb).
--
-- Fix the pathway-class round-trip bug on children.mobility_profile.
-- The app writes an object { permissions:[...], notes:"" } but the column was
-- `text`, so supabase-js serialized it to a JSON *string*. On read-back the app
-- got a string, not an object, so `mobilityProfile.permissions` was undefined and
-- every mobility checkbox silently reset (and the AI lost mobility context).
-- Migrate to jsonb, parsing the existing stringified-JSON values in place.
-- Verified beforehand: all non-null values are valid JSON objects (no bare slugs).
alter table public.children
  alter column mobility_profile type jsonb
  using (
    case
      when mobility_profile is null then null
      when btrim(mobility_profile) = '' then null
      else mobility_profile::jsonb
    end
  );

-- ============================================================================
-- 0035 · TTS cache — spoken audio for "Read to me"
-- ----------------------------------------------------------------------------
-- The child mission page can read the story + steps aloud in a warm AI voice
-- (OpenAI gpt-4o-mini-tts). Mission text is stable and children replay it, so
-- we cache the generated MP3 (base64) keyed by a hash of (model|voice|text).
-- A cache hit avoids a paid TTS call entirely.
--
-- Written by the `child-portal` edge function via the service role. RLS is
-- ENABLED with NO policies → service-role-only (clients can't read/write it).
-- Rows are small (one short sentence of MP3 ≈ a few KB base64).
-- ============================================================================

create table if not exists public.tts_cache (
  hash       text        primary key,   -- sha256(model|voice|text)
  audio      text        not null,       -- base64 MP3
  created_at timestamptz not null default now()
);

alter table public.tts_cache enable row level security;
-- Intentionally no policies: only the service role (edge function) may touch it.

comment on table public.tts_cache is
  'Cache of AI-spoken audio (base64 MP3) for the child mission read-aloud, keyed by sha256(model|voice|text). Written by the child-portal edge function via service role; RLS-enabled with no policies = service-role-only.';

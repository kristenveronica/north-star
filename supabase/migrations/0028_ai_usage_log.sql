-- 0028_ai_usage_log
--
-- Turn the lights on: persist token usage + cost for every AI call so we can
-- optimise from measured numbers, not estimates (see docs/ai-cost-audit.md).
-- The edge function already has the Anthropic `usage` in hand; this is where it
-- lands. Service-role only — this is internal telemetry, never family-readable.

create table if not exists public.ai_usage_log (
  id                     uuid primary key default gen_random_uuid(),
  created_at             timestamptz not null default now(),
  action                 text not null,
  family_id              uuid,                       -- loose ref (no FK: telemetry must never block on a delete)
  model                  text,
  input_tokens           integer not null default 0, -- billable, non-cached input
  output_tokens          integer not null default 0,
  cache_read_tokens      integer not null default 0, -- cached prefix reads (cheap)
  cache_creation_tokens  integer not null default 0, -- cache writes (1.25x)
  cost_usd               numeric(12,6) not null default 0,
  duration_ms            integer
);

-- Deny-all to clients; only the service role (edge function) reads/writes.
alter table public.ai_usage_log enable row level security;
revoke all on public.ai_usage_log from anon, authenticated;
grant select, insert on public.ai_usage_log to service_role;

create index if not exists idx_ai_usage_action_time on public.ai_usage_log (action, created_at desc);
create index if not exists idx_ai_usage_family_time on public.ai_usage_log (family_id, created_at desc);

-- ============================================================================
-- 0026_security_events
-- A service-role-only ledger for security-relevant events: portal brute-force
-- attempts, billing-abuse, repeated AI abuse, privilege-escalation attempts.
-- Doubles as the backing store for lightweight rate limiting in edge functions.
-- Additive; no impact on existing tables/data.
-- ============================================================================
create table if not exists public.security_events (
  id          bigint generated always as identity primary key,
  event_type  text not null,
  ip          text,
  identifier  text,                          -- family_id / normalized code / email
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists security_events_ip_lookup    on public.security_events(event_type, ip, created_at desc);
create index if not exists security_events_ident_lookup on public.security_events(event_type, identifier, created_at desc);

alter table public.security_events enable row level security;
-- No RLS policies + no grants → only the service role (edge functions) can touch it.
revoke all on public.security_events from anon, authenticated;

-- ============================================================================
-- 0037 · Calendar feeds — subscribe to external calendars (Google / iCloud / …)
-- ----------------------------------------------------------------------------
-- A family can subscribe to one or more read-only ICS ("secret address in iCal
-- format") URLs. The URL is stored here; the `calendar-ics` edge function
-- fetches + parses it server-side (browsers can't fetch a third-party .ics
-- directly — CORS — and the URL is a secret we should not expose in page HTML).
-- External events are overlaid on the calendar read-only. We never write back.
--
-- One-way, read-only, opt-in. Two-way sync (writing North Star events into a
-- Google/Apple calendar) is a heavier, separate future project (OAuth).
-- ============================================================================

create table if not exists public.calendar_feeds (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references public.families(id) on delete cascade,
  label          text not null,                       -- "Mum's Google Calendar"
  url            text not null,                        -- secret ICS/webcal URL
  color          text,                                 -- optional overlay colour
  created_by     uuid references auth.users(id),
  last_synced_at timestamptz,                          -- last successful fetch
  last_error     text,                                 -- last fetch/parse failure (if any)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_calendar_feeds_family on public.calendar_feeds(family_id);

-- ---------- RLS · strictly family-scoped -----------------------------------
alter table public.calendar_feeds enable row level security;

create policy cf_sel on public.calendar_feeds for select using (is_family_member(family_id));
create policy cf_ins on public.calendar_feeds for insert with check (is_family_member(family_id));
create policy cf_upd on public.calendar_feeds for update using (is_family_member(family_id)) with check (is_family_member(family_id));
create policy cf_del on public.calendar_feeds for delete using (is_family_member(family_id));

-- ---------- Grants · authenticated (RLS governs); anon has no access --------
grant select, insert, update, delete on public.calendar_feeds to authenticated;
revoke all on public.calendar_feeds from anon;

comment on table public.calendar_feeds is
  'Read-only external calendar subscriptions (secret ICS URLs). Fetched + parsed server-side by the calendar-ics edge function and overlaid on the family calendar. One-way, opt-in; never written back to.';

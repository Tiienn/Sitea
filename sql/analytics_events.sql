-- Analytics events sink (v1 reset, 2026-06-12)
-- Append-only event log written by the browser via the anon key.
-- Read it from the Supabase SQL editor / dashboard only — no public SELECT policy.
--
-- Example queries:
--   select event_name, count(*) from analytics_events
--     where created_at > now() - interval '7 days' group by 1 order by 2 desc;
--   select props->>'mode', count(*) from analytics_events
--     where event_name = 'landing_loaded' group by 1;

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  event_name text not null check (char_length(event_name) between 1 and 64),
  props jsonb not null default '{}'::jsonb check (pg_column_size(props) <= 2048),
  device text check (device in ('mobile', 'desktop')),
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_name_time_idx
  on public.analytics_events (event_name, created_at desc);

alter table public.analytics_events enable row level security;

-- Anyone may append events; nobody (except service role/dashboard) may read.
drop policy if exists analytics_events_insert on public.analytics_events;
create policy analytics_events_insert
  on public.analytics_events for insert
  to anon, authenticated
  with check (true);

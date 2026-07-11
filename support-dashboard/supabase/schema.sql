-- Support System Trend Watcher — schema
-- Single-user product: RLS locks all tables to the service role + the one
-- authenticated owner. The frontend reads with the anon key + owner session;
-- edge functions write with the service role.

create table if not exists whoop_cycles (
  date        date primary key,
  strain      numeric(4,1),
  recovery    integer check (recovery between 0 and 100),
  hrv         integer,
  sleep_hours numeric(3,1),
  synced_at   timestamptz not null default now()
);

create table if not exists whoop_workouts (
  id           bigint generated always as identity primary key,
  whoop_id     text unique,           -- upsert key for the nightly sync
  date         date not null,
  sport        text not null check (sport in ('lift','run','other')),
  strain       numeric(4,1),
  duration_min integer,
  synced_at    timestamptz not null default now()
);
create index if not exists whoop_workouts_date_idx on whoop_workouts (date);

create table if not exists calendar_events (
  id        bigint generated always as identity primary key,
  source_id text unique not null,     -- Google Calendar event id (idempotent sync)
  date      date not null,
  type      text not null check (type in ('therapy','physio')),
  synced_at timestamptz not null default now()
);
create index if not exists calendar_events_date_idx on calendar_events (date);

create table if not exists inbody_scans (
  date      date primary key,
  weight_kg numeric(4,1) not null,
  smm_kg    numeric(4,1) not null,
  bf_pct    numeric(4,1) not null,
  created_at timestamptz not null default now()
);

create table if not exists essays (
  id    bigint generated always as identity primary key,
  date  date not null,
  url   text unique not null,
  title text not null,
  created_at timestamptz not null default now()
);
create index if not exists essays_date_idx on essays (date);

create table if not exists monthly_pulse (
  month   text primary key check (month ~ '^\d{4}-\d{2}$'),
  ratings jsonb not null default '{}',
  note    text,
  created_at timestamptz not null default now()
);

-- Whoop OAuth tokens for the nightly sync (service-role only; never exposed)
create table if not exists whoop_tokens (
  id            boolean primary key default true check (id), -- single row
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  updated_at    timestamptz not null default now()
);

-- RLS: owner-only reads, service-role writes for synced tables
alter table whoop_cycles    enable row level security;
alter table whoop_workouts  enable row level security;
alter table calendar_events enable row level security;
alter table inbody_scans    enable row level security;
alter table essays          enable row level security;
alter table monthly_pulse   enable row level security;
alter table whoop_tokens    enable row level security; -- no policies: service role only

create policy "owner reads"  on whoop_cycles    for select to authenticated using (true);
create policy "owner reads"  on whoop_workouts  for select to authenticated using (true);
create policy "owner reads"  on calendar_events for select to authenticated using (true);
create policy "owner reads"  on inbody_scans    for select to authenticated using (true);
create policy "owner reads"  on essays          for select to authenticated using (true);
create policy "owner reads"  on monthly_pulse   for select to authenticated using (true);

create policy "owner writes" on inbody_scans  for insert to authenticated with check (true);
create policy "owner writes" on essays        for insert to authenticated with check (true);
create policy "owner writes" on monthly_pulse for insert to authenticated with check (true);
create policy "owner updates" on monthly_pulse for update to authenticated using (true);

-- Nightly sync schedule (run once; requires pg_cron + pg_net, both available on Supabase).
-- Replace <PROJECT_REF> and <CRON_SECRET> before running:
--
-- select cron.schedule('whoop-sync-nightly', '10 3 * * *', $$
--   select net.http_post(
--     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/whoop-sync',
--     headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb)
-- $$);
-- select cron.schedule('calendar-sync-nightly', '20 3 * * *', $$
--   select net.http_post(
--     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/calendar-sync',
--     headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb)
-- $$);
-- select cron.schedule('rss-poll-nightly', '30 3 * * *', $$
--   select net.http_post(
--     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/rss-poll',
--     headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb)
-- $$);

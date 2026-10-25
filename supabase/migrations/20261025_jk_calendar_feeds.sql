-- Private iCalendar subscription state. Only the Edge Function service role may
-- access calendar data or token hashes; no direct anon/authenticated grants.
create table if not exists public.jk_calendar_feeds (
 user_id uuid primary key references auth.users(id) on delete cascade,
 token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
 events jsonb not null default '[]'::jsonb check (jsonb_typeof(events)='array'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.jk_calendar_feeds enable row level security;
revoke all on public.jk_calendar_feeds from anon, authenticated;
comment on table public.jk_calendar_feeds is 'Private read-only ICS links and minimal job event projection. Access via service-role Edge Function only.';

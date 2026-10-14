-- APART GOEDKEUREN: niet uitgevoerd op productie.
create table if not exists public.jk_push_subscriptions (
 endpoint text primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 subscription jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.jk_push_subscriptions enable row level security;
-- Geen client policies: uitsluitend Edge Function met service role beheert abonnementen.
create index if not exists jk_push_subscriptions_user_id_idx on public.jk_push_subscriptions(user_id);

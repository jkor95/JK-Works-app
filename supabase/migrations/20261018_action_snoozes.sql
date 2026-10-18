-- v71.9.0. Applied to JK Works Supabase; safe to run more than once.
create table if not exists public.jk_push_action_snoozes (
  user_id uuid not null references auth.users(id) on delete cascade,
  action_key text not null,
  due_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending','sending','sent','failed')),
  updated_at timestamptz not null default now(),
  notified_at timestamptz,
  primary key (user_id,action_key),
  constraint jk_push_snoozes_key_size check (char_length(action_key) between 3 and 130)
);
create index if not exists jk_push_action_snoozes_due_idx
  on public.jk_push_action_snoozes (due_at) where status = 'pending';
alter table public.jk_push_action_snoozes enable row level security;
revoke all on public.jk_push_action_snoozes from anon, authenticated;
-- The existing jk-push scheduled-actions cron job is adjusted to */5 minutes
-- directly in production. Its existing authenticated request stays unchanged.

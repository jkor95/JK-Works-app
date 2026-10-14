-- Applied separately to JK Works Supabase with explicit owner authorization.
create table if not exists public.jk_push_action_state (
 user_id uuid not null references auth.users(id) on delete cascade,
 action_key text not null,
 active boolean not null default true,
 primary key(user_id,action_key)
);
alter table public.jk_push_action_state enable row level security;
create table if not exists public.jk_push_user_state (
 user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.jk_push_user_state enable row level security;

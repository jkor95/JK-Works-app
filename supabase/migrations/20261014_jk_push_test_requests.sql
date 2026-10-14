-- Afzonderlijke goedkeuring vereist. Alleen een nieuw register voor handmatige testpush.
-- Geen wijzigingen aan bedrijfsgegevens, bestaande tabellen, policies of cronjobs.
create table public.jk_push_test_requests (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 scheduled_for timestamptz not null,
 created_at timestamptz not null default now(),
 status text not null default 'queued' check (status in ('queued','sending','completed','failed')),
 delivered integer not null default 0,
 failed integer not null default 0,
 primary key (user_id,request_id)
);
alter table public.jk_push_test_requests enable row level security;
revoke all on public.jk_push_test_requests from anon,authenticated;
grant select,insert,update on public.jk_push_test_requests to service_role;
-- Geen clientpolicies. Alleen jk-push gebruikt het register na auth.getUser.
-- Aanvraagcodes blijven bewaard, zodat een herhaling geen tweede verzending start.

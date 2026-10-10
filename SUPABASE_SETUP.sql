-- JK Works Dordrecht - eenmalig uitvoeren in Supabase > SQL Editor

create table if not exists public.app_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  store text not null,
  record_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, store, record_id)
);

alter table public.app_records enable row level security;

drop policy if exists "jkworks_select_own" on public.app_records;
create policy "jkworks_select_own" on public.app_records
for select using (auth.uid() = user_id);

drop policy if exists "jkworks_insert_own" on public.app_records;
create policy "jkworks_insert_own" on public.app_records
for insert with check (auth.uid() = user_id);

drop policy if exists "jkworks_update_own" on public.app_records;
create policy "jkworks_update_own" on public.app_records
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "jkworks_delete_own" on public.app_records;
create policy "jkworks_delete_own" on public.app_records
for delete using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('jkworks-files','jkworks-files',false)
on conflict (id) do nothing;

drop policy if exists "jkworks_files_select_own" on storage.objects;
create policy "jkworks_files_select_own" on storage.objects
for select using (
  bucket_id = 'jkworks-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "jkworks_files_insert_own" on storage.objects;
create policy "jkworks_files_insert_own" on storage.objects
for insert with check (
  bucket_id = 'jkworks-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "jkworks_files_update_own" on storage.objects;
create policy "jkworks_files_update_own" on storage.objects
for update using (
  bucket_id = 'jkworks-files'
  and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'jkworks-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "jkworks_files_delete_own" on storage.objects;
create policy "jkworks_files_delete_own" on storage.objects
for delete using (
  bucket_id = 'jkworks-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- v10: permanente verwijderlog. Nodig om verwijderingen tussen apparaten
-- betrouwbaar te synchroniseren en oude lokale kopieen te blokkeren.
create table if not exists public.app_deletions (
  user_id uuid not null references auth.users(id) on delete cascade,
  store text not null,
  record_id text not null,
  deleted_at timestamptz not null default now(),
  primary key (user_id, store, record_id)
);

alter table public.app_deletions enable row level security;

drop policy if exists "jkworks_deletions_select_own" on public.app_deletions;
create policy "jkworks_deletions_select_own" on public.app_deletions
for select using (auth.uid() = user_id);

drop policy if exists "jkworks_deletions_insert_own" on public.app_deletions;
create policy "jkworks_deletions_insert_own" on public.app_deletions
for insert with check (auth.uid() = user_id);

drop policy if exists "jkworks_deletions_update_own" on public.app_deletions;
create policy "jkworks_deletions_update_own" on public.app_deletions
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "jkworks_deletions_delete_own" on public.app_deletions;
create policy "jkworks_deletions_delete_own" on public.app_deletions
for delete using (auth.uid() = user_id);


-- v63: openbare website-inhoud. Alleen het ene expliciet openbare contentrecord
-- mag zonder login worden gelezen; schrijven blijft onder de bestaande auth.uid()-regels vallen.
drop policy if exists "jkworks_public_website_select" on public.app_records;
create policy "jkworks_public_website_select" on public.app_records
for select using (store = 'websitePublic' and record_id = 'main');

-- v68: openbaar aanvraagformulier op jkworks.nl.
-- Publieke bezoekers mogen alleen nieuwe aanvragen toevoegen. Alleen de eigenaar
-- van deze JK Works-app kan aanvragen lezen, bijwerken of verwijderen.
create table if not exists public.public_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'new',
  owner_id uuid not null references auth.users(id) default '92eefdf4-d915-41c7-b844-5b17071f1bd9',
  name text not null,
  company text,
  phone text,
  email text,
  request_type text not null,
  requested_date date,
  start_time time,
  end_time time,
  location text,
  description text not null,
  preferred_contact text,
  photo_paths text[] not null default '{}'
);

alter table public.public_requests enable row level security;
grant insert on table public.public_requests to anon;
grant select, update, delete on table public.public_requests to authenticated;

drop policy if exists "jkworks_public_request_insert" on public.public_requests;
create policy "jkworks_public_request_insert"
on public.public_requests for insert to anon
with check (
  owner_id = '92eefdf4-d915-41c7-b844-5b17071f1bd9'
  and status = 'new'
  and char_length(trim(name)) between 2 and 100
  and char_length(trim(request_type)) between 2 and 100
  and char_length(trim(description)) between 10 and 2000
  and cardinality(photo_paths) <= 3
  and (nullif(trim(coalesce(phone,'')),'') is not null or nullif(trim(coalesce(email,'')),'') is not null)
);

drop policy if exists "jkworks_requests_authenticated_select" on public.public_requests;
create policy "jkworks_requests_authenticated_select"
on public.public_requests for select to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "jkworks_requests_authenticated_update" on public.public_requests;
create policy "jkworks_requests_authenticated_update"
on public.public_requests for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id and status in ('new','contact','converted','rejected'));

drop policy if exists "jkworks_requests_authenticated_delete" on public.public_requests;
create policy "jkworks_requests_authenticated_delete"
on public.public_requests for delete to authenticated
using ((select auth.uid()) = owner_id);

-- Kleine, private opslag voor maximaal drie gecomprimeerde aanvraagfoto's.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jkworks-request-files','jkworks-request-files',false,307200,array['image/jpeg'])
on conflict (id) do update
set public=false, file_size_limit=307200, allowed_mime_types=array['image/jpeg'];

drop policy if exists "jkworks_request_files_anon_insert" on storage.objects;
create policy "jkworks_request_files_anon_insert"
on storage.objects for insert to anon
with check (
  bucket_id = 'jkworks-request-files'
  and (storage.foldername(name))[1] = 'requests'
  and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and storage.filename(name) ~ '^foto-[1-3]\.jpg$'
);

drop policy if exists "jkworks_request_files_owner_select" on storage.objects;
create policy "jkworks_request_files_owner_select"
on storage.objects for select to authenticated
using (bucket_id = 'jkworks-request-files' and (select auth.uid()) = '92eefdf4-d915-41c7-b844-5b17071f1bd9');

drop policy if exists "jkworks_request_files_owner_delete" on storage.objects;
create policy "jkworks_request_files_owner_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'jkworks-request-files' and (select auth.uid()) = '92eefdf4-d915-41c7-b844-5b17071f1bd9');

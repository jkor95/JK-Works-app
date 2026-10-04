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

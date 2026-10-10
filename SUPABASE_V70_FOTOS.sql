-- Eenmalig uitvoeren in Supabase SQL Editor bij upgrade van v69 naar v70.
-- Bestaande aanvragen blijven behouden.
drop policy if exists "jkworks_public_request_insert" on public.public_requests;
create policy "jkworks_public_request_insert"
on public.public_requests for insert to anon
with check (
  owner_id = '92eefdf4-d915-41c7-b844-5b17071f1bd9'
  and status = 'new'
  and char_length(trim(name)) between 2 and 100
  and char_length(trim(request_type)) between 2 and 100
  and char_length(trim(description)) between 10 and 2000
  and (nullif(trim(coalesce(phone,'')),'') is not null or nullif(trim(coalesce(email,'')),'') is not null)
);
drop policy if exists "jkworks_request_files_anon_insert" on storage.objects;
create policy "jkworks_request_files_anon_insert"
on storage.objects for insert to anon
with check (
  bucket_id = 'jkworks-request-files'
  and (storage.foldername(name))[1] = 'requests'
  and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and storage.filename(name) ~ '^foto-[1-9][0-9]*\.jpg$'
);

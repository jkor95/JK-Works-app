"""Disposable PostgreSQL + HTTP Storage + encrypted local-vault integration test."""
import contextlib
import http.server
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time
import unittest
import uuid

import psycopg
import cloud_backup as backup


class BackupTest(unittest.TestCase):
    def test_encrypted_backup_restore_and_failure_guards(self):
        with self.assertRaises(RuntimeError):
            backup.configure({}, fixture=False)
        name = 'jk-backup-test-' + uuid.uuid4().hex[:12]
        subprocess.run(['docker','run','-d','--name',name,'-p','127.0.0.1::5432',
                        '-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17'], check=True, stdout=subprocess.DEVNULL)
        try:
            port = subprocess.check_output(['docker','port',name,'5432/tcp'], text=True).strip().rsplit(':',1)[1]
            args = dict(host='127.0.0.1',port=port,user='postgres',dbname='postgres',sslmode='disable')
            deadline = time.monotonic() + 45
            while True:
                try:
                    with psycopg.connect(**args):
                        break
                except psycopg.OperationalError:
                    if time.monotonic() > deadline:
                        raise
                    time.sleep(.2)
            with psycopg.connect(**args, autocommit=True) as conn:
                conn.execute('create database source_fixture')
                conn.execute('create database restored_fixture')
            args['dbname'] = 'source_fixture'
            bucket_ids = sorted(backup.REQUIRED_BUCKETS | {'extra-bucket'})
            content = {('jkworks-files','fixture/photo.jpg'):b'FAKE PHOTO',
                       ('extra-bucket','document.pdf'):b'%PDF-FAKE DOCUMENT'}
            with psycopg.connect(**args) as conn:
                conn.execute('create schema auth; create schema storage; create schema extra')
                conn.execute('create table auth.users(id text primary key, email text)')
                conn.execute("insert into auth.users values ('fixture-user','fixture@example.invalid')")
                conn.execute('create table public.app_records(id text primary key, data jsonb)')
                conn.execute("insert into public.app_records values ('fixture-client', '{\"invoice\":42}')")
                conn.execute('create table public.app_deletions(id text); create table public.public_requests(id text)')
                conn.execute('create table extra.other_data(id integer); insert into extra.other_data values (7)')
                conn.execute('alter table public.app_records enable row level security')
                conn.execute('create policy fixture_policy on public.app_records for select using (true)')
                conn.execute('create role fixture_reader; grant usage on schema public to fixture_reader; grant select on public.app_records to fixture_reader')
                conn.execute('create table storage.buckets(id text primary key, public boolean)')
                conn.execute('create table storage.objects(id text,bucket_id text,name text,metadata jsonb,updated_at text)')
                for bucket in bucket_ids:
                    conn.execute('insert into storage.buckets values (%s,false)', (bucket,))
                for i, ((bucket, key), data) in enumerate(content.items()):
                    conn.execute('insert into storage.objects values (%s,%s,%s,%s,%s)',
                                 (str(i),bucket,key,json.dumps({'size':len(data)}),'fixture-time-1'))
            requests = []
            class Storage(http.server.BaseHTTPRequestHandler):
                def do_GET(self):
                    requests.append(self.path)
                    from urllib.parse import unquote
                    key = unquote(self.path).split('/storage/v1/object/authenticated/',1)[-1]
                    bucket, object_name = key.split('/',1)
                    body = content[(bucket,object_name)]
                    self.send_response(200); self.end_headers(); self.wfile.write(body)
                def log_message(self, *args):
                    pass
            server = http.server.ThreadingHTTPServer(('127.0.0.1',0),Storage)
            threading.Thread(target=server.serve_forever,daemon=True).start()
            try:
                with tempfile.TemporaryDirectory() as temp:
                    directory = Path(temp)
                    vault = directory / 'encrypted'
                    vault.mkdir()
                    env = dict(os.environ,PGHOST='127.0.0.1',PGPORT=port,PGUSER='postgres',PGPASSWORD='',
                               PGDATABASE='source_fixture',PGSSLMODE='disable',
                               BACKUP_CRYPT_PASSWORD='fixture-only-password-' + 'x'*40,
                               BACKUP_CRYPT_SALT='fixture-only-salt-' + 'y'*40,
                               RCLONE_CONFIG_VAULT_REMOTE=str(vault),
                               SUPABASE_URL=f'http://127.0.0.1:{server.server_port}',
                               SUPABASE_STORAGE_READ_KEY='fixture-only-key')
                    first, manifest, configured = backup.backup(env,fixture=True)
                    self.assertEqual(len(requests),2)
                    self.assertEqual(len(manifest['buckets']),4)
                    self.assertEqual(manifest['table_counts']['auth.users'],1)
                    second, _, configured = backup.backup(env,fixture=True)
                    self.assertEqual(len(requests),2, 'Unchanged objects must be reused from the off-site backup')
                    restored = directory / 'restored'
                    restored_manifest = backup.download_verified(second,restored,configured)
                    # Ciphertext contains neither database record IDs nor plaintext document content.
                    for file in vault.rglob('*'):
                        if file.is_file():
                            self.assertNotIn(b'fixture-client',file.read_bytes())
                            self.assertNotIn(b'FAKE PHOTO',file.read_bytes())
                    with (restored / 'database.dump').open('rb') as stream:
                        subprocess.run(['docker','exec','-i',name,'pg_restore','-U','postgres',
                                        '-d','restored_fixture','--exit-on-error'],stdin=stream,
                                       check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
                    restore_args = dict(args,dbname='restored_fixture')
                    with psycopg.connect(**restore_args) as conn:
                        counts,buckets,objects = backup.inventory(conn)
                        self.assertEqual(counts,restored_manifest['table_counts'])
                        self.assertEqual(len(buckets),4)
                        self.assertEqual(conn.execute('select count(*) from pg_policies where policyname=%s',
                                                     ('fixture_policy',)).fetchone()[0],1)
                        self.assertEqual(conn.execute('select data from public.app_records').fetchone()[0],{'invoice':42})
                        self.assertTrue(conn.execute("select has_table_privilege('fixture_reader','public.app_records','SELECT')").fetchone()[0])
                    self.assertIn('fixture_reader', (restored / 'roles.sql').read_text())
                    wrong = dict(configured)
                    wrong['RCLONE_CONFIG_VAULT_PASSWORD'] = backup.run(['rclone','obscure','-'], wrong, input_text='wrong-fixture-password-' + 'z'*40 + '\n').strip()
                    with self.assertRaises(RuntimeError):
                        backup.download_verified(second,directory / 'wrong-key',wrong)
                    for obj in restored_manifest['objects']:
                        self.assertEqual((restored / obj['file']).read_bytes(),content[(obj['bucket_id'],obj['name'])])
                    # Detect corruption; never report a damaged payload as a valid restore.
                    (restored / 'database.dump').write_bytes(b'CORRUPTED')
                    with self.assertRaises(RuntimeError):
                        backup.verify_directory(restored,restored_manifest)
                    # Changed objects are downloaded; deleted objects disappear only in new snapshots.
                    content[('jkworks-files','fixture/photo.jpg')] = b'UPDATED FAKE PHOTO'
                    with psycopg.connect(**args) as conn:
                        conn.execute('update storage.objects set metadata=%s,updated_at=%s where bucket_id=%s',
                                     (json.dumps({'size':len(b'UPDATED FAKE PHOTO')}),'fixture-time-2','jkworks-files'))
                        conn.execute('delete from storage.objects where bucket_id=%s',('extra-bucket',))
                    third, third_manifest, configured = backup.backup(env,fixture=True)
                    self.assertEqual(len(requests),3)
                    self.assertEqual(len(third_manifest['objects']),1)
                    third_dir = directory / 'third-restored'
                    backup.download_verified(third,third_dir,configured)
                    self.assertEqual(len(list((third_dir / 'storage').glob('*'))),1)
                    self.assertEqual(next((third_dir / 'storage').glob('*')).read_bytes(),b'UPDATED FAKE PHOTO')
                    # Older full snapshots remain independently recoverable after a deletion.
                    old_dir = directory / 'old-restored'
                    backup.download_verified(first,old_dir,configured)
                    self.assertEqual(len(list((old_dir / 'storage').glob('*'))),2)
                    # A missing required bucket fails before exporting/uploading a successful backup.
                    with psycopg.connect(**args) as conn:
                        conn.execute('delete from storage.buckets where id=%s',('jkworks-website-assets',))
                    with self.assertRaises(RuntimeError):
                        backup.backup(env,fixture=True)
                    print('PASS: full fixture DB/auth/RLS restore, all buckets/files, encryption, reuse, corruption and missing-bucket guards')
            finally:
                server.shutdown(); server.server_close()
        finally:
            subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,check=True)


if __name__ == '__main__':
    unittest.main()

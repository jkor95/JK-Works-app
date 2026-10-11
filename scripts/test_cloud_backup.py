"""Disposable PostgreSQL + HTTP Storage + encrypted local-vault integration test."""
import contextlib
import http.server
import json
import secrets
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
import local_supabase_test as local
import backup_watchdog as monitor
from datetime import datetime, timezone, timedelta
from unittest.mock import patch


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
                    backup.retain_snapshots(configured, datetime.now(timezone.utc) + timedelta(days=36))
                    remaining = backup.run(['rclone','lsf','vault:','--dirs-only'], configured).splitlines()
                    self.assertEqual(len(remaining),2, 'Keep the newest two verified snapshots even after 35 days')
                    print('PASS: full fixture DB/auth/RLS restore, all buckets/files, encryption, reuse, corruption and missing-bucket guards')
            finally:
                server.shutdown(); server.server_close()
        finally:
            subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,check=True)


class LocalSafetyTest(unittest.TestCase):
    def test_rejects_remote_api_and_redirects(self):
        local.require_local_url(local.API + '/auth/v1/health')
        for url in ['https://ercqiavruotoclhvfzud.supabase.co',
                    'http://127.0.0.1:54321', 'https://127.0.0.1:56321',
                    'http://secret@127.0.0.1:56321', 'http://127.0.0.1.evil.invalid:56321']:
            with self.assertRaises(RuntimeError):
                local.require_local_url(url)
        with self.assertRaises(RuntimeError):
            local.NoRedirect().redirect_request(None)

    def test_production_environment_is_not_forwarded(self):
        with patch.dict(os.environ, {'PGHOST':'production.invalid', 'PGPASSWORD':secrets.token_hex(16),
                                    'SUPABASE_ACCESS_TOKEN':'FAKE', 'HTTP_PROXY':'FAKE',
                                    'RCLONE_CONFIG_CLOUD_SECRET_ACCESS_KEY':'FAKE'}):
            clean = local.clean_environment(Path('/tmp/fictitious-only'))
        self.assertEqual(clean['DOCKER_CONTEXT'], local.CONTEXT)
        self.assertNotIn('PGHOST', clean)
        self.assertNotIn('PGPASSWORD', clean)
        self.assertNotIn('SUPABASE_ACCESS_TOKEN', clean)
        self.assertNotIn('HTTP_PROXY', clean)
        self.assertNotIn('RCLONE_CONFIG_CLOUD_SECRET_ACCESS_KEY', clean)

    def test_refuses_a_network_with_external_access(self):
        with tempfile.TemporaryDirectory() as directory:
            instance = local.LocalTest(Path(directory))
            with patch.object(instance, 'run', return_value=json.dumps([
                    {'Internal':False, 'Labels':{'jkworks.restore':local.PROJECT}}])):
                with self.assertRaises(RuntimeError):
                    instance.verify_network()

    def test_mac_pg_tools_use_only_the_internal_network(self):
        with tempfile.TemporaryDirectory() as directory:
            instance = local.LocalTest(Path(directory))
            instance.db_container = 'supabase_db_' + local.PROJECT
            fake = {'PGHOST':'production.invalid', 'PGPORT':'56322', 'PGUSER':'postgres',
                    'PGPASSWORD':secrets.token_hex(16), 'PGDATABASE':'postgres', 'PGSSLMODE':'disable',
                    'JK_PG_IMAGE':'postgres:17'}
            with patch.object(local.cloud, 'run', return_value='') as run:
                instance.pg_tool('pg_dump', [], fake)
                command, env = run.call_args.args
                self.assertIn(local.NETWORK, command)
                self.assertNotIn('host', command)
                self.assertEqual(env['PGHOST'], instance.db_container)
                self.assertEqual(env['PGPORT'], '5432')

    def test_refuses_ports_exposed_to_the_lan(self):
        with tempfile.TemporaryDirectory() as directory:
            instance = local.LocalTest(Path(directory))
            net = {'Internal':True, 'Labels':{'jkworks.restore':local.PROJECT},
                   'Options':{'com.docker.network.bridge.host_binding_ipv4':'127.0.0.1'}}
            container = {'NetworkSettings':{'Ports':{'5432/tcp':[{'HostIp':'0.0.0.0'}]},
                                           'Networks':{local.NETWORK:{}}}}
            with patch.object(instance, 'run', side_effect=[json.dumps([net]),
                       'supabase_db_'+local.PROJECT, json.dumps([container])]):
                with self.assertRaises(RuntimeError):
                    instance.verify_network()

    def test_download_does_not_connect_to_database_or_start_containers(self):
        with tempfile.TemporaryDirectory() as directory:
            instance = local.LocalTest(Path(directory))
            with patch('builtins.input', side_effect=['https://fake.r2.cloudflarestorage.com',
                       'fake-bucket', '20261011T000000Z-aaaaaaaaaaaa']), \
                 patch.object(local.getpass, 'getpass', return_value='fixture-only-'+'x'*40), \
                 patch.object(local.cloud, 'configure', return_value={}) as configure, \
                 patch.object(local.cloud, 'download_verified', return_value={
                       'source_project':'ercqiavruotoclhvfzud'}) as download, \
                 patch.object(instance, 'connect') as connect, \
                 patch.object(instance, 'run') as run:
                instance.download()
                self.assertTrue(configure.call_args.kwargs['download_only'])
                download.assert_called_once()
                connect.assert_not_called()
                run.assert_not_called()


class BackupMonitoringTest(unittest.TestCase):
    def test_skipped_fixture_workflow_is_not_a_successful_production_backup(self):
        now = datetime(2026, 10, 11, tzinfo=timezone.utc)
        runs = {'workflow_runs':[{'id':1, 'created_at':now.isoformat(), 'html_url':'https://github.com/fake/run'}]}
        with patch.object(monitor, 'api', side_effect=[runs, {'jobs':[
                {'name':monitor.BACKUP_JOB, 'conclusion':'skipped', 'completed_at':now.isoformat()}]}]):
            self.assertIsNone(monitor.latest_verified_job(now))
        with patch.object(monitor, 'api', side_effect=[runs, {'jobs':[
                {'name':monitor.BACKUP_JOB, 'conclusion':'success', 'completed_at':now.isoformat()}]}]):
            self.assertIsNotNone(monitor.latest_verified_job(now))

    def test_stale_backup_and_failed_attempt_warn_without_live_notification(self):
        fake_env = {'GITHUB_REPOSITORY':monitor.REPOSITORY, 'JK_BACKUPS_ENABLED':'true',
                    'GITHUB_RUN_ID':'123', 'JK_BACKUP_RESULT':'success', 'JK_FIXTURE_RESULT':'success'}
        with patch.dict(os.environ, fake_env), patch.object(monitor, 'latest_verified_job', return_value=None), \
             patch.object(monitor, 'sync_alert') as alert:
            monitor.check()
            self.assertIn('48 uur', alert.call_args.args[0])
        fake_env['JK_BACKUP_RESULT'] = 'failure'
        with patch.dict(os.environ, fake_env), patch.object(monitor, 'latest_verified_job', return_value={
                'url':'https://github.com/fake/run','completed_at':'2026-10-11T00:00:00Z'}), \
             patch.object(monitor, 'sync_alert') as alert:
            monitor.check()
            self.assertIn('mislukt', alert.call_args.args[0])
        fake_env['JK_BACKUPS_ENABLED'] = 'false'
        with patch.dict(os.environ, fake_env), patch.object(monitor, 'api') as api:
            with self.assertRaises(RuntimeError):
                monitor.check()
            api.assert_not_called()

    def test_warning_is_assigned_and_not_closed_by_an_older_success(self):
        issue = {'number':2, 'title':monitor.TITLE, 'body':'<!-- jkworks-backup-monitor -->',
                 'created_at':'2026-10-11T01:00:00Z'}
        with patch.object(monitor, 'api', return_value=[issue]) as api:
            monitor.sync_alert(None, 'https://github.com/fake/run', {
                'completed_at':'2026-10-11T00:00:00Z'})
            self.assertEqual(api.call_count,1)
        with patch.object(monitor, 'api', side_effect=[[], {}]) as api:
            monitor.sync_alert('Fictieve mislukking', 'https://github.com/fake/run')
            payload = api.call_args.args[2]
            self.assertEqual(payload['assignees'], ['jkor95'])
            self.assertIn('jkworks-backup-monitor', payload['body'])

    def test_retention_never_purges_an_unverified_manifest(self):
        name = '20260101T000000Z-aaaaaaaaaaaa'
        with patch.object(backup, 'run', side_effect=[name+'/', 'bad-hash', '{}']) as run:
            with self.assertRaises(RuntimeError):
                backup.retain_snapshots({})
            self.assertFalse(any('purge' in call.args[0] for call in run.call_args_list))


if __name__ == '__main__':
    unittest.main()

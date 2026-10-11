"""Native disposable PostgreSQL + fictitious Storage + encrypted local-vault tests."""
import contextlib
import http.server
import hashlib
import json
import secrets
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time
import unittest
import socket

import psycopg
import cloud_backup as backup
import backup_watchdog as monitor
from datetime import datetime, timezone, timedelta
from unittest.mock import patch


class BackupTest(unittest.TestCase):
    def test_encrypted_backup_restore_and_failure_guards(self):
        with self.assertRaises(RuntimeError):
            backup.configure({}, fixture=False)
        pg_bin = Path(os.environ.get('JK_TEST_PG_BIN', '/usr/lib/postgresql/17/bin'))
        cluster = tempfile.TemporaryDirectory(prefix='jk-fixture-pg-')
        self.addCleanup(cluster.cleanup)
        root = Path(cluster.name)
        subprocess.run([str(pg_bin/'initdb'), '-D', str(root/'data'), '-A', 'trust',
                        '-U', 'postgres', '--no-locale', '--encoding=UTF8'], check=True, stdout=subprocess.DEVNULL,
                       stderr=subprocess.PIPE)
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = str(sock.getsockname()[1])
        subprocess.run([str(pg_bin/'pg_ctl'), '-D', str(root/'data'), '-l', str(root/'server.log'),
                        '-o', f'-h 127.0.0.1 -p {port} -k {root}', '-w', 'start'],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        try:
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
                    env = dict(os.environ,JK_PG_BIN=str(pg_bin),PGHOST='127.0.0.1',PGPORT=port,PGUSER='postgres',PGPASSWORD='',
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
                        subprocess.run([str(pg_bin/'pg_restore'), '-h', '127.0.0.1', '-p', port,
                                        '-U', 'postgres', '-d', 'restored_fixture', '--exit-on-error'],
                                       stdin=stream, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
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
                    wrong_salt = dict(configured)
                    wrong_salt['RCLONE_CONFIG_VAULT_PASSWORD2'] = backup.run(
                        ['rclone','obscure','-'], wrong_salt, input_text=secrets.token_hex(32)+'\n').strip()
                    with self.assertRaises(RuntimeError):
                        backup.download_verified(second,directory / 'wrong-salt',wrong_salt)
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
            subprocess.run([str(pg_bin/'pg_ctl'), '-D', str(root/'data'), '-m', 'immediate',
                            '-w', 'stop'], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=True)


class BackupSafetyTest(unittest.TestCase):
    def test_binding_names_match_workflow_and_missing_values_are_rejected(self):
        workflow = (Path(__file__).parent.parent/'.github/workflows/cloud-backup.yml').read_text()
        for name, binding in (backup.SECRET_BINDINGS | backup.VARIABLE_BINDINGS).items():
            namespace = 'secrets' if name in backup.SECRET_BINDINGS else 'vars'
            self.assertIn(binding + ': ${{ ' + namespace + '.' + name + ' }}', workflow)
        with self.assertRaises(RuntimeError):
            backup.preflight({})
        present = {binding: secrets.token_hex(32) for binding in
                   (backup.SECRET_BINDINGS | backup.VARIABLE_BINDINGS).values()}
        backup.preflight(present)

    def test_production_gate_tls_endpoint_and_separate_encryption_keys(self):
        env = {binding: secrets.token_hex(32) for binding in
               (backup.SECRET_BINDINGS | backup.VARIABLE_BINDINGS).values()}
        env.update(JK_BACKUP_AUTHORIZED='true', SUPABASE_PROJECT_REF='ercqiavruotoclhvfzud',
                   PGHOST='db.ercqiavruotoclhvfzud.supabase.co', PGUSER='postgres', PGPORT='5432',
                   PGSSLMODE='verify-full', R2_ENDPOINT='https://fake.r2.cloudflarestorage.com', R2_BUCKET='fixture-bucket')
        with patch.object(backup, 'run', side_effect=['obscured-one', 'obscured-two']) as run:
            configured = backup.configure(env)
            self.assertEqual(run.call_args_list[0].kwargs['input_text'], env['BACKUP_CRYPT_PASSWORD']+'\n')
            self.assertEqual(run.call_args_list[1].kwargs['input_text'], env['BACKUP_CRYPT_SALT']+'\n')
            self.assertEqual(configured['RCLONE_CONFIG_VAULT_TYPE'], 'crypt')
            self.assertEqual(configured['RCLONE_CONFIG_VAULT_PASSWORD2'], 'obscured-two')
        for change in ({'JK_BACKUP_AUTHORIZED':'false'}, {'PGSSLMODE':'disable'}, {'PGPORT':'6543'},
                       {'PGHOST':'wrong.invalid'}, {'R2_ENDPOINT':'https://user@fake.r2.cloudflarestorage.com'}):
            with self.assertRaises(RuntimeError):
                backup.configure(dict(env, **change))

    def test_download_requires_complete_correct_project_and_all_checksums(self):
        snapshot = '20261011T000000Z-aaaaaaaaaaaa'
        for failure in ('missing-marker', 'wrong-marker', 'wrong-project', 'corrupt-file', None):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as temp:
                def copy_fixture(args, env):
                    target = Path(args[-1])
                    data = b'fictitious only'
                    manifest = {'snapshot':snapshot, 'source_project':'unexpected' if failure == 'wrong-project' else 'local-fixture',
                        'files':{'data.bin':{'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}}}
                    raw = json.dumps(manifest).encode()
                    (target/'manifest.json').write_bytes(raw)
                    (target/'data.bin').write_bytes(b'corrupt' if failure == 'corrupt-file' else data)
                    if failure != 'missing-marker':
                        (target/'COMPLETE').write_text('bad' if failure == 'wrong-marker' else hashlib.sha256(raw).hexdigest())
                with patch.object(backup, 'run', side_effect=copy_fixture):
                    if failure:
                        with self.assertRaises((RuntimeError, FileNotFoundError)):
                            backup.download_verified(snapshot, Path(temp)/'download', {})
                    else:
                        self.assertEqual(backup.download_verified(snapshot, Path(temp)/'download', {})['snapshot'], snapshot)

    def test_download_mode_uses_expected_project_without_production_database_access(self):
        env = {'R2_ENDPOINT':'https://fake.r2.cloudflarestorage.com','R2_BUCKET':'fixture-bucket',
               'R2_ACCESS_KEY_ID':secrets.token_hex(16),'R2_SECRET_ACCESS_KEY':secrets.token_hex(32),
               'BACKUP_CRYPT_PASSWORD':secrets.token_hex(32),'BACKUP_CRYPT_SALT':secrets.token_hex(32)}
        with patch.object(backup, 'run', return_value='obscured'), patch.object(backup.psycopg, 'connect') as connect:
            configured = backup.configure(env, download_only=True)
            self.assertEqual(configured['SUPABASE_PROJECT_REF'], 'ercqiavruotoclhvfzud')
            connect.assert_not_called()

    def test_rclone_process_does_not_receive_source_credentials(self):
        env = {'PGPASSWORD':secrets.token_hex(32),'SUPABASE_STORAGE_READ_KEY':secrets.token_hex(32),
               'RCLONE_CONFIG_VAULT_PASSWORD':'obscured','PATH':os.environ['PATH']}
        with patch.object(backup.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, '')) as run:
            backup.run(['rclone','lsf','vault:'], env)
            self.assertNotIn('PGPASSWORD', run.call_args.kwargs['env'])
            self.assertNotIn('SUPABASE_STORAGE_READ_KEY', run.call_args.kwargs['env'])
            self.assertIn('RCLONE_CONFIG_VAULT_PASSWORD', run.call_args.kwargs['env'])

    def test_storage_redirects_are_never_followed(self):
        with self.assertRaises(RuntimeError):
            backup.NoRedirect().redirect_request(None)

    def test_native_dump_forces_read_only_and_keeps_credentials_out_of_arguments(self):
        with tempfile.TemporaryDirectory() as temp:
            (Path(temp)/'pg_dump').touch()
            password = secrets.token_hex(32)
            env = {'JK_PG_MAJOR':'17','JK_PG_BIN':temp,'PGPASSWORD':password,'PGHOST':'fixture.invalid',
                   'PGOPTIONS':'unsafe', 'GITHUB_TOKEN':'fixture-only'}
            with patch.object(backup, 'run', return_value='') as run:
                backup.pg_tool('pg_dump', ['--format=custom'], env)
                command, passed = run.call_args.args
                self.assertNotIn(password, command)
                self.assertEqual(passed['PGOPTIONS'], '-c default_transaction_read_only=on')
                self.assertNotIn('GITHUB_TOKEN', passed)


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
        fake_env = {'GITHUB_REPOSITORY':monitor.REPOSITORY, 'JK_BACKUP_AUTHORIZED':'true',
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
        fake_env['JK_BACKUP_AUTHORIZED'] = 'false'
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

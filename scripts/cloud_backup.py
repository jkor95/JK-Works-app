"""Logical DB + Storage backup. No restore/write operations against Supabase."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from datetime import datetime, timezone
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen
import uuid

import psycopg
from psycopg import sql

REQUIRED_TABLES = {'public.app_records', 'public.app_deletions', 'public.public_requests',
                   'auth.users', 'storage.buckets', 'storage.objects'}
REQUIRED_BUCKETS = {'jkworks-files', 'jkworks-request-files', 'jkworks-website-assets'}


def run(args, env, output=None, input_text=None):
    result = subprocess.run(args, env=env, input=input_text, stdout=output or subprocess.PIPE,
                            stderr=subprocess.PIPE, text=output is None)
    if result.returncode:
        # Never echo stderr: HTTP bodies, object names and connection details may be sensitive.
        raise RuntimeError(f'{Path(args[0]).name} failed; exit {result.returncode}; details withheld')
    return result.stdout if output is None else None


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def configure(env, fixture=False, download_only=False):
    env = dict(env)
    if not fixture:
        if not download_only and env.get('JK_BACKUPS_ENABLED') != 'true':
            raise RuntimeError('Production backup is disabled')
        if not download_only:
            ref = env['SUPABASE_PROJECT_REF']
            if ref != 'ercqiavruotoclhvfzud':
                raise RuntimeError('Unexpected Supabase project')
            if not (env['PGHOST'] == f'db.{ref}.supabase.co' or (env['PGHOST'].endswith('.pooler.supabase.com') and env['PGUSER'].endswith('.' + ref))):
                raise RuntimeError('Database connection does not identify the expected project')
            if env.get('PGPORT') != '5432' or env.get('PGSSLMODE') != 'verify-full':
                raise RuntimeError('Session/direct connection on 5432 with verified TLS is required')
            env['SUPABASE_URL'] = f'https://{ref}.supabase.co'
        endpoint = urlparse(env['R2_ENDPOINT'])
        if endpoint.scheme != 'https' or not endpoint.hostname.endswith('.r2.cloudflarestorage.com'):
            raise RuntimeError('Expected HTTPS Cloudflare R2 endpoint')
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]{1,61}[a-z0-9]', env['R2_BUCKET']):
            raise RuntimeError('Invalid private backup bucket name')
        env.update(RCLONE_CONFIG_CLOUD_TYPE='s3', RCLONE_CONFIG_CLOUD_PROVIDER='Cloudflare',
                   RCLONE_CONFIG_CLOUD_ENDPOINT=env['R2_ENDPOINT'],
                   RCLONE_CONFIG_CLOUD_ACCESS_KEY_ID=env['R2_ACCESS_KEY_ID'],
                   RCLONE_CONFIG_CLOUD_SECRET_ACCESS_KEY=env['R2_SECRET_ACCESS_KEY'],
                   RCLONE_CONFIG_VAULT_REMOTE=f"cloud:{env['R2_BUCKET']}/jkworks")
    elif urlparse(env['SUPABASE_URL']).hostname not in {'127.0.0.1', 'localhost'}:
        raise RuntimeError('Fixtures must use a loopback HTTP server')
    password = env['BACKUP_CRYPT_PASSWORD']
    salt = env['BACKUP_CRYPT_SALT']
    if len(password) < 32 or len(salt) < 32 or '\n' in password + salt:
        raise RuntimeError('Encryption password and salt must each be at least 32 characters')
    env.update(RCLONE_CONFIG_VAULT_TYPE='crypt', RCLONE_CONFIG_VAULT_FILENAME_ENCRYPTION='standard',
               RCLONE_CONFIG_VAULT_DIRECTORY_NAME_ENCRYPTION='true', RCLONE_CONFIG='/dev/null')
    env['RCLONE_CONFIG_VAULT_PASSWORD'] = run(['rclone', 'obscure', '-'], env, input_text=password + '\n').strip()
    env['RCLONE_CONFIG_VAULT_PASSWORD2'] = run(['rclone', 'obscure', '-'], env, input_text=salt + '\n').strip()
    return env


def pg_tool(tool, args, env, output=None, archive=None):
    command = ['docker', 'run', '--rm', '--network', 'host']
    for name in ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGSSLMODE', 'PGSSLROOTCERT']:
        if name in env:
            command += ['-e', name]
    if env.get('PGSSLROOTCERT'):
        cert = env['PGSSLROOTCERT']
        command += ['-v', f'{cert}:{cert}:ro']
    if archive is not None:
        command += ['-v', f'{archive}:/backup.dump:ro']
    command += [env['JK_PG_IMAGE'], tool] + args
    return run(command, env, output=output)


def inventory(conn):
    tables = conn.execute("""select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where c.relkind in ('r','p') and n.nspname not like 'pg\\_%' escape '\\'
        and n.nspname <> 'information_schema' order by 1,2""").fetchall()
    counts = {}
    for schema, table in tables:
        counts[schema + '.' + table] = conn.execute(sql.SQL('select count(*) from {}.{}').format(
            sql.Identifier(schema), sql.Identifier(table))).fetchone()[0]
    if not REQUIRED_TABLES.issubset(counts):
        raise RuntimeError('Required application/auth/storage tables are missing or unreadable')
    buckets = [row[0] for row in conn.execute('select to_jsonb(b) from storage.buckets b order by id')]
    if not REQUIRED_BUCKETS.issubset({row['id'] for row in buckets}):
        raise RuntimeError('A Storage bucket referenced by the application is missing')
    objects = [row[0] for row in conn.execute('select to_jsonb(o) from storage.objects o order by bucket_id,name')]
    if len({(row['bucket_id'], row['name']) for row in objects}) != len(objects):
        raise RuntimeError('Duplicate Storage object identities')
    return counts, buckets, objects


def previous_snapshot(env):
    names = run(['rclone', 'lsf', 'vault:', '--dirs-only'], env).splitlines()
    for name in sorted(names, reverse=True):
        name = name.rstrip('/')
        if not re.fullmatch(r'\d{8}T\d{6}Z-[a-f0-9]{12}', name):
            continue
        try:
            marker = run(['rclone', 'cat', f'vault:{name}/COMPLETE'], env).strip()
        except RuntimeError:  # Interrupted uploads never become restore candidates.
            continue
        manifest = run(['rclone', 'cat', f'vault:{name}/manifest.json'], env)
        if hashlib.sha256(manifest.encode()).hexdigest() != marker:
            raise RuntimeError('Previous successful manifest is corrupt')
        return name, json.loads(manifest)
    return None, None


def verify_directory(directory, manifest):
    expected = set(manifest['files'])
    actual = {str(p.relative_to(directory)) for p in directory.rglob('*') if p.is_file()}
    if actual - {'manifest.json', 'COMPLETE'} != expected:
        raise RuntimeError('Backup file inventory mismatch')
    for name, info in manifest['files'].items():
        target = directory / name
        if target.resolve().parent != directory.resolve() and directory.resolve() not in target.resolve().parents:
            raise RuntimeError('Unsafe manifest path')
        if target.stat().st_size != info['bytes'] or digest(target) != info['sha256']:
            raise RuntimeError('Backup checksum mismatch')


def backup(env, fixture=False):
    os.umask(0o077)
    env = configure(env, fixture)
    with tempfile.TemporaryDirectory(prefix='jk-backup-') as temp:
        stage = Path(temp)
        if not fixture:
            cert = stage / 'database-ca.crt'
            cert.write_text(env['SUPABASE_DB_CA'])
            env['PGSSLROOTCERT'] = str(cert)
        payload = stage / 'payload'
        payload.mkdir()
        (payload / 'storage').mkdir()
        previous, old = previous_snapshot(env)
        if previous:
            run(['rclone', 'copy', f'vault:{previous}/storage', str(payload / 'storage')], env)
        with psycopg.connect('', **{k: env[v] for k, v in {
            'host':'PGHOST', 'port':'PGPORT', 'user':'PGUSER', 'password':'PGPASSWORD',
            'dbname':'PGDATABASE', 'sslmode':'PGSSLMODE'}.items() if v in env},
            **({'sslrootcert':env['PGSSLROOTCERT']} if env.get('PGSSLROOTCERT') else {})) as conn:
            conn.execute('set transaction isolation level repeatable read read only')
            major = conn.info.server_version // 10000
            if major not in (15, 16, 17, 18):
                raise RuntimeError('Unsupported PostgreSQL major version')
            env['JK_PG_IMAGE'] = f'postgres:{major}'
            counts, buckets, objects = inventory(conn)
            snapshot = conn.execute('select pg_export_snapshot()').fetchone()[0]
            with (payload / 'database.dump').open('wb') as out:
                pg_tool('pg_dump', ['--format=custom', '--snapshot=' + snapshot], env, out)
            toc = pg_tool('pg_restore', ['--list', '/backup.dump'], env, archive=payload / 'database.dump')
            for table in REQUIRED_TABLES:
                schema, name = table.split('.')
                if f'TABLE DATA {schema} {name} ' not in toc:
                    raise RuntimeError('Dump is missing required application/auth/storage table data')
            with (payload / 'roles.sql').open('wb') as out:
                pg_tool('pg_dumpall', ['--roles-only', '--no-role-passwords'], env, out)
            old_objects = {o['file']: o for o in old['objects']} if old else {}
            reused = 0
            for obj in objects:
                filename = 'storage/' + hashlib.sha256((obj['bucket_id'] + '\0' + obj['name']).encode()).hexdigest() + '.bin'
                obj['file'] = filename
                target = payload / filename
                candidate = old_objects.get(filename)
                identity = {k:v for k,v in obj.items() if k not in {'file','sha256','bytes'}}
                previous_identity = {k:v for k,v in candidate.items() if k not in {'file','sha256','bytes'}} if candidate else None
                if candidate and identity == previous_identity and target.is_file():
                    if digest(target) != candidate['sha256']:
                        raise RuntimeError('Previously backed-up Storage object is corrupt')
                    reused += 1
                else:
                    key = env['SUPABASE_STORAGE_READ_KEY']
                    headers = {'apikey': key}
                    if key.startswith('eyJ'):
                        headers['Authorization'] = 'Bearer ' + key
                    url = env['SUPABASE_URL'] + '/storage/v1/object/authenticated/' + quote(obj['bucket_id'], safe='') + '/' + quote(obj['name'], safe='/')
                    with urlopen(Request(url, headers=headers), timeout=120) as response, target.open('wb') as out:
                        for block in iter(lambda: response.read(1024 * 1024), b''):
                            out.write(block)
                obj['bytes'], obj['sha256'] = target.stat().st_size, digest(target)
                declared = (obj.get('metadata') or {}).get('size')
                if declared is not None and int(declared) != obj['bytes']:
                    raise RuntimeError('Storage object size mismatch')
            present = {o['file'] for o in objects}
            for cached in (payload / 'storage').glob('*'):
                if str(cached.relative_to(payload)) not in present:
                    cached.unlink()
            # A fresh transaction detects concurrent file replacement/deletion during collection.
            conn.commit()
            conn.execute('set transaction isolation level repeatable read read only')
            _, after_buckets, after_objects = inventory(conn)
            clean = [{k:v for k,v in o.items() if k not in {'file','bytes','sha256'}} for o in objects]
            if buckets != after_buckets or clean != after_objects:
                raise RuntimeError('Storage changed during backup; retry during a quiet period')
        run_id = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:12]
        image_digest = run(['docker', 'image', 'inspect', env['JK_PG_IMAGE'], '--format', '{{index .RepoDigests 0}}'], env).strip()
        manifest = {'format':1, 'snapshot':run_id, 'postgres_major':major, 'pg_tool_image':image_digest, 'code_commit':env.get('GITHUB_SHA', 'local-fixture'), 'source_project':env.get('SUPABASE_PROJECT_REF', 'local-fixture'), 'table_counts':counts,
                    'buckets':buckets, 'objects':objects, 'files':{}}
        for file in payload.rglob('*'):
            if file.is_file():
                manifest['files'][str(file.relative_to(payload))] = {'bytes':file.stat().st_size, 'sha256':digest(file)}
        (payload / 'manifest.json').write_text(json.dumps(manifest, sort_keys=True))
        verify_directory(payload, manifest)
        remote = f'vault:{run_id}'
        run(['rclone', 'copy', str(payload), remote], env)
        # Verify uploaded ciphertext against plaintext, not just remote object existence.
        run(['rclone', 'check', str(payload), remote, '--download'], env)
        marker = stage / 'COMPLETE'
        marker.write_text(digest(payload / 'manifest.json'))
        run(['rclone', 'copyto', str(marker), remote + '/COMPLETE'], env)
        if run(['rclone', 'cat', remote + '/COMPLETE'], env).strip() != marker.read_text():
            raise RuntimeError('Completion marker verification failed')
        print(f'Backup verified: {run_id}; tables={len(counts)}, objects={len(objects)}, reused={reused}')
        return run_id, manifest, env


def download_verified(run_id, directory, env):
    if not re.fullmatch(r'\d{8}T\d{6}Z-[a-f0-9]{12}', run_id):
        raise RuntimeError('Invalid snapshot name')
    directory = Path(directory)
    directory.mkdir(exist_ok=False)
    run(['rclone', 'copy', f'vault:{run_id}', str(directory)], env)
    if digest(directory / 'manifest.json') != (directory / 'COMPLETE').read_text().strip():
        raise RuntimeError('Snapshot is incomplete or manifest is corrupt')
    manifest = json.loads((directory / 'manifest.json').read_text())
    verify_directory(directory, manifest)
    return manifest


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--download', help='Decrypt and verify this snapshot; never restore a database')
    parser.add_argument('--output', help='New private local directory for verified decrypted files')
    args = parser.parse_args()
    try:
        if args.download:
            if not args.output:
                raise RuntimeError('A new output directory is required')
            os.umask(0o077)
            download_verified(args.download, args.output, configure(os.environ, download_only=True))
            print('Download decrypted and verified; no database or Storage restore executed.')
        else:
            backup(os.environ)
    except Exception as exc:
        # Intentionally no exception message/traceback: drivers can include secret values.
        print(f'BACKUP FAILED ({type(exc).__name__}); no verified completion claimed.')
        raise SystemExit(1)

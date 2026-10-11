"""Mac-only isolated fixture runner; real snapshots can only be downloaded/verified."""
import getpass
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import tempfile
import time
from urllib.parse import urlparse
from urllib.request import Request, build_opener, ProxyHandler, HTTPRedirectHandler
from urllib.error import HTTPError

import psycopg
import cloud_backup as cloud

PROJECT = 'jkworks-local-restore-test'
NETWORK = 'jkworks-restore-offline'
CONTEXT = 'desktop-linux'
API = 'http://127.0.0.1:56321'
EMAIL = 'restore-fixture@example.invalid'
TABLES = {'app_records', 'app_deletions', 'public_requests'}

# Only these fixed texts may reach the terminal or diagnostic file. Never echo
# exception strings, command arguments, container environments or raw CLI output.
DIAGNOSES = {
    'disk': 'Docker heeft onvoldoende vrije schijfruimte.',
    'memory': 'Docker meldt onvoldoende geheugen of een geheugengerelateerde stop.',
    'architecture': 'Een Docker-image past niet bij de processorarchitectuur.',
    'ports': 'Een benodigde lokale poort is al in gebruik.',
    'mount': 'Docker Desktop weigert toegang tot een lokale map.',
    'registry': 'Een benodigd image kan niet worden gedownload (register, DNS, TLS of netwerk).',
    'health': 'Een lokale Supabase-service wordt niet gezond binnen de wachttijd.',
    'config': 'Supabase CLI weigert de lokale configuratie of een startoptie.',
    'command': 'Het lokale hulpmiddel stopte; de uitvoer past niet bij een bekende veilige diagnose.',
    'isolation': 'De omgeving voldoet niet aan het verplichte offline netwerk en de binding aan 127.0.0.1; de proef is geblokkeerd.',
    'target': 'Een lokaal adres, Docker-context of projectkoppeling wijkt af van de toegestane testomgeving; de proef is geblokkeerd.',
    'containers': 'De verwachte lokale Supabase-containers ontbreken na de start.',
    'unknown': 'De oorzaak is nog onbekend; ruwe fouttekst is om veiligheidsredenen verborgen.',
}
STAGES = {
    'setup': 'lokale voorbereiding', 'context': 'Docker Desktop-context',
    'network': 'aanmaken/controleren van het offline netwerk',
    'start': 'starten van PostgreSQL, Auth en Storage',
    'isolation': 'controleren van netwerkisolatie en poortbindingen',
    'status': 'controleren van lokale API- en databaseadressen',
    'tools': 'downloaden van PostgreSQL-exporttools',
    'fixture': 'fictieve Auth-, RLS- en Storage-proef',
    'backup': 'versleutelde fictieve back-up en integriteitscontrole',
    'restore': 'herstel van uitsluitend fictieve gegevens',
    'download': 'download en verificatie zonder databaseverbinding',
    'stop': 'stoppen van uitsluitend de lokale testomgeving',
    'remove': 'verwijderen van uitsluitend de lokale testomgeving',
}


class SafeFailure(RuntimeError):
    def __init__(self, code):
        self.code = code if code in DIAGNOSES else 'unknown'
        super().__init__(self.code)


def classify_failure(output):
    text = output.decode('utf-8', errors='replace').lower()
    patterns = (
        ('disk', ('no space left on device', 'disk quota exceeded')),
        ('memory', ('out of memory', 'oomkilled', 'cannot allocate memory')),
        ('architecture', ('exec format error', 'no matching manifest', 'unsupported architecture')),
        ('ports', ('port is already allocated', 'address already in use', 'ports are not available')),
        ('mount', ('mounts denied', 'mount denied', 'is not shared from the host')),
        ('registry', ('failed to pull', 'pull access denied', 'failed to resolve reference',
                      'error pulling', 'unable to download', 'no such host', 'getaddrinfo',
                      'tls handshake timeout', 'x509:', 'connection refused', 'i/o timeout')),
        ('health', ('unhealthy', 'health check', 'healthcheck', 'not ready', 'timed out')),
        ('config', ('unknown flag', 'unknown command', 'invalid config', 'failed to parse',
                    'failed to load config', 'cannot unmarshal')),
    )
    return next((code for code, words in patterns if any(word in text for word in words)), 'command')


def safe_diagnosis(exc, stage):
    code = exc.code if isinstance(exc, SafeFailure) else 'unknown'
    return 'Stap: ' + STAGES.get(stage, STAGES['setup']) + '.\nDiagnose: ' + DIAGNOSES[code]


def clean_environment(root):
    # Do not inherit PG*, SUPABASE*, RCLONE*, proxy settings or production secrets.
    return {'PATH': os.environ['PATH'], 'HOME': str(Path.home()),
            'DOCKER_CONTEXT': CONTEXT, 'SUPABASE_TELEMETRY_DISABLED': '1',
            'SUPABASE_HOME': str(root/'cli-state'),
            'TMPDIR': str(root/'tmp'), 'PYTHONDONTWRITEBYTECODE': '1'}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise RuntimeError('Redirects are forbidden in the local fixture')


def require_local_url(url):
    parsed = urlparse(url)
    if (parsed.scheme != 'http' or parsed.hostname != '127.0.0.1'
            or parsed.port != 56321 or parsed.username or parsed.password):
        raise SafeFailure('target')


def api(path, key, body=None, token=None, method=None, content_type='application/json'):
    url = API + path
    require_local_url(url)
    headers = {'apikey': key, 'Authorization': 'Bearer ' + (token or key), 'Content-Type': content_type}
    data = json.dumps(body).encode() if isinstance(body, dict) else body
    opener = build_opener(ProxyHandler({}), NoRedirect())
    with opener.open(Request(url, data=data, headers=headers, method=method), timeout=30) as response:
        return response.read()


class LocalTest:
    def __init__(self, root):
        self.root = root.resolve()
        self.env = clean_environment(self.root)
        self.cli = str(self.root/'tools/supabase')
        self.stage = 'setup'
        for name in ('tmp', 'logs', 'snapshots', 'fixtures'):
            (self.root/name).mkdir(exist_ok=True)

    def run(self, args, label, env=None):
        result = subprocess.run(args, env=env or self.env, capture_output=True)
        if result.returncode:
            code = classify_failure(result.stdout + result.stderr)
            # Replace this operation's old raw log with safe metadata only.
            (self.root/'logs'/f'{label}.log').write_text(json.dumps({
                'stage': self.stage if self.stage in STAGES else 'setup',
                'diagnosis': code, 'exit_code': result.returncode}) + '\n')
            raise SafeFailure(code)
        return result.stdout.decode()

    def supabase(self, command, *args):
        return self.run([self.cli, command, '--workdir', str(self.root/'project'),
                         '--network-id', NETWORK, *args], 'supabase-' + command)

    def verify_network(self):
        network = json.loads(self.run(['docker', 'network', 'inspect', NETWORK], 'network'))[0]
        if (not network['Internal'] or network.get('Labels', {}).get('jkworks.restore') != PROJECT
                or network.get('Options', {}).get('com.docker.network.bridge.host_binding_ipv4') != '127.0.0.1'):
            raise SafeFailure('isolation')
        containers = self.run(['docker', 'ps', '-a', '--format', '{{.Names}}'], 'containers').splitlines()
        own = [name for name in containers if name.endswith('_' + PROJECT)]
        if not own:
            raise SafeFailure('containers')
        for name in own:
            item = json.loads(self.run(['docker', 'inspect', name], 'inspect'))[0]
            for bindings in item['NetworkSettings']['Ports'].values():
                if bindings and any(binding['HostIp'] != '127.0.0.1' for binding in bindings):
                    raise SafeFailure('isolation')
            if set(item['NetworkSettings']['Networks']) != {NETWORK}:
                raise SafeFailure('isolation')
        self.db_container = 'supabase_db_' + PROJECT
        if self.db_container not in own:
            raise SafeFailure('containers')

    def start(self):
        self.stage = 'context'
        if (self.root/'project/supabase/.temp/project-ref').exists():
            raise SafeFailure('target')
        if self.run(['docker', 'context', 'show'], 'context').strip() != CONTEXT:
            raise SafeFailure('target')
        self.stage = 'network'
        if not self.run(['docker', 'network', 'ls', '--filter', 'name=^' + NETWORK + '$',
                         '--format', '{{.Name}}'], 'network-list').strip():
            self.run(['docker', 'network', 'create', '--internal', '--opt',
                      'com.docker.network.bridge.host_binding_ipv4=127.0.0.1', '--label',
                      'jkworks.restore=' + PROJECT, NETWORK], 'network-create')
        else:
            net = json.loads(self.run(['docker', 'network', 'inspect', NETWORK], 'network'))[0]
            if (not net['Internal'] or net.get('Labels', {}).get('jkworks.restore') != PROJECT
                    or net.get('Options', {}).get('com.docker.network.bridge.host_binding_ipv4') != '127.0.0.1'):
                raise SafeFailure('isolation')
        try:
            # Image downloads occur on the VM; running services only use the offline network.
            print('Start PostgreSQL, Auth en Storage; eerste image-download kan enkele minuten duren.', flush=True)
            self.stage = 'start'
            self.supabase('start', '--exclude', 'realtime,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor')
            self.stage = 'isolation'
            self.verify_network()
            self.stage = 'status'
            status = json.loads(self.supabase('status', '--output', 'json'))
            require_local_url(status['API_URL'])
            db = urlparse(status['DB_URL'])
            if db.hostname not in ('127.0.0.1', 'localhost') or db.port != 56322 or db.path != '/postgres':
                raise SafeFailure('target')
            self.status, self.password = status, db.password
            # Native PostgreSQL tools used by the existing backup format, with no production credentials.
            self.stage = 'tools'
            self.run(['docker', 'pull', 'postgres:17'], 'postgres-tools')
        except Exception:
            # Cleanup must not replace the original diagnosis; never remove volumes.
            try:
                self.supabase('stop')
            except Exception:
                print('Ook het stoppen is niet bevestigd; er zijn geen volumes verwijderd.', flush=True)
            raise

    def connect(self):
        return psycopg.connect(host='127.0.0.1', port=56322, user='postgres',
                               password=self.password, dbname='postgres', sslmode='disable')

    def login(self, password):
        return json.loads(api('/auth/v1/token?grant_type=password', self.status['ANON_KEY'],
                              {'email': EMAIL, 'password': password}))['access_token']

    def pg_tool(self, tool, args, env, output=None, archive=None):
        # Docker Desktop host networking need not be enabled. Tools stay offline too.
        env = dict(env, PGHOST=self.db_container)
        command = ['docker', 'run', '--rm', '--network', NETWORK]
        for name in ('PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGSSLMODE'):
            if name in env:
                command += ['-e', name]
        env['PGPORT'] = '5432'  # Internal container port, not the Mac forwarded port.
        if archive is not None:
            command += ['-v', f'{archive}:/backup.dump:ro']
        return cloud.run(command + [env['JK_PG_IMAGE'], tool] + args, env, output=output)

    def fixture(self):
        self.stage = 'fixture'
        marker = self.root/'fixture.json'
        if marker.exists():
            saved = json.loads(marker.read_text())
        else:
            with self.connect() as conn:
                if conn.execute('select count(*) from auth.users').fetchone()[0] or conn.execute(
                        "select count(*) from pg_tables where schemaname='public'").fetchone()[0]:
                    raise RuntimeError('Fixture requires an empty local project; nothing was changed')
            saved = {'password': secrets.token_hex(32), 'complete': False}
            marker.write_text(json.dumps(saved))
        key = self.status['SERVICE_ROLE_KEY']
        # Guard repeat runs: never perform fixture writes on a restored production database.
        users = json.loads(api('/auth/v1/admin/users', key, method='GET'))['users']
        if any(user['email'] != EMAIL for user in users) or len(users) > 1:
            raise RuntimeError('Non-fixture users present; refusing fixture writes')
        with self.connect() as conn:
            tables = {row[0] for row in conn.execute("select tablename from pg_tables where schemaname='public'")}
            if tables - TABLES:
                raise RuntimeError('Non-fixture tables present; refusing fixture writes')
            if 'app_records' in tables and conn.execute('select count(*) from public.app_records').fetchone()[0] > 1:
                raise RuntimeError('Non-fixture records present')
        if saved['complete']:
            self.login(saved['password'])
            print('PASS: eerdere fictieve herstelproef aanwezig; lokale login werkt. Geen gegevens opnieuw gewist.')
            return
        if not users:
            user = json.loads(api('/auth/v1/admin/users', key,
                                  {'email': EMAIL, 'password': saved['password'], 'email_confirm': True}))
        else:
            user = users[0]
        uid = user['id']
        with self.connect() as conn:
            conn.execute('create table if not exists public.app_records(id text primary key, owner uuid references auth.users(id) on delete cascade, data jsonb)')
            conn.execute('create table if not exists public.app_deletions(id text); create table if not exists public.public_requests(id text)')
            conn.execute('alter table public.app_records enable row level security')
            conn.execute('drop policy if exists jk_fixture_records on public.app_records')
            conn.execute('create policy jk_fixture_records on public.app_records for select to authenticated using (owner=auth.uid())')
            conn.execute('grant select on public.app_records to anon, authenticated')
            conn.execute("NOTIFY pgrst, 'reload schema'")
            conn.execute("insert into public.app_records values ('fixture-invoice', %s, %s) on conflict(id) do nothing",
                         (uid, json.dumps({'customer': 'Fictieve klant', 'invoice': 42})))
        for bucket in sorted(cloud.REQUIRED_BUCKETS):
            existing = json.loads(api('/storage/v1/bucket', key, method='GET'))
            if bucket not in {item['id'] for item in existing}:
                api('/storage/v1/bucket', key, {'id': bucket, 'name': bucket, 'public': False})
        blob = b'JK Works fictional document; no customer data'
        try:
            existing_blob = api('/storage/v1/object/authenticated/jkworks-files/fixture.txt', key, method='GET')
        except HTTPError as exc:
            if exc.code not in (400, 404):
                raise
            api('/storage/v1/object/jkworks-files/fixture.txt', key, blob, method='POST', content_type='text/plain')
        else:
            if existing_blob != blob:
                raise RuntimeError('Unexpected object content; nothing overwritten')
        token = self.login(saved['password'])
        deadline = time.monotonic() + 20
        while True:
            try:
                rows = json.loads(api('/rest/v1/app_records?select=id,data', self.status['ANON_KEY'], token=token, method='GET'))
                break
            except HTTPError:
                if time.monotonic() > deadline:
                    raise
                time.sleep(.5)
        assert len(rows) == 1 and rows[0]['data']['invoice'] == 42
        assert json.loads(api('/rest/v1/app_records?select=id', self.status['ANON_KEY'], method='GET')) == []
        try:
            api('/storage/v1/object/authenticated/jkworks-files/fixture.txt', self.status['ANON_KEY'], method='GET')
        except HTTPError:
            pass
        else:
            raise RuntimeError('Private Storage object unexpectedly accessible')
        print('PASS: lokale Auth-login, RLS en privé-Storage met fictieve gegevens')
        env = dict(self.env, PGHOST='127.0.0.1', PGPORT='56322', PGUSER='postgres',
                   PGPASSWORD=self.password, PGDATABASE='postgres', PGSSLMODE='disable',
                   SUPABASE_URL=API, SUPABASE_STORAGE_READ_KEY=key,
                   BACKUP_CRYPT_PASSWORD=secrets.token_hex(32), BACKUP_CRYPT_SALT=secrets.token_hex(32),
                   RCLONE_CONFIG_VAULT_REMOTE=str(self.root/'fixtures/encrypted'))
        (self.root/'fixtures/encrypted').mkdir(exist_ok=True)
        self.stage = 'backup'
        previous_runner = cloud.pg_tool
        cloud.pg_tool = self.pg_tool
        try:
            snapshot, manifest, configured = cloud.backup(env, fixture=True)
        finally:
            cloud.pg_tool = previous_runner
        target = self.root/'tmp'/('fixture-verified-' + snapshot)
        cloud.download_verified(snapshot, target, configured)
        self.stage = 'restore'
        # Restore only these fictional rows, not unmanaged full schemas/roles over a running stack.
        api('/storage/v1/object/jkworks-files', key, {'prefixes': ['fixture.txt']}, method='DELETE')
        api('/auth/v1/admin/users/' + uid, key, method='DELETE')
        for schema, table in [('auth', 'users'), ('auth', 'identities'), ('public', 'app_records')]:
            self.pg_tool('pg_restore', ['--data-only', '--schema=' + schema, '--table=' + table,
                          '--exit-on-error', '--dbname=postgres', '/backup.dump'],
                          configured, archive=target/'database.dump')
        objects = [obj for obj in manifest['objects'] if obj['bucket_id'] == 'jkworks-files' and obj['name'] == 'fixture.txt']
        assert len(objects) == 1
        restored_blob = (target/objects[0]['file']).read_bytes()
        assert restored_blob == blob
        api('/storage/v1/object/jkworks-files/fixture.txt', key, restored_blob, method='POST', content_type='text/plain')
        token = self.login(saved['password'])
        restored = json.loads(api('/rest/v1/app_records?select=data', self.status['ANON_KEY'], token=token, method='GET'))
        assert len(restored) == 1 and restored[0]['data']['invoice'] == 42
        assert api('/storage/v1/object/authenticated/jkworks-files/fixture.txt', key, method='GET') == blob
        saved['complete'] = True
        marker.write_text(json.dumps(saved))
        print('PASS: PR #2-versleuteling, controles en lokaal herstel van fictieve Auth-/app-data en Storage-bytes')
        print('Dit is geen volledig herstel van alle managed schema’s of een productieback-up.')

    def download(self):
        self.stage = 'download'
        print('Alleen downloaden en verifiëren uit R2; geen databaseverbinding of herstel.')
        env = dict(self.env)
        env['R2_ENDPOINT'] = input('R2-endpoint: ').strip()
        env['R2_BUCKET'] = input('R2-bucket: ').strip()
        for name in ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'BACKUP_CRYPT_PASSWORD', 'BACKUP_CRYPT_SALT']:
            env[name] = getpass.getpass(name + ' (verborgen invoer): ')
        snapshot = input('Snapshotnaam: ').strip()
        directory = self.root/'snapshots'/('download-' + snapshot)
        configured = cloud.configure(env, download_only=True)
        manifest = cloud.download_verified(snapshot, directory, configured)
        if manifest.get('source_project') != 'ercqiavruotoclhvfzud':
            raise RuntimeError('Unexpected source project; no restore performed')
        print('Download ontsleuteld en geverifieerd. Geen herstel uitgevoerd.')
        print('De vertrouwelijke bestanden staan in de lokale snapshots-map. Volg de beoordeelde herstelprocedure.')


if __name__ == '__main__':
    os.umask(0o077)
    local = None
    try:
        if sys.platform != 'darwin':
            raise RuntimeError('This entry point is Mac-only')
        mode, root = sys.argv[1], Path(sys.argv[2])
        expected = Path.home()/'Library/Application Support/JK Works Restore Test'
        if root.resolve() != expected.resolve():
            raise RuntimeError('Unexpected test directory')
        local = LocalTest(root)
        if mode == 'download':
            local.download()
        elif mode == 'stop':
            local.stage = 'stop'
            local.supabase('stop')
            print('Alleen de JK Works-testomgeving gestopt; lokale gegevens behouden.')
        elif mode == 'remove':
            local.stage = 'remove'
            # Never remove a different project's volumes, engine or downloaded real snapshots.
            if local.run(['docker', 'context', 'show'], 'context').strip() != CONTEXT:
                raise SafeFailure('target')
            local.supabase('stop', '--no-backup')
            remaining = local.run(['docker', 'network', 'inspect', NETWORK], 'network-remove-check')
            net = json.loads(remaining)[0]
            if net['Containers'] or not net['Internal'] or net.get('Labels', {}).get('jkworks.restore') != PROJECT:
                raise RuntimeError('Unsafe network removal refused')
            local.run(['docker', 'network', 'rm', NETWORK], 'network-remove')
            shutil.rmtree(local.root/'fixtures')
            shutil.rmtree(local.root/'tmp')
            (local.root/'fixture.json').unlink(missing_ok=True)
            print('Lokale fixturecontainers, volumes en fictieve exports verwijderd. Docker Desktop en andere projecten behouden.')
            print('Eventuele gedownloade echte back-ups zijn behouden; verwijder die privémap pas na controle.')
        elif mode == 'fixture':
            tempfile.tempdir = str(local.root/'tmp')
            local.start()
            local.fixture()
            print('Lokale testomgeving actief; productieprojecten zijn niet gekoppeld.')
        else:
            raise RuntimeError('Unknown mode')
    except Exception as exc:
        print('Lokale test gestopt. Geen ruwe foutmelding of sleutels getoond.')
        print(safe_diagnosis(exc, local.stage if local else 'setup'))
        print('De proef is niet als geslaagd bevestigd. Deel geen lokale logbestanden: die kunnen gevoelige gegevens bevatten.')
        raise SystemExit(1)

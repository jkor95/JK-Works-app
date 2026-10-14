"""Manual jk-push deployment. Only the already approved, hash-pinned new table.
No keys, source code, HTTP error bodies or database contents are printed.
"""
import argparse
import email.policy
from email.parser import BytesParser
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.error
import urllib.request
import uuid

PROJECT = 'ercqiavruotoclhvfzud'
ROOT = Path(__file__).resolve().parent.parent
BASELINE = '07793fedac41427abd70f747a21df17c50261ad3'
FUNCTION = 'supabase/functions/jk-push/index.ts'
MIGRATION = 'supabase/migrations/20261014_jk_push_test_requests.sql'
APPROVED_SQL_SHA = '0acf0d2a1d8393225df2f23486699d2b537c881c43f75bd4fd22ff3b8b34af23'

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

class Api:
    def __init__(self, token):
        if not token:
            raise RuntimeError('Secret SUPABASE_ACCESS_TOKEN ontbreekt')
        self.token = token
        self.opener = urllib.request.build_opener(NoRedirect())

    def request(self, path, body=None, content_type='application/json', accept='application/json'):
        if not path.startswith('/') or path.startswith('//'):
            raise RuntimeError('Ongeldig API-pad')
        req = urllib.request.Request('https://api.supabase.com/v1/projects/' + PROJECT + path,
            data=body, headers={'Authorization': 'Bearer ' + self.token,
            'Content-Type': content_type, 'Accept': accept}, method='POST' if body is not None else 'GET')
        try:
            with self.opener.open(req, timeout=120) as response:
                raw = response.read()
                return raw, response.headers.get('Content-Type', '')
        except urllib.error.HTTPError as error:
            raise RuntimeError('Management API HTTP ' + str(error.code)) from None
        except Exception:
            raise RuntimeError('Management API verbinding mislukt; status eerst opnieuw controleren') from None

    def json(self, path, body=None):
        raw, _ = self.request(path, None if body is None else json.dumps(body).encode())
        return json.loads(raw)

    def sql(self, query, read_only=True):
        return self.json('/database/query', {'query': query, 'read_only': read_only})


def canonical_hash(source):
    # Parse/print actual TypeScript and normalise literal quotes. Child receives no credentials.
    code = r"""
const ts=require('typescript'),fs=require('node:fs'),crypto=require('node:crypto');
const source=fs.readFileSync(0,'utf8');
const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,removeComments:true}}).outputText;
const parsed=ts.createSourceFile('index.js',output,ts.ScriptTarget.ESNext,true,ts.ScriptKind.JS);
const transformed=ts.transform(parsed,[ctx=>node=>ts.visitNode(node,function visit(n){
 if(ts.isStringLiteral(n))return ts.factory.createStringLiteral(n.text);
 return ts.visitEachChild(n,visit,ctx);
})]);
const printed=ts.createPrinter({removeComments:true}).printFile(transformed.transformed[0]);
process.stdout.write(crypto.createHash('sha256').update(printed).digest('hex'));
"""
    env = {k: os.environ[k] for k in ['PATH', 'NODE_PATH'] if k in os.environ}
    result = subprocess.run(['node', '-e', code], input=source, capture_output=True, env=env)
    if result.returncode or len(result.stdout) != 64:
        raise RuntimeError('Bronvergelijking mislukt; geen deployment')
    return result.stdout.decode()


def unpack_source(raw, content_type, metadata):
    if not content_type.startswith('multipart/'):
        raise RuntimeError('Live bron kon niet veilig worden uitgelezen; geen deployment')
    message = BytesParser(policy=email.policy.default).parsebytes(
        ('MIME-Version: 1.0\r\nContent-Type: ' + content_type + '\r\n\r\n').encode() + raw)
    parts = list(message.iter_parts())
    entrypoint = metadata.get('entrypoint_path', '')
    for part in parts:
        if part.get_param('name', header='content-disposition') == 'metadata':
            entrypoint = json.loads(part.get_payload(decode=True)).get('deno2_entrypoint_path') or entrypoint
    files = [p for p in parts if p.get_filename()]
    candidates = [p for p in files if (p.get('Supabase-Path') or p.get_filename()) == entrypoint]
    if len(candidates) != 1:
        candidates = [p for p in files if (p.get('Supabase-Path') or p.get_filename()).endswith('/index.ts') or p.get_filename() == 'index.ts']
    if len(candidates) != 1:
        raise RuntimeError('Entrypoint niet eenduidig; geen deployment')
    return candidates[0].get_payload(decode=True)


def live_source(api, metadata):
    raw, content_type = api.request('/functions/jk-push/body', accept='multipart/form-data')
    return unpack_source(raw, content_type, metadata)


def ensure_table(api, approved):
    exists = api.sql("select to_regclass('public.jk_push_test_requests') is not null as present")
    if exists != [{'present': True}]:
        if exists != [{'present': False}] or not approved:
            raise RuntimeError('Nieuwe testtabel ontbreekt; afzonderlijk goedgekeurde migratie nodig')
        source = (ROOT / MIGRATION).read_bytes()
        if hashlib.sha256(source).hexdigest() != APPROVED_SQL_SHA:
            raise RuntimeError('SQL wijkt af van afzonderlijk goedgekeurde versie')
        api.sql('begin;\n' + source.decode() + '\ncommit;', read_only=False)
        print('Uitsluitend de goedgekeurde nieuwe testtabel aangemaakt.')
    security = api.sql("""select c.relrowsecurity as rls,
        has_table_privilege('anon','public.jk_push_test_requests','SELECT,INSERT,UPDATE,DELETE') as anon_access,
        has_table_privilege('authenticated','public.jk_push_test_requests','SELECT,INSERT,UPDATE,DELETE') as user_access,
        (select count(*) from pg_policies where schemaname='public' and tablename='jk_push_test_requests') as policies
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relname='jk_push_test_requests'""")
    if security != [{'rls': True, 'anon_access': False, 'user_access': False, 'policies': 0}]:
        raise RuntimeError('Testtabel niet volgens goedgekeurde afscherming; niets aangepast')
    print('RLS en afscherming van nieuwe testtabel gecontroleerd.')


def multipart(source, metadata):
    boundary = 'jkworks-' + uuid.uuid4().hex
    body = ('--' + boundary + '\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n' +
        json.dumps({'name': metadata['name'], 'entrypoint_path': 'index.ts', 'verify_jwt': metadata['verify_jwt']}) +
        '\r\n--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="index.ts"\r\n' +
        'Content-Type: application/typescript\r\n\r\n').encode() + source + ('\r\n--' + boundary + '--\r\n').encode()
    return body, 'multipart/form-data; boundary=' + boundary


def record_version(version, source_state):
    if type(version) is not int or version < 1:
        raise RuntimeError('Functieversie niet bevestigd')
    output=os.environ.get('GITHUB_OUTPUT')
    if output:
        with open(output,'a') as handle:
            handle.write('version='+str(version)+'\nsource_state='+source_state+'\n')


def deploy(api, mode, approved=False):
    metadata = api.json('/functions/jk-push')
    if metadata.get('slug') != 'jk-push' or metadata.get('status') != 'ACTIVE' or not isinstance(metadata.get('verify_jwt'), bool):
        raise RuntimeError('Bestaande functieconfiguratie onbevestigd; geen deployment')
    if metadata.get('import_map') or metadata.get('import_map_path'):
        raise RuntimeError('Bestaande importmap vereist aparte beoordeling; geen deployment')
    baseline = subprocess.check_output(['git', 'show', BASELINE + ':' + FUNCTION], cwd=ROOT)
    proposed = (ROOT / FUNCTION).read_bytes()
    current_hash = canonical_hash(live_source(api, metadata))
    baseline_hash, proposed_hash = canonical_hash(baseline), canonical_hash(proposed)
    if current_hash not in (baseline_hash, proposed_hash):
        raise RuntimeError('Live functie wijkt inhoudelijk af van beoordeelde uitgangsversie; geen overschrijving')
    print('Live functie gecontroleerd: versie=' + str(metadata['version']) + '; verify_jwt=' + str(metadata['verify_jwt']))
    print('Bestaande automatische functiecode komt overeen met beoordeelde bron.')
    if mode == 'inspect':
        record_version(metadata['version'],'proposed' if current_hash==proposed_hash else 'baseline')
        print('Inspectie geslaagd; geen database- of functiewijzigingen uitgevoerd.')
        return
    ensure_table(api, approved)
    if current_hash != proposed_hash:
        body, content_type = multipart(proposed, metadata)
        api.request('/functions/deploy?slug=jk-push', body, content_type)
    after = api.json('/functions/jk-push')
    if after.get('id') != metadata['id'] or after.get('status') != 'ACTIVE' or after.get('verify_jwt') != metadata['verify_jwt']:
        raise RuntimeError('Deploymentconfiguratie niet bevestigd; geen frontend publiceren')
    if canonical_hash(live_source(api, after)) != proposed_hash:
        raise RuntimeError('Uitgerolde bron niet bevestigd; geen frontend publiceren')
    record_version(after['version'],'proposed')
    print('DEPLOYMENT VERIFIED: jk-push versie=' + str(after['version']) + '; live bron gelijk aan PR; JWT-configuratie behouden.')
    print('VAPID-secrets, webhooks, bestaande gegevens en cronjobs niet aangepast. Geen echte push verstuurd.')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--mode', choices=['inspect', 'deploy'], required=True)
    parser.add_argument('--approved-test-table', action='store_true')
    args = parser.parse_args()
    try:
        deploy(Api(os.environ.get('SUPABASE_ACCESS_TOKEN')), args.mode, args.approved_test_table)
    except Exception as error:
        # Only our fixed RuntimeError messages are safe; network/parser exceptions are suppressed.
        message = 'DEPLOYMENT STOPPED: ' + (str(error) if type(error) is RuntimeError else type(error).__name__)
        print(('::error::' if os.environ.get('GITHUB_ACTIONS') == 'true' else '') + message, file=sys.stderr)
        return 1
    return 0

if __name__ == '__main__':
    sys.exit(main())

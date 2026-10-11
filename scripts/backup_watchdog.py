"""GitHub-only alerts. No Supabase/R2 credentials or backup contents required."""
import json
import os
from datetime import datetime, timezone, timedelta
from urllib.request import Request, urlopen

REPOSITORY = 'jkor95/JK-Works-app'
TITLE = 'JK Works: back-upwaarschuwing'
BACKUP_JOB = 'Goedgekeurde productieback-up'


def api(method, path, payload=None):
    headers = {'Authorization': 'Bearer ' + os.environ['GH_TOKEN'],
               'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'}
    data = json.dumps(payload).encode() if payload is not None else None
    with urlopen(Request('https://api.github.com/repos/' + REPOSITORY + path,
                         data=data, headers=headers, method=method), timeout=30) as response:
        body = response.read()
        return json.loads(body) if body else None


def latest_verified_job(now):
    cutoff = now - timedelta(hours=48)
    runs = api('GET', '/actions/workflows/cloud-backup.yml/runs?branch=main&per_page=100')['workflow_runs']
    for run in runs:
        if datetime.fromisoformat(run['created_at'].replace('Z', '+00:00')) < cutoff - timedelta(hours=1):
            continue
        for job in api('GET', f"/actions/runs/{run['id']}/jobs?per_page=100")['jobs']:
            if job['name'] == BACKUP_JOB and job['conclusion'] == 'success':
                completed = datetime.fromisoformat(job['completed_at'].replace('Z', '+00:00'))
                if completed >= cutoff:
                    return {'url':run['html_url'], 'completed_at':job['completed_at']}
    return None


def sync_alert(reason, run_url, recent=None):
    owner = REPOSITORY.split('/')[0]
    marker = '<!-- jkworks-backup-monitor -->'
    issues = api('GET', '/issues?state=open&assignee=' + owner + '&per_page=100')
    existing = next((issue for issue in issues if issue.get('title') == TITLE
                     and marker in (issue.get('body') or '') and not issue.get('pull_request')), None)
    if reason:
        body = (reason + '\n\nControleer de [Actions-run](' + run_url + '). '
                'Er staan geen sleutels, back-upinhoud of klantgegevens in deze melding. '
                'Voer geen productieherstel uit zonder afzonderlijk herstelplan.\n\n' + marker)
        if existing:
            if not existing['body'].startswith(reason):
                api('PATCH', f"/issues/{existing['number']}", {'body': body})
                api('POST', f"/issues/{existing['number']}/comments",
                    {'body':'@' + owner + ' Nieuwe back-upwaarschuwing: ' + reason})
        else:
            api('POST', '/issues', {'title': TITLE, 'body': body, 'assignees': [owner]})
        print('Back-upwaarschuwing beschikbaar als aan de eigenaar toegewezen GitHub-issue.')
    elif existing and recent and recent['completed_at'] > existing['created_at']:
        api('PATCH', f"/issues/{existing['number']}", {'state': 'closed', 'state_reason': 'completed'})
        print('Back-upwaarschuwing gesloten: een recente geverifieerde productiejob is geslaagd.')
    elif existing:
        print('Waarschuwing blijft open tot een nieuwe geverifieerde productieback-up slaagt.')
    else:
        print('Controle geslaagd: recente geverifieerde productieback-up aanwezig.')


def check(now=None):
    if os.environ.get('GITHUB_REPOSITORY') != REPOSITORY or os.environ.get('JK_BACKUP_AUTHORIZED') != 'true':
        raise RuntimeError('Alert workflow is disabled or targets another repository')
    now = now or datetime.now(timezone.utc)
    failed = any(os.environ.get(name) in {'failure', 'cancelled'}
                 for name in ('JK_BACKUP_RESULT', 'JK_FIXTURE_RESULT'))
    recent = latest_verified_job(now)
    reason = ('De goedgekeurde back-uppoging of verplichte fixturetest is mislukt of afgebroken.' if failed else
              'Geen succesvolle geverifieerde productieback-up in de afgelopen 48 uur gevonden.' if not recent else None)
    run_url = (f"https://github.com/{REPOSITORY}/actions/runs/" + os.environ['GITHUB_RUN_ID'])
    sync_alert(reason, recent['url'] if recent and not failed else run_url, recent)


if __name__ == '__main__':
    try:
        check()
    except Exception as exc:
        print(f'BACKUP MONITOR FAILED ({type(exc).__name__}); no secret values logged.')
        raise SystemExit(1)

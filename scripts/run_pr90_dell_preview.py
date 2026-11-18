#!/usr/bin/env python3
"""Fail-closed, detached, isolated preview of JK Works PR #90. No deployment."""
import base64
import hashlib
import importlib.util
import io
import json
import os
import pathlib
import re
import sys
import tarfile
import threading
import time
import urllib.request
from datetime import datetime, timezone

ROOT=pathlib.Path('/opt/jkworks-serverbeheer/release-automation')
STATE=pathlib.Path('/var/lib/jkworks-release')
COMMIT='4e9ed48375c1680cc4d183b34e7e52458de37ec2'
PATCH_COMMIT='56df9a88d911e6bb00d505894e46a0df6558b137'
ORIGINAL_SHA='43bc85b7c8da9cd2ecad2403047761f9867d1e0a'
PATCH_SHA='d6911a085ecdee947e212d109ccde64e0d74f4ff'
TARGET='scripts/test_workdays.cjs'
FOLDER=STATE/'jkworks-pr90-preview-20261118'
STATUS=FOLDER/'status.json'
LOG=FOLDER/'browser-check.private.log'
ID='jkworks-pr90-preview-20261118'
REQUIRED='Backend: uitsluitend fixtures; echte productie-Supabase en apparaatdeelkaart niet getest.'

def record(status, **details):
    obj={'status':status,'source_commit':COMMIT,'patch_commit':PATCH_COMMIT,
         'publication_enabled':False,
         'checked_at_utc':datetime.now(timezone.utc).isoformat(),**details}
    tmp=FOLDER/'status.tmp'
    tmp.write_text(json.dumps(obj,sort_keys=True,indent=2)+'\n')
    os.chmod(tmp,0o600)
    tmp.replace(STATUS)
    print('STATUS:',status,flush=True)

def blob_sha(data):
    return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()

def source_module(filename,name):
    spec=importlib.util.spec_from_file_location(name,ROOT/filename)
    mod=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def patch_payload(original,patched):
    out=io.BytesIO()
    found=False
    with tarfile.open(fileobj=io.BytesIO(original),mode='r:') as src,tarfile.open(fileobj=out,mode='w') as dst:
        for member in src:
            if member.isdir():continue
            if not member.isfile():raise RuntimeError('archive_nonfile_rejected')
            data=src.extractfile(member).read()
            if member.name==TARGET:
                if blob_sha(data)!=ORIGINAL_SHA:raise RuntimeError('source_fixture_hash_mismatch')
                data=patched
                found=True
            info=tarfile.TarInfo(member.name)
            info.size=len(data)
            info.mode=0o444
            dst.addfile(info,io.BytesIO(data))
    if not found:raise RuntimeError('source_fixture_missing')
    return out.getvalue()

def monitor(stop):
    n=0
    last_group=0
    while not stop.wait(3):
        try:
            lines=LOG.read_text(errors='replace').splitlines()
        except FileNotFoundError:
            continue
        if len(lines)<n:n=0
        for line in lines[n:]:
            if line.startswith('PASS:'):
                last_group+=1
                print('PASS',last_group,line[5:120],flush=True)
            elif line=='JKWORKS_CLOUD_FIXTURES_COMPLETE':
                print('CLOUDFIXTURES: GESLAAGD',flush=True)
            elif 'Error' in line or 'Timeout' in line:
                print('BROWSERFOUT GEDETECTEERD; zie log',flush=True)
        n=len(lines)

def main():
    if os.geteuid()!=0:raise RuntimeError('root_required')
    if FOLDER.exists():raise RuntimeError('test_id_already_used; no_implicit_retry')
    FOLDER.mkdir(mode=0o700)
    os.chmod(FOLDER,0o700)
    browser=source_module('jkworks_browser_checks.py','preview_browser')
    req={'schema':2,'id':ID,'target':'jkworks','commit':COMMIT,
         'previous_commit':'','mode':'verify_only'}
    code=browser.source_module()
    head=code.git(req,'rev-parse','refs/heads/production-dell').decode().strip()
    if head!=COMMIT:raise RuntimeError('source_head_changed')
    parents=code.git(req,'rev-list','--parents','-n','1',COMMIT).decode().split()
    if len(parents)!=2 or parents[0]!=COMMIT:raise RuntimeError('invalid_source_parent')
    req['previous_commit']=parents[1]
    original,exported_head=browser.export(req)
    if exported_head!=COMMIT:raise RuntimeError('source_export_changed')
    env=pathlib.Path('/etc/jkworks-serverbeheer/github.env').read_text()
    matches=re.findall(r'^JKWORKS_GH_TOKEN=(.+)$',env,re.M)
    if len(matches)!=1:raise RuntimeError('github_token_missing')
    token=matches[0].strip().strip("\\'\\\"")
    request=urllib.request.Request(
        'https://api.github.com/repos/jkor95/JK-Works-app/contents/'+TARGET+'?ref='+PATCH_COMMIT,
        headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json',
                 'User-Agent':'JKWorks-PR90-Isolated-Preview'})
    with urllib.request.urlopen(request,timeout=30) as response:
        doc=json.load(response)
    patch=base64.b64decode(doc['content'],validate=True)
    if doc.get('sha')!=PATCH_SHA or blob_sha(patch)!=PATCH_SHA:
        raise RuntimeError('patch_hash_mismatch')
    payload=patch_payload(original,patch)
    record('running')
    stop=threading.Event()
    observer=threading.Thread(target=monitor,args=(stop,),daemon=True)
    observer.start()
    try:
        result=browser.sandbox(req,payload,FOLDER)
        after=code.git(req,'rev-parse','refs/heads/production-dell').decode().strip()
        loglines=LOG.read_text(errors='replace').splitlines()
        groups=sum(x.startswith('PASS:') for x in loglines)
        passed=(result.get('browser_checks_passed') is True and after==COMMIT
                and REQUIRED in loglines and 'JKWORKS_CLOUD_FIXTURES_COMPLETE' in loglines)
        record('passed' if passed else 'failed',browser_groups=groups,
               source_unchanged=after==COMMIT,full_suite_complete=REQUIRED in loglines)
    finally:
        stop.set()
        observer.join(timeout=4)
        cleanup=browser.cleanup(req)
        print('OPRUIMEN:','GESLAAGD' if cleanup else 'CONTROLE NODIG',flush=True)
        if not cleanup:
            record('cleanup_failed')
    if not passed:sys.exit(1)

if __name__=='__main__':
    try:main()
    except Exception as exc:
        print('TEST GEBLOKKEERD:',type(exc).__name__,str(exc)[:200],flush=True)
        if FOLDER.is_dir():
            try:record('blocked',reason=type(exc).__name__)
            except Exception:pass
        sys.exit(1)

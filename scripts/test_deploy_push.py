"""Fictitious deployment guards: never opens a network connection."""
import hashlib
import json
import unittest
import uuid
from unittest.mock import patch
import deploy_push as deploy

class TableApi:
    def __init__(self, exists=False):
        self.exists=exists
        self.writes=[]
        self.security=[{'rls':True,'anon_access':False,'user_access':False,'policies':0}]
    def sql(self, query, read_only=True):
        if not read_only:
            self.writes.append(query)
            self.exists=True
            return []
        if 'to_regclass' in query:
            return [{'present':self.exists}]
        return self.security

class DeploymentGuards(unittest.TestCase):
    def setUp(self):
        silent=patch('builtins.print')
        silent.start()
        self.addCleanup(silent.stop)
    def test_exact_previously_approved_sql(self):
        sql=(deploy.ROOT/deploy.MIGRATION).read_bytes()
        self.assertEqual(hashlib.sha256(sql).hexdigest(),deploy.APPROVED_SQL_SHA)
        api=TableApi()
        deploy.ensure_table(api,True)
        self.assertEqual(len(api.writes),1)
        self.assertEqual(api.writes[0],'begin;\n'+sql.decode()+'\ncommit;')
    def test_no_sql_write_without_separate_approval(self):
        api=TableApi()
        with self.assertRaises(RuntimeError):deploy.ensure_table(api,False)
        self.assertEqual(api.writes,[])
    def test_existing_table_not_changed(self):
        api=TableApi(True)
        deploy.ensure_table(api,True)
        self.assertEqual(api.writes,[])
    def test_wrong_security_never_automatically_changed(self):
        api=TableApi(True)
        api.security=[{'rls':False,'anon_access':True,'user_access':False,'policies':0}]
        with self.assertRaises(RuntimeError):deploy.ensure_table(api,True)
        self.assertEqual(api.writes,[])
    def test_missing_credential_blocks_before_network(self):
        with self.assertRaises(RuntimeError):deploy.Api(None)
    def test_redirect_cannot_forward_authorization(self):
        self.assertIsNone(deploy.NoRedirect().redirect_request(None,None,302,None,None,'https://other.invalid'))
    def test_multipart_preserves_jwt_setting(self):
        source=b'// fictitious function'
        body,content_type=deploy.multipart(source,{'name':'jk-push','verify_jwt':False})
        self.assertIn(b'"verify_jwt": false',body)
        self.assertIn(source,body)
        self.assertIn('multipart/form-data; boundary=',content_type)
        self.assertNotIn(b'SUPABASE_ACCESS_TOKEN',body)
    def test_unbundled_source_round_trip(self):
        source=b'// source fixture'
        body,content_type=deploy.multipart(source,{'name':'jk-push','verify_jwt':False})
        self.assertEqual(deploy.unpack_source(body,content_type,{'entrypoint_path':'index.ts'}),source)
    def test_unexpected_source_container_rejected(self):
        with self.assertRaises(RuntimeError):deploy.unpack_source(b'not source','text/plain',{})
    def test_different_live_function_never_overwritten(self):
        class Api:
            calls=[]
            def json(self,path,body=None):
                self.calls.append(path)
                return {'id':'fixture','slug':'jk-push','name':'jk-push','status':'ACTIVE','version':1,'verify_jwt':False}
        api=Api()
        with patch.object(deploy.subprocess,'check_output',return_value=b'baseline fixture'),patch.object(deploy,'live_source',return_value=b'new unknown live code'),patch.object(deploy,'canonical_hash',side_effect=['different','baseline','proposed']):
            with self.assertRaises(RuntimeError):deploy.deploy(api,'deploy',True)
        self.assertEqual(api.calls,['/functions/jk-push'])
    def test_current_release_cannot_create_missing_table(self):
        class Api:
            def json(self,path,body=None):
                return {'id':'fixture','slug':'jk-push','name':'jk-push','status':'ACTIVE','version':1,'verify_jwt':False}
        api=Api()
        with patch.object(deploy.subprocess,'check_output',return_value=b'baseline fixture'),patch.object(deploy,'live_source',return_value=b'baseline fixture'),patch.object(deploy,'canonical_hash',side_effect=['baseline','baseline','proposed']),patch.object(deploy,'ensure_table',side_effect=RuntimeError('Fixture stop before deployment')) as table:
            with self.assertRaises(RuntimeError):deploy.deploy(api,'deploy',True)
            table.assert_called_once_with(api,False)
    def test_canonicaliser_receives_no_credentials(self):
        class Result:
            returncode=0
            stdout=b'a'*64
        with patch.dict(deploy.os.environ,{'SUPABASE_ACCESS_TOKEN':str(uuid.uuid4())}),patch.object(deploy.subprocess,'run',return_value=Result()) as run:
            self.assertEqual(deploy.canonical_hash(b'// fixture'),'a'*64)
            self.assertNotIn('SUPABASE_ACCESS_TOKEN',run.call_args.kwargs['env'])

if __name__=='__main__':
    unittest.main()

-- Synthetic, transaction-rolled-back database smoke test.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO jk_staging.accounts(id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
INSERT INTO jk_staging.app_records(user_id,store,record_id,data)
 VALUES ('11111111-1111-4111-8111-111111111111','clients','fake-001','{"name":"TEST ONLY"}');
INSERT INTO jk_staging.app_deletions(user_id,store,record_id)
 VALUES ('11111111-1111-4111-8111-111111111111','clients','fake-old');
INSERT INTO jk_staging.public_requests(owner_id,name,request_type,description)
 VALUES ('11111111-1111-4111-8111-111111111111','Synthetic Demo','repair','not a real customer');
INSERT INTO jk_staging.file_objects(owner_id,bucket,object_key,sha256,size_bytes)
 VALUES ('11111111-1111-4111-8111-111111111111','fictional','test/file',repeat('a',64),12);
DO $$
BEGIN
 IF (SELECT count(*) FROM jk_staging.app_records WHERE store='clients') <> 1 THEN
  RAISE EXCEPTION 'Records smoke check failed';
 END IF;
 IF (SELECT count(*) FROM jk_staging.app_deletions) <> 1 THEN
  RAISE EXCEPTION 'Deletion smoke check failed';
 END IF;
 IF (SELECT count(*) FROM jk_staging.public_requests) <> 1 THEN
  RAISE EXCEPTION 'Public request smoke check failed';
 END IF;
 IF (SELECT count(*) FROM jk_staging.file_objects) <> 1 THEN
  RAISE EXCEPTION 'File metadata smoke check failed';
 END IF;
END $$;
ROLLBACK;
-- No test rows persisted.
SELECT count(*) = 0 AS smoke_was_rolled_back FROM jk_staging.accounts;

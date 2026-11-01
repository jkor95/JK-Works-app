-- Read-only checks for future empty staging DB; no production access.
SELECT current_database() AS db_name, current_user AS role_name;
SELECT table_schema,table_name
FROM information_schema.tables
WHERE table_schema='jk_staging' ORDER BY table_name;
SELECT has_schema_privilege('public','jk_staging','USAGE') AS public_schema_usage;

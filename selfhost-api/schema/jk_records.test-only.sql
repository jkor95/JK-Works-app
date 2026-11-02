-- VOORSTEL ALLEEN. NIET AUTOMATISCH UITVOEREN.
-- Uitsluitend bedoeld voor een lege, afzonderlijke JK Works-testdatabase.
-- Geen productie-, Supabase- of Coolify-database wijzigen.
BEGIN;
CREATE TABLE IF NOT EXISTS jk_records (
  owner_id uuid NOT NULL,
  store text NOT NULL CHECK (store IN ('clients', 'jobs')),
  record_id text NOT NULL CHECK (record_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, store, record_id)
);
CREATE INDEX IF NOT EXISTS jk_records_owner_store_updated_idx
  ON jk_records (owner_id, store, updated_at DESC);
COMMIT;
-- Let op: de HTTP-API biedt nog GEEN authenticatie.
-- Daarom blijft de records-module voorlopig niet via HTTP bereikbaar.

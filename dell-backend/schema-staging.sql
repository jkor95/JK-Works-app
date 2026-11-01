-- JK Works staging-only baseline. NEVER execute on live Supabase or existing 'jkworks' DB.
-- Apply only to a NEW, empty, dedicated PostgreSQL database after backup/restore plan.
BEGIN;
CREATE SCHEMA IF NOT EXISTS jk_staging;
CREATE TABLE jk_staging.accounts (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  disabled boolean NOT NULL DEFAULT false
);
-- Auth secrets/hashes deliberately omitted: authentication design not yet approved.
CREATE TABLE jk_staging.app_records (
  user_id uuid NOT NULL REFERENCES jk_staging.accounts(id),
  store text NOT NULL,
  record_id text NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,store,record_id),
  CHECK (length(store) BETWEEN 1 AND 100),
  CHECK (length(record_id) BETWEEN 1 AND 300)
);
CREATE TABLE jk_staging.app_deletions (
  user_id uuid NOT NULL REFERENCES jk_staging.accounts(id),
  store text NOT NULL,
  record_id text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,store,record_id)
);
CREATE TABLE jk_staging.public_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'new',
  name text NOT NULL,
  company text,
  phone text,
  email text,
  request_type text NOT NULL,
  requested_date date,
  start_time time,
  end_time time,
  location text,
  description text NOT NULL,
  preferred_contact text,
  owner_id uuid NOT NULL REFERENCES jk_staging.accounts(id),
  photo_paths text[] NOT NULL DEFAULT ARRAY[]::text[]
);
CREATE TABLE jk_staging.file_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES jk_staging.accounts(id),
  bucket text NOT NULL,
  object_key text NOT NULL,
  sha256 char(64) NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  content_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket,object_key)
);
-- Deliberately no PUBLIC/anonymous access. App-specific role grants must be designed and tested.
REVOKE ALL ON SCHEMA jk_staging FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA jk_staging FROM PUBLIC;
COMMIT;

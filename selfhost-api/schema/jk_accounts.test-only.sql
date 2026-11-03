-- Alleen voor afzonderlijke jkworks_backend_test database. Niet automatisch uitvoeren.
BEGIN;
DO $$ BEGIN
 IF current_database() <> 'jkworks_backend_test' THEN
  RAISE EXCEPTION 'Refusing non-test database';
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS jk_test_accounts (
 owner_id uuid PRIMARY KEY,
 email text NOT NULL UNIQUE CHECK (length(email) BETWEEN 3 AND 254 AND email = lower(email)),
 password_hash text NOT NULL,
 disabled boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
-- Geen standaardaccount, wachtwoord of tokens in GitHub bewaren.

-- Run ONLY in jkworks_staging, not in any production database.
BEGIN;
CREATE TABLE IF NOT EXISTS jk_staging.login_accounts (
 account_id uuid PRIMARY KEY REFERENCES jk_staging.accounts(id),
 email text NOT NULL UNIQUE,
 password_salt text NOT NULL,
 password_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (length(email) BETWEEN 3 AND 254)
);
CREATE TABLE IF NOT EXISTS jk_staging.login_sessions (
 token_hash text PRIMARY KEY,
 account_id uuid NOT NULL REFERENCES jk_staging.accounts(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jk_login_sessions_account_idx ON jk_staging.login_sessions(account_id);
CREATE INDEX IF NOT EXISTS jk_login_sessions_expiry_idx ON jk_staging.login_sessions(expires_at);
COMMIT;

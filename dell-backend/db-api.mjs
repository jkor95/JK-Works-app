import pg from 'pg';
import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4,
  connectionTimeoutMillis: 3000, idleTimeoutMillis: 15000 });
const digest = value => createHash('sha256').update(value).digest('hex');
export const passwordHash = async (password, salt) =>
  (await scrypt(password, Buffer.from(salt,'hex'), 64)).toString('hex');
export async function createLogin(accountId,email,password) {
  if (!process.env.DATABASE_URL) throw Error('DATABASE_URL missing');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < 14) throw Error('Invalid new account credentials');
  const salt=randomBytes(32).toString('hex');
  const hash=await passwordHash(password,salt);
  const conn=await pool.connect();
  try {
    await conn.query('BEGIN');
    await conn.query('INSERT INTO jk_staging.accounts(id) VALUES ($1)',[accountId]);
    await conn.query('INSERT INTO jk_staging.login_accounts(account_id,email,password_salt,password_hash) VALUES ($1,$2,$3,$4)',[accountId,email.trim().toLowerCase(),salt,hash]);
    await conn.query('COMMIT');
  } catch(e) { await conn.query('ROLLBACK');throw e; }
  finally {conn.release();}
}
export async function login(email,password) {
  if(typeof email!=='string'||typeof password!=='string'||email.length>254||password.length>1024) return null;
  const r=await pool.query('SELECT l.account_id,l.password_salt,l.password_hash FROM jk_staging.login_accounts l JOIN jk_staging.accounts a ON a.id=l.account_id WHERE l.email=$1 AND a.disabled=false',[email.trim().toLowerCase()]);
  // Do not reveal whether an email exists; retain constant-work password verification.
  const salt=r.rows[0]?.password_salt || '00'.repeat(32);
  const expected=Buffer.from(r.rows[0]?.password_hash || '00'.repeat(64),'hex');
  const actual=await scrypt(password,Buffer.from(salt,'hex'),64);
  if(!r.rows.length||!timingSafeEqual(expected,actual)) return null;
  const token=randomBytes(32).toString('base64url');
  await pool.query("INSERT INTO jk_staging.login_sessions(token_hash,account_id,expires_at) VALUES ($1,$2,now()+ interval '12 hours')",[digest(token),r.rows[0].account_id]);
  return token;
}
export async function identify(token) {
  if(!token || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const r=await pool.query("SELECT s.account_id FROM jk_staging.login_sessions s JOIN jk_staging.accounts a ON a.id=s.account_id WHERE s.token_hash=$1 AND s.expires_at>now() AND a.disabled=false",[digest(token)]);
  return r.rows[0]?.account_id || null;
}
export async function logout(token) {
  if (token) await pool.query('DELETE FROM jk_staging.login_sessions WHERE token_hash=$1',[digest(token)]);
}
export async function listRecords(accountId) {
  const r=await pool.query('SELECT store,record_id,data,updated_at FROM jk_staging.app_records WHERE user_id=$1 ORDER BY store,record_id LIMIT 5000',[accountId]);
  return r.rows;
}
export async function upsertRecord(accountId,store,id,data) {
  const conn=await pool.connect();
  try {
    await conn.query('BEGIN');
    await conn.query('SELECT pg_advisory_xact_lock(hashtextextended($1 || \'|\' || $2 || \'|\' || $3, 0))',[accountId,store,id]);
    // Deletion wins: do not resurrect an older ID from a second device.
    const tombstone=await conn.query('SELECT 1 FROM jk_staging.app_deletions WHERE user_id=$1 AND store=$2 AND record_id=$3 FOR UPDATE',[accountId,store,id]);
    if(tombstone.rowCount){await conn.query('ROLLBACK');return {deleted:true};}
    await conn.query(`INSERT INTO jk_staging.app_records(user_id,store,record_id,data,updated_at) VALUES ($1,$2,$3,$4,now())
     ON CONFLICT (user_id,store,record_id) DO UPDATE SET data=EXCLUDED.data,updated_at=now()`,[accountId,store,id,data]);
    await conn.query('COMMIT');
    return {deleted:false};
  } catch(e) {await conn.query('ROLLBACK');throw e;} finally {conn.release();}
}
export async function deleteRecord(accountId,store,id) {
  const conn=await pool.connect();
  try {
    await conn.query('BEGIN');
    await conn.query('SELECT pg_advisory_xact_lock(hashtextextended($1 || \'|\' || $2 || \'|\' || $3, 0))',[accountId,store,id]);
    await conn.query('DELETE FROM jk_staging.app_records WHERE user_id=$1 AND store=$2 AND record_id=$3',[accountId,store,id]);
    await conn.query(`INSERT INTO jk_staging.app_deletions(user_id,store,record_id,deleted_at) VALUES ($1,$2,$3,now())
      ON CONFLICT (user_id,store,record_id) DO UPDATE SET deleted_at=EXCLUDED.deleted_at`,[accountId,store,id]);
    await conn.query('COMMIT');
  } catch(e) {await conn.query('ROLLBACK');throw e;}finally{conn.release();}
}

export async function initializeStagingAccount() {
  if (process.env.ENABLE_STAGING_API !== 'true') return {ready:false,reason:'disabled'};
  const email=process.env.JK_TEST_EMAIL;
  const password=process.env.JK_TEST_PASSWORD;
  if (!process.env.DATABASE_URL || !email || !password || password.length<14) {
    return {ready:false,reason:'missing_staging_credentials'};
  }
  // Safe for repeat deployments. No production tables or existing users modified.
  const conn=await pool.connect();
  try {
    await conn.query('BEGIN');
    await conn.query(`CREATE TABLE IF NOT EXISTS jk_staging.login_accounts (
      account_id uuid PRIMARY KEY REFERENCES jk_staging.accounts(id),
      email text NOT NULL UNIQUE,
      password_salt text NOT NULL,
      password_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await conn.query(`CREATE TABLE IF NOT EXISTS jk_staging.login_sessions (
      token_hash text PRIMARY KEY,
      account_id uuid NOT NULL REFERENCES jk_staging.accounts(id) ON DELETE CASCADE,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await conn.query('CREATE INDEX IF NOT EXISTS jk_login_sessions_expiry_idx ON jk_staging.login_sessions(expires_at)');
    const lookup=await conn.query('SELECT account_id FROM jk_staging.login_accounts WHERE email=$1',[email.trim().toLowerCase()]);
    if(!lookup.rowCount){
      const {randomUUID}=await import('node:crypto');
      const accountId=randomUUID(),salt=randomBytes(32).toString('hex');
      const hash=await passwordHash(password,salt);
      await conn.query('INSERT INTO jk_staging.accounts(id) VALUES ($1)',[accountId]);
      await conn.query('INSERT INTO jk_staging.login_accounts(account_id,email,password_salt,password_hash) VALUES ($1,$2,$3,$4)',[accountId,email.trim().toLowerCase(),salt,hash]);
    }
    await conn.query('COMMIT');
    return {ready:true};
  } catch(e) {
    await conn.query('ROLLBACK');
    return {ready:false,reason:'database_initialization_failed'};
  } finally { conn.release(); }
}

/**
 * Consistent owner-scoped snapshot. Deletion markers are included, so future
 * clients can reconcile removals rather than silently resurrecting records.
 * Deliberately no cross-account access and no production data import.
 */
export async function syncSnapshot(accountId) {
  const conn=await pool.connect();
  try {
    await conn.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const rec=await conn.query('SELECT store,record_id,data,updated_at FROM jk_staging.app_records WHERE user_id=$1 ORDER BY store,record_id LIMIT 5001',[accountId]);
    const del=await conn.query('SELECT store,record_id,deleted_at FROM jk_staging.app_deletions WHERE user_id=$1 ORDER BY store,record_id LIMIT 5001',[accountId]);
    if(rec.rows.length>5000||del.rows.length>5000)throw Error('staging_sync_limit_exceeded');
    await conn.query('COMMIT');
    return {records:rec.rows,deletions:del.rows};
  }catch(err){await conn.query('ROLLBACK');throw err}finally{conn.release()}
}

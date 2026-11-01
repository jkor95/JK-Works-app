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
  return pool.query(`INSERT INTO jk_staging.app_records(user_id,store,record_id,data,updated_at) VALUES ($1,$2,$3,$4,now())
 ON CONFLICT (user_id,store,record_id) DO UPDATE SET data=EXCLUDED.data,updated_at=now()`,[accountId,store,id,data]);
}
export async function deleteRecord(accountId,store,id) {
  const conn=await pool.connect();
  try {
    await conn.query('BEGIN');
    await conn.query('DELETE FROM jk_staging.app_records WHERE user_id=$1 AND store=$2 AND record_id=$3',[accountId,store,id]);
    await conn.query(`INSERT INTO jk_staging.app_deletions(user_id,store,record_id,deleted_at) VALUES ($1,$2,$3,now())
      ON CONFLICT (user_id,store,record_id) DO UPDATE SET deleted_at=EXCLUDED.deleted_at`,[accountId,store,id]);
    await conn.query('COMMIT');
  } catch(e) {await conn.query('ROLLBACK');throw e;}finally{conn.release();}
}

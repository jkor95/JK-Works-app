import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { signTestToken } from './auth.mjs';
const scrypt=promisify(scryptCb);
const emailPattern=/^[^\s@]{1,64}@[^\s@]{1,190}$/;
export async function hashPassword(password) {
 if(typeof password!=='string'||password.length<12||Buffer.byteLength(password)>1024) throw new TypeError('Invalid password');
 const salt=randomBytes(16);
 const hash=await scrypt(password,salt,64,{N:16384,r:8,p:1,maxmem:33554432});
 return 'scrypt-v1$'+salt.toString('base64url')+'$'+hash.toString('base64url');
}
export async function verifyPassword(password,encoded) {
 if(typeof password!=='string'||Buffer.byteLength(password)>1024||typeof encoded!=='string') return false;
 const parts=encoded.split('$');
 if(parts.length!==3||parts[0]!=='scrypt-v1') return false;
 let salt,expected;
 try {salt=Buffer.from(parts[1],'base64url');expected=Buffer.from(parts[2],'base64url');}catch{return false;}
 if(salt.length!==16||expected.length!==64) return false;
 const actual=await scrypt(password,salt,64,{N:16384,r:8,p:1,maxmem:33554432});
 return timingSafeEqual(expected,actual);
}
export function createLoginService(db,secret,{now=()=>Date.now()}={}) {
 if(!db||typeof db.query!=='function'||typeof secret!=='string'||Buffer.byteLength(secret)<32) throw new TypeError('Invalid login service configuration');
 return async ({email,password})=>{
  if(typeof email!=='string'||!emailPattern.test(email)||typeof password!=='string'||password.length>1024) return null;
  const result=await db.query('SELECT owner_id, password_hash FROM jk_test_accounts WHERE email = $1 AND disabled = FALSE LIMIT 1',[email.trim().toLowerCase()]);
  const row=result.rows[0];
  // Do not reveal whether an account exists; run a real scrypt even for unknown accounts.
  const fallback='scrypt-v1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const valid=await verifyPassword(password,row?.password_hash??fallback);
  if(!row||!valid) return null;
  return {access_token:signTestToken(secret,row.owner_id,Math.floor(now()/1000)+900),token_type:'Bearer',expires_in:900};
 };
}

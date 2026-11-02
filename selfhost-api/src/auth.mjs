import { createHmac, timingSafeEqual } from 'node:crypto';

// Internal test tokens only. Tokens must be minted by a trusted, separate login service.
// Never accept owner IDs from request headers, query parameters or bodies.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function b64(value) {return Buffer.from(value).toString('base64url');}
function mac(secret, payload) {return createHmac('sha256',secret).update(payload).digest();}
export function createTokenVerifier(secret, {now=()=>Date.now()}={}) {
  if(typeof secret!=='string'||Buffer.byteLength(secret,'utf8')<32) throw new Error('AUTH_TOKEN_SECRET must contain at least 32 bytes');
  return async req=>{
    const header=req.headers?.authorization;
    if(typeof header!=='string'||!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(header)||header.length>4096) return null;
    const token=header.slice(7);
    const dot=token.indexOf('.');
    const encoded=token.slice(0,dot),signature=token.slice(dot+1);
    let provided,claims;
    try {
      provided=Buffer.from(signature,'base64url');
      if(b64(provided)!==signature) return null;
      claims=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'));
    } catch {return null;}
    const expected=mac(secret,encoded);
    if(provided.length!==expected.length||!timingSafeEqual(provided,expected)) return null;
    if(claims?.aud!=='jkworks-test-api'||!uuid.test(claims?.sub)||!Number.isSafeInteger(claims.exp)||claims.exp*1000<=now()||claims.exp*1000>now()+3600000) return null;
    return {ownerId:claims.sub};
  };
}
// Exported for isolated unit tests and future trusted login service; not an HTTP endpoint.
export function signTestToken(secret, ownerId, expiresAtSeconds) {
  if(typeof secret!=='string'||Buffer.byteLength(secret)<32||!uuid.test(ownerId)||!Number.isSafeInteger(expiresAtSeconds)) throw new TypeError('Invalid signing input');
  const encoded=b64(JSON.stringify({aud:'jkworks-test-api',sub:ownerId,exp:expiresAtSeconds}));
  return encoded+'.'+mac(secret,encoded).toString('base64url');
}

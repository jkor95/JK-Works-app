import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { Pool } from 'pg';
import { createRecordsHandler } from './routes.mjs';
import { createTokenVerifier } from './auth.mjs';
import { createLoginService } from './login.mjs';

const port = Number(process.env.PORT || 3000);
const databaseUrl = process.env.DATABASE_URL;
const pool = process.env.NODE_ENV === 'test' ? null : (databaseUrl ? new Pool({ connectionString: databaseUrl, max: 5, connectionTimeoutMillis: 3000 }) : null);

export function createHandler(db = pool, verifySession = null, login = null) {
  const recordsHandler = db && typeof db.query === 'function' ? createRecordsHandler(db, verifySession) : null;
  const attempts = new Map();
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const url = new URL(req.url || '/', 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/health/live') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/health/ready') {
      try {
        if (!db) throw new Error('Database not configured');
        await db.query('SELECT 1');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ready' }));
      } catch {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'unavailable' }));
      }
      return;
    }
    if (url.pathname === '/v1/auth/login') {
      res.setHeader('Content-Type', 'application/json');
      if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }); res.end(JSON.stringify({error:'method_not_allowed'})); return; }
      if (!login) { res.writeHead(503); res.end(JSON.stringify({error:'authentication_not_configured'})); return; }
      // In-memory limiter for the isolated single-instance test deployment.
      // A production deployment must use a shared limiter at the reverse proxy.
      const key = req.socket?.remoteAddress || 'unknown';
      const now = Date.now();
      for (const [address, entry] of attempts) if (entry.until <= now) attempts.delete(address);
      const entry = attempts.get(key) || { count: 0, until: now + 60000 };
      if (entry.count >= 5) { res.writeHead(429, { 'Retry-After': String(Math.max(1, Math.ceil((entry.until-now)/1000))) }); res.end(JSON.stringify({error:'too_many_attempts'})); return; }
      entry.count++;
      attempts.set(key, entry);
      const chunks=[]; let size=0;
      try {
        for await (const chunk of req) {
          size+=chunk.length;
          if(size>4096) { res.writeHead(413); res.end(JSON.stringify({error:'payload_too_large'})); return; }
          chunks.push(chunk);
        }
        const payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('bad input');
        const result=await login(payload);
        res.writeHead(result?200:401);
        res.end(JSON.stringify(result??{error:'invalid_credentials'}));
      } catch (e) {
        const badInput=e instanceof SyntaxError||e.message==='bad input';
        res.writeHead(badInput?400:503);
        res.end(JSON.stringify({error:badInput?'invalid_input':'authentication_unavailable'}));
      }
      return;
    }
    if (url.pathname.startsWith('/v1/records/')) {
      if (!recordsHandler) { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'database_unavailable' })); return; }
      return recordsHandler(req, res, url);
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!pool) throw new Error('DATABASE_URL is verplicht');
  const verifySession = process.env.AUTH_TOKEN_SECRET ? createTokenVerifier(process.env.AUTH_TOKEN_SECRET) : null;
  const login = process.env.AUTH_TOKEN_SECRET ? createLoginService(pool, process.env.AUTH_TOKEN_SECRET) : null;
  const server = http.createServer(createHandler(pool, verifySession, login));
  server.requestTimeout = 10000;
  server.headersTimeout = 8000;
  server.listen(port, '0.0.0.0', () => console.log('JK Works isolated test API listening'));
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => server.close(() => pool.end().finally(() => process.exit(0))));
  }
}

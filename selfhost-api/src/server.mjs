import http from 'node:http';
import { Pool } from 'pg';

const port = Number(process.env.PORT || 3000);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is verplicht');
const pool = new Pool({ connectionString: databaseUrl, max: 5, connectionTimeoutMillis: 3000 });

export function createHandler(db = pool) {
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
        await db.query('SELECT 1');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ready' }));
      } catch {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'unavailable' }));
      }
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  };
}

if (process.env.NODE_ENV !== 'test') {
  const server = http.createServer(createHandler());
  server.requestTimeout = 10000;
  server.headersTimeout = 8000;
  server.listen(port, '0.0.0.0', () => console.log('JK Works isolated test API listening'));
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => server.close(() => pool.end().finally(() => process.exit(0))));
  }
}

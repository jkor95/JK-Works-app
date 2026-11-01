import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8090);
const maxPath = 200;

function reply(res, status, body, extra={}) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff',
    'X-Robots-Tag':'noindex, nofollow, noarchive', ...extra});
  res.end(JSON.stringify(body));
}

export function handler(req, res) {
  const path = (req.url || '').split('?')[0];
  if (path.length > maxPath || !['GET','HEAD','POST','PUT','PATCH','DELETE'].includes(req.method)) {
    return reply(res, 400, {error:'invalid_request'});
  }
  if (path === '/health' && (req.method === 'GET' || req.method === 'HEAD')) {
    return reply(res, 200, {status:'ok', service:'jkworks-staging-backend'});
  }
  if (path === '/api/v1/status' && req.method === 'GET') {
    return reply(res, 200, {
      environment:'staging',
      operational:false,
      database_connected:false,
      authentication_enabled:false,
      production_sync_enabled:false,
      message:'Backend skeleton only: business endpoints are disabled.'
    });
  }
  if (path.startsWith('/api/')) {
    // Secure default: never perform business operations without persistent
    // identity, authorization, CSRF and transaction handling.
    return reply(res, 503, {error:'service_not_configured'});
  }
  return reply(res, 404, {error:'not_found'});
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const server = createServer(handler);
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  server.listen(port, host, () => process.stdout.write('JK Works staging backend listening on loopback or configured host\n'));
}

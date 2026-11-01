import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8090);
const maxPath = 200;

function reply(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow, noarchive'
  });
  res.end(JSON.stringify(body));
}

export function databaseCheck() {
  const url = process.env.DATABASE_URL;
  if (!url) return Promise.resolve({connected:false, reason:'not_configured'});
  let parsed;
  try {
    parsed = new URL(url);
    if (!['postgres:','postgresql:'].includes(parsed.protocol) ||
        !parsed.hostname || !parsed.pathname || parsed.pathname === '/') {
      return Promise.resolve({connected:false, reason:'invalid_configuration'});
    }
  } catch {
    return Promise.resolve({connected:false, reason:'invalid_configuration'});
  }
  return new Promise(resolve => {
    const args = ['-X','-q','-t','-A','-v','ON_ERROR_STOP=1',
      '-c',"SELECT count(*) FROM information_schema.tables WHERE table_schema='jk_staging' AND table_name IN ('accounts','app_records','app_deletions','public_requests','file_objects')"];
    const child = spawn('psql',args, {
      env:{...process.env,PGCONNECT_TIMEOUT:'3',PGDATABASE:decodeURIComponent(parsed.pathname.slice(1)),
        PGHOST:parsed.hostname,PGPORT:parsed.port || '5432',
        PGUSER:decodeURIComponent(parsed.username),PGPASSWORD:decodeURIComponent(parsed.password)},
      stdio:['ignore','pipe','pipe']
    });
    let output='';
    child.stdout.on('data', chunk => { if(output.length<64) output+=chunk.toString(); });
    child.stderr.resume(); // Never log or return database errors; they can contain credentials.
    const timer=setTimeout(()=>child.kill('SIGKILL'),4500);
    child.on('error',()=>{clearTimeout(timer);resolve({connected:false,reason:'driver_unavailable'});});
    child.on('close',code=>{clearTimeout(timer);resolve(code===0 && output.trim()==='5'
      ? {connected:true,schema_ready:true}
      : {connected:false,reason:code===0?'schema_incomplete':'connection_failed'});});
  });
}

export async function handler(req, res) {
  const path = (req.url || '').split('?')[0];
  if (path.length > maxPath || !['GET','HEAD','POST','PUT','PATCH','DELETE'].includes(req.method)) {
    return reply(res,400,{error:'invalid_request'});
  }
  if (path === '/health' && ['GET','HEAD'].includes(req.method)) {
    return reply(res,200,{status:'ok',service:'jkworks-staging-backend'});
  }
  if (path === '/api/v1/status' && req.method === 'GET') {
    const db = await databaseCheck();
    return reply(res,200,{
      environment:'staging', operational:false,
      database_connected:db.connected,
      database_schema_ready:db.schema_ready === true,
      database_reason:db.reason || null,
      authentication_enabled:false,
      production_sync_enabled:false,
      message:'Database connectivity only. All business endpoints remain disabled.'
    });
  }
  if (path.startsWith('/api/')) return reply(res,503,{error:'service_not_configured'});
  return reply(res,404,{error:'not_found'});
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const server=createServer(handler);
  server.requestTimeout=5000;
  server.headersTimeout=5000;
  server.listen(port,host,()=>process.stdout.write('JK Works staging backend listening\n'));
}

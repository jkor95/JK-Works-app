import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { login, identify, logout, listRecords, upsertRecord, deleteRecord, initializeStagingAccount } from './db-api.mjs';

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


const isApiEnabled=()=>process.env.ENABLE_STAGING_API==='true';
const sameOrigin=req=>{
  const expected=process.env.STAGING_ORIGIN;
  if(!expected) return false;
  try{return new URL(req.headers.origin).origin===new URL(expected).origin;}catch{return false;}
};
function cookie(req) {
  const c=String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('jk_stage_session='));
  return c?.slice('jk_stage_session='.length) || null;
}
function readJson(req) {
  return new Promise((resolve,reject)=>{
    let buf='',bytes=0;
    req.on('data',v=>{bytes+=v.length;if(bytes>65536){reject(Error('body_too_large'));req.destroy();return;}buf+=v;});
    req.on('end',()=>{try{resolve(JSON.parse(buf||'{}'));}catch{reject(Error('invalid_json'));}});
    req.on('error',reject);
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
      authentication_enabled:isApiEnabled(),
      production_sync_enabled:false,
      message:'Database connectivity only. All business endpoints remain disabled.'
    });
  }

  if (path.startsWith('/api/v1/') && isApiEnabled()) {
    const method=req.method;
    if(!['GET','POST','PUT','DELETE'].includes(method)) return reply(res,405,{error:'not_allowed'});
    // State-changing requests must come from the explicitly configured same origin.
    if(method!=='GET' && !sameOrigin(req)) return reply(res,403,{error:'origin_rejected'});
    try {
      if(path==='/api/v1/auth/login' && method==='POST') {
        const body=await readJson(req);
        const token=await login(body.email,body.password);
        if(!token)return reply(res,401,{error:'invalid_credentials'});
        res.setHeader('Set-Cookie','jk_stage_session='+token+'; HttpOnly; Secure; SameSite=Strict; Path=/api/v1; Max-Age=43200');
        return reply(res,200,{ok:true});
      }
      const token=cookie(req);
      const id=await identify(token);
      if(!id)return reply(res,401,{error:'authentication_required'});
      if(path==='/api/v1/auth/me' && method==='GET') return reply(res,200,{id});
      if(path==='/api/v1/auth/logout' && method==='POST') {
        await logout(token);
        res.setHeader('Set-Cookie','jk_stage_session=; HttpOnly; Secure; SameSite=Strict; Path=/api/v1; Max-Age=0');
        return reply(res,200,{ok:true});
      }
      if(path==='/api/v1/records' && method==='GET')return reply(res,200,{records:await listRecords(id)});
      const m = /^\/api\/v1\/records\/([A-Za-z0-9_-]{1,64})\/([A-Za-z0-9_.-]{1,128})$/.exec(path);
      if(m && (method==='PUT'||method==='DELETE')){
        if(method==='PUT'){
          const body=await readJson(req);
          if(body===null||typeof body!=='object'||Array.isArray(body))return reply(res,400,{error:'invalid_data'});
          await upsertRecord(id,m[1],m[2],body);
        } else await deleteRecord(id,m[1],m[2]);
        return reply(res,200,{ok:true});
      }
      return reply(res,404,{error:'not_found'});
    }catch(e){
      // Never return database errors, SQL, raw credentials or request bodies.
      if(e.message==='body_too_large')return reply(res,413,{error:'body_too_large'});
      if(e.message==='invalid_json')return reply(res,400,{error:'invalid_json'});
      return reply(res,503,{error:'temporarily_unavailable'});
    }
  }
  if (path.startsWith('/api/')) return reply(res,503,{error:'service_not_configured'});
  return reply(res,404,{error:'not_found'});
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const init=await initializeStagingAccount();
  if(process.env.ENABLE_STAGING_API==='true' && !init.ready) { console.error('Staging API initialization unsuccessful:',init.reason); process.exit(1); }
  const server=createServer(handler);
  server.requestTimeout=5000;
  server.headersTimeout=5000;
  server.listen(port,host,()=>process.stdout.write('JK Works staging backend listening\n'));
}

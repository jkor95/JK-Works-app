import { createRecordRepository } from './records.mjs';

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
};
async function bodyJson(req) {
  const chunks=[]; let size=0;
  for await (const chunk of req) {
    size+=chunk.length;
    if(size>65536) { const e=new Error('Payload too large');e.status=413;throw e; }
    chunks.push(chunk);
  }
  let data;
  try {data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch {const e=new Error('Invalid JSON');e.status=400;throw e;}
  if (!data || typeof data!=='object' || Array.isArray(data)) {const e=new Error('Expected object');e.status=400;throw e;}
  return data;
}
/**
 * Authentication is injected by a trusted verifier, never from a request owner_id.
 * With no verifier the entire /v1/records API fails closed (503).
 */
export function createRecordsHandler(db, verifySession) {
  const repository=createRecordRepository(db);
  return async (req,res,url) => {
    if (typeof verifySession !== 'function') return json(res,503,{error:'authentication_not_configured'});
    let identity;
    try {identity=await verifySession(req);}catch{return json(res,401,{error:'unauthorized'});}
    if (!identity || typeof identity.ownerId!=='string') return json(res,401,{error:'unauthorized'});
    const segments=url.pathname.split('/').filter(Boolean);
    if(segments[0]!=='v1'||segments[1]!=='records'||segments.length<3||segments.length>4) return json(res,404,{error:'not_found'});
    const store=segments[2], id=segments[3];
    if(!['clients','jobs'].includes(store)) return json(res,404,{error:'not_found'});
    try {
      if(req.method==='GET'&&!id) return json(res,200,{items:await repository.list(identity.ownerId,store)});
      if(req.method==='GET'&&id) {const row=await repository.get(identity.ownerId,store,id);return json(res,row?200:404,row??{error:'not_found'});}
      if(req.method==='POST'&&!id) {
        const input=await bodyJson(req);
        if(typeof input.record_id!=='string') return json(res,400,{error:'record_id_required'});
        const row=await repository.create(identity.ownerId,store,input.record_id,input.data);
        return json(res,row?201:409,row??{error:'already_exists'});
      }
      if(req.method==='PUT'&&id) {
        const input=await bodyJson(req);
        const row=await repository.update(identity.ownerId,store,id,input.data);
        return json(res,row?200:404,row??{error:'not_found'});
      }
      if(req.method==='DELETE'&&id) return json(res,(await repository.remove(identity.ownerId,store,id))?204:404,{});
      res.setHeader('Allow',id?'GET, PUT, DELETE':'GET, POST');
      return json(res,405,{error:'method_not_allowed'});
    }catch(e) {
      if(e.status===413) return json(res,413,{error:'payload_too_large'});
      if(e instanceof TypeError||e instanceof RangeError||e.status===400) return json(res,400,{error:'invalid_input'});
      return json(res,500,{error:'internal_error'});
    }
  };
}

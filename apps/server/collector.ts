import Fastify,{type FastifyError} from 'fastify';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import type { DB } from '../../packages/db/index.js';
import { batchSchema, type Batch } from '../../packages/contracts/events.js';
import { Limiter,Problem } from './security.js';
import { ingest } from './ingestion.js';
import {instrumentHTTP} from './telemetry.js';
import {registerAcquisitionCollector} from './growth-routes.js';
export function createCollector(db:DB) {
 const app=Fastify({logger:false,bodyLimit:32768,requestTimeout:10000,trustProxy:false,ajv:{customOptions:{removeAdditional:false,coerceTypes:false,useDefaults:false,allErrors:false}}});
 instrumentHTTP(app,'collector');
 const limiter=new Limiter(),rejections=new Map<string,number>();
 app.addHook('onRequest',async(req,reply)=>{reply.header('X-Content-Type-Options','nosniff').header('Vary','Origin').header('Cache-Control','no-store');if(req.headers['content-encoding'])throw new Problem(415,'ENCODING_NOT_SUPPORTED');limiter.check(req.ip,600);});
 app.setErrorHandler<FastifyError>((err,req,reply)=>{
  const status=err instanceof Problem?err.status:err.validation?400:err.statusCode&&err.statusCode<500?err.statusCode:503;
  const code=err instanceof Problem?err.code:err.validation?'INVALID_EVENT_SCHEMA':status===503?'TEMPORARILY_UNAVAILABLE':'INVALID_REQUEST';
  rejections.set(code,(rejections.get(code)||0)+1);if(status===429||status===503)reply.header('Retry-After','5');reply.code(status).send({error:{code}});
 });
 const checkOrigin=async(origin:unknown)=>{
  if(typeof origin!=='string'||origin==='null')throw new Problem(403,'ORIGIN_NOT_ALLOWED');
  const [site]=await db.query("SELECT id FROM sites WHERE origin=$1 AND enabled=true AND approval_state='approved' AND environment='synthetic'",[origin]);if(!site)throw new Problem(403,'ORIGIN_NOT_ALLOWED');return origin;
 };
 app.get('/healthz',async()=>({status:'ok'}));
 app.get<{Params:{file:string}}>('/sdk/v1/:file',async(req,reply)=>{
  const match=/^tracker\.1\.0\.0\.([a-f0-9]{16})\.js$/.exec(req.params.file);if(!match)throw new Problem(404,'NOT_FOUND');
  const bytes=await readFile(path.resolve('dist/sdk',req.params.file)).catch(()=>{throw new Problem(404,'NOT_FOUND');});
  if(createHash('sha256').update(bytes).digest('hex').slice(0,16)!==match[1])throw new Problem(404,'NOT_FOUND');
  return reply.header('Access-Control-Allow-Origin','*').header('Cache-Control','public, max-age=31536000, immutable').type('application/javascript').send(bytes);
 });
 app.options('/v1/events',async(req,reply)=>{
  const origin=await checkOrigin(req.headers.origin);
  if(req.headers['access-control-request-method']!=='POST'||(req.headers['access-control-request-headers']||'').toString().split(',').some(x=>x.trim().toLowerCase()!=='content-type'))throw new Problem(403,'PREFLIGHT_NOT_ALLOWED');
  return reply.header('Access-Control-Allow-Origin',origin).header('Access-Control-Allow-Methods','POST').header('Access-Control-Allow-Headers','Content-Type').header('Access-Control-Max-Age','60').code(204).send();
 });
 app.get<{Params:{siteKey:string}}>('/v1/config/:siteKey',async()=>({schema_version:1,enabled:false,reason:'UPGRADE_REQUIRED'}));
 app.get<{Params:{siteKey:string}}>('/v2/config/:siteKey',async(req,reply)=>{
  const origin=await checkOrigin(req.headers.origin);const [site]=await db.query('SELECT * FROM sites WHERE site_key=$1 AND origin=$2',[req.params.siteKey,origin]);if(!site)throw new Problem(403,'ORIGIN_NOT_ALLOWED');
  const [privacy]=await db.query("SELECT value FROM settings WHERE key='privacy'");
  const pages=await db.query("SELECT page_key,selector,revision,locale,variant,state,elements,actions,campaign_codes,diagnostics_enabled,diagnostic_error_codes FROM pages WHERE site_id=$1 AND enabled=true AND approval_state='approved'",[site.id]);
  const experimental=await db.query("SELECT id,page_key,control_variant,treatment_variant,revision FROM experiments WHERE site_id=$1 AND status IN ('running','paused')",[site.id]);
  for(const page of pages)page.approved_contexts=experimental.filter(e=>e.page_key===page.page_key&&e.revision===page.revision).flatMap(e=>[e.control_variant,e.treatment_variant].map(variant=>({experiment_id:e.id,revision:e.revision,locale:page.locale,state:page.state,variant})));
  return reply.header('Access-Control-Allow-Origin',origin).header('ETag','"'+site.config_version+'"').send({schema_version:2,enabled:site.enabled&&!privacy.value.global_stop,config_version:site.config_version,expires_in:60,sample_rate:site.sample_rate,site_key:site.site_key,features:['diagnostics-v1','delivery-v1'],pages});
 });
 app.post<{Body:Batch}>('/v1/events',{schema:{body:batchSchema}},async(req,reply)=>{
  const origin=await checkOrigin(req.headers.origin);reply.header('Access-Control-Allow-Origin',origin);
  limiter.check('site:'+req.body.site_key,1200);limiter.check('view:'+req.body.view_id,90);
  await ingest(db,req.body,origin);return reply.code(204).send();
 });
 registerAcquisitionCollector(app,db);
 return {app,rejections};
}

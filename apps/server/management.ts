import Fastify, {type FastifyRequest,type FastifyError} from 'fastify';
import cookie from '@fastify/cookie';
import serveStatic from '@fastify/static';
import { Type as T } from '@sinclair/typebox';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { DB } from '../../packages/db/index.js';
import { codePattern,selectorsOverlap,type Selector } from '../../packages/domain/matcher.js';
import { Problem,Limiter,digest,token,equalToken,passwordVerify,passwordHash,audit } from './security.js';
import {reportQuerySchema,installQuerySchema,validateSelector,safeScriptJSON,decodeReferenceBase64,portfolioQuerySchema,pagePolicySchema,operationSettingsSchema} from '../../packages/security/validation.js';
import { report,type ReportFilter } from './analytics.js';
import {clientAddress} from './client-address.js';
import {validRules,type SiteRules} from '../../packages/domain/site-paths.js';
import {referenceImage,referenceImportSchema,importReference,type Manifest} from './references.js';
import { config } from './config.js';
import { createCaptureService } from './capture.js';
import {portfolio,type PortfolioFilter} from './campaigns.js';
import {createOperations,operationStatus,type OperationsSettings} from './operations.js';
import {instrumentHTTP} from './telemetry.js';
import {historyQuerySchema,historyTable,type TableQuery} from './table-data.js';
import {registerGrowthManagement} from './growth-routes.js';
import {createInstallationChecker,installationStatuses} from './installation-checks.js';
const obj=<P extends import('@sinclair/typebox').TProperties>(p:P)=>T.Object(p,{additionalProperties:false});
const code=T.String({pattern:codePattern.source});
const selectorSchema=obj({origin:T.String({maxLength:255}),path:T.String({maxLength:1024}),query_equals:T.Record(code,T.String({maxLength:64}),{maxProperties:8}),ignored_query_names:T.Array(code,{maxItems:16}),other_query_policy:T.Union([T.Literal('reject'),T.Literal('ignore')]),duplicate_query_policy:T.Literal('reject'),fragment_policy:T.Union([T.Literal('ignore_anchor'),T.Literal('reject')])});
type User={id:string;email:string;role:string;csrf:string};
export function createManagement(db:DB,rejections:Map<string,number>) {
 const app=Fastify({logger:false,bodyLimit:32768,requestTimeout:15000,trustProxy:false,ajv:{customOptions:{removeAdditional:false,coerceTypes:false,useDefaults:false}}});
 instrumentHTTP(app,'management',db);const operations=createOperations(db,config.dataDir,config.backupDir);
 app.addHook('onReady',async()=>operations.start());app.addHook('onClose',()=>operations.close());
 const limiter=new Limiter();const users=new WeakMap<FastifyRequest,User>();const dummyHash=passwordHash(token());
 const captures=createCaptureService(db,config.dataDir,config.demoOrigin);
 const checkInstallation=createInstallationChecker(db);
 app.addHook('onReady',()=>captures.recover());
 app.addHook('onClose',()=>captures.close());
 const user=(req:FastifyRequest)=>{const u=users.get(req);if(!u)throw new Problem(401,'LOGIN_REQUIRED');return u;};
 const canEdit=(u:User)=>{if(!['owner','administrator'].includes(u.role))throw new Problem(403,'INSUFFICIENT_PERMISSION');};
 const siteAccess=async(u:User,id:string,connection:DB=db)=>{
  const [site]=await connection.query('SELECT * FROM sites WHERE id=$1',[id]);if(!site)throw new Problem(404,'SITE_NOT_FOUND');
  if(u.role!=='owner'&&!(await connection.query('SELECT 1 FROM site_memberships WHERE user_id=$1 AND site_id=$2',[u.id,id])).length)throw new Problem(404,'SITE_NOT_FOUND');return site;
 };
 // This signing key protects only short-lived pre-login cookies. Opaque sessions
 // remain database-backed and survive a process restart.
 app.register(cookie,{secret:token()});
 app.addHook('onRequest',async(req,reply)=>{
  reply.header('X-Content-Type-Options','nosniff').header('Referrer-Policy','no-referrer').header('X-Frame-Options','DENY').header('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  if(config.dashboardOrigin.startsWith('https:'))reply.header('Strict-Transport-Security','max-age=31536000');
  reply.header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; frame-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  if(req.headers.host!==new URL(config.dashboardOrigin).host)throw new Problem(403,'HOST_NOT_ALLOWED');
  if(!req.url.startsWith('/')||req.url.startsWith('//'))throw new Problem(400,'REQUEST_TARGET_INVALID');
  // The router decodes static path components. Authorize the matched route,
  // including /%61pi/...; raw-prefix checks alone can skip API protections.
  const route=req.routeOptions.url??req.url.split('?')[0];
  if(!route.startsWith('/api/')&&!req.url.startsWith('/api'))return;
  reply.header('Cache-Control','no-store');limiter.check('api:'+clientAddress(req),300);
  if(!['GET','HEAD'].includes(req.method)&&req.headers.origin!==config.dashboardOrigin)throw new Problem(403,'REQUEST_ORIGIN_INVALID');
  if(route==='/api/auth/login'||route==='/api/auth/csrf')return;
  const cookieToken=req.cookies.ir_session;if(!cookieToken)throw new Problem(401,'LOGIN_REQUIRED');
  const [s]=await db.query('SELECT s.*,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=$1 AND expires_at>now() AND last_seen>now()-interval \'1 hour\'',[digest(cookieToken)]);
  if(!s)throw new Problem(401,'LOGIN_REQUIRED');users.set(req,{id:s.user_id,email:s.email,role:s.role,csrf:s.csrf});
  await db.query('UPDATE sessions SET last_seen=now() WHERE token_hash=$1',[digest(cookieToken)]);
  if(!['GET','HEAD'].includes(req.method)&&!equalToken(req.headers['x-csrf-token'],s.csrf))throw new Problem(403,'CSRF_INVALID');
 });
 app.setErrorHandler<FastifyError>((err,req,reply)=>{const status=err instanceof Problem?err.status:err.validation?400:err.statusCode&&err.statusCode<500?err.statusCode:500;return reply.code(status).send({error:{code:err instanceof Problem?err.code:err.validation?'INVALID_REQUEST':'REQUEST_FAILED'}});});
 app.get('/api/auth/csrf',async(req,reply)=>{
  const existing=req.cookies.ir_session?await db.query("SELECT csrf FROM sessions WHERE token_hash=$1 AND expires_at>now() AND last_seen>now()-interval '1 hour'",[digest(req.cookies.ir_session)]):[];
  const csrf=token();reply.setCookie('ir_login_csrf',csrf+'.'+Date.now(),{signed:true,httpOnly:true,sameSite:'strict',path:'/api/auth',maxAge:600,secure:config.dashboardOrigin.startsWith('https:')});
  if(req.cookies.ir_session&&!existing?.length)reply.clearCookie('ir_session',{path:'/'});
  return {token:existing?.[0]?.csrf||csrf,login_token:csrf};
 });
 app.post<{Body:{email:string;password:string}}>('/api/auth/login',{schema:{body:obj({email:T.String({maxLength:254}),password:T.String({minLength:1,maxLength:256})})}},async(req,reply)=>{
  limiter.check('login:'+clientAddress(req),8,600000);const signed=req.cookies.ir_login_csrf&&req.unsignCookie(req.cookies.ir_login_csrf);
  const parts=signed&&signed.valid&&signed.value?.match(/^([A-Za-z0-9_-]{43})\.(\d{13})$/),age=parts?Date.now()-Number(parts[2]):Infinity;
  if(!parts||age<0||age>600000||!equalToken(req.headers['x-csrf-token'],parts[1]))throw new Problem(403,'CSRF_INVALID');
  const [u]=await db.query('SELECT * FROM users WHERE email=$1',[req.body.email.toLowerCase().trim()]);
  const validPassword=await passwordVerify(u?.password_hash||await dummyHash,req.body.password);
  if(!u||!validPassword){await audit(db,null,'login_failed');throw new Problem(401,'INVALID_CREDENTIALS');}
  if(req.cookies.ir_session)await db.query('DELETE FROM sessions WHERE token_hash=$1',[digest(req.cookies.ir_session)]);
  const session=token(),csrf=token();await db.query("INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES($1,$2,$3,now()+interval '12 hours')",[digest(session),u.id,csrf]);
  reply.setCookie('ir_session',session,{httpOnly:true,sameSite:'strict',path:'/',maxAge:43200,secure:config.dashboardOrigin.startsWith('https:')}).clearCookie('ir_login_csrf',{path:'/api/auth'});await audit(db,u.id,'login');return {id:u.id,email:u.email,role:u.role,csrf};
 });
 app.get('/api/auth/me',async req=>user(req));
 app.get('/api/installations',async req=>{const u=user(req);const sites=await db.query(u.role==='owner'?'SELECT id FROM sites':'SELECT site_id AS id FROM site_memberships WHERE user_id=$1',u.role==='owner'?[]:[u.id]);const rows=await installationStatuses(db,sites.map(s=>s.id));if(rows.length>1000)throw new Problem(422,'INSTALLATION_LIST_BUDGET');return {rows,activity_window_hours:24,checked_at:new Date().toISOString()};});
 app.post<{Params:{site:string;page:string}}>('/api/pages/:site/:page/check-installation',{schema:{params:obj({site:T.String({minLength:1,maxLength:100}),page:code}),body:obj({})}},async req=>{const u=user(req);if(!['owner','administrator','analyst','installer'].includes(u.role))throw new Problem(403,'INSUFFICIENT_PERMISSION');const site=await siteAccess(u,req.params.site);const[page]=await db.query('SELECT * FROM pages WHERE site_id=$1 AND page_key=$2',[site.id,req.params.page]);if(!page)throw new Problem(404,'PAGE_NOT_FOUND');limiter.check('installation:'+u.id,30,600000);const result=await checkInstallation(site,page);await audit(db,u.id,'installation_checked',site.id,{page_key:page.page_key,link:result.link,pixel:result.pixel,http_status:result.http_status});return result;});
 app.post('/api/auth/logout',async(req,reply)=>{await db.query('DELETE FROM sessions WHERE token_hash=$1',[digest(req.cookies.ir_session||'')]);reply.clearCookie('ir_session',{path:'/'});return {ok:true};});
 app.get('/api/bootstrap',async req=>{
  const u=user(req);const sites=await db.query(u.role==='owner'?'SELECT * FROM sites ORDER BY environment DESC,name':'SELECT s.* FROM sites s JOIN site_memberships m ON m.site_id=s.id WHERE m.user_id=$1 ORDER BY s.name',u.role==='owner'?[]:[u.id]);
  const pages=sites.length?await db.query('SELECT * FROM pages WHERE site_id=ANY($1::text[]) ORDER BY created_at,page_key',[sites.map(s=>s.id)]):[];
  const [privacy]=await db.query("SELECT value FROM settings WHERE key='privacy'");const experiments=sites.length?await db.query('SELECT id,site_id,page_key,name,status,control_variant,treatment_variant FROM experiments WHERE site_id=ANY($1::text[]) ORDER BY created_at DESC LIMIT 200',[sites.map(s=>s.id)]):[];return {user:u,sites,pages,experiments,privacy:privacy.value,demo_url:config.releaseStatus==='PRODUCTION'?null:config.demoOrigin+'/casino/?lp=halloween',environment:config.releaseStatus==='PRODUCTION'?'PRODUCTION':'LOCAL DEMO',release_status:config.releaseStatus,timezone:'Europe/Bucharest'};
 });
 app.get<{Querystring:ReportFilter}>('/api/reports',{schema:{querystring:reportQuerySchema}},async(req)=>{
  const u=user(req);if(u.role==='installer')throw new Problem(403,'INSUFFICIENT_PERMISSION');
  await siteAccess(u,req.query.site_id);return report(db,req.query,{includePendingReferences:['owner','administrator'].includes(u.role)});
 });
 app.get<{Querystring:PortfolioFilter}>('/api/campaigns',{schema:{querystring:portfolioQuerySchema}},async req=>{const u=user(req);if(u.role==='installer')throw new Problem(403,'INSUFFICIENT_PERMISSION');const sites=await db.query(u.role==='owner'?'SELECT id FROM sites':'SELECT site_id AS id FROM site_memberships WHERE user_id=$1',u.role==='owner'?[]:[u.id]);return portfolio(db,req.query,sites.map(s=>s.id));});
 app.get<{Querystring:ReportFilter&{revision_a:string;revision_b:string}}>('/api/reports/versions',{schema:{querystring:obj({...reportQuerySchema.properties,revision_a:code,revision_b:code})}},async req=>{const u=user(req);if(u.role==='installer')throw new Problem(403,'INSUFFICIENT_PERMISSION');await siteAccess(u,req.query.site_id);const {revision_a,revision_b,...filters}=req.query;return {reports:await Promise.all([revision_a,revision_b].map(revision=>report(db,{...filters,revision,reference_id:undefined}))),definition:'Separate page revisions, independent cohorts and reference layouts; counts are observed, not causal experiment results.'};});
 app.patch<{Params:{site:string;page:string};Body:{revision?:string;campaign_codes:string[];diagnostics_enabled:boolean;diagnostic_error_codes:string[];primary_cta_id:string;primary_action_id:string}}>('/api/pages/:site/:page/policy',{schema:{body:pagePolicySchema}},async req=>{const u=user(req);canEdit(u);await siteAccess(u,req.params.site);const[page]=await db.query('SELECT * FROM pages WHERE site_id=$1 AND page_key=$2',[req.params.site,req.params.page]);if(!page)throw new Problem(404,'PAGE_NOT_FOUND');const b=req.body;if(!b.campaign_codes.includes('unknown')||!page.elements.includes(b.primary_cta_id)||!page.actions.includes(b.primary_action_id))throw new Problem(422,'POLICY_REGISTRY_INVALID');await db.transaction(async tx=>{await tx.query('SELECT id FROM sites WHERE id=$1 FOR UPDATE',[req.params.site]);if((await tx.query("SELECT 1 FROM experiments WHERE site_id=$1 AND page_key=$2 AND status IN ('running','paused') LIMIT 1",[req.params.site,req.params.page])).length)throw new Problem(409,'ACTIVE_EXPERIMENT_POLICY_LOCKED');await tx.query('UPDATE pages SET campaign_codes=$3,diagnostics_enabled=$4,diagnostic_error_codes=$5,primary_cta_id=$6,primary_action_id=$7,revision=COALESCE($8,revision) WHERE site_id=$1 AND page_key=$2',[req.params.site,req.params.page,JSON.stringify(b.campaign_codes),b.diagnostics_enabled,JSON.stringify(b.diagnostic_error_codes),b.primary_cta_id,b.primary_action_id,b.revision??null]);await tx.query('UPDATE sites SET config_version=config_version+1 WHERE id=$1',[req.params.site]);await tx.query('INSERT INTO config_history(site_id,version,sample_rate) SELECT id,config_version,sample_rate FROM sites WHERE id=$1',[req.params.site]);await audit(tx,u.id,'page_policy_updated',req.params.site,{page_key:req.params.page,...b});});return {ok:true};});
 app.get('/api/operations',async req=>{if(user(req).role!=='owner')throw new Problem(403,'OWNER_REQUIRED');return operationStatus(db);});
 app.patch<{Body:OperationsSettings}>('/api/operations/settings',{schema:{body:operationSettingsSchema}},async req=>{if(user(req).role!=='owner')throw new Problem(403,'OWNER_REQUIRED');await db.query("UPDATE settings SET value=$1 WHERE key='operations'",[JSON.stringify(req.body)]);await audit(db,user(req).id,'operations_settings_updated',null,req.body as unknown as Record<string,unknown>);return {ok:true};});
 app.post<{Params:{kind:'retention'|'backup'|'monitor'}}>('/api/operations/run/:kind',{schema:{params:obj({kind:T.Union([T.Literal('retention'),T.Literal('backup'),T.Literal('monitor')])}),body:obj({})}},async req=>{if(user(req).role!=='owner')throw new Problem(403,'OWNER_REQUIRED');limiter.check('operation:'+user(req).id,8,600000);await audit(db,user(req).id,'operation_requested',null,{kind:req.params.kind});return operations.run(req.params.kind,true);});
 app.post<{Body:{name:string;page_key:string;product:string;selector:Selector}}>('/api/landing-pages',{schema:{body:obj({name:T.String({minLength:1,maxLength:120}),page_key:code,product:code,selector:selectorSchema})}},async(req)=>{
  const u=user(req);canEdit(u);const b=req.body,s=b.selector;
  validateSelector(s);if(!b.name.trim()||/[\u0000-\u001f\u007f]/.test(b.name))throw new Problem(422,'NAME_INVALID');
  return db.transaction(async tx=>{
   let [site]=await tx.query('SELECT * FROM sites WHERE origin=$1 FOR UPDATE',[s.origin]);
   if(site)await siteAccess(u,site.id,tx);else {
    if(u.role!=='owner')throw new Problem(403,'OWNER_REQUIRED');
    if(new URL(s.origin).protocol!=='https:')throw new Problem(422,'REAL_ORIGIN_REQUIRES_HTTPS');
    const id=randomUUID();await tx.query("INSERT INTO sites(id,site_key,name,origin,domain_group,family,environment) VALUES($1,$2,$3,$4,'unassigned','campaign','real')",[id,'site_'+randomUUID().replaceAll('-',''),new URL(s.origin).hostname,s.origin]);[site]=await tx.query('SELECT * FROM sites WHERE id=$1',[id]);
   }
   const siblings=await tx.query('SELECT selector FROM pages WHERE site_id=$1',[site.id]);if(siblings.some(p=>selectorsOverlap(p.selector,s)))throw new Problem(409,'SELECTOR_OVERLAP');
   await tx.query('INSERT INTO pages(site_id,page_key,name,selector,product) VALUES($1,$2,$3,$4,$5)',[site.id,b.page_key,b.name,JSON.stringify(s),b.product]);await audit(tx,u.id,'page_draft_created',site.id,{page_key:b.page_key});return {site_id:site.id,page_key:b.page_key};
  });
 });
 // Owner approval is the release decision for a real site: it records who approved, when, and the reviewed consent policy.
 app.post<{Params:{site:string};Body:{consent_policy_version:string}}>('/api/sites/:site/approve',{schema:{params:obj({site:T.String({minLength:1,maxLength:100})}),body:obj({consent_policy_version:code})}},async req=>{
  const u=user(req);if(u.role!=='owner')throw new Problem(403,'OWNER_APPROVAL_REQUIRED');const site=await siteAccess(u,req.params.site);
  if(site.environment==='synthetic')throw new Problem(409,'SYNTHETIC_SITE');if(!site.origin.startsWith('https://'))throw new Problem(422,'HTTPS_ORIGIN_REQUIRED');
  await db.transaction(async tx=>{
   await tx.query("UPDATE sites SET approval_state='approved',enabled=true,consent_policy_version=$2,approved_by=$3,approved_at=now(),config_version=config_version+1 WHERE id=$1",[site.id,req.body.consent_policy_version,u.id]);
   await tx.query('INSERT INTO config_history(site_id,version,sample_rate) SELECT id,config_version,sample_rate FROM sites WHERE id=$1',[site.id]);
   await audit(tx,u.id,'site_approved',site.id,{consent_policy_version:req.body.consent_policy_version});
  });return {ok:true};
 });
 // Immediate per-site stop. Collected data stays; a new approval is needed to resume.
 app.post<{Params:{site:string}}>('/api/sites/:site/suspend',{schema:{params:obj({site:T.String({minLength:1,maxLength:100})}),body:obj({})}},async req=>{
  const u=user(req);canEdit(u);const site=await siteAccess(u,req.params.site);if(site.environment==='synthetic')throw new Problem(409,'SYNTHETIC_SITE');
  await db.transaction(async tx=>{
   await tx.query("UPDATE sites SET approval_state='pending',enabled=false,config_version=config_version+1 WHERE id=$1",[site.id]);
   await tx.query('INSERT INTO config_history(site_id,version,sample_rate) SELECT id,config_version,sample_rate FROM sites WHERE id=$1',[site.id]);
   await audit(tx,u.id,'site_suspended',site.id);
  });return {ok:true};
 });
 // Collection mode for a site: exact selected pages, or the whole site with include/exclude rules and path patterns.
 app.patch<{Params:{site:string};Body:{collection_mode:'selected_pages'|'whole_site';rules:SiteRules;elements:string[];actions:string[];journeys?:boolean}}>('/api/sites/:site/collection',{schema:{params:obj({site:T.String({minLength:1,maxLength:100})}),body:obj({collection_mode:T.Union([T.Literal('selected_pages'),T.Literal('whole_site')]),rules:obj({include:T.Array(T.String({maxLength:200}),{minItems:1,maxItems:50}),exclude:T.Array(T.String({maxLength:200}),{maxItems:50}),patterns:T.Array(T.String({maxLength:200}),{maxItems:50})}),elements:T.Array(code,{maxItems:200}),actions:T.Array(code,{maxItems:100}),journeys:T.Optional(T.Boolean())})}},async req=>{
  const u=user(req);canEdit(u);const site=await siteAccess(u,req.params.site);if(!validRules(req.body.rules))throw new Problem(422,'SITE_RULES_INVALID');
  await db.transaction(async tx=>{
   await tx.query('UPDATE sites SET collection_mode=$2,site_rules=$3,site_elements=$4,site_actions=$5,journeys_enabled=COALESCE($6,journeys_enabled),config_version=config_version+1 WHERE id=$1',[site.id,req.body.collection_mode,JSON.stringify(req.body.rules),JSON.stringify(req.body.elements),JSON.stringify(req.body.actions),req.body.journeys??null]);
   await tx.query('UPDATE pages SET elements=$2,actions=$3 WHERE site_id=$1 AND auto',[site.id,JSON.stringify(req.body.elements),JSON.stringify(req.body.actions)]);
   await tx.query('INSERT INTO config_history(site_id,version,sample_rate) SELECT id,config_version,sample_rate FROM sites WHERE id=$1',[site.id]);
   await audit(tx,u.id,'site_collection_changed',site.id,{collection_mode:req.body.collection_mode,journeys:req.body.journeys});
  });return {ok:true};
 });
 // One snippet for a whole-site installation.
 app.get<{Querystring:{site_id:string}}>('/api/install/site',{schema:{querystring:obj({site_id:T.String({minLength:1,maxLength:100})})}},async req=>{
  const site=await siteAccess(user(req),req.query.site_id);if(site.collection_mode!=='whole_site')throw new Problem(409,'WHOLE_SITE_MODE_REQUIRED');
  const artifact=JSON.parse(await readFile(path.resolve('dist/sdk/artifact.json'),'utf8')),loader=await readFile(path.resolve('dist/sdk/bootstrap.js'),'utf8');
  const manifest={schema_version:2,site_key:site.site_key,manifest_version:site.config_version,collection_mode:'whole_site',rules:site.site_rules,pages:[]};
  const options={siteKey:site.site_key,endpoint:config.collectorOrigin,installationManifest:manifest,artifact:{file:artifact.file,sri:artifact.sri},consentPolicyVersion:site.environment==='synthetic'?'demo-v1':site.consent_policy_version??'REPLACE_WITH_REVIEWED_POLICY_VERSION'};
  const reason=site.approval_state!=='approved'||!site.enabled?'An owner must approve this site for live collection.':site.environment!=='synthetic'&&!config.collectorOrigin.startsWith('https:')?'Live installation needs the HTTPS collector origin of a production deployment.':site.environment!=='synthetic'&&!site.consent_policy_version?'Record the reviewed consent policy version when approving the site.':null;
  return {blocked:reason!==null,reason,manifest,artifact,endpoint:config.collectorOrigin,code:`<script>
${loader}
InfraredBridge(${safeScriptJSON(options)});
</script>`,csp:`script-src ${config.collectorOrigin}; connect-src ${config.collectorOrigin}`};
 });
 app.post<{Params:{site:string;page:string}}>('/api/pages/:site/:page/toggle',async req=>{
  const u=user(req);canEdit(u);const site=await siteAccess(u,req.params.site);const [page]=await db.query('SELECT * FROM pages WHERE site_id=$1 AND page_key=$2',[site.id,req.params.page]);if(!page)throw new Problem(404,'PAGE_NOT_FOUND');
  // A real page goes live only on an approved site, and only by an owner. Anyone who can edit may pause it.
  if(!page.enabled&&site.environment!=='synthetic'&&(site.approval_state!=='approved'||u.role!=='owner'))throw new Problem(403,'LIVE_APPROVAL_REQUIRED');
  await db.transaction(async tx=>{await tx.query('SELECT id FROM sites WHERE id=$1 FOR UPDATE',[site.id]);await tx.query("UPDATE pages SET enabled=NOT enabled,approval_state=CASE WHEN NOT enabled THEN 'approved' ELSE approval_state END WHERE site_id=$1 AND page_key=$2",[site.id,page.page_key]);await tx.query('UPDATE sites SET config_version=config_version+1 WHERE id=$1',[site.id]);await tx.query('INSERT INTO config_history(site_id,version,sample_rate) SELECT id,config_version,sample_rate FROM sites WHERE id=$1',[site.id]);await audit(tx,u.id,page.enabled?'page_disabled':'page_enabled',site.id,{page_key:page.page_key});});return {ok:true};
 });
 app.get<{Querystring:{site_id:string;page_key:string}}>('/api/install',{schema:{querystring:installQuerySchema}},async req=>{
  const site=await siteAccess(user(req),req.query.site_id);const [page]=await db.query('SELECT * FROM pages WHERE site_id=$1 AND page_key=$2',[site.id,req.query.page_key]);if(!page)throw new Problem(404,'PAGE_NOT_FOUND');
  const artifact=JSON.parse(await readFile(path.resolve('dist/sdk/artifact.json'),'utf8')),loader=await readFile(path.resolve('dist/sdk/bootstrap.js'),'utf8');
  const manifest={schema_version:2,site_key:site.site_key,manifest_version:site.config_version,collection_mode:'selected_pages',pages:[{page_key:page.page_key,selector:page.selector}]};
  const options={siteKey:site.site_key,endpoint:config.collectorOrigin,installationManifest:manifest,artifact:{file:artifact.file,sri:artifact.sri},consentPolicyVersion:site.environment==='synthetic'?'demo-v1':site.consent_policy_version??'REPLACE_WITH_REVIEWED_POLICY_VERSION'};
  const reason=site.environment==='synthetic'?(!site.enabled||!page.enabled||page.approval_state!=='approved'?'This demo page is paused.':null)
   :site.approval_state!=='approved'||!site.enabled?'An owner must approve this site for live collection.'
   :!page.enabled||page.approval_state!=='approved'?'Enable this page to collect.'
   :!config.collectorOrigin.startsWith('https:')?'Live installation needs the HTTPS collector origin of a production deployment.'
   :!site.consent_policy_version?'Record the reviewed consent policy version when approving the site.':null;
  const blocked=reason!==null;
  return {blocked,reason,manifest,artifact,endpoint:config.collectorOrigin,included:page.selector,code:`<script>\n${loader}\nInfraredBridge(${safeScriptJSON(options)});\n</script>`,csp:`script-src ${config.collectorOrigin}; connect-src ${config.collectorOrigin}`};
 });
 app.get('/api/quality',async req=>{
  const u=user(req);if(u.role!=='owner')throw new Problem(403,'OWNER_REQUIRED');
  const jobs=await db.query('SELECT state,count(*)::int AS count FROM jobs GROUP BY state');const [counts]=await db.query('SELECT (SELECT count(*)::int FROM events) AS events,(SELECT count(*)::int FROM views) AS views,(SELECT count(*)::int FROM view_facts WHERE has_page_view=false) AS orphans');
  return {jobs,counts,rejections:Object.fromEntries(rejections),database:config.databaseUrl?'PostgreSQL':'PGlite · persistent local PostgreSQL',retention:'30 days default',release_status:'LOCAL_DEMO',external_capture:'disabled',live_collection:'disabled',checked_at:new Date().toISOString()};
 });
 app.get('/api/audit',async req=>{if(user(req).role!=='owner')throw new Problem(403,'OWNER_REQUIRED');return db.query('SELECT action,site_id,detail,created_at FROM audit ORDER BY created_at DESC LIMIT 100');});
 app.get<{Querystring:TableQuery}>('/api/tables/audit',{schema:{querystring:historyQuerySchema('audit')}},async req=>{if(user(req).role!=='owner')throw new Problem(403,'OWNER_REQUIRED');return historyTable(db,'audit',req.query);});
 app.get<{Querystring:TableQuery}>('/api/tables/operations',{schema:{querystring:historyQuerySchema('operations')}},async req=>{if(user(req).role!=='owner')throw new Problem(403,'OWNER_REQUIRED');return historyTable(db,'operations',req.query);});
 app.patch<{Body:{raw_days:number;reference_days:number;minimum_views:number;global_stop:boolean}}>('/api/settings/privacy',{schema:{body:obj({raw_days:T.Integer({minimum:1,maximum:90}),reference_days:T.Integer({minimum:1,maximum:365}),minimum_views:T.Integer({minimum:20,maximum:100}),global_stop:T.Boolean()})}},async req=>{
  if(user(req).role!=='owner')throw new Problem(403,'OWNER_REQUIRED');if((await db.query("SELECT 1 FROM experiments WHERE status IN ('running','paused') AND attribution_hours>$1 LIMIT 1",[req.body.raw_days*24])).length)throw new Problem(409,'RETENTION_SHORTER_THAN_ACTIVE_WINDOW');await db.query("UPDATE settings SET value=$1 WHERE key='privacy'",[JSON.stringify(req.body)]);await audit(db,user(req).id,'privacy_updated',null,req.body);return {ok:true};
 });
 app.post<{Body:{manifest:Manifest;image_base64:string}}>('/api/references/import',{bodyLimit:8000000,schema:{body:referenceImportSchema}},async req=>{
  const u=user(req);canEdit(u);await siteAccess(u,req.body.manifest.site_id);limiter.check('reference-import:'+u.id,10,600000);const id=await importReference(db,config.dataDir,req.body.manifest,decodeReferenceBase64(req.body.image_base64));await audit(db,u.id,'reference_imported',req.body.manifest.site_id,{id});return {id};
 });
 app.post<{Params:{site:string;page:string};Body:{width:number;height:number;variant?:string}}>('/api/pages/:site/:page/capture',{schema:{body:obj({width:T.Integer({minimum:240,maximum:1920}),height:T.Integer({minimum:200,maximum:1080}),variant:T.Optional(code)})}},async(req,reply)=>{
  const u=user(req);canEdit(u);await siteAccess(u,req.params.site);limiter.check('capture:'+u.id,8,600000);
  return reply.code(202).send(await captures.start(req.params.site,req.params.page,u.id,req.body.width,req.body.height,req.body.variant));
 });
 app.get<{Params:{id:string}}>('/api/captures/:id',async req=>{
  const u=user(req);canEdit(u);const job=await captures.get(req.params.id);await siteAccess(u,job.site_id);return job;
 });
 app.post<{Params:{id:string}}>('/api/references/:id/approve',async req=>{
  const u=user(req);canEdit(u);const [ref]=await db.query('SELECT * FROM page_references WHERE id=$1',[req.params.id]);if(!ref)throw new Problem(404,'REFERENCE_NOT_FOUND');await siteAccess(u,ref.site_id);
  await db.query("UPDATE page_references SET status='approved',manifest=jsonb_set(manifest,'{capture_status}','\"approved\"'::jsonb) WHERE id=$1",[ref.id]);await audit(db,u.id,'reference_approved',ref.site_id,{id:ref.id});return {ok:true};
 });
 app.get<{Params:{id:string}}>('/api/references/:id/image',async(req,reply)=>{
  const u=user(req);if(u.role==='installer')throw new Problem(403,'INSUFFICIENT_PERMISSION');
  const {buffer}=await referenceImage(db,config.dataDir,req.params.id,async(siteId,status)=>{await siteAccess(u,siteId);if(status!=='approved'&&!['owner','administrator'].includes(u.role))throw new Problem(404,'REFERENCE_NOT_FOUND');});return reply.type('image/png').header('Cache-Control','private, no-store').send(buffer);
 });
 app.get<{Querystring:ReportFilter}>('/api/export.csv',{schema:{querystring:reportQuerySchema}},async(req,reply)=>{
  const u=user(req);if(!['owner','administrator','analyst'].includes(u.role))throw new Problem(403,'EXPORT_NOT_ALLOWED');await siteAccess(u,req.query.site_id);const r=await report(db,req.query);if(r.suppressed)throw new Problem(403,'REPORT_SUPPRESSED');
  const safe=(v:unknown)=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'").replaceAll('"','""')+'"';
  const csv=[['UTC date','Tracked page views','Activated views','Page activation rate','Data source'],...r.daily!.map(d=>[d.date,d.views,d.activations,d.views?100*d.activations/d.views:0,r.data_source])].map(row=>row.map(safe).join(',')).join('\r\n');await audit(db,u.id,'aggregate_export',req.query.site_id,{page_key:req.query.page_key});return reply.type('text/csv').header('Content-Disposition','attachment; filename="heatmap-aggregate.csv"').send(csv);
 });
 registerGrowthManagement(app,db,{user,canEdit,siteAccess});
 app.register(serveStatic,{root:path.resolve('dist/dashboard'),wildcard:false});
 app.setNotFoundHandler((req,reply)=>{const pathname=req.url.split('?')[0];if(req.url.startsWith('/api')||/(?:^|\/)(?:\.|%2e)/i.test(pathname)||path.extname(pathname))return reply.code(404).send({error:{code:'NOT_FOUND'}});return reply.sendFile('index.html');});
 return app;
}

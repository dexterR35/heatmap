import {historyQuerySchema} from '../apps/server/table-data.js';
import {writeFile} from 'node:fs/promises';
import {batchSchema} from '../packages/contracts/events.js';
import {reportQuerySchema,installQuerySchema,portfolioQuerySchema,pagePolicySchema,operationSettingsSchema} from '../packages/security/validation.js';
import {acquisitionVisitSchema,acquisitionRenderSchema,acquisitionOutcomeSchema,acquisitionWithdrawSchema,registryImportSchema,experimentSchema,experimentStateSchema,spendSchema,acquisitionQuerySchema} from '../packages/contracts/acquisition.js';
const paths:Record<string,unknown>={};
const add=(path:string,method:string,summary:string,auth=true,body?:unknown)=>{
 paths[path]={...(paths[path] as object||{}),[method]:{summary,...(auth?{security:[{session:[]}]}:{}),...(body?{requestBody:{required:true,content:{'application/json':{schema:body}}}}:{}),responses:{200:{description:'Successful JSON response (route-specific)'},204:{description:'Durably accepted event batch or successful preflight'},400:{description:'Strict schema / request validation failed'},401:{description:'Authentication required'},403:{description:'Origin / scope / consent policy / role rejected'},409:{description:'Immutable context, selector or event receipt conflict'},413:{description:'Request size limit'},429:{description:'Rate / quota limit; Retry-After applies'},503:{description:'Durable ingestion unavailable; no acceptance'}}}};
};
add('/v1/events','post','Strict event ingestion; requires exact approved Origin; commits before 204',false,batchSchema);add('/v1/events','options','Explicit noncredentialed browser CORS preflight',false);
add('/v2/config/{siteKey}','get','Selector-aware public configuration for exact approved Origin',false);add('/v1/config/{siteKey}','get','Legacy clients always receive upgrade-required disabled policy',false);add('/sdk/v1/{immutableArtifact}','get','Public immutable integrity-addressed JavaScript',false);add('/healthz','get','Generic collector availability',false);
for(const [path,method,summary]of [
 ['/api/auth/csrf','get','Issue login CSRF cookie/token or read current session CSRF'],['/api/auth/login','post','CSRF-protected local Argon2id login'],['/api/auth/logout','post','Immediately revoke session'],['/api/auth/me','get','Current server-authenticated identity'],['/api/bootstrap','get','Authorized sites, selected pages and local policy'],['/api/reports','get','Single-site/page UTC-date/device/viewport aggregate report'],['/api/landing-pages','post','Save an exact-selector disabled draft'],['/api/pages/{site}/{page}/toggle','post','Pause a page or resume synthetic-only collection'],['/api/install','get','Selected-page manifest, SDK/SRI, draft/live gate and host bridge'],['/api/references/import','post','Bounded validated PNG/WebP and layout manifest import'],['/api/references/{id}/approve','post','Review/approve a scoped reference'],['/api/references/{id}/image','get','Authenticated private reference PNG'],['/api/export.csv','get','Authorized aggregate CSV export with formula-neutralized text'],['/api/settings/privacy','patch','Owner-only retention, reporting threshold and global stop'],['/api/quality','get','Owner-only process counters and durable queue health'],['/api/audit','get','Owner-only recent non-personal configuration audit']
])add(path,method,summary,!['/api/auth/login','/api/auth/csrf'].includes(path));
add('/api/pages/{site}/{page}/capture','post','Queue a fixed synthetic fixture capture; returns 202, pending explicit screenshot review');
add('/api/captures/{id}','get','Read scoped durable capture status');
add('/api/installations','get','Membership-scoped saved link/pixel inspection and live 24h recorded-event status; registry entries are not installations');
add('/api/pages/{site}/{page}/check-installation','post','Inspect an exact registered URL and bounded same-origin scripts; no JavaScript execution or consent; public HTTPS only outside the configured local demo');
add('/api/campaigns','get','Membership-scoped portfolio counts, ordered CTA funnels and investigation rules');
add('/api/reports/versions','get','Independent revision_a and revision_b reports; each keeps its own cohort and reference');
add('/api/pages/{site}/{page}/policy','patch','Owner/administrator registered campaign, primary CTA/action and diagnostic policy',true,pagePolicySchema);
add('/api/operations','get','Owner-only maintenance settings, queue, durable runs/alerts and aggregate telemetry');
for(const kind of ['audit','operations'] as const){const route='/api/tables/'+kind;add(route,'get','Owner-only paginated '+kind+' history with validated sort/search and stable snapshot');((paths[route] as any).get).parameters=Object.entries(historyQuerySchema(kind).properties).map(([name,schema])=>({name,in:'query',required:false,schema}));}
add('/api/operations/settings','patch','Owner-only maintenance schedule and alert thresholds',true,operationSettingsSchema);
add('/api/operations/run/{kind}','post','Owner-only retention, verified backup or monitor run; no concurrent backup/retention');
add('/api/registry/import','post','Transactional exact-lp registry validation/dry-run/import; real pages remain disabled',true,registryImportSchema);
add('/api/registry/export','get','Authorized page registry JSON without integration secrets');
add('/api/acquisition','get','Membership-scoped backend acquisition ledger; UTC entry dates; currencies kept separate');
((paths['/api/acquisition'] as any).get).parameters=Object.entries(acquisitionQuerySchema.properties).map(([name,schema])=>({name,in:'query',required:false,schema}));
add('/api/acquisition/spend','post','Reconcile one page/campaign/day spend total with explicit outcome-coverage confirmation',true,spendSchema);
add('/api/experiments','get','Authorized experiment portfolio without assignment salts or unit tokens');
add('/api/experiments','post','Freeze a draft binary-outcome power plan and page context',true,experimentSchema);
add('/api/experiments/{id}/state','post','Start/pause/resume or permanently close assignment; real-site starts remain disabled',true,experimentStateSchema);
add('/api/experiments/{id}/readout','get','Fixed-horizon matured intent-to-treat readout; integrity blockers, diagnostics and archived aggregates');
add('/api/experiments/{id}/freeze','post','Freeze a valid completed readout; subsequent new outcomes are rejected');
add('/api/experiments/{id}/sample','post','Generate source-separated historical examples on a running synthetic fixture only');
add('/api/sites/{site}/acquisition-keys','get','Authorized metadata for site-scoped backend keys; secrets never returned');
add('/api/sites/{site}/acquisition-keys','post','Create a revocable site-scoped backend secret; shown once');
add('/api/acquisition-keys/{id}/revoke','post','Revoke a scoped backend integration key');
for(const[route,schema,summary]of [
 ['/v1/acquisition/visits',acquisitionVisitSchema,'Register a consented acquisition visit; optionally issue a stable 50/50 experiment assignment'],
 ['/v1/acquisition/rendered',acquisitionRenderSchema,'Confirm the assigned variant actually rendered'],
 ['/v1/acquisition/outcomes',acquisitionOutcomeSchema,'Deduplicate backend-confirmed business completions within their attribution window'],
 ['/v1/acquisition/withdraw',acquisitionWithdrawSchema,'Withdraw the site-scoped unit and delete linked acquisition/raw usability evidence'],
] as const){add(route,'post',summary,false,schema);((paths[route] as any).post).security=[{acquisitionKey:[]}];}
((paths['/api/campaigns'] as any).get).parameters=Object.entries(portfolioQuerySchema.properties).map(([name,schema])=>({name,in:'query',required:false,schema}));
((paths['/api/reports/versions'] as any).get).parameters=[...Object.entries(reportQuerySchema.properties).map(([name,schema])=>({name,in:'query',required:(reportQuerySchema.required as readonly string[]).includes(name),schema})),...['revision_a','revision_b'].map(name=>({name,in:'query',required:true,schema:{type:'string',pattern:'^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,63}$'}}))];
for(const route of ['/api/reports','/api/export.csv','/api/install']){const schema=route==='/api/install'?installQuerySchema:reportQuerySchema;const operation=(paths[route] as any).get;operation.parameters=Object.entries(schema.properties).map(([name,value])=>({name,in:'query',required:(schema.required as readonly string[]|undefined)?.includes(name)??false,schema:value}));}
for(const [route,item]of Object.entries(paths))for(const operation of Object.values(item as object) as any[]){const names=[...route.matchAll(/\{([^}]+)\}/g)].map(m=>m[1]);if(names.length)operation.parameters=names.map(name=>({name,in:'path',required:true,schema:{type:'string'}}));}
await writeFile('docs/OPENAPI.json',JSON.stringify({openapi:'3.1.0',info:{title:'NetBet Heatmap Studio · local synthetic API',version:'0.4.0',description:'Reference route inventory and exact event schema. Management routes require session auth plus expected Host; mutations require expected Origin and X-CSRF-Token. Route-specific management body/query schemas remain in management.ts.'},servers:[{url:'http://127.0.0.1:3000',description:'Private management routes'},{url:'http://127.0.0.1:8080',description:'Public collector allowlist only'}],paths,components:{securitySchemes:{acquisitionKey:{type:'apiKey',in:'header',name:'X-Acquisition-Key',description:'Backend-only; browser Origin headers are rejected. Keys are site scoped and revocable.'},session:{type:'apiKey',in:'cookie',name:'nb_session'}}}},null,2));

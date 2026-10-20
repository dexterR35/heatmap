import {randomUUID} from 'node:crypto';
import type {DB} from '../../packages/db/index.js';
import type {VisitInput,OutcomeInput,SpendInput} from '../../packages/contracts/acquisition.js';
import {Problem,canonical,digest} from './security.js';
import {dateWindow} from './campaigns.js';

export function acquisitionContext(page:any,site:any){return {market:page.market??site.market??'unknown',product:page.product,brand:site.brand,locale:page.locale,page_family:page.page_family,currency:site.currency,report_timezone:site.report_timezone};}
export async function eligiblePage(db:DB,siteId:string,pageKey:string,lock=false){
 const[site]=await db.query('SELECT * FROM sites WHERE id=$1'+(lock?' FOR UPDATE':''),[siteId]);
 const[privacy]=await db.query("SELECT value FROM settings WHERE key='privacy'");
 if(!site||!site.enabled||site.approval_state!=='approved'||privacy.value.global_stop)throw new Problem(403,'COLLECTION_DISABLED');
 const[page]=await db.query('SELECT * FROM pages WHERE site_id=$1 AND page_key=$2',[siteId,pageKey]);
 if(!page||!page.enabled||page.approval_state!=='approved')throw new Problem(403,'PAGE_DISABLED');return {site,page,privacy:privacy.value};
}
export async function registerAcquisitionVisit(db:DB,siteId:string,b:VisitInput,source:'recorded'|'seeded'='recorded'){
 return db.transaction(async tx=>{
  const {site,page}=await eligiblePage(tx,siteId,b.page_key,true);
  if(!b.analytics_consent||!b.public_context||!page.campaign_codes.includes(b.campaign))throw new Problem(422,'ACQUISITION_CONTEXT_INVALID');
  const hash=digest(canonical(b)),subject=digest(siteId+'|'+b.unit_token);
  const[receipt]=await tx.query('SELECT * FROM acquisition_visits WHERE site_id=$1 AND receipt_id=$2',[siteId,b.receipt_id]);
  if(receipt){if(receipt.request_hash!==hash||receipt.data_source!==source)throw new Problem(409,'VISIT_RECEIPT_CONFLICT');return publicVisit(receipt);}
  let experiment:any=null,variant=page.variant,window=168;
  if(b.experiment_id){
   [experiment]=await tx.query('SELECT * FROM experiments WHERE id=$1 AND site_id=$2 AND page_key=$3 FOR UPDATE',[b.experiment_id,siteId,b.page_key]);
   if(!experiment)throw new Problem(404,'EXPERIMENT_NOT_FOUND');
   const[existing]=await tx.query('SELECT * FROM acquisition_visits WHERE experiment_id=$1 AND subject_hash=$2',[experiment.id,subject]);
   if(existing){if(existing.data_source!==source)throw new Problem(409,'ASSIGNMENT_SOURCE_CONFLICT');return publicVisit(existing);}
   if(experiment.status!=='running')throw new Problem(409,'EXPERIMENT_NOT_RUNNING');
   if(page.revision!==experiment.revision||canonical(acquisitionContext(page,site))!==canonical(experiment.context))throw new Problem(409,'EXPERIMENT_CONTEXT_CHANGED');
   const bucket=parseInt(digest(experiment.salt+'|'+subject).slice(0,12),16)/0x1000000000000;
   variant=bucket<.5?experiment.control_variant:experiment.treatment_variant;window=experiment.attribution_hours;
  }
  const[count]=await tx.query('SELECT count(*)::int AS n FROM acquisition_visits WHERE site_id=$1 AND created_at>=CURRENT_DATE',[siteId]);
  if(count.n>=Math.min(site.daily_quota,100000))throw new Problem(429,'ACQUISITION_SITE_QUOTA');
  const id=randomUUID();const[row]=await tx.query('INSERT INTO acquisition_visits(id,site_id,page_key,receipt_id,request_hash,subject_hash,campaign,device,context,experiment_id,variant,revision,attribution_hours,policy_version,data_source) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *',[id,siteId,page.page_key,b.receipt_id,hash,subject,b.campaign,b.device,JSON.stringify(acquisitionContext(page,site)),experiment?.id??null,variant,page.revision,window,b.policy_version,source]);
  return publicVisit(row);
 });
}
function publicVisit(v:any){return {visit_id:v.id,experiment_id:v.experiment_id,variant:v.variant,revision:v.revision,page_key:v.page_key,campaign:v.campaign,device:v.device,created_at:new Date(v.created_at).toISOString(),attribution_hours:v.attribution_hours,data_source:v.data_source};}
export async function markAcquisitionRendered(db:DB,siteId:string,b:{visit_id:string;variant:string;revision:string}){
 return db.transaction(async tx=>{const[v]=await tx.query('SELECT * FROM acquisition_visits WHERE id=$1 AND site_id=$2 FOR UPDATE',[b.visit_id,siteId]);if(!v)throw new Problem(404,'VISIT_NOT_FOUND');await eligiblePage(tx,siteId,v.page_key);
 if(v.variant!==b.variant||v.revision!==b.revision)throw new Problem(409,'RENDERED_VARIANT_MISMATCH');
 await tx.query('UPDATE acquisition_visits SET rendered_at=COALESCE(rendered_at,now()) WHERE id=$1',[v.id]);return {ok:true};});
}
export async function recordAcquisitionOutcome(db:DB,siteId:string,b:OutcomeInput){
 return db.transaction(async tx=>{const[identity]=await tx.query('SELECT page_key FROM acquisition_visits WHERE id=$1 AND site_id=$2',[b.visit_id,siteId]);if(!identity)throw new Problem(404,'VISIT_NOT_FOUND');await eligiblePage(tx,siteId,identity.page_key,true);const[v]=await tx.query('SELECT * FROM acquisition_visits WHERE id=$1 AND site_id=$2 FOR UPDATE',[b.visit_id,siteId]);if(!v)throw new Problem(404,'VISIT_NOT_FOUND');
 const hash=digest(canonical(b)),[receipt]=await tx.query('SELECT * FROM acquisition_outcomes WHERE site_id=$1 AND event_id=$2',[siteId,b.event_id]);if(receipt){if(receipt.payload_hash!==hash)throw new Problem(409,'OUTCOME_RECEIPT_CONFLICT');return {ok:true,duplicate:true};}
 if(v.experiment_id&&(await tx.query('SELECT 1 FROM experiments WHERE id=$1 AND final_readout IS NOT NULL',[v.experiment_id])).length)throw new Problem(409,'EXPERIMENT_READOUT_FROZEN');
 const time=Date.parse(b.occurred_at),start=new Date(v.created_at).getTime();if(!Number.isFinite(time)||time<start||time>start+v.attribution_hours*3600000||time>Date.now()+300000)throw new Problem(422,'OUTCOME_OUTSIDE_WINDOW');
 const result=await tx.query('INSERT INTO acquisition_outcomes(site_id,event_id,visit_id,kind,occurred_at,payload_hash) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(visit_id,kind) DO NOTHING RETURNING event_id',[siteId,b.event_id,v.id,b.kind,b.occurred_at,hash]);return {ok:true,duplicate:!result.length};});
}
export async function withdrawAcquisitionUnit(db:DB,siteId:string,visitId:string){
 return db.transaction(async tx=>{
  await tx.query('SELECT id FROM sites WHERE id=$1 FOR UPDATE',[siteId]);const[visit]=await tx.query('SELECT subject_hash FROM acquisition_visits WHERE id=$1 AND site_id=$2',[visitId,siteId]);if(!visit)return {ok:true,deleted_visits:0};
  const visits=await tx.query('SELECT id,experiment_id,data_source FROM acquisition_visits WHERE site_id=$1 AND subject_hash=$2 FOR UPDATE',[siteId,visit.subject_hash]);
  const experiments=new Map<string,number>();for(const v of visits)if(v.experiment_id&&v.data_source==='recorded')experiments.set(v.experiment_id,(experiments.get(v.experiment_id)??0)+1);
  for(const[id,count]of experiments)await tx.query('UPDATE experiments SET privacy_exclusions=privacy_exclusions+$2 WHERE id=$1',[id,count]);
  const viewIds=await tx.query("SELECT view_id FROM views WHERE site_id=$1 AND context->>'acquisition_id'=ANY($2::text[])",[siteId,visits.map(v=>v.id)]);
  for(const v of viewIds){await tx.query('SELECT id FROM jobs WHERE site_id=$1 AND view_id=$2 FOR UPDATE',[siteId,v.view_id]);for(const table of ['events','view_facts','jobs','views'])await tx.query(`DELETE FROM ${table} WHERE site_id=$1 AND view_id=$2`,[siteId,v.view_id]);}
  await tx.query('DELETE FROM acquisition_visits WHERE site_id=$1 AND subject_hash=$2',[siteId,visit.subject_hash]);
  return {ok:true,deleted_visits:visits.length};
 });
}
export async function writeSpend(db:DB,b:SpendInput){
 const date=new Date(b.day+'T00:00:00Z');if(!Number.isFinite(+date)||date.toISOString().slice(0,10)!==b.day||b.day>new Date().toISOString().slice(0,10))throw new Problem(422,'SPEND_DATE_INVALID');
 const[page]=await db.query('SELECT p.*,s.currency,s.market AS site_market,s.brand,s.report_timezone FROM pages p JOIN sites s ON s.id=p.site_id WHERE p.site_id=$1 AND p.page_key=$2',[b.site_id,b.page_key]);
 if(!page||!page.campaign_codes.includes(b.campaign))throw new Problem(422,'SPEND_SCOPE_INVALID');
 if(page.currency==='XXX'||page.currency!==b.currency)throw new Problem(422,'SPEND_CURRENCY_INVALID');
 const context=acquisitionContext(page,{...page,market:page.site_market});
 await db.query("INSERT INTO acquisition_spend(id,site_id,page_key,campaign,day,currency,amount_micros,coverage_confirmed,context,data_source) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'recorded') ON CONFLICT(site_id,page_key,campaign,day,currency,data_source) DO UPDATE SET amount_micros=EXCLUDED.amount_micros,coverage_confirmed=EXCLUDED.coverage_confirmed,context=EXCLUDED.context,updated_at=now()",[randomUUID(),b.site_id,b.page_key,b.campaign,b.day,b.currency,b.amount_micros,b.coverage_confirmed,JSON.stringify(context)]);return {ok:true};
}
export async function acquisitionReport(db:DB,f:any,siteIds:string[]){
 const dates=dateWindow({from:f.from??new Date(Date.now()-6*86400000).toISOString().slice(0,10),to:f.to??new Date().toISOString().slice(0,10)}),source=f.data_source??'recorded';if(!['recorded','seeded'].includes(source))throw new Problem(400,'INVALID_DATA_SOURCE');
 if(f.site_id&&!siteIds.includes(f.site_id))throw new Problem(404,'SITE_NOT_FOUND');
 const sites=f.site_id?[f.site_id]:siteIds;
 const visits=await db.query("SELECT v.*,p.name,s.environment,COALESCE(o.registration,false) AS registration,COALESCE(o.qualified,false) AS qualified FROM acquisition_visits v JOIN sites s ON s.id=v.site_id JOIN pages p ON p.site_id=v.site_id AND p.page_key=v.page_key LEFT JOIN LATERAL (SELECT bool_or(kind='registration_completed') AS registration,bool_or(kind='qualified_acquisition') AS qualified FROM acquisition_outcomes WHERE visit_id=v.id) o ON true WHERE v.site_id=ANY($1::text[]) AND v.created_at>=$2 AND v.created_at<$3 AND v.data_source=$4 AND ($5::text IS NULL OR v.page_key=$5) AND ($6::text IS NULL OR v.campaign=$6) ORDER BY v.created_at LIMIT 50001",[sites,dates.from,dates.to,source,f.page_key??null,f.campaign??null]);
 if(visits.length>50000)throw new Problem(422,'ACQUISITION_REPORT_BUDGET');
 const selected=visits.filter(v=>['market','product','brand'].every(k=>!f[k]||v.context[k]===f[k])&&(!f.device||f.device==='all'||v.device===f.device));
 const[privacy]=await db.query("SELECT value FROM settings WHERE key='privacy'");
 const groups=new Map<string,any>();
 for(const v of selected){const key=canonical([v.site_id,v.page_key,v.campaign,v.context]);let g=groups.get(key);if(!g){g={site_id:v.site_id,page_key:v.page_key,name:v.name,campaign:v.campaign,...v.context,context:v.context,environment:v.environment,visits:0,subjects:new Set<string>(),registrations:new Set<string>(),qualified:new Set<string>(),pending:0};groups.set(key,g);}g.visits++;g.subjects.add(v.subject_hash);if(v.registration)g.registrations.add(v.subject_hash);if(v.qualified)g.qualified.add(v.subject_hash);if(Date.now()<new Date(v.created_at).getTime()+v.attribution_hours*3600000)g.pending++;}
 const spend=await db.query('SELECT * FROM acquisition_spend WHERE site_id=ANY($1::text[]) AND day>=$2::date AND day<$3::date AND data_source=$4',[sites,dates.from,dates.to,source]);
 const expectedDays=Math.ceil((Date.parse(dates.to)-Date.parse(dates.from))/86400000);
 const rows=[...groups.values()].map(g=>{
  const {subjects,registrations,qualified,environment,context,...base}=g;if(environment!=='synthetic'&&subjects.size<privacy.value.minimum_views)return {site_id:g.site_id,page_key:g.page_key,name:g.name,suppressed:true};
  const costs=spend.filter(s=>s.site_id===g.site_id&&s.page_key===g.page_key&&s.campaign===g.campaign&&s.currency===g.currency&&canonical(s.context)===canonical(context));
  const blockers:string[]=[];if(!costs.length)blockers.push('SPEND_UNAVAILABLE');if(new Set(costs.map(s=>new Date(s.day).toISOString().slice(0,10))).size!==expectedDays)blockers.push('SPEND_DAYS_MISSING');if(costs.some(s=>!s.coverage_confirmed))blockers.push('COVERAGE_UNCONFIRMED');if(g.pending)blockers.push('ATTRIBUTION_WINDOW_OPEN');if(f.device&&f.device!=='all')blockers.push('SPEND_NOT_DEVICE_ALLOCATED');if(!qualified.size)blockers.push('NO_QUALIFIED_ACQUISITIONS');
  const amount=costs.reduce((n,s)=>n+Number(s.amount_micros),0);
  return {...base,suppressed:false,measured_units:subjects.size,registrations:registrations.size,qualified_acquisitions:qualified.size,registration_rate:subjects.size?100*registrations.size/subjects.size:0,acquisition_rate:subjects.size?100*qualified.size/subjects.size:0,spend:costs.length?amount/1e6:null,cost_per_acquisition:blockers.length?null:amount/1e6/qualified.size,cost_blockers:blockers};
 });
 const scopedSpend=spend.filter(s=>(!f.page_key||s.page_key===f.page_key)&&(!f.campaign||s.campaign===f.campaign)&&['market','product','brand'].every(k=>!f[k]||s.context[k]===f[k]));
 return {from:dates.from,to:dates.to,data_source:source,rows,spend_rows:scopedSpend.map(s=>({...s,amount_micros:Number(s.amount_micros)})),measured_visits:rows.filter(r=>!r.suppressed).reduce((n,r)=>n+(r.visits??0),0),definition:'Backend-registered consented acquisition visits, separate from sampled heatmaps. Units are deduplicated within site/page/campaign/context. Page totals must not be summed as globally unique people. Outcomes are attributed to visit-entry dates; date boundaries are UTC; currencies are never combined. Cost requires reconciled complete daily spend, confirmed outcome coverage and closed attribution windows.'};
}

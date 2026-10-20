import { randomUUID } from 'node:crypto';
import type { DB } from '../../packages/db/index.js';
import type { Batch, Event } from '../../packages/contracts/events.js';
import { digest,canonical,Problem } from './security.js';
import {acquisitionContext} from './acquisition.js';
import {allowedCanonical,pathKey,validRules} from '../../packages/domain/site-paths.js';
const AUTO_PAGE_LIMIT=500;
import {config} from '../../packages/config/index.js';

export async function ingest(db:DB,b:Batch,origin:string,source:'recorded'|'seeded'='recorded',country:string|null=null) {
 const now=Date.now(),start=new Date(b.view_started_at).getTime();
 if(!Number.isFinite(start)||start>now+300000||start<now-172800000)throw new Problem(422,'EVENT_TIME');
 const contextHash=digest(canonical({context:b.context,config:b.config_version,rate:b.sample_rate,start:b.view_started_at,consent:b.consent}));
 await db.transaction(async tx=>{
  const [site]=await tx.query('SELECT * FROM sites WHERE site_key=$1 FOR UPDATE',[b.site_key]);
  if(!site||site.origin!==origin)throw new Problem(403,'ORIGIN_NOT_ALLOWED');
  const [settings]=await tx.query("SELECT value FROM settings WHERE key='privacy'");
  if(settings.value.global_stop||!site.enabled||site.approval_state!=='approved'||(site.environment==='synthetic'&&config.releaseStatus==='PRODUCTION'))throw new Problem(403,'COLLECTION_DISABLED');
  if(b.context.page_path!==undefined&&site.collection_mode!=='whole_site')throw new Problem(422,'UNREGISTERED_CONTEXT');
  if((b.context.session_id!==undefined||b.context.session_seq!==undefined)&&(!site.journeys_enabled||b.context.session_id===undefined||b.context.session_seq===undefined))throw new Problem(422,'JOURNEYS_DISABLED');
  let [page]=await tx.query('SELECT * FROM pages WHERE site_id=$1 AND page_key=$2',[site.id,b.context.page_key]);
  if(site.collection_mode==='whole_site'){
   // Whole-site mode: the browser sends the canonical path; the server recomputes and checks it before trusting it.
   const path=b.context.page_path;
   if(!path||!validRules(site.site_rules)||pathKey(path)!==b.context.page_key||!allowedCanonical(path,site.site_rules))throw new Problem(422,'UNREGISTERED_PAGE_PATH');
   if(page&&page.path!==path)throw new Problem(409,'PAGE_KEY_CONFLICT');
   if(!page){
    const [{n}]=await tx.query('SELECT count(*)::int AS n FROM pages WHERE site_id=$1 AND auto',[site.id]);if(n>=AUTO_PAGE_LIMIT)throw new Problem(422,'PAGE_LIMIT');
    await tx.query("INSERT INTO pages(site_id,page_key,name,selector,enabled,approval_state,revision,locale,variant,state,product,elements,actions,path,auto) VALUES($1,$2,$3,$4,true,'approved','auto','auto','control','public-default','website',$5,$6,$3,true) ON CONFLICT DO NOTHING",
     [site.id,b.context.page_key,path,JSON.stringify({origin:site.origin,path,query_equals:{},ignored_query_names:[],other_query_policy:'ignore',duplicate_query_policy:'reject',fragment_policy:'ignore_anchor'}),JSON.stringify(site.site_elements),JSON.stringify(site.site_actions)]);
    [page]=await tx.query('SELECT * FROM pages WHERE site_id=$1 AND page_key=$2',[site.id,b.context.page_key]);
    if(page.path!==path)throw new Problem(409,'PAGE_KEY_CONFLICT');
   }
  }
  if(!page||!page.enabled||page.approval_state!=='approved')throw new Problem(403,'PAGE_DISABLED');
  const [epoch]=await tx.query('SELECT sample_rate FROM config_history WHERE site_id=$1 AND version=$2',[site.id,b.config_version]);
  if(!epoch||b.sample_rate!==epoch.sample_rate)throw new Problem(409,'STALE_CONFIG');
  let variantAllowed=b.context.variant===page.variant;
  if(b.context.acquisition_id){
   const[visit]=await tx.query('SELECT * FROM acquisition_visits WHERE id=$1 AND site_id=$2 AND page_key=$3',[b.context.acquisition_id,site.id,page.page_key]);
   if(!visit||visit.data_source!==source||!visit.rendered_at||visit.variant!==b.context.variant||visit.revision!==b.context.revision||visit.campaign!==b.context.campaign)throw new Problem(422,'ACQUISITION_CONTEXT_INVALID');
   if(visit.experiment_id){const[experiment]=await tx.query("SELECT id FROM experiments WHERE id=$1 AND status IN ('running','paused')",[visit.experiment_id]);variantAllowed=!!experiment;}
  }
  if(!variantAllowed||['revision','locale','state'].some(k=>b.context[k as keyof typeof b.context]!==page[k])||!(page.campaign_codes??['unknown']).includes(b.context.campaign))throw new Problem(422,'UNREGISTERED_CONTEXT');
  for(const e of b.events) {
   const at=start+e.elapsed_ms;if(at<now-86400000||at>now+300000)throw new Problem(422,'EVENT_TIME');
   if(e.viewport.document_height<e.viewport.height||e.viewport.document_width<e.viewport.width)throw new Problem(422,'GEOMETRY_INVALID');
   if(e.type==='page_view'&&e.seq!==0)throw new Problem(422,'INVALID_START_SEQUENCE');
   if(e.type==='activation'&&(!page.actions.includes(e.action_id)||(e.element_id&&!page.elements.includes(e.element_id))))throw new Problem(422,'UNREGISTERED_ACTION');
   if(e.type==='exposure'&&!page.elements.includes(e.element_id))throw new Problem(422,'UNREGISTERED_ELEMENT');
   if((e.type==='diagnostic'||e.type==='performance')&&!page.diagnostics_enabled)throw new Problem(403,'DIAGNOSTICS_DISABLED');
   if(e.type==='diagnostic'&&e.kind!=='dead_click'&&!page.diagnostic_error_codes.includes(e.code))throw new Problem(422,'UNREGISTERED_ERROR_CODE');
   if(e.type==='diagnostic'&&e.kind==='dead_click'&&e.element_id&&!page.elements.includes(e.element_id))throw new Problem(422,'UNREGISTERED_ELEMENT');
   if(e.type==='performance'&&e.metric==='layout_shift'&&e.value>1000)throw new Problem(422,'INVALID_PERFORMANCE_VALUE');
   if(e.type==='hover'&&!page.elements.includes(e.element_id))throw new Problem(422,'UNREGISTERED_ELEMENT');
   if(e.type==='movement'&&e.cells.some(c=>c.x%8!==0||c.y%8!==0||c.x>e.viewport.document_width||c.y>e.viewport.document_height))throw new Problem(422,'GEOMETRY_INVALID');
   if(e.type==='click') {
    if(e.client_x>e.viewport.width+2||e.client_y>e.viewport.height+2||e.document_x>e.viewport.document_width+2||e.document_y>e.viewport.document_height+2)throw new Problem(422,'GEOMETRY_INVALID');
    if(e.layer==='document'&&(Math.abs(e.document_x-e.client_x-e.viewport.scroll_x)>2||Math.abs(e.document_y-e.client_y-e.viewport.scroll_y)>2))throw new Problem(422,'GEOMETRY_INVALID');
    if(e.target&&!page.elements.includes(e.target.element_id))throw new Problem(422,'UNREGISTERED_ELEMENT');
   }
  }
  await tx.query('INSERT INTO views(site_id,view_id,page_key,started_at,context,context_hash,config_version,sample_rate,data_source,acquisition_context,country) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING',[site.id,b.view_id,b.context.page_key,new Date(Math.min(start,now)).toISOString(),JSON.stringify(b.context),contextHash,b.config_version,b.sample_rate,source,JSON.stringify(acquisitionContext(page,site)),country&&/^[A-Z]{2}$/.test(country)?country:null]);
  const [view]=await tx.query('SELECT context_hash,data_source FROM views WHERE site_id=$1 AND view_id=$2',[site.id,b.view_id]);
  if(view.context_hash!==contextHash)throw new Problem(409,'VIEW_CONTEXT_CONFLICT');
  if(view.data_source!=='legacy'&&view.data_source!==source)throw new Problem(409,'VIEW_SOURCE_CONFLICT');
  let added=0;
  for(const e of b.events) {
   const hash=digest(canonical({event:e,contextHash}));
   const inserted=await tx.query('INSERT INTO events(site_id,event_id,view_id,event_hash,event_type,payload) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING event_id',[site.id,e.event_id,b.view_id,hash,e.type,JSON.stringify(e)]);
   if(!inserted.length){const [old]=await tx.query('SELECT event_hash,view_id FROM events WHERE site_id=$1 AND event_id=$2',[site.id,e.event_id]);if(old.event_hash!==hash||old.view_id!==b.view_id)throw new Problem(409,'EVENT_ID_CONFLICT');}else added++;
  }
  const [count]=await tx.query('SELECT count(*)::int AS n FROM events WHERE site_id=$1 AND view_id=$2',[site.id,b.view_id]);
  if(count.n>20000)throw new Problem(429,'VIEW_QUOTA');
  if(added){
   const [q]=await tx.query('INSERT INTO ingestion_quotas(site_id,day,event_count) VALUES($1,CURRENT_DATE,$2) ON CONFLICT(site_id,day) DO UPDATE SET event_count=ingestion_quotas.event_count+EXCLUDED.event_count RETURNING event_count',[site.id,added]);
   if(q.event_count>site.daily_quota)throw new Problem(429,'SITE_QUOTA');
   await tx.query("INSERT INTO jobs(id,site_id,view_id) VALUES($1,$2,$3) ON CONFLICT(site_id,view_id) DO UPDATE SET state='pending',next_attempt_at=now(),updated_at=now(),attempts=0",[randomUUID(),site.id,b.view_id]);
  }
 });
}
export { processJobs } from "../worker/process.js";

import { randomUUID } from 'node:crypto';
import type { DB } from '../../packages/db/index.js';
import type { Batch, Event, Viewport } from '../../packages/contracts/events.js';
import { ingest } from './ingestion.js';
export const elements=['hero','hero-register','benefits','games','games-register','faq','footer'];
export const actions=['registration-start'];
export async function seedRegistry(db:DB,demoOrigin:string) {
 await db.transaction(async tx=>{
  const [existing]=await tx.query("SELECT id,origin FROM sites WHERE id='local-demo' FOR UPDATE");
  if(!existing){
   const id='local-demo';await tx.query("INSERT INTO sites(id,site_key,name,origin,domain_group,market,family,environment,enabled,approval_state,daily_quota) VALUES($1,$2,$3,$4,$5,$6,$7,'synthetic',true,'approved',1000000)",[id,'site_local_demo_2026','Campaign sandbox',demoOrigin,'local-demo','Demo','campaign']);
   for(const campaign of ['halloween','christmas'])await tx.query('INSERT INTO pages(site_id,page_key,name,selector,enabled,approval_state,revision,elements,actions,diagnostics_enabled) VALUES($1,$2,$3,$4,true,\'approved\',\'demo-v1\',$5,$6,true)',[id,'casino-'+campaign,campaign==='halloween'?'Halloween casino':'Christmas casino',JSON.stringify({origin:demoOrigin,path:'/casino/',query_equals:{lp:campaign},ignored_query_names:['utm_source','utm_medium','utm_campaign'],other_query_policy:'reject',duplicate_query_policy:'reject',fragment_policy:'ignore_anchor'}),JSON.stringify(elements),JSON.stringify(actions)]);
  }else if(existing.origin!==demoOrigin){
   // Keep the existing demo data and policies when its configured address changes.
   await tx.query("UPDATE sites SET origin=$1,config_version=config_version+1 WHERE id='local-demo'",[demoOrigin]);
   await tx.query("UPDATE pages SET selector=jsonb_set(selector,'{origin}',to_jsonb($1::text)) WHERE site_id='local-demo' AND selector->>'origin'=$2",[demoOrigin,existing.origin]);
  }
  const real=await tx.query('SELECT id FROM sites WHERE origin=$1',['https://go.netbet.ro']);
  if(!real.length){
   await tx.query("INSERT INTO sites(id,site_key,name,origin,domain_group,market,family,environment) VALUES($1,$2,'NetBet Romania','https://go.netbet.ro','netbet.ro',NULL,'go','real')",['netbet-ro-go','site_'+randomUUID().replaceAll('-','')]);
   await tx.query('INSERT INTO pages(site_id,page_key,name,selector,product) VALUES($1,$2,$3,$4,$5)',['netbet-ro-go','casino-halloween','Casino · Halloween',JSON.stringify({origin:'https://go.netbet.ro',path:'/casino/',query_equals:{lp:'halloween'},ignored_query_names:[],other_query_policy:'reject',duplicate_query_policy:'reject',fragment_policy:'ignore_anchor'}),'casino']);
  }
  await tx.query('INSERT INTO config_history(site_id,version,sample_rate) SELECT id,config_version,sample_rate FROM sites ON CONFLICT DO NOTHING');
  if(!(await tx.query("SELECT 1 FROM settings WHERE key='growth_registry_v1'")).length){
   await tx.query("UPDATE sites SET currency='GBP',report_timezone='Europe/London' WHERE id='local-demo'");
   await tx.query("UPDATE pages SET product='casino',page_family='seasonal' WHERE site_id='local-demo' AND page_key IN ('casino-halloween','casino-christmas')");
   if(!(await tx.query("SELECT 1 FROM sites WHERE origin='https://go.netbet.co.uk'")).length){
    await tx.query("INSERT INTO sites(id,site_key,name,origin,domain_group,market,family,environment,brand,currency,report_timezone) VALUES('netbet-uk-go',$1,'NetBet United Kingdom','https://go.netbet.co.uk','netbet.co.uk','UK','go','real','netbet','GBP','Europe/London')",['site_'+randomUUID().replaceAll('-','')]);
    await tx.query("INSERT INTO pages(site_id,page_key,name,selector,product,market,page_family) VALUES('netbet-uk-go','casino-nb-max-wo','UK Casino · NB Max WO',$1,'casino','UK','nb-max')",[JSON.stringify({origin:'https://go.netbet.co.uk',path:'/casino/',query_equals:{lp:'nb-max-wo'},ignored_query_names:[],other_query_policy:'reject',duplicate_query_policy:'reject',fragment_policy:'ignore_anchor'})]);
   }
   await tx.query('INSERT INTO config_history(site_id,version,sample_rate) SELECT id,config_version,sample_rate FROM sites ON CONFLICT DO NOTHING');
   await tx.query("INSERT INTO settings(key,value) VALUES('growth_registry_v1','true')");
  }
 });
}
export async function seedTraffic(db:DB,origin:string) {
 const done=await db.query("SELECT value FROM settings WHERE key='synthetic_seed_v1'");if(done.length)return {seeded:false};
 let seed=20261016;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const now=Date.now();
 for(let n=0;n<210;n++) {
  const page=n%5===0?'christmas':'halloween',width=n%4===0?390:1440,height=width===390?844:900,docHeight=width===390?2440:2100;
  const vp:Viewport={width,height,dpr:1,visual_scale:1,visual_offset_x:0,visual_offset_y:0,scroll_x:0,scroll_y:0,document_width:width,document_height:docHeight};
  const sid=randomUUID(),events:Event[]=[];let seq=0;
  const base=()=>({event_id:randomUUID(),segment_id:sid,seq:seq++,elapsed_ms:seq*500,viewport:{...vp}});
  events.push({...base(),type:'page_view'},{...base(),type:'segment_start',segment_ordinal:0,geometry_state:'stable'});
  const clicks=1+Math.floor(rand()*6);
  for(let c=0;c<clicks;c++) {
   const hero=rand()<0.6,x=width*(hero?0.19:0.25+rand()*0.5)+(rand()-0.5)*width*0.11,y=hero?415+(rand()-0.5)*90:720+rand()*1000;
   vp.scroll_y=Math.max(0,Math.min(y-height/2,docHeight-height));
   events.push({...base(),type:'click',client_x:x,client_y:y-vp.scroll_y,document_x:x,document_y:y,pointer:width===390?'touch':'mouse',layer:'document',...(hero?{target:{element_id:'hero-register',x_fraction:rand(),y_fraction:rand(),rect:{x:width*0.07,y:382,width:width*0.25,height:60}}}:{})});
  }
  if(rand()<0.78)events.push({...base(),type:'exposure',element_id:'hero-register',qualified_ms:1000+Math.floor(rand()*15000),threshold:0.5,first_qualified:true});
  if(rand()<0.34)events.push({...base(),type:'activation',action_id:'registration-start',element_id:'hero-register',method:'pointer'});
  const reach=45+rand()*55;
  events.push({...base(),type:'progress',max_reach_px:docHeight*reach/100,max_reach_percent:reach,max_scroll_percent:Math.max(0,(docHeight*reach/100-height)/(docHeight-height)*100),visible_ms:5000+Math.floor(rand()*110000),geometry_stable:true});
  const batch:Batch={schema_version:1,sdk_version:'1.0.0',site_key:'site_local_demo_2026',batch_id:randomUUID(),config_version:1,view_id:randomUUID(),view_started_at:new Date(now-Math.floor(rand()*20*3600000)).toISOString(),sample_rate:1,consent:{analytics:true,policy_version:'demo-v1'},context:{page_key:'casino-'+page,revision:'demo-v1',locale:'en-GB',variant:'control',state:'public-default',campaign:'unknown'},events};
  await ingest(db,batch,origin,'seeded');
 }
 await db.query("INSERT INTO settings(key,value) VALUES('synthetic_seed_v1','true') ON CONFLICT DO NOTHING");return {seeded:true};
}

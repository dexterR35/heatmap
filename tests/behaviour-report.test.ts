import {beforeAll,afterAll,it,expect,describe} from 'vitest';
import {randomUUID} from 'node:crypto';
import {batch,demoOrigin,testDB} from './fixtures.js';
import type {DB} from '../packages/db/index.js';
import type {Event} from '../packages/contracts/events.js';
import {ingest,processJobs} from '../apps/server/ingestion.js';
import {report} from '../apps/server/analytics.js';
import {breakdown,formFunnels,hoverStats,journeySummary,type BehaviourView} from '../packages/domain/behaviour-report.js';
import type {SegmentFact} from '../packages/domain/metrics.js';

const segment=(over:Partial<SegmentFact>={}):SegmentFact=>({width:1440,height:900,document_height:2100,reach:50,visible_ms:1000,clicks:0,actions:[],exposures:[],activated_elements:[],element_clicks:{},...over});
const view=(over:Partial<BehaviourView>={}):BehaviourView=>({view_id:randomUUID(),country:null,context:{},segments:[segment()],activated:false,...over});

describe('behaviour aggregation',()=>{
 it('merges buckets below the privacy minimum into "other"',()=>{
  const views=[...Array(6)].map(()=>view({country:'RO',activated:true})).concat([view({country:'GB'}),view({country:'GB'}),view()]);
  const r=breakdown(views,v=>v.country,5);
  expect(r.rows).toEqual([{key:'RO',views:6,activated:6,activation_rate:100}]);
  expect(r.other).toMatchObject({views:2});expect(r.suppressed_buckets).toBe(1);expect(r.unknown).toBe(1);
  expect(breakdown(views,v=>v.country,0).rows.map(b=>b.key)).toEqual(['RO','GB']);
 });
 it('finds the field where visitors give up',()=>{
  const form=(fields:Record<string,number>,submitted:boolean,last:string)=>view({behaviour:{hover:{},forms:{signup:{started:true,submitted,last_field:last,duration_ms:submitted?9000:undefined,fields:Object.fromEntries(Object.entries(fields).map(([k,n])=>[k,{completions:n,filled:n,errors:k==='password'?1:0,ms:n*1000}]))}}}});
  const [f]=formFunnels([form({email:1,password:1},true,'password'),form({email:1,password:1},false,'password'),form({email:1},false,'email')]);
  expect(f).toMatchObject({form_id:'signup',started:3,submitted:1,median_duration_ms:9000});
  expect(f.fields.find(x=>x.field_id==='password')).toMatchObject({reached:2,errors:2,drop_offs:1});
  expect(f.fields.find(x=>x.field_id==='email')).toMatchObject({reached:3,drop_offs:1});
 });
 it('measures hesitation on hovered CTAs that were never clicked',()=>{
  const hovered={hover:{cta:{count:1,ms:800}},forms:{}};
  const stats=hoverStats([view({behaviour:hovered}),view({behaviour:hovered,segments:[segment({element_clicks:{cta:1}})]}),view()],['cta','other']);
  expect(stats).toEqual([{element_id:'cta',hovered_views:2,hover_rate:200/3,avg_hover_ms:800,hovered_without_click:1,hesitation_rate:50}]);
 });
 it('summarises journeys around a page',()=>{
  const s1=randomUUID(),s2=randomUUID();
  const views=[view({context:{session_id:s1,session_seq:1}}),view({context:{session_id:s2,session_seq:2}})];
  const sessions=[{session_id:s1,session_seq:1,page_key:'p.home'},{session_id:s1,session_seq:2,page_key:'p.pricing'},{session_id:s2,session_seq:1,page_key:'p.blog'},{session_id:s2,session_seq:2,page_key:'p.home'}];
  expect(journeySummary(views,sessions,0)).toEqual({views:2,entry_rate:50,exit_rate:50,previous:{rows:[{page_key:'p.blog',views:1}],suppressed:0},next:{rows:[{page_key:'p.pricing',views:1}],suppressed:0}});
  expect(journeySummary([view()],[],0)).toBeNull();
 });
});

describe('page report',()=>{
 let db:DB;
 beforeAll(async()=>{db=await testDB();});
 afterAll(async()=>{await db.close();});
 const visit=async(source:object,client:object,extra:object[]=[])=>{
  const b=batch(),{segment_id,viewport}=b.events[0];let seq=0;
  const e=(x:object)=>({event_id:randomUUID(),seq:seq++,elapsed_ms:100+seq,segment_id,viewport,...x}) as Event;
  b.events=[e({type:'page_view',source,client}),...extra.map(e)];await ingest(db,b,demoOrigin);
 };
 it('reports audience, attention, movement, forms, hover, exits and engagement, and filters by segment',async()=>{
  await visit({channel:'paid',engine:'google',click_id:'google'},{browser:'chrome',os:'android',device:'mobile'},[
   {type:'attention',bands:Array(20).fill(400)},{type:'movement',cells:[{x:200,y:400,n:5}]},
   {type:'form',form_id:'signup',action:'start'},{type:'form',form_id:'signup',field_id:'email',action:'field_complete',duration_ms:2000,filled:true},
   {type:'hover',element_id:'hero-register',hover_ms:900},{type:'exit',kind:'hidden',reach_percent:55},{type:'engagement',active_ms:12000,idle_ms:1000,first_interaction_ms:800}]);
  await visit({channel:'search',engine:'bing'},{browser:'safari',os:'ios',device:'mobile'});
  while(await processJobs(db,100)){}
  const r=await report(db,{site_id:'local-demo',page_key:'casino-halloween'});if(r.suppressed)throw new Error('unexpected suppression');
  const b=r.behaviour;
  expect(b.audience.channel.rows.map(x=>x.key).sort()).toEqual(['paid','search']);expect(b.audience.browser.rows.map(x=>x.key).sort()).toEqual(['chrome','safari']);
  expect(b.attention).toEqual({bands:Array(20).fill(400),segments:1});
  expect(b.movement_quality).toEqual({mapped:0,incompatible:5});   // no approved reference yet, so nothing is projected
  expect(b.forms[0]).toMatchObject({form_id:'signup',started:1,submitted:0});
  expect(b.hover[0]).toMatchObject({element_id:'hero-register',hovered_views:1,hovered_without_click:1});
  expect(b.exits).toMatchObject({hidden:1,unknown:1});expect(b.engagement).toMatchObject({measured_views:1,engaged_rate:100});
  const paid=await report(db,{site_id:'local-demo',page_key:'casino-halloween',channel:'paid'});if(paid.suppressed)throw new Error('unexpected suppression');
  expect(paid.summary.views).toBe(1);expect(paid.behaviour.audience.channel.rows.map(x=>x.key)).toEqual(['paid']);
  const ios=await report(db,{site_id:'local-demo',page_key:'casino-halloween',os:'ios'});if(ios.suppressed)throw new Error('unexpected suppression');
  expect(ios.summary.views).toBe(1);
 });
});

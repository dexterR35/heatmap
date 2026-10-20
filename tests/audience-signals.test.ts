import {beforeAll,afterAll,it,expect,describe} from 'vitest';
import {randomUUID} from 'node:crypto';
import {batch,demoOrigin,testDB} from './fixtures.js';
import type {DB} from '../packages/db/index.js';
import type {Event} from '../packages/contracts/events.js';
import {createCollector,edgeCountry} from '../apps/server/collector.js';
import {config} from '../packages/config/index.js';
import {clientInfo,trafficSource} from '../packages/domain/audience.js';
import {viewFacts} from '../packages/domain/metrics.js';
let db:DB,collector:ReturnType<typeof createCollector>;
beforeAll(async()=>{db=await testDB();collector=createCollector(db);await collector.app.ready();});
afterAll(async()=>{await collector.app.close();await db.close();});

describe('traffic source',()=>{
 const host='landing.example.com';
 it('classifies direct, search, social, internal and referral visits',()=>{
  expect(trafficSource('','',host)).toEqual({channel:'direct'});
  expect(trafficSource('','https://www.google.ro/',host)).toEqual({channel:'search',engine:'google'});
  expect(trafficSource('','https://l.facebook.com/l.php?u=x',host)).toEqual({channel:'social',engine:'facebook'});
  expect(trafficSource('','https://landing.example.com/other/',host)).toEqual({channel:'internal'});
  expect(trafficSource('','https://some-blog.example.org/post',host)).toEqual({channel:'referral',engine:'other'});
 });
 it('marks ad clicks as paid without sending the click ID value',()=>{
  const s=trafficSource('?gclid=SECRET-CLICK-ID&utm_source=Google&utm_medium=cpc&utm_campaign=Summer_2026','',host);
  expect(s).toEqual({channel:'paid',engine:'google',click_id:'google',utm_source:'google',utm_medium:'cpc',utm_campaign:'summer_2026'});
  expect(JSON.stringify(s)).not.toContain('SECRET');
 });
 it('drops UTM values that are not plain slugs, such as e-mail addresses',()=>{
  const s=trafficSource('?utm_source=newsletter&utm_medium=email&utm_campaign=jane.doe@example.com','',host);
  expect(s).toEqual({channel:'email',utm_source:'newsletter',utm_medium:'email'});
 });
});

describe('client info',()=>{
 const cases:[string,number,boolean|undefined,object][]=[
  ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',5,undefined,{browser:'safari',os:'ios',device:'mobile'}],
  ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',5,true,{browser:'chrome',os:'android',device:'mobile'}],
  ['Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Safari/537.36',5,false,{browser:'samsung',os:'android',device:'tablet'}],
  ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',0,false,{browser:'edge',os:'windows',device:'desktop'}],
  ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:131.0) Gecko/20100101 Firefox/131.0',0,undefined,{browser:'firefox',os:'macos',device:'desktop'}],
  ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',5,undefined,{browser:'safari',os:'ios',device:'tablet'}],
 ];
 it('reduces the user agent to browser, OS and device families',()=>{for(const [ua,touch,mobile,expected] of cases)expect(clientInfo(ua,touch,mobile,'ro-RO')).toEqual({...expected,language:'ro'});});
});

describe('behaviour events',()=>{
 const post=(events:Event[],extra:Partial<ReturnType<typeof batch>>={})=>{const b={...batch(),...extra};b.events=events.map((e,i)=>({...e,seq:i}));return collector.app.inject({method:'POST',url:'/v1/events',headers:{origin:demoOrigin},payload:b});};
 const base=()=>{const {event_id,segment_id,viewport}=batch().events[0];return {event_id:randomUUID(),segment_id,viewport,elapsed_ms:200,seq:0};};
 it('accepts every new signal through the real collector schema',async()=>{
  const b=base(),seg={segment_id:b.segment_id,viewport:b.viewport};
  const events=[
   {...b,type:'page_view',source:{channel:'paid',engine:'google',click_id:'google',utm_source:'google'},client:{browser:'chrome',os:'android',device:'mobile',language:'ro'}},
   {...seg,event_id:randomUUID(),seq:0,elapsed_ms:300,type:'attention',bands:Array.from({length:20},(_,i)=>i*100)},
   {...seg,event_id:randomUUID(),seq:0,elapsed_ms:300,type:'movement',cells:[{x:200,y:400,n:3},{x:208,y:408,n:1}]},
   {...seg,event_id:randomUUID(),seq:0,elapsed_ms:300,type:'form',form_id:'register',field_id:'email',action:'field_complete',duration_ms:4200,filled:true},
   {...seg,event_id:randomUUID(),seq:0,elapsed_ms:300,type:'hover',element_id:'hero-register',hover_ms:900},
   {...seg,event_id:randomUUID(),seq:0,elapsed_ms:300,type:'exit',kind:'exit_intent',reach_percent:42},
   {...seg,event_id:randomUUID(),seq:0,elapsed_ms:300,type:'engagement',active_ms:12000,idle_ms:3000,first_interaction_ms:1500},
  ] as Event[];
  const r=await post(events);expect(r.statusCode).toBe(204);
 });
 it('rejects off-grid movement, unregistered hover targets and free-text form values',async()=>{
  const b=base();
  expect((await post([{...b,type:'page_view'},{...b,event_id:randomUUID(),type:'movement',cells:[{x:203,y:400,n:1}]}] as Event[])).statusCode).toBe(422);
  expect((await post([{...b,type:'page_view'},{...b,event_id:randomUUID(),type:'hover',element_id:'not-registered',hover_ms:900}] as Event[])).statusCode).toBe(422);
  expect((await post([{...b,type:'page_view'},{...b,event_id:randomUUID(),type:'form',form_id:'register',field_id:'email',action:'field_complete',value:'jane@example.com'}] as unknown as Event[])).statusCode).toBe(400);
  expect((await post([{...b,type:'page_view',client:{browser:'chrome',os:'android',device:'mobile',user_agent:'raw'}}] as unknown as Event[])).statusCode).toBe(400);
 });
 it('stores a country only from a declared trusted edge',async()=>{
  const previous=config.trustedEdge;
  try{
   const req=(country:string)=>({headers:{'cf-ipcountry':country},socket:{remoteAddress:'127.0.0.1'}}) as any;
   (config as any).trustedEdge='';expect(edgeCountry(req('RO'))).toBeNull();
   (config as any).trustedEdge='cloudflare';expect(edgeCountry(req('RO'))).toBe('RO');expect(edgeCountry(req('XX'))).toBeNull();expect(edgeCountry(req('ro'))).toBeNull();
   const b=batch();const r=await collector.app.inject({method:'POST',url:'/v1/events',headers:{origin:demoOrigin,'cf-ipcountry':'GB'},payload:b});expect(r.statusCode).toBe(204);
   const [view]=await db.query('SELECT country FROM views WHERE view_id=$1',[b.view_id]);expect(view.country).toBe('GB');
  }finally{(config as any).trustedEdge=previous;}
 });
});

it('summarises behaviour per visit',()=>{
 const b=batch().events[0],seg={segment_id:b.segment_id,viewport:b.viewport,elapsed_ms:100};let seq=0;
 const e=(x:object)=>({...seg,event_id:randomUUID(),seq:seq++,...x}) as Event;
 const facts=viewFacts([
  e({type:'page_view',source:{channel:'search',engine:'google'},client:{browser:'safari',os:'ios',device:'mobile'}}),
  e({type:'attention',bands:Array(20).fill(100)}),e({type:'attention',bands:Array(20).fill(250)}),
  e({type:'hover',element_id:'hero-register',hover_ms:500}),e({type:'hover',element_id:'hero-register',hover_ms:700}),
  e({type:'form',form_id:'register',action:'start'}),
  e({type:'form',form_id:'register',field_id:'email',action:'field_complete',duration_ms:3000,filled:true}),
  e({type:'form',form_id:'register',field_id:'password',action:'field_error'}),
  e({type:'exit',kind:'hidden',reach_percent:64}),
  e({type:'engagement',active_ms:8000,idle_ms:2000,first_interaction_ms:900}),
 ]);
 const {behaviour}=facts,segment=facts.segments[b.segment_id];
 expect(behaviour.source).toEqual({channel:'search',engine:'google'});expect(behaviour.client?.os).toBe('ios');
 expect(segment.attention).toEqual(Array(20).fill(250));
 expect(behaviour.hover['hero-register']).toEqual({count:2,ms:1200});
 expect(behaviour.forms.register).toMatchObject({started:true,submitted:false,last_field:'password',fields:{email:{completions:1,filled:1,errors:0,ms:3000},password:{completions:0,filled:0,errors:1,ms:0}}});
 expect(behaviour.exit).toEqual({kind:'hidden',reach_percent:64});expect(behaviour.engagement).toEqual({active_ms:8000,idle_ms:2000,first_interaction_ms:900});
});

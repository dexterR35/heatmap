import {beforeAll,afterAll,it,expect,describe} from 'vitest';
import {batch,demoOrigin,testDB} from './fixtures.js';
import type {DB} from '../packages/db/index.js';
import {openDB,migrate} from '../packages/db/index.js';
import {seedRegistry} from '../apps/server/seed.js';
import {createCollector} from '../apps/server/collector.js';
import {Limiter} from '../packages/security/index.js';
import {loopbackOrigin} from '../packages/config/origins.js';
import {anySignal,validConsent,validHostContext,validPublicConfig} from '../packages/domain/host-input.js';
let db:DB,collector:ReturnType<typeof createCollector>;
beforeAll(async()=>{db=await testDB();collector=createCollector(db);await collector.app.ready();});
afterAll(async()=>{await collector.app.close();await db.close();});

describe('synthetic demo origin',()=>{
 it('refuses a public demo origin in configuration',()=>{
  expect(()=>loopbackOrigin('https://landing.example.com','DEMO')).toThrow('DEMO_MUST_BE_LOOPBACK');
  expect(loopbackOrigin('http://127.0.0.1:4174','DEMO')).toBe('http://127.0.0.1:4174');
 });
 it('never re-points the approved demo site at a public host',async()=>{
  const fresh=await openDB(undefined,'memory://');await migrate(fresh);
  try{
   await seedRegistry(fresh,demoOrigin);
   await expect(seedRegistry(fresh,'https://landing.example.com')).rejects.toThrow('DEMO_MUST_BE_LOOPBACK');
   const [site]=await fresh.query("SELECT origin FROM sites WHERE id='local-demo'");expect(site.origin).toBe(demoOrigin);
  }finally{await fresh.close();}
 });
});

describe('rate limiter',()=>{
 it('keeps admitting new callers when its table is full',()=>{
  const limiter=new Limiter(100);
  for(let i=0;i<5000;i++)limiter.check('flood:'+i,600);
  expect(()=>limiter.check('legitimate-visitor',600)).not.toThrow();
 });
 it('still limits a caller that stays in the table',()=>{
  const limiter=new Limiter(100);
  for(let i=0;i<3;i++)limiter.check('busy',3);
  expect(()=>limiter.check('busy',3)).toThrow('RATE_LIMIT');
 });
});

describe('collector',()=>{
 it('lets approved pages read rejections so the SDK stops retrying',async()=>{
  expect((await collector.app.inject({url:'/v2/config/site_local_demo_2026',headers:{origin:demoOrigin}})).statusCode).toBe(200);
  const invalid=await collector.app.inject({method:'POST',url:'/v1/events',headers:{origin:demoOrigin},payload:{...batch(),url:'https://example.invalid'}});
  expect(invalid.statusCode).toBe(400);expect(invalid.headers['access-control-allow-origin']).toBe(demoOrigin);
 });
 it('does not expose rejections to unapproved origins',async()=>{
  const r=await collector.app.inject({method:'POST',url:'/v1/events',headers:{origin:'https://attacker.invalid'},payload:batch()});
  expect(r.statusCode).toBe(403);expect(r.headers['access-control-allow-origin']).toBeUndefined();
 });
});

describe('host page input',()=>{
 const context={eligible:true,pageKey:'casino-halloween',revision:'demo-v1',locale:'en-GB',variant:'control',state:'public-default'};
 it('accepts only well-formed consent and context',()=>{
  expect(validConsent('granted')).toBe(true);
  for(const bad of [undefined,null,'yes',true])expect(validConsent(bad)).toBe(false);
  expect(validHostContext(context)).toBe(true);expect(validHostContext({...context,campaign:'halloween'})).toBe(true);
  for(const bad of [undefined,null,[],{...context,eligible:'true'},{...context,pageKey:''},{...context,locale:'x'.repeat(129)},{...context,campaign:7}])expect(validHostContext(bad)).toBe(false);
 });
 it('rejects malformed collector configuration',()=>{
  const page={page_key:'casino-halloween',selector:{origin:demoOrigin,path:'/casino/'},revision:'demo-v1',locale:'en-GB',variant:'control',state:'public-default',elements:['hero'],actions:['registration-start'],campaign_codes:['unknown']};
  const config={schema_version:2,enabled:true,config_version:1,sample_rate:1,expires_in:60,pages:[page],features:['delivery-v1']};
  expect(validPublicConfig(config)).toBe(true);
  for(const bad of [null,{...config,schema_version:1},{...config,sample_rate:2},{...config,pages:[{...page,elements:null}]},{...config,pages:[{...page,actions:[{}]}]},{...config,pages:Array(33).fill(page)}])expect(validPublicConfig(bad)).toBe(false);
 });
 it('combines abort signals without AbortSignal.any',()=>{
  const native=AbortSignal.any;(AbortSignal as any).any=undefined;
  try{
   const a=new AbortController(),b=new AbortController(),combined=anySignal([a.signal,b.signal]);
   expect(combined.aborted).toBe(false);b.abort();expect(combined.aborted).toBe(true);
  }finally{(AbortSignal as any).any=native;}
 });
});

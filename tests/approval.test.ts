import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {batch,demoOrigin,realOrigin,testDB} from './fixtures.js';
import type {DB} from '../packages/db/index.js';
import {createManagement} from '../apps/server/management.js';
import {createCollector} from '../apps/server/collector.js';
import {ingest} from '../apps/server/ingestion.js';
import {digest} from '../packages/security/index.js';
import {config} from '../packages/config/index.js';
let db:DB,app:ReturnType<typeof createManagement>,collector:ReturnType<typeof createCollector>,siteKey:string;
const host={host:'127.0.0.1:3000'},origin='http://127.0.0.1:3000',tokens={owner:randomUUID(),administrator:randomUUID()};
const as=(role:keyof typeof tokens)=>({...host,cookie:'ir_session='+tokens[role],origin,'x-csrf-token':'synthetic-csrf'});
const realBatch=()=>{const b=batch();return {...b,site_key:siteKey,config_version:0,context:{...b.context,revision:'UNKNOWN'}};};
beforeAll(async()=>{
 db=await testDB();
 for(const role of ['owner','administrator'] as const){
  await db.query('INSERT INTO users(id,email,password_hash,role) VALUES($1,$2,$3,$4)',[role,role+'@approval.invalid','not-a-login-hash',role]);
  await db.query("INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES($1,$2,'synthetic-csrf',now()+interval '1 hour')",[digest(tokens[role]),role]);
 }
 await db.query("INSERT INTO site_memberships(user_id,site_id) VALUES('administrator','example-real')");
 [{site_key:siteKey}]=await db.query("SELECT site_key FROM sites WHERE id='example-real'");
 app=createManagement(db,new Map());collector=createCollector(db);await app.ready();await collector.app.ready();
});
afterAll(async()=>{await app.close();await collector.app.close();await db.close();});
const send=async(b:ReturnType<typeof realBatch>)=>{const [site]=await db.query("SELECT config_version FROM sites WHERE id='example-real'");return collector.app.inject({method:'POST',url:'/v1/events',headers:{origin:realOrigin},payload:{...b,config_version:site.config_version}});};

it('keeps a real site closed until an owner approves it and enables a page',async()=>{
 expect((await send(realBatch())).statusCode).toBe(403);
 expect((await app.inject({method:'POST',url:'/api/sites/example-real/approve',headers:as('administrator'),payload:{consent_policy_version:'cmp-2026-10'}})).statusCode).toBe(403);
 expect((await app.inject({method:'POST',url:'/api/sites/example-real/approve',headers:as('owner'),payload:{consent_policy_version:'cmp 2026'}})).statusCode).toBe(400);
 expect((await app.inject({method:'POST',url:'/api/sites/example-real/approve',headers:as('owner'),payload:{consent_policy_version:'cmp-2026-10'}})).statusCode).toBe(200);
 const [site]=await db.query("SELECT approval_state,enabled,consent_policy_version,approved_by FROM sites WHERE id='example-real'");
 expect(site).toMatchObject({approval_state:'approved',enabled:true,consent_policy_version:'cmp-2026-10',approved_by:'owner'});
 expect((await db.query("SELECT 1 FROM audit WHERE action='site_approved' AND site_id='example-real'")).length).toBe(1);
 // Approval alone does not collect: the page itself must be enabled, and only an owner may enable it.
 expect((await send(realBatch())).statusCode).toBe(403);
 expect((await app.inject({method:'POST',url:'/api/pages/example-real/casino-halloween/toggle',headers:as('administrator'),payload:{}})).statusCode).toBe(403);
 expect((await app.inject({method:'POST',url:'/api/pages/example-real/casino-halloween/toggle',headers:as('owner'),payload:{}})).statusCode).toBe(200);
 expect((await send(realBatch())).statusCode).toBe(204);
});

it('explains why a live snippet is still blocked without an HTTPS collector',async()=>{
 const r=(await app.inject({url:'/api/install?site_id=example-real&page_key=casino-halloween',headers:as('owner')})).json();
 expect(r.blocked).toBe(true);expect(r.reason).toContain('HTTPS collector');expect(r.code).toContain('cmp-2026-10');
});

it('stops collection immediately when a site is suspended',async()=>{
 expect((await app.inject({method:'POST',url:'/api/sites/example-real/suspend',headers:as('administrator'),payload:{}})).statusCode).toBe(200);
 expect((await send(realBatch())).statusCode).toBe(403);
 expect((await db.query("SELECT 1 FROM audit WHERE action='site_suspended'")).length).toBe(1);
});

it('refuses the synthetic demo site in production, where its loopback origin could be forged',async()=>{
 const previous=config.releaseStatus;
 try{
  (config as any).releaseStatus='PRODUCTION';
  expect((await collector.app.inject({method:'POST',url:'/v1/events',headers:{origin:demoOrigin},payload:batch()})).statusCode).toBe(403);
  await expect(ingest(db,batch(),demoOrigin)).rejects.toMatchObject({code:'COLLECTION_DISABLED'});
 }finally{(config as any).releaseStatus=previous;}
 expect((await collector.app.inject({method:'POST',url:'/v1/events',headers:{origin:demoOrigin},payload:batch()})).statusCode).toBe(204);
});

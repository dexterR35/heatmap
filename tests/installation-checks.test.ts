import {it,expect,beforeAll,afterAll} from 'vitest';
import {randomUUID} from 'node:crypto';
import {testDB,batch,demoOrigin} from './fixtures.js';
import {publicAddress,readDocument,probeInstallation,createInstallationChecker,installationStatuses} from '../apps/server/installation-checks.js';
import {createManagement} from '../apps/server/management.js';
import {digest} from '../apps/server/security.js';
import {ingest} from '../apps/server/ingestion.js';
import type {DB} from '../packages/db/index.js';
const selector={origin:'https://campaign.example.invalid',path:'/casino/',query_equals:{lp:'summer'},ignored_query_names:[],other_query_policy:'reject' as const,duplicate_query_policy:'reject' as const,fragment_policy:'ignore_anchor' as const};
const site={site_key:'site_fixture_2026',environment:'real',origin:selector.origin};
const doc=(body='',status=200,type='text/html',location?:string)=>({body,status,type,location,truncated:false,response_ms:100,document_ms:120});
it('blocks private, loopback, metadata, reserved and transition addresses including URL-normalized forms',async()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','100.64.0.1','172.16.0.1','192.168.0.1','0.0.0.0','224.0.0.1','::1','::ffff:127.0.0.1','fc00::1','fe80::1','2001:db8::1','2001::1','2002:7f00:1::1','64:ff9b::7f00:1'])expect(publicAddress(ip),ip).toBe(false);
 for(const ip of ['1.1.1.1','8.8.8.8','104.18.102.99','2606:4700::1111','2001:4860:4860::8888'])expect(publicAddress(ip),ip).toBe(true);
 for(const url of ['https://127.0.0.1/','https://2130706433/','https://[::1]/','https://user:pass@1.1.1.1/','http://1.1.1.1/','https://1.1.1.1:3000/'])await expect(readDocument(new URL(url),AbortSignal.timeout(500),false)).rejects.toThrow('UNSAFE_TARGET');
 await expect(readDocument(new URL(demoOrigin),AbortSignal.timeout(500),false)).rejects.toThrow('UNSAFE_TARGET');
});
it('finds the bridge and matching public settings in a bounded same-origin script without executing it',async()=>{
 const calls:string[]=[];const r=await probeInstallation(site,{selector},async url=>{calls.push(url.href);return url.pathname==='/host.js'?doc(`InfraredBridge({siteKey:'${site.site_key}',endpoint:'http://127.0.0.1:8080'})`,200,'application/javascript'):doc('<script src="/host.js"></script><script src="https://tags.example.invalid/tag.js"></script>');});
 expect(r).toMatchObject({link:'reachable',pixel:'detected',identity:'matched',endpoint:'matched',scripts_checked:1,scripts_unchecked:1,response_ms:100});expect(calls).toHaveLength(2);expect(calls[0]).toBe(selector.origin+'/casino/?lp=summer');
});
it('does not claim missing on access blocks, failed links or a redirect to a different campaign',async()=>{
 expect(await probeInstallation(site,{selector},async()=>doc('forbidden',403))).toMatchObject({link:'blocked',pixel:'unverified',reason:'ACCESS_OR_BOT_PROTECTION'});
 expect(await probeInstallation(site,{selector},async()=>doc('missing',404))).toMatchObject({link:'http_error',pixel:'unverified'});
 expect(await probeInstallation(site,{selector},async url=>url.search?doc('',302,'text/html','/login/'):doc('<script>InfraredBridge({})</script>'))).toMatchObject({link:'different_page',pixel:'unverified',redirects:1});
 const result=await probeInstallation(site,{selector},async()=>doc('<div>Allow analytics</div><!-- InfraredBridge -->'));expect(result).toMatchObject({link:'reachable',pixel:'not_found_in_html',reason:'DYNAMIC_OR_CONSENT_LOADING_NOT_VERIFIED'});
});
it('bounds scripts, bodies and redirect loops; failed script reads remain unverified',async()=>{
 let calls=0;const r=await probeInstallation(site,{selector},async url=>{calls++;return url.pathname==='/casino/'?doc(Array.from({length:8},(_,i)=>`<script src="/script${i}.js"></script>`).join('')):doc('',404);});expect(calls).toBe(5);expect(r.scripts_unchecked).toBe(8);expect(r.pixel).toBe('not_found_in_html');
 expect(await probeInstallation(site,{selector},async()=>doc('',302,'text/html','?lp=summer'))).toMatchObject({link:'redirect_error',redirects:4});
});
let db:DB;
beforeAll(async()=>{db=await testDB();});afterAll(async()=>{await db.close();});
it('separates saved checks, actual received events, sample data and collection state without manufacturing traffic',async()=>{
 const[s]=await db.query("SELECT * FROM sites WHERE id='local-demo'"),[p]=await db.query("SELECT * FROM pages WHERE site_id='local-demo' AND page_key='casino-halloween'");
 await createInstallationChecker(db,async()=>doc('<script>InfraredBridge({})</script>'))(s,p);
 expect(await db.query('SELECT * FROM events')).toHaveLength(0);let rows=await installationStatuses(db,['local-demo']);expect(rows.find(r=>r.page_key===p.page_key)).toMatchObject({collection:'enabled',recent_events:false,check:{pixel:'detected'}});
 await ingest(db,batch(),demoOrigin,'seeded');rows=await installationStatuses(db,['local-demo']);expect(rows.find(r=>r.page_key===p.page_key)?.recent_events).toBe(false);
 await ingest(db,batch(),demoOrigin);rows=await installationStatuses(db,['local-demo']);expect(rows.find(r=>r.page_key===p.page_key)).toMatchObject({recent_events:true,collection:'enabled'});expect(rows.find(r=>r.page_key==='casino-christmas')?.recent_events).toBe(false);
 await db.query("UPDATE settings SET value=jsonb_set(value,'{global_stop}','true') WHERE key='privacy'");rows=await installationStatuses(db,['local-demo']);expect(rows.find(r=>r.page_key===p.page_key)).toMatchObject({recent_events:true,collection:'stopped'});
 await db.query("UPDATE settings SET value=jsonb_set(value,'{global_stop}','false') WHERE key='privacy'");
});
it('requires authentication, membership, role and CSRF for network checks',async()=>{
 const app=createManagement(db,new Map());await app.ready();
 try{expect((await app.inject({url:'/api/installations',headers:{host:'127.0.0.1:3000'}})).statusCode).toBe(401);
 const session=randomUUID();await db.query("INSERT INTO users(id,email,password_hash,role) VALUES('install-viewer','install-viewer@example.invalid','unused','viewer')");await db.query("INSERT INTO site_memberships(user_id,site_id) VALUES('install-viewer','local-demo')");await db.query("INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES($1,'install-viewer','fixture',now()+interval '1 hour')",[digest(session)]);const headers={host:'127.0.0.1:3000',cookie:'ir_session='+session,origin:'http://127.0.0.1:3000','x-csrf-token':'fixture'};
 const list=await app.inject({url:'/api/installations',headers});expect(list.statusCode).toBe(200);expect(list.json().rows.every((r:any)=>r.site_id==='local-demo')).toBe(true);
 expect((await app.inject({method:'POST',url:'/api/pages/local-demo/casino-halloween/check-installation',headers,payload:{}})).statusCode).toBe(403);
 await db.query("UPDATE users SET role='analyst' WHERE id='install-viewer'");expect((await app.inject({method:'POST',url:'/api/pages/example-real/casino-halloween/check-installation',headers,payload:{}})).statusCode).toBe(404);
 const {['x-csrf-token']:_,...noCSRF}=headers;expect((await app.inject({method:'POST',url:'/api/pages/local-demo/casino-halloween/check-installation',headers:noCSRF,payload:{}})).statusCode).toBe(403);
 }finally{await app.close();}
});

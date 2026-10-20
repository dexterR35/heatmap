import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {batch,demoOrigin,testDB} from './fixtures.js';
import type {DB} from '../packages/db/index.js';
import type {Event} from '../packages/contracts/events.js';
import {ingest,processJobs} from '../apps/server/ingestion.js';
import {createCollector} from '../apps/server/collector.js';
import {createManagement} from '../apps/server/management.js';
import {report} from '../apps/server/analytics.js';
import {portfolio} from '../apps/server/campaigns.js';
import {digest} from '../apps/server/security.js';
let db:DB,collector:ReturnType<typeof createCollector>,app:ReturnType<typeof createManagement>;
const session=randomUUID(),viewer=randomUUID(),headers={host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000',cookie:'ir_session='+session,'x-csrf-token':'test'};
beforeAll(async()=>{db=await testDB();collector=createCollector(db);app=createManagement(db,new Map());await collector.app.ready();await app.ready();for(const[id,role,key]of [['owner','owner',session],['viewer','viewer',viewer]]){await db.query('INSERT INTO users(id,email,password_hash,role) VALUES($1,$2,$3,$4)',[id,id+'@example.invalid','not-a-login-hash',role]);await db.query("INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES($1,$2,'test',now()+interval '1 hour')",[digest(key),id]);}await db.query("INSERT INTO site_memberships(user_id,site_id) VALUES('viewer','local-demo')");});
afterAll(async()=>{await app.close();await collector.app.close();await db.close();});
it('allows policy edits only for authorized roles and approved registered identifiers',async()=>{
 const url='/api/pages/local-demo/casino-halloween/policy',payload={campaign_codes:['unknown','launch-2026'],diagnostics_enabled:true,diagnostic_error_codes:['runtime-error','unhandled-rejection'],primary_cta_id:'hero-register',primary_action_id:'registration-start'};
 expect((await app.inject({method:'PATCH',url,headers:{...headers,cookie:'ir_session='+viewer},payload})).statusCode).toBe(403);
 expect((await app.inject({method:'PATCH',url,headers,payload:{...payload,primary_cta_id:'unregistered'}})).statusCode).toBe(422);
 expect((await app.inject({method:'PATCH',url,headers,payload})).statusCode).toBe(200);
 const b=batch();b.context.campaign='launch-2026';b.config_version=2;await ingest(db,b,demoOrigin);const unknown=batch();unknown.context.campaign='secret-unapproved';await expect(ingest(db,unknown,demoOrigin)).rejects.toMatchObject({code:'UNREGISTERED_CONTEXT'});await processJobs(db);
 const p=await portfolio(db,{campaign:'launch-2026'},['local-demo']);expect(p.totals.tracked_views).toBe(1);expect(p.pages.every((x:any)=>x.site_id==='local-demo')).toBe(true);
});
it('rejects raw error content and disabled diagnostics before persistence',async()=>{
 const b=batch(),signal={...b.events[0],type:'diagnostic',kind:'runtime_error',code:'runtime-error'} as Event;b.events=[signal];
 const request=(payload:Record<string,unknown>)=>collector.app.inject({method:'POST',url:'/v1/events',headers:{origin:demoOrigin},payload});
 expect((await request({...b,events:[{...signal,message:'private visitor content'}]})).statusCode).toBe(400);
 expect((await request({...b,events:[{...signal,code:'unapproved'}]})).statusCode).toBe(422);
 await db.query("UPDATE pages SET diagnostics_enabled=false WHERE site_id='local-demo' AND page_key='casino-halloween'");expect((await request(b)).statusCode).toBe(403);expect((await db.query('SELECT * FROM events WHERE event_id=$1',[signal.event_id])).length).toBe(0);await db.query("UPDATE pages SET diagnostics_enabled=true WHERE site_id='local-demo' AND page_key='casino-halloween'");
});
it('maps registered elements across widths and re-applies approved masks',async()=>{
 const b=batch(),base=b.events[0];base.viewport={...base.viewport,width:390,document_width:390,document_height:2200};b.events=[base,{...base,type:'click',event_id:randomUUID(),seq:1,client_x:200,client_y:400,document_x:200,document_y:400,pointer:'touch',layer:'document',target:{element_id:'hero-register',x_fraction:0.5,y_fraction:0.5,rect:{x:100,y:380,width:200,height:40}}}] as Event[];await ingest(db,b,demoOrigin);await processJobs(db);
 const id=randomUUID(),manifest={schema_version:1,revision:'demo-v1',locale:'en-GB',variant:'control',state:'public-default',layer:'document',viewport:{width:1440,height:900,dpr:1},document:{width:1440,height:2100},elements:[{id:'hero-register',rect:{x:1000,y:1000,width:200,height:100}}],masks:[]};await db.query("INSERT INTO page_references(id,site_id,page_key,manifest,object_key,status) VALUES($1,'local-demo','casino-halloween',$2,$3,'approved')",[id,JSON.stringify(manifest),id+'.png']);
 const filters={site_id:'local-demo',page_key:'casino-halloween',device:'all',width:'1440',reference_id:id};const mapped=await report(db,{...filters,mapping:'element'});expect(mapped.quality!.mapped).toBe(1);expect(mapped.points).toEqual([{x:1104,y:1048,weight:1}]);expect((await report(db,filters)).quality!.mapped).toBe(0);
 await db.query('UPDATE page_references SET manifest=$2 WHERE id=$1',[id,JSON.stringify({...manifest,masks:[{x:1090,y:1040,width:30,height:30}]})]);expect((await report(db,{...filters,mapping:'element'})).quality!.masked).toBe(1);
});
it('excludes shifted visual viewport coordinates from diagnostic overlays',async()=>{
 const b=batch(),base=b.events[0];b.context.campaign='launch-2026';base.viewport.visual_offset_x=5;const click={...base,type:'click',event_id:randomUUID(),seq:1,elapsed_ms:300,client_x:200,client_y:400,document_x:200,document_y:400,pointer:'mouse',layer:'document',target:{element_id:'hero-register',x_fraction:0.5,y_fraction:0.5,rect:{x:100,y:380,width:200,height:40}}} as Event;b.events=[base,click,{...click,event_id:randomUUID(),seq:2,elapsed_ms:400},{...click,event_id:randomUUID(),seq:3,elapsed_ms:500}] as Event[];await ingest(db,b,demoOrigin);await processJobs(db);const r=await report(db,{site_id:'local-demo',page_key:'casino-halloween',campaign:'launch-2026',width:'1440',mapping:'element'});if(r.suppressed)throw new Error('Unexpected suppressed synthetic cohort');expect(r.diagnostics.rage_clicks).toBe(1);expect(r.rage_points).toEqual([]);expect(r.quality!.unsupported).toBe(3);
});
it('keeps version cohorts independent and prevents private operations access',async()=>{
 const policy=await app.inject({method:'PATCH',url:'/api/pages/local-demo/casino-halloween/policy',headers,payload:{revision:'demo-v2',campaign_codes:['unknown','launch-2026'],diagnostics_enabled:true,diagnostic_error_codes:['runtime-error'],primary_cta_id:'hero-register',primary_action_id:'registration-start'}});expect(policy.statusCode).toBe(200);await expect(ingest(db,batch(),demoOrigin)).rejects.toMatchObject({code:'UNREGISTERED_CONTEXT'});const b=batch();b.context.revision='demo-v2';await ingest(db,b,demoOrigin);await processJobs(db);
 const r=await app.inject({url:'/api/reports/versions?site_id=local-demo&page_key=casino-halloween&revision_a=demo-v1&revision_b=demo-v2',headers});expect(r.statusCode).toBe(200);expect(r.json().reports.map((x:any)=>x.selected_revision)).toEqual(['demo-v1','demo-v2']);expect(r.json().reports[1].summary.views).toBe(1);
 expect((await app.inject({url:'/api/operations',headers:{...headers,cookie:'ir_session='+viewer}})).statusCode).toBe(403);
 expect((await app.inject({url:'/api/operations',headers})).statusCode).toBe(200);
 expect((await app.inject({method:'PATCH',url:'/api/operations/settings',headers,payload:{automatic_backup:true}})).statusCode).toBe(400);
});

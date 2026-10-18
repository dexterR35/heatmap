import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import type {DB} from '../packages/db/index.js';
import type {Event} from '../packages/contracts/events.js';
import {testDB,batch,demoOrigin} from './fixtures.js';
import {ingest,processJobs} from '../apps/server/ingestion.js';
import {report} from '../apps/server/analytics.js';
let db:DB;
beforeAll(async()=>{db=await testDB();});afterAll(async()=>{await db.close();});

async function reference(width:number,extra:Record<string,unknown>={}){
 const id=randomUUID(),manifest={schema_version:1,revision:'demo-v1',locale:'en-GB',variant:'control',state:'public-default',layer:'document',viewport:{width,height:900,dpr:1},document:{width,height:2100},elements:[],masks:[],...extra};
 await db.query("INSERT INTO page_references(id,site_id,page_key,manifest,object_key,status) VALUES($1,'local-demo','casino-halloween',$2,$3,'approved')",[id,JSON.stringify(manifest),id+'.png']);return id;
}

it('keeps resized-view actions and element exposure in the correct device cohort',async()=>{
 const b=batch(),base=b.events[0],mobile=randomUUID();
 b.events=[base,{...base,type:'segment_start',event_id:randomUUID(),seq:1,segment_ordinal:0,geometry_state:'stable'},
 {...base,type:'segment_start',event_id:randomUUID(),seq:2,segment_id:mobile,segment_ordinal:1,geometry_state:'stable',viewport:{...base.viewport,width:390,height:844,document_width:390,document_height:2440}},
 {...base,type:'exposure',event_id:randomUUID(),seq:3,segment_id:mobile,element_id:'hero-register',qualified_ms:1000,threshold:0.5,first_qualified:true,viewport:{...base.viewport,width:390,height:844,document_width:390,document_height:2440}},
 {...base,type:'activation',event_id:randomUUID(),seq:4,segment_id:mobile,element_id:'hero-register',action_id:'registration-start',method:'keyboard',viewport:{...base.viewport,width:390,height:844,document_width:390,document_height:2440}}] as Event[];
 await ingest(db,b,demoOrigin);await processJobs(db);
 const desktop=await report(db,{site_id:'local-demo',page_key:'casino-halloween',width:'1440',device:'desktop'});
 const phone=await report(db,{site_id:'local-demo',page_key:'casino-halloween',width:'390',device:'mobile'});
 expect(desktop.summary!.views).toBe(1);expect(desktop.summary!.activated_views).toBe(0);expect(desktop.elements!.find(e=>e.id==='hero-register')!.exposed_views).toBe(0);
 expect(phone.summary!.activated_views).toBe(1);expect(phone.summary!.exposed_activated_views).toBe(1);expect(phone.elements!.find(e=>e.id==='hero-register')!.activated_views).toBe(1);
});
it('counts repeated pointer clicks separately from distinct element activations',async()=>{
 const b=batch(),base=b.events[0];
 const click={...base,type:'click',event_id:randomUUID(),seq:1,client_x:200,client_y:400,document_x:200,document_y:400,pointer:'mouse',layer:'document',target:{element_id:'hero-register',x_fraction:0.5,y_fraction:0.5,rect:{x:100,y:380,width:200,height:40}}} as Event;
 b.events=[base,click,{...click,event_id:randomUUID(),seq:2},{...base,type:'activation',event_id:randomUUID(),seq:3,action_id:'registration-start',element_id:'hero-register',method:'pointer'}] as Event[];
 await ingest(db,b,demoOrigin);await processJobs(db);
 const r=await report(db,{site_id:'local-demo',page_key:'casino-halloween',width:'1440',device:'desktop'}),element=r.elements!.find(e=>e.id==='hero-register')!;
 expect(element.click_count).toBe(2);expect(element.activated_views).toBe(1);expect(element.exposed_activated_views).toBe(0);
});
it('requires exact width for an overlay and rejects another layout/context',async()=>{
 const id=await reference(1440),wrong=await reference(390);
 expect((await report(db,{site_id:'local-demo',page_key:'casino-halloween'})).reference).toBeNull();
 expect((await report(db,{site_id:'local-demo',page_key:'casino-halloween',width:'1440',reference_id:id})).reference!.id).toBe(id);
 await expect(report(db,{site_id:'local-demo',page_key:'casino-halloween',width:'1440',reference_id:wrong})).rejects.toMatchObject({code:'REFERENCE_NOT_COMPATIBLE'});
 const translated=await reference(1440,{locale:'ro-RO'});
 await expect(report(db,{site_id:'local-demo',page_key:'casino-halloween',width:'1440',reference_id:translated})).rejects.toMatchObject({code:'REFERENCE_NOT_COMPATIBLE'});
});
it('reports separate private-mask and incompatible-layout exclusions',async()=>{
 const id=await reference(1440,{masks:[{x:190,y:390,width:20,height:20}]});
 const r=await report(db,{site_id:'local-demo',page_key:'casino-halloween',width:'1440',reference_id:id});
 expect(r.quality!.masked).toBe(2);expect(r.quality!.mapped).toBe(0);expect(r.points).toHaveLength(0);
});
it('separates recorded, generated and legacy evidence instead of blending counts',async()=>{
 const real=batch(),sample=batch(),old=batch();await ingest(db,real,demoOrigin);await ingest(db,sample,demoOrigin,'seeded');await ingest(db,old,demoOrigin);await db.query("UPDATE views SET data_source='legacy' WHERE view_id=$1",[old.view_id]);await processJobs(db);
 const recorded=await report(db,{site_id:'local-demo',page_key:'casino-halloween'}),samples=await report(db,{site_id:'local-demo',page_key:'casino-halloween',data_source:'seeded'}),legacy=await report(db,{site_id:'local-demo',page_key:'casino-halloween',data_source:'legacy'});
 expect(recorded.data_source).toBe('recorded');expect(samples.summary!.views).toBe(1);expect(legacy.summary!.views).toBe(1);expect(recorded.summary!.views).toBeGreaterThan(0);
 await expect(ingest(db,{...sample,events:[{...sample.events[0],event_id:randomUUID()}]},demoOrigin)).rejects.toMatchObject({code:'VIEW_SOURCE_CONFLICT'});
});
it('offers observed viewport widths even when the current width filter excludes them',async()=>{
 const b=batch(),event=b.events[0];event.viewport.width=950;event.viewport.document_width=950;await ingest(db,b,demoOrigin);await processJobs(db);
 const r=await report(db,{site_id:'local-demo',page_key:'casino-halloween',width:'1440'});expect(r.widths).toContain(950);
});

import {randomUUID} from 'node:crypto';
import {openDB,migrate,type DB} from '../packages/db/index.js';
import {seedRegistry} from '../apps/server/seed.js';
import type {Batch,Event} from '../packages/contracts/events.js';
export const demoOrigin='http://127.0.0.1:4173';
export const realOrigin='https://landing.example.com';
// A disabled, unapproved real-site draft: every "real collection stays blocked" test runs against it.
export async function seedRealDraft(db:DB){
 await db.query("INSERT INTO sites(id,site_key,name,origin,domain_group,market,family,environment) VALUES('example-real',$1,'Example landing pages',$2,'landing.example.com',NULL,'go','real')",['site_'+randomUUID().replaceAll('-',''),realOrigin]);
 await db.query("INSERT INTO pages(site_id,page_key,name,selector,product) VALUES('example-real','casino-halloween','Casino · Halloween',$1,'casino')",[JSON.stringify({origin:realOrigin,path:'/casino/',query_equals:{lp:'halloween'},ignored_query_names:[],other_query_policy:'reject',duplicate_query_policy:'reject',fragment_policy:'ignore_anchor'})]);
 await db.query('INSERT INTO config_history(site_id,version,sample_rate) SELECT id,config_version,sample_rate FROM sites ON CONFLICT DO NOTHING');
}
export async function testDB(){const db=await openDB(undefined,'memory://');await migrate(db);await seedRegistry(db,demoOrigin);await seedRealDraft(db);return db;}
export function batch(type:Event['type']='page_view'):Batch {
 const base={event_id:randomUUID(),seq:type==='page_view'?0:1,elapsed_ms:100,segment_id:randomUUID(),viewport:{width:1440,height:900,dpr:1,visual_scale:1,visual_offset_x:0,visual_offset_y:0,scroll_x:0,scroll_y:0,document_width:1440,document_height:2100}};
 const e=type==='click'?{...base,type:'click',client_x:200,client_y:400,document_x:200,document_y:400,pointer:'mouse',layer:'document'}:{...base,type:'page_view'};
 return {schema_version:1,sdk_version:'1.0.0',site_key:'site_local_demo_2026',batch_id:randomUUID(),config_version:1,view_id:randomUUID(),view_started_at:new Date(Date.now()-1000).toISOString(),sample_rate:1,consent:{analytics:true,policy_version:'demo-v1'},context:{page_key:'casino-halloween',revision:'demo-v1',locale:'en-GB',variant:'control',state:'public-default',campaign:'unknown'},events:[e as Event]};
}

import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {batch,demoOrigin,realOrigin,testDB} from './fixtures.js';
import type {DB} from '../packages/db/index.js';
import {createManagement} from '../apps/server/management.js';
import {createCollector} from '../apps/server/collector.js';
import {digest} from '../packages/security/index.js';
import {pathKey,DEFAULT_RULES} from '../packages/domain/site-paths.js';
let db:DB,app:ReturnType<typeof createManagement>,collector:ReturnType<typeof createCollector>,siteKey:string;
const token=randomUUID(),owner={host:'127.0.0.1:3000',cookie:'ir_session='+token,origin:'http://127.0.0.1:3000','x-csrf-token':'synthetic-csrf'};
const rules={...DEFAULT_RULES,patterns:['/projects/:id']};
beforeAll(async()=>{
 db=await testDB();
 await db.query("INSERT INTO users(id,email,password_hash,role) VALUES('owner','owner@site.invalid','x','owner')");
 await db.query("INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES($1,'owner','synthetic-csrf',now()+interval '1 hour')",[digest(token)]);
 [{site_key:siteKey}]=await db.query("SELECT site_key FROM sites WHERE id='example-real'");
 app=createManagement(db,new Map());collector=createCollector(db);await app.ready();await collector.app.ready();
 expect((await app.inject({method:'POST',url:'/api/sites/example-real/approve',headers:owner,payload:{consent_policy_version:'cmp-1'}})).statusCode).toBe(200);
 expect((await app.inject({method:'PATCH',url:'/api/sites/example-real/collection',headers:owner,payload:{collection_mode:'whole_site',rules,elements:['hero'],actions:['signup']}})).statusCode).toBe(200);
});
afterAll(async()=>{await app.close();await collector.app.close();await db.close();});
const visit=async(path:string,key=pathKey(path))=>{
 const b=batch(),[site]=await db.query("SELECT config_version FROM sites WHERE id='example-real'");
 return collector.app.inject({method:'POST',url:'/v1/events',headers:{origin:realOrigin},payload:{...b,site_key:siteKey,config_version:site.config_version,context:{page_key:key,revision:'auto',locale:'auto',variant:'control',state:'public-default',campaign:'unknown',page_path:path}}});
};

it('creates a page for each canonical path on first visit, with site-wide elements',async()=>{
 expect((await visit('/')).statusCode).toBe(204);
 expect((await visit('/projects/:id')).statusCode).toBe(204);
 expect((await visit('/projects/:id')).statusCode).toBe(204);
 const pages=await db.query("SELECT page_key,path,auto,enabled,elements,actions FROM pages WHERE site_id='example-real' AND auto ORDER BY page_key");
 expect(pages.map(p=>[p.page_key,p.path])).toEqual([['p.home','/'],['p.projects.id','/projects/:id']]);
 expect(pages[0]).toMatchObject({auto:true,enabled:true,elements:['hero'],actions:['signup']});
});

it('refuses paths that do not survive the server-side canonical check',async()=>{
 expect((await visit('/projects/1234')).statusCode).toBe(422);        // not canonical: the ID was not collapsed
 expect((await visit('/account/:id')).statusCode).toBe(422);         // excluded sensitive area
 expect((await visit('/blog/*')).statusCode).toBe(422);              // a pattern the site did not define
 expect((await visit('/pricing','p.other')).statusCode).toBe(422);   // key does not match the path
 expect((await visit('/pricing/')).statusCode).toBe(422);            // trailing slash is not canonical
});

it('serves whole-site configuration with disabled pages, and stops a disabled page',async()=>{
 expect((await app.inject({method:'POST',url:'/api/pages/example-real/p.home/toggle',headers:owner,payload:{}})).statusCode).toBe(200);
 const config=(await collector.app.inject({url:'/v2/config/'+siteKey,headers:{origin:realOrigin}})).json();
 expect(config).toMatchObject({collection_mode:'whole_site',pages:[],site_elements:['hero'],disabled_page_keys:['p.home']});
 expect((await visit('/')).statusCode).toBe(403);
});

it('caps automatically created pages per site',async()=>{
 await db.query("INSERT INTO pages(site_id,page_key,name,selector,auto,path) SELECT 'example-real','p.fill-'||g,'fill','{}'::jsonb,true,'/fill-'||g FROM generate_series(1,500) g");
 expect((await visit('/brand-new-page')).statusCode).toBe(422);
});

it('rejects a page path on a selected-pages site and invalid rules',async()=>{
 const b=batch();
 expect((await collector.app.inject({method:'POST',url:'/v1/events',headers:{origin:demoOrigin},payload:{...b,context:{...b.context,page_path:'/casino/'}}})).statusCode).toBe(422);
 expect((await app.inject({method:'PATCH',url:'/api/sites/example-real/collection',headers:owner,payload:{collection_mode:'whole_site',rules:{include:['no-slash'],exclude:[],patterns:[]},elements:[],actions:[]}})).statusCode).toBe(422);
});

it('generates one snippet for the whole site',async()=>{
 const r=(await app.inject({url:'/api/install/site?site_id=example-real',headers:owner})).json();
 expect(r.manifest).toMatchObject({collection_mode:'whole_site',pages:[]});expect(r.code).toContain('InfraredBridge(');
});

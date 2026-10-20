import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {testDB,batch,demoOrigin} from './fixtures.js';
import type {DB} from '../packages/db/index.js';
import {ingest,processJobs} from '../apps/server/ingestion.js';
import {createManagement} from '../apps/server/management.js';
import {digest} from '../packages/security/index.js';
import {config} from '../packages/config/index.js';
let db:DB,app:ReturnType<typeof createManagement>,referenceId:string;
const originalDir=config.dataDir,root=path.resolve('.local'),directory=path.join(root,'adversarial-test-'+randomUUID());
const host={host:'127.0.0.1:3000'},origin='http://127.0.0.1:3000';
const tokens={owner:randomUUID(),viewer:randomUUID(),installer:randomUUID()};
const headers=(role:keyof typeof tokens)=>({...host,cookie:'ir_session='+tokens[role],origin,'x-csrf-token':'synthetic-csrf'});
beforeAll(async()=>{
 db=await testDB();config.dataDir=directory;await mkdir(path.join(directory,'references'),{recursive:true});
 for(const role of ['owner','viewer','installer'] as const){await db.query('INSERT INTO users(id,email,password_hash,role) VALUES($1,$2,$3,$4)',[role,role+'@security.invalid','not-a-login-hash',role]);await db.query("INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES($1,$2,'synthetic-csrf',now()+interval '1 hour')",[digest(tokens[role]),role]);if(role!=='owner')await db.query("INSERT INTO site_memberships(user_id,site_id) VALUES($1,'local-demo')",[role]);}
 referenceId=randomUUID();await writeFile(path.join(directory,'references',referenceId+'.png'),Buffer.from('private-unreviewed-test-bytes'));
 await db.query("INSERT INTO page_references(id,site_id,page_key,manifest,object_key) VALUES($1,'local-demo','casino-halloween',$2,$3)",[referenceId,JSON.stringify({revision:'demo-v1',locale:'en-GB',variant:'control',state:'public-default',layer:'document',viewport:{width:1440,height:900},document:{width:1440,height:2100},masks:[]}),referenceId+'.png']);
 app=createManagement(db,new Map());await app.ready();
});
afterAll(async()=>{await app.close();await db.close();config.dataDir=originalDir;if(path.dirname(path.resolve(directory))!==root||!/^adversarial-test-[a-f0-9-]{36}$/.test(path.basename(directory)))throw new Error('UNSAFE_TEST_CLEANUP');await rm(directory,{recursive:true,force:true});});
it('binds a deduplicated event ID to its original view and rolls back the new view',async()=>{
 const b=batch();await ingest(db,b,demoOrigin);const forged={...b,view_id:randomUUID(),batch_id:randomUUID()};
 await expect(ingest(db,forged,demoOrigin)).rejects.toMatchObject({code:'EVENT_ID_CONFLICT'});
 expect(await db.query('SELECT 1 FROM views WHERE view_id=$1',[forged.view_id])).toHaveLength(0);
});
it('applies CSRF and Origin checks to encoded static API paths',async()=>{
 for(const source of ['https://attacker.invalid','http://127.0.0.1:9999',origin]){const r=await app.inject({method:'POST',url:'/%61pi/auth/logout',headers:{...headers('owner'),origin:source,'x-csrf-token':'wrong'}});expect(r.statusCode).toBe(403);}
 expect((await app.inject({url:'/%61pi/auth/me',headers:host})).statusCode).toBe(401);expect((await app.inject({url:'/api/auth/me',headers:headers('owner')})).statusCode).toBe(200);
});
it('denies installers private reference bytes even on their assigned property',async()=>{
 const r=await app.inject({url:'/api/references/'+referenceId+'/image',headers:headers('installer')});expect(r.statusCode).toBe(403);expect(r.body).not.toContain('private-unreviewed');
});
it('holds pending-review images and manifests back from report viewers',async()=>{
 const r=await app.inject({url:'/api/references/'+referenceId+'/image',headers:headers('viewer')});expect(r.statusCode).toBe(404);
 const report=await app.inject({url:'/api/reports?site_id=local-demo&page_key=casino-halloween&width=1440',headers:headers('viewer')});expect(report.statusCode).toBe(200);expect(report.json().references.some((r:any)=>r.id===referenceId)).toBe(false);
 expect((await app.inject({url:'/api/references/'+referenceId+'/image',headers:headers('owner')})).statusCode).toBe(200);
});
it('moves a crashed final-attempt lease into a visible failed state',async()=>{
 const b=batch();await ingest(db,b,demoOrigin);await db.query("UPDATE jobs SET state='processing',attempts=5,locked_until=now()-interval '1 minute' WHERE view_id=$1",[b.view_id]);
 await processJobs(db);const[job]=await db.query('SELECT * FROM jobs WHERE view_id=$1',[b.view_id]);expect(job.state).toBe('failed');expect(job.locked_until).toBeNull();
});

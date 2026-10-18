import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {mkdir,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import sharp from 'sharp';
import {openDB,migrate} from '../packages/db/index.js';
import {seedRegistry} from '../apps/server/seed.js';
import {importReference} from '../apps/server/references.js';
import {ingest,processJobs} from '../apps/server/ingestion.js';
import {batch,demoOrigin} from './fixtures.js';
import {digest} from '../apps/server/security.js';
import {createExperiment} from '../apps/server/experiments.js';
import {registerAcquisitionVisit,recordAcquisitionOutcome} from '../apps/server/acquisition.js';
it('persists through reopen, backs up, and restores into an empty database with matching reference bytes',async()=>{
 const base=path.resolve('.local','recovery-test-'+randomUUID()),source=path.join(base,'source'),target=path.join(base,'restored'),backup=path.join(base,'backup');await mkdir(source,{recursive:true});
 let db=await openDB(undefined,source+'/database');
 try {
  await migrate(db);await seedRegistry(db,demoOrigin);const b=batch();await ingest(db,b,demoOrigin);await processJobs(db);
  await db.query("INSERT INTO installation_checks(site_id,page_key,result) VALUES('local-demo','casino-halloween','{\"link\":\"reachable\",\"pixel\":\"detected\"}')");
  const experiment=await createExperiment(db,{site_id:'local-demo',page_key:'casino-halloween',name:'Recovery fixture',kind:'aa',primary_metric:'registration_completed',control_variant:'control',treatment_variant:'backup-copy',baseline_rate:.05,mde_relative:.2,minimum_days:14,attribution_hours:24});
  const acquisition=await registerAcquisitionVisit(db,'local-demo',{receipt_id:randomUUID(),page_key:'casino-halloween',unit_token:digest(randomUUID()),campaign:'unknown',device:'desktop',analytics_consent:true,public_context:true,policy_version:'demo-v1'});await recordAcquisitionOutcome(db,'local-demo',{event_id:randomUUID(),visit_id:acquisition.visit_id,kind:'registration_completed',occurred_at:new Date().toISOString()});
  const buffer=await sharp({create:{width:240,height:200,channels:3,background:'#101020'}}).png().toBuffer();
  const id=await importReference(db,source,{schema_version:1,site_id:'local-demo',page_key:'casino-halloween',revision:'demo-v1',locale:'en-GB',variant:'control',state:'public-default',captured_at:new Date().toISOString(),viewport:{width:240,height:200,dpr:1},document:{width:240,height:200},layer:'document',elements:[],masks:[],capture_policy_version:'test-v1'},buffer);
  const [original]=await db.query('SELECT * FROM page_references WHERE id=$1',[id]);await db.close();
  db=await openDB(undefined,source+'/database');expect((await db.query('SELECT * FROM events')).length).toBe(1);await db.close();
  const run=(script:string,dataDir:string)=>spawnSync(process.execPath,['--import','tsx',script,backup],{cwd:process.cwd(),encoding:'utf8',timeout:30000,env:{...process.env,DATABASE_URL:'',DATA_DIR:dataDir,COLLECTOR_ORIGIN:'http://127.0.0.1:65530'}});
  const backed=run('scripts/backup.ts',source);expect(backed.status,backed.stderr).toBe(0);
  const restored=run('scripts/restore.ts',target);expect(restored.status,restored.stderr).toBe(0);
  db=await openDB(undefined,target+'/database');expect((await db.query('SELECT * FROM events')).length).toBe(1);const [ref]=await db.query('SELECT * FROM page_references WHERE id=$1',[id]);expect(ref.manifest.image.sha256).toBe(original.manifest.image.sha256);expect(digest(await readFile(path.join(target,'references',ref.object_key)))).toBe(ref.manifest.image.sha256);await db.close();
  db=await openDB(undefined,target+'/database');expect((await db.query('SELECT id FROM experiments WHERE id=$1',[experiment.id]))).toHaveLength(1);expect((await db.query('SELECT visit_id FROM acquisition_outcomes WHERE visit_id=$1',[acquisition.visit_id]))).toHaveLength(1);expect((await db.query('SELECT result FROM installation_checks'))[0].result.pixel).toBe('detected');await db.close();
  expect(run('scripts/restore.ts',target).status).not.toBe(0);
 }finally{
  await db.close().catch(()=>{});
  if(!base.startsWith(path.resolve('.local')+path.sep)||!path.basename(base).startsWith('recovery-test-'))throw new Error('UNSAFE_TEST_CLEANUP');
  await rm(base,{recursive:true,force:true});
 }
},60000);

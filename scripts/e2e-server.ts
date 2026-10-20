import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {openDB,migrate} from '../packages/db/index.js';
import {config} from '../packages/config/index.js';
import {seedRegistry,seedTraffic} from '../apps/server/seed.js';
import {passwordHash,token,digest} from '../packages/security/index.js';
import {createDemo} from '../apps/server/demo.js';
import {importReference,type Manifest} from '../apps/server/references.js';
import {seedRealDraft} from '../tests/fixtures.js';
import {startWholeSiteFixture} from '../tests/e2e/whole-site-fixture.js';
if(!process.env.E2E_DATA_DIR||config.dataDir!==path.resolve(process.env.E2E_DATA_DIR))throw new Error('ISOLATED_TEST_DIRECTORY_REQUIRED');
const db=await openDB(undefined,config.dataDir+'/database');await migrate(db);await seedRegistry(db,config.demoOrigin);await seedRealDraft(db);await seedTraffic(db,config.demoOrigin);
const credentials={email:'browser-tests@local.invalid',password:token()};await db.query("INSERT INTO users(id,email,password_hash,role) VALUES('browser-owner',$1,$2,'owner')",[credentials.email,await passwordHash(credentials.password)]);await writeFile(path.join(config.dataDir,'admin-credentials.json'),JSON.stringify(credentials),{mode:0o600,flag:'wx'});
// Disposable, explicit E2E fixture only: new journeys reuse a scoped authenticated
// session so expanding the suite cannot exhaust the real login rate limiter.
const browserSession=token();await db.query("INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES($1,'browser-owner',$2,now()+interval '1 hour')",[digest(browserSession),token()]);await writeFile(path.join(config.dataDir,'browser-session.json'),JSON.stringify({cookie:browserSession}),{mode:0o600,flag:'wx'});
const demo=createDemo();await demo.listen({host:'127.0.0.1',port:config.demoPort});const stage=path.join(config.dataDir,'staging');await mkdir(stage,{recursive:true});
try{
 const runner=spawn(process.execPath,['--import','tsx','scripts/capture-runner.ts',stage,config.demoOrigin],{stdio:'ignore',windowsHide:true,env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,USERPROFILE:process.env.USERPROFILE,TEMP:process.env.TEMP,TMP:process.env.TMP,LOCALAPPDATA:process.env.LOCALAPPDATA}});
 await new Promise<void>((resolve,reject)=>{runner.once('error',reject);runner.once('exit',code=>code===0?resolve():reject(new Error('E2E_REFERENCE_CAPTURE_FAILED')));});
 for(const campaign of ['halloween','christmas'])for(const width of [1440,390]){const base=path.join(stage,campaign+'-'+width),manifest=JSON.parse(await readFile(base+'.json','utf8')) as Manifest,id=await importReference(db,config.dataDir,manifest,await readFile(base+'.png'));await db.query("UPDATE page_references SET status='approved' WHERE id=$1",[id]);}
}finally{await demo.close();}
await startWholeSiteFixture(db,config.dataDir,config.collectorOrigin);await db.close();
await import('../apps/server/main.js');

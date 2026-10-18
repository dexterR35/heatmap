import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { DB } from '../../packages/db/index.js';
import { importReference, manifestSchema, type Manifest } from './references.js';
import { audit, Problem } from './security.js';

interface Plan {site_id:string; page_key:string; campaign:string; origin:string; width:number; height:number;variant:string;treatment:boolean}
type Runner = (plan:Plan, directory:string, signal:AbortSignal) => Promise<void>;
const ajv = new Ajv({coerceTypes:false,removeAdditional:false}); addFormats(ajv);
const validManifest = ajv.compile(manifestSchema);

const runFixture: Runner = async (plan,directory,signal) => {
  const child = spawn(process.execPath, ['--import','tsx','scripts/capture-runner.ts',directory,plan.origin,plan.campaign,String(plan.width),String(plan.height),plan.variant,plan.treatment?'treatment':'control'], {
    cwd:process.cwd(), stdio:'ignore', windowsHide:true, signal,
    env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,USERPROFILE:process.env.USERPROFILE,TEMP:process.env.TEMP,TMP:process.env.TMP,LOCALAPPDATA:process.env.LOCALAPPDATA},
  });
  await new Promise<void>((resolve,reject) => {
    child.once('error',() => reject(new Error('CAPTURE_BROWSER_UNAVAILABLE')));
    child.once('exit',code => code===0 ? resolve() : reject(new Error('CAPTURE_FAILED')));
  });
};

export function createCaptureService(db:DB, dataDir:string, demoOrigin:string, runner:Runner=runFixture) {
  const running = new Set<Promise<void>>(), controllers = new Set<AbortController>();

  async function execute(id:string,plan:Plan,userId:string) {
    const controller = new AbortController(); controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(),30000);
    try {
      await db.query("UPDATE capture_jobs SET status='running',updated_at=now() WHERE id=$1",[id]);
      const directory = path.join(dataDir,'staging','capture-'+id);
      await mkdir(directory,{recursive:true});
      await runner(plan,directory,controller.signal);
      const base = path.join(directory,plan.campaign+'-'+plan.width);
      const json = await readFile(base+'.json','utf8');
      if(json.length>64000)throw new Error('CAPTURE_MANIFEST_INVALID');
      const manifest:unknown = JSON.parse(json);
      if(!validManifest(manifest))throw new Error('CAPTURE_MANIFEST_INVALID');
      const m = manifest as Manifest;
      if(m.site_id!==plan.site_id||m.page_key!==plan.page_key||m.viewport.width!==plan.width||m.viewport.height!==plan.height||m.variant!==plan.variant)throw new Error('CAPTURE_TARGET_MISMATCH');
      const bytes = await readFile(base+'.png');
      // Capture does not approve the reference. The operator reviews it in the UI.
      const referenceId = await importReference(db,dataDir,m,bytes);
      await db.query("UPDATE capture_jobs SET status='pending-review',reference_id=$2,updated_at=now() WHERE id=$1",[id,referenceId]);
      await audit(db,userId,'reference_captured',plan.site_id,{page_key:plan.page_key,reference_id:referenceId});
    } catch(error) {
      const known = ['CAPTURE_BROWSER_UNAVAILABLE','CAPTURE_FAILED','CAPTURE_MANIFEST_INVALID','CAPTURE_TARGET_MISMATCH'];
      const code = controller.signal.aborted ? 'CAPTURE_TIMED_OUT' : error instanceof Error && known.includes(error.message) ? error.message : 'CAPTURE_IMPORT_FAILED';
      await db.query("UPDATE capture_jobs SET status='failed',error_code=$2,updated_at=now() WHERE id=$1",[id,code]);
    } finally {
      clearTimeout(timeout); controllers.delete(controller);
    }
  }

  return {
    async recover() {await db.query("UPDATE capture_jobs SET status='failed',error_code='CAPTURE_INTERRUPTED',updated_at=now() WHERE status IN ('queued','running')");},
    async start(siteId:string,pageKey:string,userId:string,width:number,height:number,variant?:string) {
      if(!Number.isInteger(width)||width<240||width>1920||!Number.isInteger(height)||height<200||height>1080)throw new Problem(422,'CAPTURE_VIEWPORT_INVALID');
      const [site] = await db.query('SELECT * FROM sites WHERE id=$1',[siteId]);
      const [page] = await db.query('SELECT * FROM pages WHERE site_id=$1 AND page_key=$2',[siteId,pageKey]);
      if(!site||!page)throw new Problem(404,'PAGE_NOT_FOUND');
      if(site.id!=='local-demo'||site.environment!=='synthetic'||site.origin!==demoOrigin)throw new Problem(403,'EXTERNAL_CAPTURE_DISABLED');
      const campaign = page.selector.query_equals.lp;
      if(!['halloween','christmas'].includes(campaign)||page.page_key!=='casino-'+campaign||page.revision!=='demo-v1'||page.selector.path!=='/casino/')throw new Problem(422,'CAPTURE_FIXTURE_MISMATCH');
      const selectedVariant=variant??page.variant;let treatment=false;
      if(selectedVariant!==page.variant){const[e]=await db.query('SELECT kind,treatment_variant FROM experiments WHERE site_id=$1 AND page_key=$2 AND revision=$3 AND (control_variant=$4 OR treatment_variant=$4) ORDER BY created_at DESC LIMIT 1',[siteId,pageKey,page.revision,selectedVariant]);if(!e)throw new Problem(422,'CAPTURE_VARIANT_UNKNOWN');treatment=e.kind==='ab'&&e.treatment_variant===selectedVariant;}
      const id = randomUUID();
      await db.transaction(async tx => {
        await tx.query("SELECT key FROM settings WHERE key='privacy' FOR UPDATE");
        if((await tx.query("SELECT id FROM capture_jobs WHERE status IN ('queued','running') LIMIT 1")).length)throw new Problem(409,'CAPTURE_BUSY');
        await tx.query("INSERT INTO capture_jobs(id,site_id,page_key,user_id,status,width,height) VALUES($1,$2,$3,$4,'queued',$5,$6)",[id,siteId,pageKey,userId,width,height]);
      });
      const task = execute(id,{site_id:siteId,page_key:pageKey,campaign,origin:demoOrigin,width,height,variant:selectedVariant,treatment},userId).catch(()=>{});
      running.add(task);void task.finally(() => running.delete(task));
      return {id,status:'queued'};
    },
    async get(id:string) {
      const [job] = await db.query('SELECT id,site_id,page_key,status,width,height,reference_id,error_code,created_at,updated_at FROM capture_jobs WHERE id=$1',[id]);
      if(!job)throw new Problem(404,'CAPTURE_NOT_FOUND');return job;
    },
    async close() {for(const controller of controllers)controller.abort();await Promise.allSettled([...running]);},
  };
}

import {spawn} from 'node:child_process';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {config} from '../apps/server/config.js';
import {localClient} from './local-client.js';
const client=await localClient(),stage=path.join(config.dataDir,'staging');await mkdir(stage,{recursive:true});
// Minimal environment. The runner receives neither DATABASE_URL nor administrator credentials.
const runner=spawn(process.execPath,['--import','tsx','scripts/capture-runner.ts',stage,config.demoOrigin],{stdio:'inherit',env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,USERPROFILE:process.env.USERPROFILE,TEMP:process.env.TEMP,TMP:process.env.TMP,LOCALAPPDATA:process.env.LOCALAPPDATA}});
await new Promise<void>((resolve,reject)=>runner.on('exit',code=>code===0?resolve():reject(new Error('CAPTURE_FAILED'))));
for(const campaign of ['halloween','christmas'])for(const width of [1440,390]){
 const base=path.join(stage,`${campaign}-${width}`),manifest=JSON.parse(await readFile(base+'.json','utf8')),buffer=await readFile(base+'.png');
 const response=await client('/api/references/import',{manifest,image_base64:buffer.toString('base64')});const {id}=await response.json() as {id:string};
 // Reviewed deterministic fixture artifacts only. Manual imports remain pending review.
 await client('/api/references/'+id+'/approve',{});
}
console.log('Four synthetic reference layouts imported and approved. Refresh References in the dashboard.');

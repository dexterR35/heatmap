import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdir,rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
const root=path.resolve('.local'),directory=path.join(root,'e2e-'+randomUUID());
const reservations=await Promise.all([0,1,2].map(()=>new Promise<ReturnType<typeof createServer>>(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>resolve(s));})));
const ports=reservations.map(s=>(s.address() as {port:number}).port);await Promise.all(reservations.map(s=>new Promise<void>((resolve,reject)=>s.close(e=>e?reject(e):resolve()))));
await mkdir(directory,{recursive:true});const require=createRequire(import.meta.url);
try{
 const child=spawn(process.execPath,[require.resolve('@playwright/test/cli'),'test',...process.argv.slice(2)],{stdio:'inherit',windowsHide:true,env:{...process.env,E2E_DATA_DIR:directory,DATABASE_URL:'',ADMIN_EMAIL:'',ADMIN_PASSWORD:'',DATA_DIR:directory,DASHBOARD_PORT:String(ports[0]),COLLECTOR_PORT:String(ports[1]),DEMO_PORT:String(ports[2]),DASHBOARD_ORIGIN:'http://127.0.0.1:'+ports[0],COLLECTOR_ORIGIN:'http://127.0.0.1:'+ports[1],DEMO_ORIGIN:'http://127.0.0.1:'+ports[2],CONTAINER_LOCAL_PROFILE:'false',RELEASE_STATUS:'LOCAL_DEMO'}});
 process.exitCode=await new Promise<number>((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code??1));});
}finally{if(path.dirname(directory)!==root||!/^e2e-[a-f0-9-]{36}$/.test(path.basename(directory)))throw new Error('UNSAFE_TEST_CLEANUP');await rm(directory,{recursive:true,force:true});}

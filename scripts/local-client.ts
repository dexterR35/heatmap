import {readFile} from 'node:fs/promises';
import {config} from '../apps/server/config.js';
export async function localClient() {
 let credentials={email:process.env.ADMIN_EMAIL||'',password:process.env.ADMIN_PASSWORD||''};
 if(!credentials.email||!credentials.password)credentials=JSON.parse(await readFile(config.dataDir+'/admin-credentials.json','utf8'));
 const response=await fetch(config.dashboardOrigin+'/api/auth/csrf');const {token,login_token}=await response.json() as {token:string;login_token?:string};const cookie=response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 const login=await fetch(config.dashboardOrigin+'/api/auth/login',{method:'POST',headers:{Origin:config.dashboardOrigin,'Content-Type':'application/json','X-CSRF-Token':login_token||token,Cookie:cookie},body:JSON.stringify(credentials)});
 if(!login.ok)throw new Error('LOCAL_LOGIN_FAILED');const user=await login.json() as {csrf:string};const session=login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 return async(url:string,body?:unknown,method='POST')=>{
  const r=await fetch(config.dashboardOrigin+url,{method:body?method:'GET',headers:{Origin:config.dashboardOrigin,'X-CSRF-Token':user.csrf,Cookie:session,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  if(!r.ok)throw new Error('LOCAL_OPERATION_FAILED_'+r.status+'_'+((await r.json()) as any).error?.code);return r;
 };
}
export async function requireOffline() {
 try{const r=await fetch(config.collectorOrigin+'/healthz',{signal:AbortSignal.timeout(1000)});if(r.ok)throw new Error('STOP_SERVER_FIRST');}catch(e){if((e as Error).message==='STOP_SERVER_FIRST')throw e;}
}

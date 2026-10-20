import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {config} from '../packages/config/index.js';
import {localClient} from './local-client.js';
import {matchesSelector,selectorURL} from '../packages/domain/matcher.js';
// This command deliberately performs no requests to registered real properties.
for(const value of [config.dashboardOrigin,config.collectorOrigin,config.demoOrigin])if(!['127.0.0.1','localhost','[::1]'].includes(new URL(value).hostname))throw new Error('LINK_CHECK_LOCAL_ONLY');
const checks:{name:string;status:'PASS'|'FAIL'|'SKIPPED'}[]=[];
async function check(name:string,fn:()=>Promise<boolean>){try{checks.push({name,status:await fn()?'PASS':'FAIL'});}catch{checks.push({name,status:'FAIL'});}}
const get=(url:string,headers?:Record<string,string>)=>fetch(url,{headers,redirect:'manual',signal:AbortSignal.timeout(5000)});
await check('Dashboard document',async()=>{const r=await get(config.dashboardOrigin+'/');return r.status===200&&r.headers.get('content-type')?.includes('text/html')===true;});
await check('Collector health',async()=>(await get(config.collectorOrigin+'/healthz')).status===200);
await check('Synthetic landing page',async()=>(await get(config.demoOrigin+'/casino/?lp=halloween')).status===200);
await check('Public collector cannot serve management API',async()=>(await get(config.collectorOrigin+'/api/bootstrap')).status===404);
await check('Private environment file denied',async()=>(await get(config.dashboardOrigin+'/.env')).status===404);
await check('Dashboard API requires authentication',async()=>(await get(config.dashboardOrigin+'/api/bootstrap')).status===401);
const request=await localClient();
const bootstrap=await(await request('/api/bootstrap')).json() as any;
await check('Configured dashboard demo link',async()=>bootstrap.demo_url===config.demoOrigin+'/casino/?lp=halloween'&&(await get(bootstrap.demo_url)).status===200);
const install=await(await request('/api/install?site_id=local-demo&page_key=casino-halloween')).json() as any;
await check('Page-scoped installation endpoint and exact selector',async()=>install.endpoint===config.collectorOrigin&&!install.blocked&&matchesSelector(selectorURL(install.included),install.included)&&!matchesSelector(config.demoOrigin+'/casino/?lp=unselected',install.included));
await check('Immutable SDK link and SHA-384 integrity',async()=>{const r=await get(install.endpoint+'/sdk/v1/'+install.artifact.file);const bytes=Buffer.from(await r.arrayBuffer());return r.status===200&&r.headers.get('content-type')?.includes('javascript')===true&&'sha384-'+createHash('sha384').update(bytes).digest('base64')===install.artifact.sri;});
await check('Synthetic configuration CORS',async()=>{const r=await get(config.collectorOrigin+'/v2/config/site_local_demo_2026',{Origin:config.demoOrigin});return r.status===200&&r.headers.get('access-control-allow-origin')===config.demoOrigin;});
const realPage=bootstrap.pages?.find((p:any)=>bootstrap.sites?.find((s:any)=>s.id===p.site_id)?.environment!=='synthetic');
if(!realPage)checks.push({name:'Real-property installation remains blocked',status:'SKIPPED'});
else await check('Real-property installation remains blocked',async()=>{const r=await(await request('/api/install?site_id='+encodeURIComponent(realPage.site_id)+'&page_key='+encodeURIComponent(realPage.page_key))).json() as any;return r.blocked===true;});
await check('Private approved reference image',async()=>{const r=await(await request('/api/reports?site_id=local-demo&page_key=casino-halloween&width=1440&device=desktop')).json() as any;if(!r.reference)return false;const image=await request('/api/references/'+r.reference.id+'/image');return image.status===200&&image.headers.get('content-type')==='image/png';});
const result={checked_at:new Date().toISOString(),scope:'local application routes and generated installation artifacts',production_dns_tls_and_redirects:'NOT_VERIFIED',checks};await mkdir('.local/evidence',{recursive:true});await writeFile('.local/evidence/link-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(checks.some(c=>c.status==='FAIL'))process.exitCode=1;

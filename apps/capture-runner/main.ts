import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {selectorURL} from '../../packages/domain/matcher.js';
// Standalone browser process: no DB imports or secrets. Only fixed synthetic loopback pages.
const output=path.resolve(process.argv[2]||'.local/staging');const origin=process.argv[3]||'http://127.0.0.1:4173';
const u=new URL(origin);if(u.hostname!=='127.0.0.1'||u.protocol!=='http:'||u.pathname!=='/')throw new Error('SYNTHETIC_LOOPBACK_ONLY');
const requestedCampaign=process.argv[4],requestedWidth=process.argv[5]?Number(process.argv[5]):undefined,requestedHeight=process.argv[6]?Number(process.argv[6]):undefined;
const variant=process.argv[7]??'control',treatment=process.argv[8]==='treatment';if(!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,63}$/.test(variant))throw new Error('CAPTURE_VARIANT_INVALID');
if(requestedCampaign&&!['halloween','christmas'].includes(requestedCampaign))throw new Error('UNKNOWN_FIXTURE');
if(requestedWidth!==undefined&&(!Number.isInteger(requestedWidth)||requestedWidth<240||requestedWidth>1920))throw new Error('CAPTURE_VIEWPORT_INVALID');
if(requestedHeight!==undefined&&(!Number.isInteger(requestedHeight)||requestedHeight<200||requestedHeight>1080))throw new Error('CAPTURE_VIEWPORT_INVALID');
await mkdir(output,{recursive:true});const browser=await chromium.launch({headless:true});
let captured=0;
try{for(const campaign of requestedCampaign?[requestedCampaign]:['halloween','christmas'])for(const width of requestedWidth?[requestedWidth]:[1440,390]){
 const height=requestedHeight??(width===390?844:900),context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(10000);
 await page.route('**/*',route=>{const request=new URL(route.request().url());if(request.origin!==u.origin)return route.abort();return route.continue();});
 const selector={origin:u.origin,path:'/casino/',query_equals:{lp:campaign},ignored_query_names:[],other_query_policy:'reject' as const,duplicate_query_policy:'reject' as const,fragment_policy:'ignore_anchor' as const};
 await page.goto(selectorURL(selector),{waitUntil:'networkidle',timeout:12000});if(page.url()!==selectorURL(selector))throw new Error('CAPTURE_TARGET_MISMATCH');
 const host=await page.evaluate(()=>({...document.documentElement.dataset}));
 if(host.hmPageKey!=='casino-'+campaign||host.hmRevision!=='demo-v1'||host.hmLocale!=='en-GB'||host.hmVariant!=='control'||host.hmState!=='public-default')throw new Error('CAPTURE_CONTEXT_MISMATCH');
 await page.evaluate(({variant,treatment})=>{document.documentElement.dataset.hmVariant=variant;if(treatment){const button=document.querySelector<HTMLElement>('[data-hm-id="hero-register"]')!;button.textContent='Explore your seasonal offer →';button.style.background='#a7f3d0';}},{variant,treatment});
 await page.locator('#consent').evaluate(el=>(el as HTMLElement).style.display='none');await page.locator('#withdraw').evaluate(el=>(el as HTMLElement).style.display='none');
 const geometry=await page.evaluate(()=>({document:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},elements:[...document.querySelectorAll('[data-hm-id]')].map(el=>{const r=el.getBoundingClientRect();return {id:el.getAttribute('data-hm-id')!,rect:{x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height},layer:'document'};}),masks:[...document.querySelectorAll('[data-hm-private]')].map(el=>{const r=el.getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height};}).filter(r=>r.width>0&&r.height>0)}));
 if(geometry.document.width!==width||geometry.document.height>20000||geometry.document.width*geometry.document.height>40000000)throw new Error('CAPTURE_GEOMETRY_LIMIT');
 const base=`${campaign}-${width}`;await page.screenshot({path:path.join(output,base+'.png'),fullPage:true,mask:[page.locator('[data-hm-private]')],maskColor:'#252731'});
 await writeFile(path.join(output,base+'.json'),JSON.stringify({schema_version:1,site_id:'local-demo',page_key:'casino-'+campaign,revision:'demo-v1',locale:'en-GB',variant,state:'public-default',captured_at:new Date().toISOString(),viewport:{width,height,dpr:1},...geometry,layer:'document',capture_policy_version:'local-fixture-v1'},null,2));await context.close();captured++;
}}finally{await browser.close();}
console.log(`${captured} local reference artifact(s) captured.`);

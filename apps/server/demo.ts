import Fastify from 'fastify';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {config} from './config.js';
import {safeScriptJSON} from '../../packages/security/validation.js';
import type {DB} from '../../packages/db/index.js';
import {registerExperimentLab,labHostBridge} from './experiment-lab.js';
export function createDemo(db?:DB) {
 const app=Fastify({logger:false,bodyLimit:32768,ajv:{customOptions:{removeAdditional:false,coerceTypes:false,useDefaults:false}}});
 if(db)registerExperimentLab(app,db,config.demoOrigin);
 app.get('/casino/',async(req,reply)=>reply.type('text/html').header('Referrer-Policy','no-referrer').send(await readFile(path.resolve('apps/demo/index.html'),'utf8')));
 app.get('/host.js',async(req,reply)=>{
  const meta=JSON.parse(await readFile(path.resolve('dist/sdk/artifact.json'),'utf8')),loader=await readFile(path.resolve('dist/sdk/bootstrap.js'),'utf8');
  const settings={siteKey:'site_local_demo_2026',endpoint:config.collectorOrigin,installationManifest:{schema_version:2,site_key:'site_local_demo_2026',manifest_version:1,collection_mode:'selected_pages',pages:['halloween','christmas'].map(c=>({page_key:'casino-'+c,selector:{origin:config.demoOrigin,path:'/casino/',query_equals:{lp:c},ignored_query_names:['utm_source','utm_medium','utm_campaign'],other_query_policy:'reject',duplicate_query_policy:'reject',fragment_policy:'ignore_anchor'}}))},artifact:{file:meta.file,sri:meta.sri},consentPolicyVersion:'demo-v1'};
  const bridge=`\nInfraredBridge(${safeScriptJSON(settings)});\nconst campaign=new URL(location.href).searchParams.get('lp');\nif(campaign==='christmas'){document.getElementById('eyebrow').textContent='A season of discovery.';const emphasis=document.createElement('em');emphasis.textContent='wonder';document.getElementById('headline').replaceChildren('A little more',document.createElement('br'),emphasis,document.createElement('br'),'this season.');}\nconst current={eligible:true,pageKey:'casino-'+campaign,revision:'demo-v1',locale:'en-GB',variant:'control',state:'public-default'};\nInfraredHost.setContext(current);\ndocument.getElementById('allow').onclick=()=>{InfraredHost.setConsent('granted');document.getElementById('consent').classList.add('hidden');};\ndocument.getElementById('deny').onclick=()=>{InfraredHost.setConsent('denied');document.getElementById('consent').classList.add('hidden');};\ndocument.getElementById('withdraw').onclick=()=>{InfraredHost.setConsent('denied');document.getElementById('consent').classList.remove('hidden');};\n`;
  const status="\nsetInterval(()=>{const s=window.InfraredSDK?.getStatus(),el=document.getElementById('tracking-status');if(el)el.textContent=s?.state==='ACTIVE'?'Recording clicks · '+document.documentElement.clientWidth+'px':s?.state==='DISABLED'?'Collection paused · check dashboard':s?.state==='FETCHING_CONFIG'?'Connecting analytics…':'Analytics off · awaiting consent';},500);\n";
  return reply.type('application/javascript').send(loader+bridge+status+labHostBridge+"\nObject.assign(document.documentElement.dataset,{hmPageKey:current.pageKey,hmRevision:current.revision,hmLocale:current.locale,hmVariant:current.variant,hmState:current.state});");
 });
 app.get('/',async(req,reply)=>reply.redirect('/casino/?lp=halloween'));return app;
}

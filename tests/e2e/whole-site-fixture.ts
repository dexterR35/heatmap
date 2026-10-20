import Fastify from 'fastify';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import type {DB} from '../../packages/db/index.js';
import {safeScriptJSON} from '../../packages/security/validation.js';
import {DEFAULT_RULES} from '../../packages/domain/site-paths.js';

// A small multi-page website for browser tests of whole-site mode. Test-only: never part of the product.
const SITE_KEY='site_local_whole_2026';
const page=(title:string)=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:sans-serif;margin:0">
<nav style="display:flex;gap:16px;padding:16px"><a href="/">Home</a><a href="/about">About</a><a href="/projects/123">Project</a><a href="/account/settings">Account</a></nav>
<main style="min-height:1400px;padding:24px"><h1>${title}</h1><button type="button" id="consent">Allow analytics</button>
<p><a data-hm-id="cta" data-hm-action="signup" href="#signup" style="display:inline-block;padding:16px 28px;background:#111;color:#fff">Sign up</a></p></main>
<script src="/host.js"></script></body></html>`;

export async function startWholeSiteFixture(db:DB,dataDir:string,collectorOrigin:string){
 const app=Fastify({logger:false});
 for(const [route,title] of [['/','Home'],['/about','About'],['/projects/123','Project 123'],['/account/settings','Account settings']])
  app.get(route,async(_req,reply)=>reply.type('text/html').header('Referrer-Policy','no-referrer').send(page(title)));
 let origin='';
 app.get('/host.js',async(_req,reply)=>{
  const artifact=JSON.parse(await readFile(path.resolve('dist/sdk/artifact.json'),'utf8')),loader=await readFile(path.resolve('dist/sdk/bootstrap.js'),'utf8');
  const options={siteKey:SITE_KEY,endpoint:collectorOrigin,installationManifest:{schema_version:2,site_key:SITE_KEY,manifest_version:1,collection_mode:'whole_site',rules:{...DEFAULT_RULES,patterns:['/projects/:id']},pages:[]},artifact:{file:artifact.file,sri:artifact.sri},consentPolicyVersion:'demo-v1'};
  return reply.type('application/javascript').send(`${loader}\nInfraredBridge(${safeScriptJSON(options)});\ndocument.getElementById('consent').addEventListener('click',()=>window.InfraredHost.setConsent('granted'));
window.denyAnalytics=()=>window.InfraredHost.setConsent('denied');`);
 });
 await app.listen({host:'127.0.0.1',port:0});
 const address=app.server.address();if(!address||typeof address==='string')throw new Error('WHOLE_SITE_FIXTURE_PORT');
 origin='http://127.0.0.1:'+address.port;
 await db.query("INSERT INTO sites(id,site_key,name,origin,domain_group,market,family,environment,enabled,approval_state,daily_quota,collection_mode,site_rules,site_elements,site_actions,journeys_enabled) VALUES('local-site',$1,'Whole-site fixture',$2,'local-site','Demo','site','synthetic',true,'approved',1000000,'whole_site',$3,'[\"cta\"]','[\"signup\"]',true)",[SITE_KEY,origin,JSON.stringify({...DEFAULT_RULES,patterns:['/projects/:id']})]);
 await db.query('INSERT INTO config_history(site_id,version,sample_rate) SELECT id,config_version,sample_rate FROM sites WHERE id=$1',['local-site']);
 await writeFile(path.join(dataDir,'whole-site.json'),JSON.stringify({origin}));
 return app;
}

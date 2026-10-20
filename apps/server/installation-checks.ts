import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {request as httpsRequest} from 'node:https';
import {request as httpRequest} from 'node:http';
import type {DB} from '../../packages/db/index.js';
import {matchesSelector,selectorURL,type Selector} from '../../packages/domain/matcher.js';
import {Problem} from './security.js';
import {config} from './config.js';

type Document={status:number;body:string;type:string;location?:string;truncated:boolean;response_ms?:number;document_ms?:number};
type Read=(url:URL,signal:AbortSignal,allowDemo:boolean)=>Promise<Document>;
export type Probe={checked_at:string;link:string;http_status:number|null;pixel:string;identity:string;endpoint:string;scripts_checked:number;scripts_unchecked:number;redirects:number;final_origin:string|null;reason:string|null;response_ms:number|null;document_ms:number|null};

// Pin each connection to a checked address. Redirects and script URLs are checked
// independently; an external property can never redirect the probe into localhost.
export function publicAddress(value:string):boolean {
 if(isIP(value)===4){const [a,b]=value.split('.').map(Number);return ![0,10,127].includes(a)&&a<224&&!(a===100&&b>=64&&b<=127)&&!(a===169&&b===254)&&!(a===172&&b>=16&&b<=31)&&!(a===192&&(b===168||b===0||b===2))&&!(a===198&&(b===18||b===19||b===51))&&!(a===203&&b===0);}
 // Accept global unicast only, excluding transition/documentation ranges.
 if(isIP(value)===6){const parts=value.split(':');return /^[23]/i.test(value)&&!/^2002:/i.test(value)&&!/^3fff:/i.test(value)&&!(parts[0].toLowerCase()==='2001'&&(parseInt(parts[1]||'0',16)<512||parseInt(parts[1],16)===0xdb8));}
 return false;
}
export const readDocument:Read=async(url,signal,allowDemo)=>{
 const started=performance.now();
 const demo=allowDemo&&url.origin===config.demoOrigin;
 if(url.username||url.password||url.hash||(!demo&&(url.protocol!=='https:'||(url.port&&url.port!=='443'))))throw new Error('UNSAFE_TARGET');
 if(!['http:','https:'].includes(url.protocol))throw new Error('UNSAFE_TARGET');
 const host=url.hostname.replace(/^\[|\]$/g,''),answers=isIP(host)?[{address:host,family:isIP(host)}]:await Promise.race([lookup(host,{all:true,verbatim:true}),new Promise<never>((_,reject)=>{if(signal.aborted)reject(new Error('CHECK_TIMEOUT'));else signal.addEventListener('abort',()=>reject(new Error('CHECK_TIMEOUT')),{once:true});})]);
 signal.throwIfAborted();if(!answers.length||(!demo&&answers.some(a=>!publicAddress(a.address))))throw new Error('UNSAFE_TARGET');
 if(demo&&!answers.every(a=>a.address==='127.0.0.1'||a.address==='::1'))throw new Error('UNSAFE_TARGET');
 const address=answers[0],limit=512*1024;
 return new Promise<Document>((resolve,reject)=>{
  const req=(url.protocol==='https:'?httpsRequest:httpRequest)(url,{agent:false,signal,headers:{'User-Agent':'Infrared-Installation-Check/1.0','Accept':'text/html,application/javascript,text/javascript;q=0.9','Accept-Encoding':'identity'},lookup:((_h:any,options:any,cb:any)=>options?.all?cb(null,[address]):cb(null,address.address,address.family)) as any},res=>{
   let size=0,done=false;const chunks:Buffer[]=[],response_ms=Math.round(performance.now()-started);
   const finish=(truncated:boolean)=>{if(done)return;done=true;resolve({status:res.statusCode??0,type:String(res.headers['content-type']??''),location:res.headers.location,body:Buffer.concat(chunks).toString('utf8'),truncated,response_ms,document_ms:Math.round(performance.now()-started)});};
   res.on('data',(chunk:Buffer)=>{const remaining=limit-size;if(remaining>0){chunks.push(chunk.subarray(0,remaining));size+=chunk.length;}if(size>=limit){finish(true);res.destroy();}});
   res.on('end',()=>finish(false));res.on('error',e=>{if(!done)reject(e);});
  });req.on('error',reject);req.end();
 });
};

export async function probeInstallation(site:{site_key:string;environment:string;origin:string},page:{selector:Selector},read:Read=readDocument):Promise<Probe>{
 const result:Probe={checked_at:new Date().toISOString(),link:'unreachable',http_status:null,pixel:'unverified',identity:'unverified',endpoint:'unverified',scripts_checked:0,scripts_unchecked:0,redirects:0,final_origin:null,reason:null,response_ms:null,document_ms:null};
 const signal=AbortSignal.timeout(12000),allowDemo=site.environment==='synthetic'&&site.origin===config.demoOrigin;
 try{
  let url=new URL(selectorURL(page.selector)),document:Document;
  for(;;){document=await read(url,signal,allowDemo);result.http_status=document.status;result.final_origin=url.origin;result.response_ms=document.response_ms??null;result.document_ms=document.document_ms??null;
   if(![301,302,303,307,308].includes(document.status))break;
   if(!document.location||result.redirects>=4){result.link='redirect_error';result.reason='REDIRECT_LIMIT_OR_INVALID';return result;}
   result.redirects++;url=new URL(document.location,url);
  }
  if([401,403,429].includes(document.status)){result.link='blocked';result.reason='ACCESS_OR_BOT_PROTECTION';return result;}
  if(document.status<200||document.status>=300){result.link='http_error';result.reason='HTTP_ERROR';return result;}
  if(!matchesSelector(url.toString(),page.selector)){result.link='different_page';result.reason='REDIRECT_CHANGED_LANDING_PAGE';return result;}
  if(!/text\/html|application\/xhtml\+xml/i.test(document.type)){result.link='not_html';result.reason='NOT_AN_HTML_PAGE';return result;}
  result.link='reachable';
  const html=document.body.replace(/<!--[\s\S]*?-->/g,''),sources:string[]=[];let source=html;
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
   const attr=match[1].match(/\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
   if(!attr)continue;
   try{const script=new URL((attr[1]??attr[2]??attr[3]).replaceAll('&amp;','&'),url);if(script.origin===url.origin&&!sources.includes(script.href)&&!script.search){sources.push(script.href);}else result.scripts_unchecked++;}catch{result.scripts_unchecked++;}
  }
  // Bounded static inspection only: never execute host scripts, accept consent,
  // follow tags, or manufacture events to make a check look successful.
  result.scripts_unchecked+=Math.max(0,sources.length-4);
  for(const src of sources.slice(0,4)){try{const script=await read(new URL(src),signal,allowDemo);if(script.status===200&&/javascript|ecmascript|text\/plain/i.test(script.type)){source+='\n'+script.body;result.scripts_checked++;if(script.truncated)result.scripts_unchecked++;}else result.scripts_unchecked++;}catch{result.scripts_unchecked++;}}
  const marker=/\bInfrared(?:SDK|Bridge|Host)\b/.test(source)||/\/sdk\/v1\/tracker\.[\w.-]+\.js/.test(source);
  if(marker){result.pixel='detected';result.identity=source.includes(site.site_key)?'matched':'unverified';result.endpoint=source.includes(config.collectorOrigin)?'matched':'unverified';}
  else{result.pixel='not_found_in_html';result.reason='DYNAMIC_OR_CONSENT_LOADING_NOT_VERIFIED';}
  if(document.truncated)result.reason='DOCUMENT_TRUNCATED';
 }catch(e){result.reason=signal.aborted?'CHECK_TIMEOUT':e instanceof Error&&e.message==='UNSAFE_TARGET'?'UNSAFE_TARGET':'NETWORK_OR_TLS_ERROR';}
 return result;
}

export async function installationStatuses(db:DB,ids:string[]){
 return db.query(`SELECT p.site_id,p.page_key,s.report_timezone,
 CASE WHEN s.environment='synthetic' THEN 'local_demo' ELSE 'real_site' END AS environment,
 CASE WHEN (SELECT (value->>'global_stop')::boolean FROM settings WHERE key='privacy') THEN 'stopped'
 WHEN s.environment<>'synthetic' OR NOT s.enabled OR NOT p.enabled OR s.approval_state<>'approved' OR p.approval_state<>'approved' THEN 'disabled' ELSE 'enabled' END AS collection,
 c.result AS check,
 (SELECT count(*)::int FROM jobs j JOIN views v ON v.site_id=j.site_id AND v.view_id=j.view_id WHERE v.site_id=p.site_id AND v.page_key=p.page_key AND v.data_source='recorded' AND j.state IN ('pending','processing')) AS pending_views,
 (SELECT count(*)::int FROM jobs j JOIN views v ON v.site_id=j.site_id AND v.view_id=j.view_id WHERE v.site_id=p.site_id AND v.page_key=p.page_key AND v.data_source='recorded' AND j.state='failed') AS failed_views,
 (SELECT COALESCE(EXTRACT(epoch FROM(now()-min(j.updated_at))),0)::double precision FROM jobs j JOIN views v ON v.site_id=j.site_id AND v.view_id=j.view_id WHERE v.site_id=p.site_id AND v.page_key=p.page_key AND v.data_source='recorded' AND j.state IN ('pending','processing')) AS oldest_pending_seconds,
 (SELECT max(e.received_at) FROM events e JOIN views v ON v.site_id=e.site_id AND v.view_id=e.view_id WHERE v.site_id=p.site_id AND v.page_key=p.page_key AND v.data_source='recorded' AND e.received_at<=now()) AS last_event_at,
 EXISTS(SELECT 1 FROM events e JOIN views v ON v.site_id=e.site_id AND v.view_id=e.view_id WHERE v.site_id=p.site_id AND v.page_key=p.page_key AND v.data_source='recorded' AND e.received_at>now()-interval '24 hours' AND e.received_at<=now()) AS recent_events
 FROM pages p JOIN sites s ON s.id=p.site_id LEFT JOIN installation_checks c ON c.site_id=p.site_id AND c.page_key=p.page_key
 WHERE p.site_id=ANY($1::text[]) ORDER BY p.site_id,p.page_key LIMIT 1001`,[ids]);
}

export function createInstallationChecker(db:DB,read:Read=readDocument){
 let active=0;const targets=new Set<string>();
 return async(site:any,page:any)=>{
  const key=site.id+'/'+page.page_key;if(active>=3||targets.has(key))throw new Problem(409,'INSTALLATION_CHECK_BUSY');
  active++;targets.add(key);
  try{const result=await probeInstallation(site,page,read);await db.query('INSERT INTO installation_checks(site_id,page_key,checked_at,result) VALUES($1,$2,$3,$4) ON CONFLICT(site_id,page_key) DO UPDATE SET checked_at=EXCLUDED.checked_at,result=EXCLUDED.result',[site.id,page.page_key,result.checked_at,JSON.stringify(result)]);return result;}
  finally{active--;targets.delete(key);}
 };
}

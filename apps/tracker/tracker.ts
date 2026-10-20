import {matchPage,type Selector} from '../../packages/domain/matcher.js';
import {validCollectorOrigin} from '../../packages/domain/endpoint.js';
import {scrollMetrics} from '../../packages/domain/metrics.js';
import type {Batch,Context,Event,Viewport} from '../../packages/contracts/events.js';
import {installDiagnostics} from './diagnostics.js';
import {installSignals} from './signals.js';
import {clientInfo,trafficSource} from '../../packages/domain/audience.js';
import {canonicalPath,pathKey,validRules,type SiteRules} from '../../packages/domain/site-paths.js';
import {readJourney,removeJourney} from './journey.js';
import {anySignal,validConsent,validHostContext,validPublicConfig,type Consent,type HostContext} from '../../packages/domain/host-input.js';
export interface Manifest {schema_version:2;site_key:string;manifest_version:number;collection_mode:'selected_pages'|'whole_site';rules?:SiteRules;pages:{page_key:string;selector:Selector}[]}
export interface Options {siteKey:string;endpoint:string;consent:Consent;consentPolicyVersion:string;context:HostContext;installationManifest:Manifest}
interface PublicPage {page_key:string;selector:Selector;revision:string;locale:string;variant:string;state:string;elements:string[];actions:string[];diagnostics_enabled?:boolean;diagnostic_error_codes?:string[];campaign_codes?:string[];approved_contexts?:{revision:string;locale:string;variant:string;state:string}[]}
function allowedContext(p:PublicPage,h:HostContext){return [p,...(h.acquisitionId?p.approved_contexts??[]:[])].some(c=>['revision','locale','variant','state'].every(k=>c[k as keyof typeof c]===h[k as keyof HostContext]));}
interface PublicConfig {schema_version:2;enabled:boolean;config_version:number;sample_rate:number;expires_in:number;pages:PublicPage[];features?:string[];collection_mode?:'whole_site';rules?:SiteRules;site_elements?:string[];site_actions?:string[];disabled_page_keys?:string[];journeys?:true}
let options:Options|undefined,configuration:PublicConfig|undefined,page:PublicPage|undefined;
let state='UNINITIALIZED',reason='',generation=0,configAt=0,view='',segment='',ordinal=0,seq=0,started=0,monoStart=0,lastInteraction=0;
let queue:Event[]=[],cleanup:(()=>void)[]=[],controller:AbortController|undefined,flushing=false;
let maxReach=0,maxScroll=0,visible=0,lastTick=0,lastProgress=0,geometry='',dropped=0;
let diagnosticObserver:ReturnType<typeof installDiagnostics>|undefined,signals:ReturnType<typeof installSignals>|undefined;
let retries=0,transportFailures=0,lastDelivery='',activePath='',journey:{id:string;seq:number}|undefined;
function forgetJourney(){journey=undefined;removeJourney();}
const optOut=()=>navigator.doNotTrack==='1'||(navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl===true;
const wholeSite=()=>options?.installationManifest.collection_mode==='whole_site';
// Whole-site mode: the page identity is the canonical path. Selected-pages mode matches exact selectors.
function sitePage(){const path=canonicalPath(location.pathname,options!.installationManifest.rules!);return path?{page_key:pathKey(path),path}:null;}
const localMatch=()=>options&&(wholeSite()?sitePage():matchPage(location.href,options.installationManifest.pages));
function pageFor(c:PublicConfig):PublicPage|null{
 if(!wholeSite())return matchPage(location.href,c.pages);
 const s=sitePage();if(!s||c.collection_mode!=='whole_site'||c.disabled_page_keys?.includes(s.page_key))return null;
 return {page_key:s.page_key,selector:{origin:location.origin,path:s.path,query_equals:{},ignored_query_names:[],other_query_policy:'ignore',duplicate_query_policy:'reject',fragment_policy:'ignore_anchor'},revision:'auto',locale:'auto',variant:'control',state:'public-default',elements:c.site_elements??[],actions:c.site_actions??[],campaign_codes:['unknown']};
}
// samePage=false is used only to drain an earlier view's queue after client-side navigation: consent and eligibility still apply.
function permitted(samePage=true) {
 return !!options&&options.consent==='granted'&&options.context.eligible&&!optOut()&&(!samePage||localMatch()?.page_key===options.context.pageKey);
}
function active() {
 return permitted()&&state==='ACTIVE'&&!document.hidden&&!!configuration&&Date.now()-configAt<60000;
}
function clear(next='WAITING_FOR_PERMISSION',why='') {
 generation++;controller?.abort();controller=undefined;for(const fn of cleanup.splice(0))fn();
 diagnosticObserver?.destroy();diagnosticObserver=undefined;signals?.destroy();signals=undefined;queue=[];view='';segment='';page=undefined;configuration=undefined;flushing=false;state=next;reason=why;
}
function viewport():Viewport {
 const de=document.documentElement,v=window.visualViewport;
 return {width:de.clientWidth,height:innerHeight,dpr:devicePixelRatio,visual_scale:v?.scale??1,visual_offset_x:v?.offsetLeft??0,visual_offset_y:v?.offsetTop??0,scroll_x:Math.max(0,scrollX),scroll_y:Math.max(0,scrollY),document_width:Math.max(de.scrollWidth,de.clientWidth),document_height:Math.max(de.scrollHeight,innerHeight)};
}
type Payload = Event extends infer E ? E extends Event ? Omit<E,'event_id'|'seq'|'elapsed_ms'|'segment_id'|'viewport'> : never : never;
function emit(payload:Payload) {
 if(!active())return;
 const v=viewport();if(v.width<240||v.width>7680||v.height<200||v.height>4320||v.document_height>100000)return;
 if(Date.now()-lastInteraction>1800000||Date.now()-started>86400000){void activate();return;}
 const e={...payload,event_id:crypto.randomUUID(),seq:seq++,elapsed_ms:Math.round(performance.now()-monoStart),segment_id:segment,viewport:v} as Event;
 if(queue.length>=200||new TextEncoder().encode(JSON.stringify(queue)).length>125000){dropped++;return;}
 queue.push(e);if(queue.length>=20)queueMicrotask(()=>void flush());return e;
}
function context():Context {
 const c=options!.context;return {page_key:c.pageKey,revision:c.revision,locale:c.locale,variant:c.variant,state:c.state,campaign:c.campaign||'unknown',...(c.acquisitionId?{acquisition_id:c.acquisitionId}:{}),...(wholeSite()?{page_path:activePath}:{}),...(journey?{session_id:journey.id,session_seq:journey.seq}:{})};
}
async function flush(keepalive=false,draining=false) {
 if(flushing||!permitted(!draining)||!view||!configuration||Date.now()-configAt>=60000)return;
 const g=generation;flushing=true;
 try {
  while(queue.length&&g===generation&&permitted(!draining)) {
   const events:Event[]=[];
   while(queue.length&&events.length<50) {if(new TextEncoder().encode(JSON.stringify([...events,queue[0]])).length>22000)break;events.push(queue.shift()!);}
   if(!events.length){queue.shift();dropped++;continue;}
   const batch:Batch={schema_version:1,sdk_version:'1.0.0',site_key:options!.siteKey,batch_id:crypto.randomUUID(),config_version:configuration.config_version,view_id:view,view_started_at:new Date(started).toISOString(),sample_rate:configuration.sample_rate,consent:{analytics:true,policy_version:options!.consentPolicyVersion},context:context(),events};
   const born=Date.now();let accepted=false;
   for(let attempt=0;attempt<4;attempt++) {
    if(g!==generation||!permitted(!draining)||Date.now()-configAt>=60000||Date.now()-born>60000)break;
    try {
     if(attempt>0)retries=Math.min(20000,retries+1);const timeout=AbortSignal.timeout(8000),signal=controller?anySignal([timeout,controller.signal]):timeout;
     const response=await fetch(options!.endpoint+'/v1/events',{method:'POST',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify(batch),keepalive,signal});
     if(response.status===204){accepted=true;break;}
     transportFailures=Math.min(20000,transportFailures+1);
     if(response.status===403||response.status===409){clear('DISABLED','SERVER_POLICY');return;}
     if(response.status!==408&&response.status!==429&&response.status<500)break;
     if(attempt<3)await new Promise(r=>setTimeout(r,Math.min(10000,Math.max(500,Number(response.headers.get('Retry-After')||0)*1000,500*2**attempt))));
    }catch{transportFailures=Math.min(20000,transportFailures+1);if(g!==generation||!permitted(!draining))break;if(attempt<3)await new Promise(r=>setTimeout(r,500*2**attempt+Math.random()*250));}
   }
   if(!accepted&&g===generation)dropped=Math.min(20000,dropped+events.length);
  }
 }finally{if(g===generation){flushing=false;const key=[retries,dropped,transportFailures].join(':');if(configuration?.features?.includes('delivery-v1')&&key!==lastDelivery&&(retries||dropped||transportFailures)){lastDelivery=key;emit({type:'delivery',retry_attempts:retries,dropped_events:Math.min(20000,dropped),transport_failures:transportFailures});}}}
}
const PRIVATE='form,input,textarea,select,[contenteditable],[data-hm-ignore],[data-hm-private],iframe,canvas';
function privateTarget(el:Element,x:number,y:number,checkCoordinates=true,path:EventTarget[]=[]) {
 // Clicks inside web components are retargeted to the host element, so the composed path is checked as well.
 if(el.closest(PRIVATE)||path.some(node=>node instanceof Element&&node.matches(PRIVATE)))return true;
 if(!checkCoordinates)return false;
 const regions=document.querySelectorAll('[data-hm-private]');if(regions.length>64)return true;
 for(const region of regions){const r=region.getBoundingClientRect();if(r.width>0&&r.height>0&&x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom)return true;}
 return false;
}
function onClick(e:MouseEvent) {
 if(!active()||!(e.target instanceof Element)||privateTarget(e.target,e.clientX,e.clientY,e.detail!==0,e.composedPath())||e.button!==0)return;
 lastInteraction=Date.now();const target=e.target.closest('[data-hm-id]'),id=target?.getAttribute('data-hm-id')||'',action=target?.getAttribute('data-hm-action')||'';
 const registered=page!.elements.includes(id),approvedAction=page!.actions.includes(action);
 if(e.detail===0){if(approvedAction)emit({type:'activation',action_id:action,...(registered?{element_id:id}:{}),method:'keyboard'});return;}
 let layer:'document'|'fixed'|'sticky'|'element-only'='document';
 let ancestor:Element|null=e.target;for(let i=0;i<12&&ancestor;i++,ancestor=ancestor.parentElement){const style=getComputedStyle(ancestor);if(style.position==='fixed')layer='fixed';else if(style.position==='sticky'&&layer==='document')layer='sticky';if(style.transform!=='none'||(style.overflowY==='auto'&&ancestor.scrollHeight>ancestor.clientHeight))layer='element-only';}
 const rect=target?.getBoundingClientRect(),valid=registered&&rect&&rect.width>0&&rect.height>0;
 const pe=e as PointerEvent;
 const click=emit({type:'click',client_x:e.clientX,client_y:e.clientY,document_x:e.clientX+scrollX,document_y:e.clientY+scrollY,pointer:pe.pointerType==='touch'?'touch':pe.pointerType==='pen'?'pen':'mouse',layer,...(valid?{target:{element_id:id,x_fraction:Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)),y_fraction:Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height)),rect:{x:rect.left+scrollX,y:rect.top+scrollY,width:rect.width,height:rect.height}}}:{})});
 if(click){diagnosticObserver?.click(e.target,click.event_id,registered?id:undefined);signals?.click(e);}
 if(approvedAction){emit({type:'activation',action_id:action,...(registered?{element_id:id}:{}),method:'pointer'});void flush();}
}
function progress(force=false) {
 if(!active())return;const v=viewport(),key=v.width+':'+v.height+':'+v.document_height;
 if(geometry!==key){geometry=key;segment=crypto.randomUUID();ordinal++;maxReach=0;maxScroll=0;visible=0;emit({type:'segment_start',segment_ordinal:ordinal,geometry_state:'stable'});}
 const m=scrollMetrics(v.scroll_y,v.document_height,v.height),previous=maxReach;
 maxReach=Math.max(maxReach,m.reach);maxScroll=Math.max(maxScroll,m.scroll);
 const now=performance.now();visible+=Math.max(0,Math.min(1000,now-lastTick));lastTick=now;
 if(force||maxReach-previous>=5||now-lastProgress>10000){lastProgress=now;emit({type:'progress',max_reach_px:Math.min(v.document_height,v.document_height*maxReach/100),max_reach_percent:maxReach,max_scroll_percent:maxScroll,visible_ms:Math.round(visible),geometry_stable:true});}
}
async function refresh() {
 if(!permitted()||document.hidden)return;
 const g=generation;
 try {
  const response=await fetch(options!.endpoint+'/v2/config/'+encodeURIComponent(options!.siteKey),{credentials:'omit',referrerPolicy:'no-referrer',mode:'cors',signal:controller?.signal});
  if(!response.ok)throw new Error('CONFIG_REJECTED');const body:unknown=await response.json();if(!validPublicConfig(body)){clear('DISABLED','CONFIG_INVALID');return;}const next=body as PublicConfig;
  if(g!==generation||!permitted())return;
  const current=pageFor(next);
  if(!next.enabled||!current||current.page_key!==options!.context.pageKey||!allowedContext(current,options!.context)){clear('DISABLED','POLICY_CHANGED');return;}
  // The complete view retains its issued epoch and sample rate; restrictive current policy still wins.
  if(!(current.campaign_codes??['unknown']).includes(options!.context.campaign??'unknown')){clear('DISABLED','UNREGISTERED_CAMPAIGN');return;}if(!current.diagnostics_enabled||JSON.stringify(current.diagnostic_error_codes)!==JSON.stringify(page?.diagnostic_error_codes)){diagnosticObserver?.destroy();diagnosticObserver=undefined;}page=current;
  configuration={...next,config_version:configuration!.config_version,sample_rate:configuration!.sample_rate};configAt=Date.now();
 }catch{if(g===generation&&Date.now()-configAt>=60000)clear('DISABLED','CONFIG_EXPIRED');}
}
async function activate() {
 clear();if(!permitted()){reason='CONSENT_CONTEXT_OR_SCOPE';return;}
 state='FETCHING_CONFIG';const g=generation;controller=new AbortController();
 try {
  const response=await fetch(options!.endpoint+'/v2/config/'+encodeURIComponent(options!.siteKey),{credentials:'omit',referrerPolicy:'no-referrer',mode:'cors',signal:controller.signal});if(!response.ok)throw new Error('CONFIG_UNAVAILABLE');
  const body:unknown=await response.json();if(g!==generation||!permitted())return;if(!validPublicConfig(body)){clear('DISABLED','CONFIG_INVALID');return;}const c=body as PublicConfig;
  const p=pageFor(c),host=options!.context;
  if(c.schema_version!==2||!c.enabled||!p||p.page_key!==host.pageKey||!allowedContext(p,host)){clear('DISABLED','SCOPE_OR_CONTEXT');return;}
  if(!(p.campaign_codes??['unknown']).includes(host.campaign??'unknown')){clear('DISABLED','UNREGISTERED_CAMPAIGN');return;}
  if(crypto.getRandomValues(new Uint32Array(1))[0]/4294967296>=c.sample_rate){clear('SAMPLED_OUT');return;}
  if(c.journeys)journey=readJourney();else forgetJourney();
  configuration=c;page=p;activePath=p.selector.path;configAt=Date.now();view=crypto.randomUUID();segment=crypto.randomUUID();ordinal=0;seq=0;started=Date.now();lastInteraction=started;monoStart=performance.now();lastTick=monoStart;geometry='';state='ACTIVE';
  retries=0;transportFailures=0;dropped=0;lastDelivery='';
  const nav=navigator as Navigator&{userAgentData?:{mobile?:boolean}};
  emit({type:'page_view',source:trafficSource(location.search,document.referrer,location.hostname),client:clientInfo(navigator.userAgent,navigator.maxTouchPoints||0,nav.userAgentData?.mobile,navigator.language)});progress(true);
  signals=installSignals({active,privateTarget,emit,flush:k=>void flush(k),elements:p.elements,segment:()=>segment,reach:()=>maxReach,startedAt:monoStart});
  if(p.diagnostics_enabled)diagnosticObserver=installDiagnostics({active,privateTarget,emit,errorCodes:p.diagnostic_error_codes??[]});
  // Analytics failures must never surface as errors in the host page.
  const listen=(target:EventTarget,name:string,fn:EventListener)=>{const safe:EventListener=event=>{try{fn(event);}catch{/* ignored */}};target.addEventListener(name,safe,{passive:true});cleanup.push(()=>target.removeEventListener(name,safe));};
  listen(document,'click',onClick as EventListener);
  let scrollScheduled=false;listen(window,'scroll',()=>{lastInteraction=Date.now();if(scrollScheduled)return;scrollScheduled=true;requestAnimationFrame(()=>{scrollScheduled=false;if(g===generation)progress();});});
  listen(document,'visibilitychange',()=>{if(document.hidden){progress(true);void flush(true);lastTick=performance.now();}else{lastTick=performance.now();if(Date.now()-configAt>45000)void refresh();}});
  const ro=new ResizeObserver(()=>{try{if(g===generation)progress(true);}catch{/* ignored */}});ro.observe(document.documentElement);cleanup.push(()=>ro.disconnect());
  const exposures=new Map<Element,{since:number;sent:boolean;id:string}>();
  const io=new IntersectionObserver(entries=>{for(const entry of entries){const record=exposures.get(entry.target);if(record)record.since=entry.intersectionRatio>=0.5&&!document.hidden?performance.now():0;}},{threshold:[0,0.5,1]});
  for(const el of [...document.querySelectorAll('[data-hm-exposure][data-hm-id]')].slice(0,100)){const id=el.getAttribute('data-hm-id')!;if(p.elements.includes(id)&&!el.closest('[data-hm-private],[data-hm-ignore],form')){exposures.set(el,{since:0,sent:false,id});io.observe(el);}}
  cleanup.push(()=>io.disconnect());
  const tick=setInterval(()=>{try{
   if(!permitted()){clear();return;}if(!active()){for(const value of exposures.values())value.since=0;if(Date.now()-configAt>=60000)clear('DISABLED','CONFIG_EXPIRED');return;}
   progress();for(const [el,record] of exposures){if(record.sent)continue;if(!el.isConnected||privateTarget(el,0,0,false)){record.since=0;continue;}const r=el.getBoundingClientRect();const ratio=Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,0))/Math.max(1,r.height);if(ratio<0.5){record.since=0;continue;}if(!record.since)record.since=performance.now();if(performance.now()-record.since>=1000){emit({type:'exposure',element_id:record.id,qualified_ms:Math.round(performance.now()-record.since),threshold:0.5,first_qualified:true});record.sent=true;}}
  }catch{/* ignored */}},500),send=setInterval(()=>void flush(),5000),poll=setInterval(()=>void refresh(),45000);
  cleanup.push(()=>{clearInterval(tick);clearInterval(send);clearInterval(poll);});
 }catch{if(g===generation)clear('DISABLED','CONFIG_UNAVAILABLE');}
}
export const sdk={
 async init(next:Options) {
  if(!validConsent(next?.consent)||!validHostContext(next?.context))return;
  if(options&&options.siteKey!==next.siteKey){reason='CONFLICTING_INSTALLATION';return;}
  if(options&&JSON.stringify(options.installationManifest)!==JSON.stringify(next.installationManifest)){clear('DISABLED','MANIFEST_CHANGED');return;}
  if(!validCollectorOrigin(next.endpoint))return;
  if(next.installationManifest.schema_version!==2||!(next.installationManifest.collection_mode==='selected_pages'||(next.installationManifest.collection_mode==='whole_site'&&validRules(next.installationManifest.rules)))||next.installationManifest.site_key!==next.siteKey||next.installationManifest.pages.length>32)return;
  if(options&&view&&options.consent===next.consent&&JSON.stringify(options.context)===JSON.stringify(next.context))return;
  // Send what the previous page view still holds before switching to the new one.
  if(options&&view&&queue.length)await flush(true,true);
  options=structuredClone(next);await activate();
 },
 setConsent(consent:Consent,policyVersion:string){if(!options)return;if(!validConsent(consent))consent='denied';if(typeof policyVersion!=='string')policyVersion=options.consentPolicyVersion;const changed=options.consent!==consent||options.consentPolicyVersion!==policyVersion;options.consent=consent;options.consentPolicyVersion=policyVersion;if(consent==='denied')forgetJourney();if(changed){clear();if(permitted())void activate();}},
 setContext(next:HostContext){if(!options)return;if(!validHostContext(next))next={...options.context,eligible:false};if(JSON.stringify(next)===JSON.stringify(options.context))return;options.context=structuredClone(next);clear();if(permitted())void activate();},
 trackAction(id:string){if(typeof id==='string'&&active()&&page!.actions.includes(id))emit({type:'activation',action_id:id,method:'host'});},
 flush:()=>flush(),destroy(){clear('DESTROYED');forgetJourney();options=undefined;},
 getStatus:()=>({state,reason,queuedEvents:queue.length,configVersion:configuration?.config_version,droppedEvents:dropped}),
};
(window as any).InfraredSDK=sdk;

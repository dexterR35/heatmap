import {matchPage} from '../../packages/domain/matcher.js';
import {validCollectorOrigin,validSDKArtifact} from '../../packages/domain/endpoint.js';
import {validConsent,validHostContext} from '../../packages/domain/host-input.js';
import {canonicalPath,pathKey,validRules} from '../../packages/domain/site-paths.js';
import type {Manifest,Options,sdk as sdkType} from './tracker.js';
interface BridgeOptions {siteKey:string;endpoint:string;installationManifest:Manifest;artifact:{file:string;sri:string};consentPolicyVersion:string}
type SDK=typeof sdkType;
declare global {interface Window {InfraredSDK?:SDK;InfraredBridge:(options:BridgeOptions)=>void;InfraredHost?:{setConsent:(state:Options['consent'])=>void;setContext:(context:Options['context'])=>void;setEligible:(eligible:boolean)=>void;destroy:()=>void}}}
window.InfraredBridge=function(options:BridgeOptions) {
 if(window.InfraredHost)return;
 if(!validCollectorOrigin(options.endpoint)||!validSDKArtifact(options.artifact))return;
 const whole=options.installationManifest.collection_mode==='whole_site';if(whole&&!validRules(options.installationManifest.rules))return;
 // Whole-site mode derives the page from the canonical path; the host only grants consent and may mark areas ineligible.
 const siteKey=()=>{const path=canonicalPath(location.pathname,options.installationManifest.rules!);return path?pathKey(path):'unknown';};
 let consent:Options['consent']='unknown',context:Options['context']=whole?{eligible:true,pageKey:siteKey(),revision:'auto',locale:'auto',variant:'control',state:'public-default'}:{eligible:false,pageKey:'unknown',revision:'UNKNOWN',locale:'unknown',variant:'unknown',state:'unknown'},loading:Promise<void>|undefined,version=0;
 const selected=()=>whole?{page_key:siteKey()}:matchPage(location.href,options.installationManifest.pages);
 const allowed=()=>consent==='granted'&&context.eligible&&context.pageKey!=='unknown'&&selected()?.page_key===context.pageKey&&navigator.doNotTrack!=='1'&&!(navigator as any).globalPrivacyControl;
 async function sync() {
  const v=++version;
  if(!allowed()){window.InfraredSDK?.setContext({...context,eligible:false});window.InfraredSDK?.setConsent(consent,options.consentPolicyVersion);return;}
  try {
   if(!window.InfraredSDK){loading??=new Promise<void>((resolve,reject)=>{const script=document.createElement('script');script.src=options.endpoint+'/sdk/v1/'+options.artifact.file;script.integrity=options.artifact.sri;script.crossOrigin='anonymous';script.referrerPolicy='no-referrer';script.async=true;script.onload=()=>resolve();script.onerror=()=>{loading=undefined;reject(new Error('SDK_LOAD_FAILED'));};document.head.appendChild(script);});await loading;}
   if(v!==version||!allowed())return;
   await window.InfraredSDK!.init({...options,consent,context});
  }catch{ /* Host navigation never depends on analytics availability. */ }
 }
 const originalPush=history.pushState,originalReplace=history.replaceState;
 // Runs inside the host's history calls, so it must never throw into the host router.
 function navigation(){try{if(whole){const key=siteKey();if(key!==context.pageKey){context={...context,pageKey:key};void sync();}return;}if(selected()?.page_key!==context.pageKey){context={...context,eligible:false};void sync();}else if(!allowed())void sync();}catch{/* ignored */}}
 history.pushState=function(...args){const r=originalPush.apply(this,args);navigation();return r;};
 history.replaceState=function(...args){const r=originalReplace.apply(this,args);navigation();return r;};
 window.addEventListener('popstate',navigation);
 const onConsent=(event:Event)=>window.InfraredHost?.setConsent((event as CustomEvent).detail),onContext=(event:Event)=>window.InfraredHost?.setContext((event as CustomEvent).detail);
 window.addEventListener('infrared:consent',onConsent);window.addEventListener('infrared:context',onContext);
 // Malformed host input never grants collection: bad consent becomes denied, a bad context becomes ineligible.
 window.InfraredHost={setConsent(next){consent=validConsent(next)?next:'denied';void sync();},setContext(next){if(whole){context={...context,eligible:validHostContext(next)&&next.eligible};void sync();return;}context=validHostContext(next)?structuredClone(next):{...context,eligible:false};void sync();},setEligible(next){context={...context,eligible:next===true};void sync();},destroy(){version++;window.InfraredSDK?.destroy();history.pushState=originalPush;history.replaceState=originalReplace;window.removeEventListener('popstate',navigation);window.removeEventListener('infrared:consent',onConsent);window.removeEventListener('infrared:context',onContext);delete window.InfraredHost;}};
};

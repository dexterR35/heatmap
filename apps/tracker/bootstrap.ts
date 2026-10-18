import {matchPage} from '../../packages/domain/matcher.js';
import {validCollectorOrigin,validSDKArtifact} from '../../packages/domain/endpoint.js';
import type {Manifest,Options,sdk as sdkType} from './tracker.js';
interface BridgeOptions {siteKey:string;endpoint:string;installationManifest:Manifest;artifact:{file:string;sri:string};consentPolicyVersion:string}
type SDK=typeof sdkType;
declare global {interface Window {NBHeatmap?:SDK;NBHeatmapBridge:(options:BridgeOptions)=>void;NBHeatmapHost?:{setConsent:(state:Options['consent'])=>void;setContext:(context:Options['context'])=>void;destroy:()=>void}}}
window.NBHeatmapBridge=function(options:BridgeOptions) {
 if(window.NBHeatmapHost)return;
 if(!validCollectorOrigin(options.endpoint)||!validSDKArtifact(options.artifact))return;
 let consent:Options['consent']='unknown',context:Options['context']={eligible:false,pageKey:'unknown',revision:'UNKNOWN',locale:'unknown',variant:'unknown',state:'unknown'},loading:Promise<void>|undefined,version=0;
 const selected=()=>matchPage(location.href,options.installationManifest.pages);
 const allowed=()=>consent==='granted'&&context.eligible&&selected()?.page_key===context.pageKey&&navigator.doNotTrack!=='1'&&!(navigator as any).globalPrivacyControl;
 async function sync() {
  const v=++version;
  if(!allowed()){window.NBHeatmap?.setContext({...context,eligible:false});window.NBHeatmap?.setConsent(consent,options.consentPolicyVersion);return;}
  try {
   if(!window.NBHeatmap){loading??=new Promise<void>((resolve,reject)=>{const script=document.createElement('script');script.src=options.endpoint+'/sdk/v1/'+options.artifact.file;script.integrity=options.artifact.sri;script.crossOrigin='anonymous';script.referrerPolicy='no-referrer';script.async=true;script.onload=()=>resolve();script.onerror=()=>{loading=undefined;reject(new Error('SDK_LOAD_FAILED'));};document.head.appendChild(script);});await loading;}
   if(v!==version||!allowed())return;
   await window.NBHeatmap!.init({...options,consent,context});
  }catch{ /* Host navigation never depends on analytics availability. */ }
 }
 const originalPush=history.pushState,originalReplace=history.replaceState;
 function navigation(){if(selected()?.page_key!==context.pageKey){context={...context,eligible:false};void sync();}else if(!allowed())void sync();}
 history.pushState=function(...args){const r=originalPush.apply(this,args);navigation();return r;};
 history.replaceState=function(...args){const r=originalReplace.apply(this,args);navigation();return r;};
 window.addEventListener('popstate',navigation);
 const onConsent=(event:Event)=>window.NBHeatmapHost?.setConsent((event as CustomEvent).detail),onContext=(event:Event)=>window.NBHeatmapHost?.setContext((event as CustomEvent).detail);
 window.addEventListener('nb:analytics-consent',onConsent);window.addEventListener('nb:page-context',onContext);
 window.NBHeatmapHost={setConsent(next){consent=next;void sync();},setContext(next){context=structuredClone(next);void sync();},destroy(){version++;window.NBHeatmap?.destroy();history.pushState=originalPush;history.replaceState=originalReplace;window.removeEventListener('popstate',navigation);window.removeEventListener('nb:analytics-consent',onConsent);window.removeEventListener('nb:page-context',onContext);delete window.NBHeatmapHost;}};
};

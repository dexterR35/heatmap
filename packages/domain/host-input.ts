// Values arriving from the host page or the collector are untrusted until checked here.
import {validRules} from './site-paths.js';
export type Consent='unknown'|'granted'|'denied';
export interface HostContext {eligible:boolean;pageKey:string;revision:string;locale:string;variant:string;state:string;campaign?:string;acquisitionId?:string}
const label=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=128;
const record=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const labels=(value:unknown,max:number)=>Array.isArray(value)&&value.length<=max&&value.every(label);
export const validConsent=(value:unknown):value is Consent=>value==='unknown'||value==='granted'||value==='denied';
export function validHostContext(value:unknown):value is HostContext {
 if(!record(value)||typeof value.eligible!=='boolean')return false;
 return ['pageKey','revision','locale','variant','state'].every(k=>label(value[k]))&&['campaign','acquisitionId'].every(k=>value[k]===undefined||label(value[k]));
}
export function validPublicConfig(value:unknown):boolean {
 if(record(value)&&value.collection_mode!==undefined&&(value.collection_mode!=='whole_site'||!validRules(value.rules)||!labels(value.site_elements,200)||!labels(value.site_actions,100)||!labels(value.disabled_page_keys,1000)))return false;
 if(!record(value)||value.schema_version!==2||typeof value.enabled!=='boolean'||!Array.isArray(value.pages)||value.pages.length>32)return false;
 if(!Number.isSafeInteger(value.config_version)||typeof value.sample_rate!=='number'||!(value.sample_rate>=0&&value.sample_rate<=1)||typeof value.expires_in!=='number')return false;
 if(value.features!==undefined&&!labels(value.features,32))return false;
 if(value.journeys!==undefined&&value.journeys!==true)return false;
 return value.pages.every(p=>record(p)&&label(p.page_key)&&record(p.selector)&&['revision','locale','variant','state'].every(k=>label(p[k]))&&labels(p.elements,200)&&labels(p.actions,100)
  &&(p.diagnostics_enabled===undefined||typeof p.diagnostics_enabled==='boolean')&&(p.diagnostic_error_codes===undefined||labels(p.diagnostic_error_codes,64))&&(p.campaign_codes===undefined||labels(p.campaign_codes,64))
  &&(p.approved_contexts===undefined||Array.isArray(p.approved_contexts)&&p.approved_contexts.length<=64&&p.approved_contexts.every(c=>record(c)&&['revision','locale','variant','state'].every(k=>label(c[k])))));
}
// AbortSignal.any is missing on older Safari; without it every send would throw.
export function anySignal(signals:AbortSignal[]):AbortSignal {
 if(typeof AbortSignal.any==='function')return AbortSignal.any(signals);
 const controller=new AbortController();
 for(const signal of signals){if(signal.aborted){controller.abort(signal.reason);break;}signal.addEventListener('abort',()=>controller.abort(signal.reason),{once:true});}
 return controller.signal;
}

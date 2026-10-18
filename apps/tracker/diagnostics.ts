import type {Event} from '../../packages/contracts/events.js';
type Signal=Extract<Event,{type:'diagnostic'|'performance'}>;
type Payload=Signal extends infer E?E extends Signal?Omit<E,'event_id'|'seq'|'elapsed_ms'|'segment_id'|'viewport'>:never:never;
interface Hooks {active:()=>boolean;privateTarget:(el:Element,x:number,y:number,coordinates?:boolean)=>boolean;emit:(payload:Payload)=>unknown;errorCodes:string[]}
// No error messages, stacks, file names, URLs, DOM text, selectors or input values.
export function installDiagnostics(h:Hooks){
 let budget=40;const cleanups:(()=>void)[]=[],pending=new Set<()=>void>(),sentErrors=new Set<string>(),metricCounts=new Map<string,number>();
 const emit=(p:Payload)=>{if(h.active()&&budget>0){budget--;h.emit(p);}};
 const metric=(name:Extract<Payload,{type:'performance'}>['metric'],value:number)=>{const count=metricCounts.get(name)??0;if(count>=4||!Number.isFinite(value)||value<0)return;metricCounts.set(name,count+1);emit({type:'performance',metric:name,value:Math.min(name==='layout_shift'?1000:120000,value)});};
 const error=(kind:'runtime_error'|'unhandled_rejection',code:string)=>{if(!h.errorCodes.includes(code)||sentErrors.has(code))return;sentErrors.add(code);emit({type:'diagnostic',kind,code});};
 const runtime=(event:ErrorEvent)=>{if(event.target instanceof Element&&h.privateTarget(event.target,0,0,false))return;error('runtime_error','runtime-error');};
 const rejection=()=>error('unhandled_rejection','unhandled-rejection');
 window.addEventListener('error',runtime);window.addEventListener('unhandledrejection',rejection);cleanups.push(()=>{window.removeEventListener('error',runtime);window.removeEventListener('unhandledrejection',rejection);});
 const observe=(type:string,fn:(entries:PerformanceEntry[])=>void,options:Record<string,unknown>={})=>{try{if(!PerformanceObserver.supportedEntryTypes.includes(type))return;const o=new PerformanceObserver(list=>{if(h.active())fn(list.getEntries());});o.observe({type,buffered:true,...options});cleanups.push(()=>o.disconnect());}catch{/* Unsupported metric stays unavailable. */}};
 observe('navigation',entries=>{for(const entry of entries){const n=entry as PerformanceNavigationTiming;if(n.loadEventEnd>0)metric('navigation_load_ms',n.loadEventEnd-n.startTime);}});
 observe('paint',entries=>{for(const e of entries)if(e.name==='first-contentful-paint')metric('fcp_ms',e.startTime);});
 observe('largest-contentful-paint',entries=>{for(const e of entries){const node=(e as PerformanceEntry&{element?:Element}).element;if(node&&h.privateTarget(node,0,0,false))continue;metric('lcp_ms',e.startTime);}});
 observe('event',entries=>{for(const e of entries){const target=(e as PerformanceEntry&{target?:Element}).target;if(!target||h.privateTarget(target,0,0,false))continue;metric('interaction_latency_ms',e.duration);}},{durationThreshold:40,buffered:false});
 let shifts=0;observe('layout-shift',entries=>{for(const e of entries){const shift=e as PerformanceEntry&{hadRecentInput:boolean;value:number;sources?:{node?:Node}[]};if(shift.hadRecentInput||shift.sources?.some(s=>s.node instanceof Element&&h.privateTarget(s.node,0,0,false)))continue;shifts+=shift.value;}if(shifts>0)metric('layout_shift',shifts);},{buffered:false});
 return {
  click(target:Element,clickId:string,elementId?:string){
   if(!h.active()||budget<=0||pending.size>=5||!target.closest('button,a,[role="button"],[data-hm-action]'))return;
   const x=scrollX,y=scrollY;let responded=false;
   const changed=()=>{responded=true;};
   const observer=new MutationObserver(records=>{if(records.some(r=>{const el=r.target instanceof Element?r.target:r.target.parentElement;return el&&!h.privateTarget(el,0,0,false);})){responded=true;}});
   observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['aria-expanded','aria-busy','disabled','class','hidden']});
   window.addEventListener('pagehide',changed);window.addEventListener('popstate',changed);window.addEventListener('hashchange',changed);
   const finish=()=>{observer.disconnect();window.removeEventListener('pagehide',changed);window.removeEventListener('popstate',changed);window.removeEventListener('hashchange',changed);clearTimeout(timer);pending.delete(finish);};
   const timer=setTimeout(()=>{const eligible=h.active()&&target.isConnected&&!h.privateTarget(target,0,0,false);finish();if(eligible&&!responded&&scrollX===x&&scrollY===y)emit({type:'diagnostic',kind:'dead_click',related_event_id:clickId,...(elementId?{element_id:elementId}:{})});},1000);
   pending.add(finish);
  },
  destroy(){for(const fn of cleanups)fn();for(const fn of [...pending])fn();budget=0;},
 };
}

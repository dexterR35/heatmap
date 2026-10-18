import type {Event} from '../contracts/events.js';
import type {SegmentFact} from './metrics.js';
export interface ObservationPoint {x:number;y:number;element_id?:string;x_fraction?:number;y_fraction?:number;layer:string;visual_scale:number;visual_offset_x?:number;visual_offset_y?:number}
export interface Journey {exposures:Record<string,number>;first_actions:Record<string,number>;last_actions:Record<string,number>}
export interface Diagnostics {rage_clicks:number;dead_clicks:number;runtime_errors:number;unhandled_rejections:number;rage_points:ObservationPoint[];dead_points:ObservationPoint[]}
export const actionKey=(element:string,action:string)=>element+'|'+action;
export function enrichFacts(events:Event[],segments:Record<string,SegmentFact>){
 const ordered=[...events].sort((a,b)=>a.elapsed_ms-b.elapsed_ms||a.seq-b.seq||a.event_id.localeCompare(b.event_id));
 const clicks=new Map(events.filter((e):e is Extract<Event,{type:'click'}>=>e.type==='click').map(e=>[e.event_id,e]));
 const recent:Extract<Event,{type:'click'}>[]=[],lastRage=new Map<string,number>(),deadClicks=new Set<string>();
 const delivery={retry_attempts:0,dropped_events:0,transport_failures:0};let pageViewAt:number|null=null;
 for(const e of ordered){const s=segments[e.segment_id];if(!s)continue;
  const journey=s.journey??={exposures:Object.create(null),first_actions:Object.create(null),last_actions:Object.create(null)};
  const d=s.diagnostics??={rage_clicks:0,dead_clicks:0,runtime_errors:0,unhandled_rejections:0,rage_points:[],dead_points:[]};
  const performance=s.performance??=Object.create(null);
  if(e.type==='page_view')pageViewAt=pageViewAt===null?e.elapsed_ms:Math.min(pageViewAt,e.elapsed_ms);
  if(e.type==='exposure')journey.exposures[e.element_id]=Math.min(journey.exposures[e.element_id]??Infinity,e.elapsed_ms);
  if(e.type==='activation'){const key=actionKey(e.element_id??'',e.action_id);journey.first_actions[key]=Math.min(journey.first_actions[key]??Infinity,e.elapsed_ms);journey.last_actions[key]=Math.max(journey.last_actions[key]??-Infinity,e.elapsed_ms);}
  if(e.type==='click'){
   while(recent.length&&e.elapsed_ms-recent[0].elapsed_ms>1000)recent.shift();
   if(e.layer==='document'&&e.viewport.visual_scale===1){const cluster=recent.filter(c=>c.segment_id===e.segment_id&&Math.hypot(c.document_x-e.document_x,c.document_y-e.document_y)<=32);if(cluster.length>=2&&e.elapsed_ms-(lastRage.get(e.segment_id)??-Infinity)>1000){d.rage_clicks++;if(d.rage_points.length<1000)d.rage_points.push({x:e.document_x,y:e.document_y,element_id:e.target?.element_id,x_fraction:e.target?.x_fraction,y_fraction:e.target?.y_fraction,layer:e.layer,visual_scale:e.viewport.visual_scale,visual_offset_x:e.viewport.visual_offset_x,visual_offset_y:e.viewport.visual_offset_y});lastRage.set(e.segment_id,e.elapsed_ms);}recent.push(e);if(recent.length>100)recent.shift();}
  }
  if(e.type==='diagnostic'){
   if(e.kind==='runtime_error')d.runtime_errors++;
   if(e.kind==='unhandled_rejection')d.unhandled_rejections++;
   if(e.kind==='dead_click'){const c=clicks.get(e.related_event_id);if(c&&!deadClicks.has(c.event_id)&&c.segment_id===e.segment_id&&e.elapsed_ms>=c.elapsed_ms&&e.elapsed_ms-c.elapsed_ms<=5000){deadClicks.add(c.event_id);d.dead_clicks++;if(d.dead_points.length<1000)d.dead_points.push({x:c.document_x,y:c.document_y,element_id:c.target?.element_id,x_fraction:c.target?.x_fraction,y_fraction:c.target?.y_fraction,layer:c.layer,visual_scale:c.viewport.visual_scale,visual_offset_x:c.viewport.visual_offset_x,visual_offset_y:c.viewport.visual_offset_y});}}
  }
  if(e.type==='performance')performance[e.metric]=Math.max(performance[e.metric]??0,e.value);
  if(e.type==='delivery')for(const key of ['retry_attempts','dropped_events','transport_failures'] as const)delivery[key]=Math.max(delivery[key],e[key]);
 }
 return {page_view_at:pageViewAt,delivery};
}
export function percentile(values:number[],p:number){if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.max(0,Math.ceil(sorted.length*p)-1)];}
export function wilson(successes:number,total:number){if(!total)return null;const z=1.96,p=successes/total,den=1+z*z/total,center=(p+z*z/(2*total))/den,half=z*Math.sqrt(p*(1-p)/total+z*z/(4*total*total))/den;return {low:Math.max(0,100*(center-half)),high:Math.min(100,100*(center+half)),confidence:0.95};}
export function engagement(views:{facts:any;segments:SegmentFact[]}[],cta:string,action:string){
 let exposed=0,activated=0,ordered=0,engaged=0,quickExits=0;const delays:number[]=[],performance=new Map<string,number[]>();
 const diagnostics={rage_clicks:0,dead_clicks:0,runtime_errors:0,unhandled_rejections:0,affected_views:0};const delivery={retry_attempts:0,dropped_events:0,transport_failures:0};
 for(const v of views){const e=v.segments.some(s=>s.exposures.includes(cta)),a=v.segments.some(s=>s.actions.includes(action));exposed+=+e;activated+=+a;
  const key=actionKey(cta,action),exposure=Math.min(...v.segments.map(s=>s.journey?.exposures[cta]??Infinity)),last=Math.max(...v.segments.map(s=>s.journey?.last_actions[key]??-Infinity));
  ordered+=+(v.facts.page_view_at!==null&&Number.isFinite(exposure)&&exposure>=(v.facts.page_view_at??0)&&last>=exposure);
  const first=Math.min(...v.segments.flatMap(s=>Object.entries(s.journey?.first_actions??{}).filter(([k])=>k.endsWith('|'+action)).map(([,at])=>at)));if(Number.isFinite(first))delays.push(Math.max(0,first-(v.facts.page_view_at??0)));
  const visible=v.segments.reduce((n,s)=>n+s.visible_ms,0);engaged+=+(a||visible>=10000||v.segments.some(s=>s.reach>=75));quickExits+=+(!a&&visible>0&&visible<10000);
  let affected=false;const perView=new Map<string,number>();
  for(const s of v.segments){for(const k of ['rage_clicks','dead_clicks','runtime_errors','unhandled_rejections'] as const){const n=s.diagnostics?.[k]??0;diagnostics[k]+=n;affected||=n>0;}for(const[k,n]of Object.entries(s.performance??{}))perView.set(k,Math.max(perView.get(k)??0,n));}
  for(const[k,n]of perView){const arr=performance.get(k)??[];arr.push(n);performance.set(k,arr);}diagnostics.affected_views+=+affected;
  for(const k of ['retry_attempts','dropped_events','transport_failures'] as const)delivery[k]+=v.facts.delivery?.[k]??0;
 }
 const total=views.length;
 return {funnel:{views:total,exposed_views:exposed,activated_views:activated,ordered_activated_views:ordered,exposure_rate:total?100*exposed/total:0,ordered_activation_rate:exposed?100*ordered/exposed:0,confidence: wilson(ordered,exposed),definition:'Page view, qualified primary CTA exposure, then activation of that CTA; within the selected view cohort.'},engagement:{engaged_views:engaged,quick_exit_views:quickExits,median_first_action_ms:percentile(delays,0.5),first_action_samples:delays.length},diagnostics,delivery,performance:[...performance].map(([metric,values])=>({metric,samples:values.length,p50:percentile(values,0.5),p75:percentile(values,0.75),p95:percentile(values,0.95)}))};
}

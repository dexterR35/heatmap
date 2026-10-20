import type {BehaviourFacts,SegmentFact} from './metrics.js';
import {percentile} from './advanced.js';

// One confirmed page view as the report sees it.
export interface BehaviourView {view_id:string;country:string|null;context:Record<string,unknown>;behaviour?:BehaviourFacts;segments:SegmentFact[];activated:boolean}
export interface Bucket {key:string;views:number;activated:number;activation_rate:number}
const rate=(n:number,d:number)=>d?100*n/d:0;

// Groups views by one dimension. On real sites, buckets below the privacy minimum are merged into "other".
export function breakdown(views:BehaviourView[],keyOf:(v:BehaviourView)=>string|undefined|null,minimum:number,limit=12){
 const map=new Map<string,{views:number;activated:number}>();let unknown=0;
 for(const v of views){const k=keyOf(v);if(!k){unknown++;continue;}const b=map.get(k)??{views:0,activated:0};b.views++;b.activated+=+v.activated;map.set(k,b);}
 const sorted=[...map].sort((a,b)=>b[1].views-a[1].views||a[0].localeCompare(b[0]));
 const rows:Bucket[]=[],other={views:0,activated:0};let suppressed=0;
 for(const [key,b] of sorted){if(b.views<minimum||rows.length>=limit){other.views+=b.views;other.activated+=b.activated;if(b.views<minimum)suppressed++;continue;}rows.push({key,...b,activation_rate:rate(b.activated,b.views)});}
 return {rows,other:{...other,activation_rate:rate(other.activated,other.views)},unknown,suppressed_buckets:suppressed};
}

export function audience(views:BehaviourView[],minimum:number){
 const src=(v:BehaviourView)=>v.behaviour?.source,cli=(v:BehaviourView)=>v.behaviour?.client;
 return {
  channel:breakdown(views,v=>src(v)?.channel,minimum),engine:breakdown(views,v=>src(v)?.engine,minimum),
  utm_source:breakdown(views,v=>src(v)?.utm_source,minimum),utm_campaign:breakdown(views,v=>src(v)?.utm_campaign,minimum),
  browser:breakdown(views,v=>cli(v)?.browser,minimum),os:breakdown(views,v=>cli(v)?.os,minimum),device:breakdown(views,v=>cli(v)?.device,minimum),
  language:breakdown(views,v=>cli(v)?.language,minimum),country:breakdown(views,v=>v.country,minimum),
 };
}

// Average visible milliseconds per 5% band of the page, across segments that reported attention.
export function attentionBands(segments:SegmentFact[]){
 const reported=segments.filter(s=>s.attention?.length===20);
 const bands=Array.from({length:20},(_,i)=>reported.length?reported.reduce((n,s)=>n+s.attention![i],0)/reported.length:0);
 return {bands,segments:reported.length};
}

export function formFunnels(views:BehaviourView[]){
 const forms=new Map<string,{started:number;submitted:number;durations:number[];fields:Map<string,{reached:number;completions:number;filled:number;errors:number;ms:number;drop_offs:number}>}>();
 for(const v of views)for(const [id,f] of Object.entries(v.behaviour?.forms??{})){
  const form=forms.get(id)??{started:0,submitted:0,durations:[] as number[],fields:new Map()};forms.set(id,form);
  form.started+=+f.started;form.submitted+=+f.submitted;if(f.submitted&&f.duration_ms!==undefined)form.durations.push(f.duration_ms);
  for(const [field,x] of Object.entries(f.fields)){const s=form.fields.get(field)??{reached:0,completions:0,filled:0,errors:0,ms:0,drop_offs:0};form.fields.set(field,s);s.reached++;s.completions+=x.completions;s.filled+=x.filled;s.errors+=x.errors;s.ms+=x.ms;}
  if(f.started&&!f.submitted&&f.last_field){const s=form.fields.get(f.last_field);if(s)s.drop_offs++;}
 }
 return [...forms].map(([form_id,f])=>({form_id,started:f.started,submitted:f.submitted,completion_rate:rate(f.submitted,f.started),median_duration_ms:percentile(f.durations,0.5),
  fields:[...f.fields].map(([field_id,x])=>({field_id,reached:x.reached,reach_rate:rate(x.reached,f.started),filled_rate:rate(x.filled,x.completions),errors:x.errors,avg_ms:x.completions?x.ms/x.completions:0,drop_offs:x.drop_offs,drop_off_rate:rate(x.drop_offs,f.started)})).sort((a,b)=>b.reached-a.reached)})).sort((a,b)=>b.started-a.started);
}

// Hesitation: views that hovered a registered element but never clicked or activated it.
export function hoverStats(views:BehaviourView[],elements:string[]){
 return elements.map(id=>{
  let hovered=0,ms=0,count=0,noClick=0;
  for(const v of views){const h=v.behaviour?.hover?.[id];if(!h)continue;hovered++;ms+=h.ms;count+=h.count;
   if(!v.segments.some(s=>(s.element_clicks[id]??0)>0||s.activated_elements.includes(id)))noClick++;}
  return {element_id:id,hovered_views:hovered,hover_rate:rate(hovered,views.length),avg_hover_ms:count?ms/count:0,hovered_without_click:noClick,hesitation_rate:rate(noClick,hovered)};
 }).filter(h=>h.hovered_views>0);
}

export function exitSummary(views:BehaviourView[]){
 const kinds={link:0,exit_intent:0,hidden:0};const reach:number[]=[];let unknown=0;
 for(const v of views){const e=v.behaviour?.exit;if(!e){unknown++;continue;}kinds[e.kind]++;reach.push(e.reach_percent);}
 return {...kinds,unknown,median_exit_reach:percentile(reach,0.5)};
}

export function engagementSummary(views:BehaviourView[]){
 const e=views.map(v=>v.behaviour?.engagement).filter((x):x is NonNullable<typeof x>=>!!x);
 const first=e.map(x=>x.first_interaction_ms).filter((x):x is number=>x!==undefined);
 return {measured_views:e.length,avg_active_seconds:e.length?e.reduce((n,x)=>n+x.active_ms,0)/e.length/1000:0,avg_idle_seconds:e.length?e.reduce((n,x)=>n+x.idle_ms,0)/e.length/1000:0,
  median_first_interaction_ms:percentile(first,0.5),engaged_rate:rate(e.filter(x=>x.active_ms>=10000).length,e.length),interaction_rate:rate(first.length,e.length)};
}

// Journeys around this page: where visitors came from within the tab, and where they went next.
export function journeySummary(views:BehaviourView[],sessionViews:{session_id:string;session_seq:number;page_key:string}[],minimum:number){
 const index=new Map(sessionViews.map(s=>[s.session_id+':'+s.session_seq,s.page_key]));
 const inJourney=views.filter(v=>typeof v.context.session_id==='string'&&typeof v.context.session_seq==='number');
 if(!inJourney.length)return null;
 const prev=new Map<string,number>(),next=new Map<string,number>();let entries=0,exits=0;
 for(const v of inJourney){const id=v.context.session_id as string,seq=v.context.session_seq as number;
  if(seq===1)entries++;else{const p=index.get(id+':'+(seq-1))??'(not recorded)';prev.set(p,(prev.get(p)??0)+1);}
  const n=index.get(id+':'+(seq+1));if(n)next.set(n,(next.get(n)??0)+1);else exits++;}
 const top=(m:Map<string,number>)=>{const rows=[...m].sort((a,b)=>b[1]-a[1]).map(([page_key,views])=>({page_key,views}));return {rows:rows.filter(r=>r.views>=minimum).slice(0,8),suppressed:rows.filter(r=>r.views<minimum).reduce((n,r)=>n+r.views,0)};};
 return {views:inJourney.length,entry_rate:rate(entries,inJourney.length),exit_rate:rate(exits,inJourney.length),previous:top(prev),next:top(next)};
}

import {engagement} from './advanced.js';
import {deviceForWidth,type SegmentFact} from './metrics.js';

export interface ChartView {
 started_at:string|Date;facts:any;segments:SegmentFact[];
 received_events?:number;delayed_events?:number;
}
export interface ActivityPoint {
 date:string;suppressed:boolean;
 views:number|null;clicks:number|null;exposed_views:number|null;
 activations:number|null;ordered_activations:number|null;
 rage_clicks:number|null;dead_clicks:number|null;errors:number|null;
 retry_attempts:number|null;dropped_events:number|null;transport_failures:number|null;
 received_events:number|null;delayed_events:number|null;
 performance:ReturnType<typeof engagement>['performance'];
}

/** Calendar days keep their true spacing. Suppressed buckets are gaps, never zero. */
export function activitySeries(views:ChartView[],from:string,to:string,cta:string,action:string,minimum=0):ActivityPoint[]{
 const start=new Date(from),end=new Date(to);start.setUTCHours(0,0,0,0);
 if(!Number.isFinite(+start)||!Number.isFinite(+end)||+end<+start||+end-+start>94*86400000)throw new Error('CHART_DATE_RANGE');
 const groups=new Map<string,ChartView[]>();
 for(const view of views){const date=new Date(view.started_at).toISOString().slice(0,10),group=groups.get(date)??[];group.push(view);groups.set(date,group);}
 const points:ActivityPoint[]=[];
 for(let at=+start;at<+end;at+=86400000){
  const date=new Date(at).toISOString().slice(0,10),group=groups.get(date)??[],hidden=group.length<minimum;
  const value=(n:number)=>hidden?null:n;
  const a=engagement(group,cta,action);
  points.push({date,suppressed:hidden,views:value(group.length),clicks:value(group.reduce((n,v)=>n+v.segments.reduce((n,s)=>n+s.clicks,0),0)),exposed_views:value(a.funnel.exposed_views),activations:value(a.funnel.activated_views),ordered_activations:value(a.funnel.ordered_activated_views),rage_clicks:value(a.diagnostics.rage_clicks),dead_clicks:value(a.diagnostics.dead_clicks),errors:value(a.diagnostics.runtime_errors+a.diagnostics.unhandled_rejections),retry_attempts:value(a.delivery.retry_attempts),dropped_events:value(a.delivery.dropped_events),transport_failures:value(a.delivery.transport_failures),received_events:value(group.reduce((n,v)=>n+(v.received_events??0),0)),delayed_events:value(group.reduce((n,v)=>n+(v.delayed_events??0),0)),performance:hidden?[]:a.performance});
 }
 return points;
}

/** Segment counts form a partition; a resized view can contribute multiple segments. */
export function segmentDevices(views:ChartView[],minimum=0){
 return ['desktop','tablet','mobile'].map(device=>{const cohort=views.filter(v=>v.segments.some(s=>deviceForWidth(s.width)===device));return {device,segments:cohort.length<minimum?null:cohort.reduce((n,v)=>n+v.segments.filter(s=>deviceForWidth(s.width)===device).length,0),suppressed:cohort.length<minimum};});
}

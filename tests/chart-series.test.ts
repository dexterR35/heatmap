import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {batch} from './fixtures.js';
import {viewFacts,cohortSegments} from '../packages/domain/metrics.js';
import {activitySeries,segmentDevices,type ChartView} from '../packages/domain/chart-series.js';
import type {Event} from '../packages/contracts/events.js';
const cta='hero-register',action='registration-start';
function view(date:string,events:Event[]=batch().events,device='all'):ChartView{const facts=viewFacts(events);return {started_at:date,facts,segments:cohortSegments(facts.segments,device)};}
it('fills actual UTC calendar spacing with observed zeros and leaves absent performance unavailable',()=>{
 const points=activitySeries([view('2026-10-15T23:59:59Z'),view('2026-10-16T00:00:00Z')],'2026-10-14T00:00:00Z','2026-10-18T00:00:00Z',cta,action);
 expect(points.map(p=>[p.date,p.views])).toEqual([['2026-10-14',0],['2026-10-15',1],['2026-10-16',1],['2026-10-17',0]]);expect(points.every(p=>!p.performance.length)).toBe(true);
});
it('shows small real-data daily buckets as null gaps, including zero-count days',()=>{
 const points=activitySeries([view('2026-10-15T12:00:00Z'),view('2026-10-15T13:00:00Z'),view('2026-10-16T12:00:00Z')],'2026-10-15T00:00:00Z','2026-10-18T00:00:00Z',cta,action,2);
 expect(points.map(p=>p.views)).toEqual([2,null,null]);expect(points[1]).toMatchObject({suppressed:true,clicks:null,exposed_views:null,ordered_activations:null,errors:null,delayed_events:null,performance:[]});
});
it('keeps ordered CTA and click metrics in the filtered segment cohort',()=>{
 const b=batch().events[0],mobile={...b,segment_id:randomUUID(),viewport:{...b.viewport,width:390,document_width:390}},events=[b,{...mobile,type:'exposure',elapsed_ms:2000,element_id:cta,qualified_ms:1000,threshold:0.5,first_qualified:true},{...mobile,type:'activation',elapsed_ms:3000,element_id:cta,action_id:action,method:'keyboard'}] as Event[];
 const desktop=activitySeries([view('2026-10-16',events,'desktop')],'2026-10-16','2026-10-17',cta,action)[0],phone=activitySeries([view('2026-10-16',events,'mobile')],'2026-10-16','2026-10-17',cta,action)[0];
 expect(desktop.ordered_activations).toBe(0);expect(phone.ordered_activations).toBe(1);expect(phone.clicks).toBe(0);expect(segmentDevices([view('2026-10-16',events)])).toEqual([{device:'desktop',segments:1,suppressed:false},{device:'tablet',segments:0,suppressed:false},{device:'mobile',segments:1,suppressed:false}]);
});
it('aggregates timing quantiles, linked signals and receipts by view start day without inventing samples',()=>{
 const b=batch().events[0],events=[b,{...b,type:'performance',metric:'lcp_ms',value:1200},{...b,type:'diagnostic',kind:'runtime_error',code:'runtime-error'},{...b,type:'delivery',retry_attempts:2,dropped_events:1,transport_failures:2}] as Event[],v={...view('2026-10-16',events),received_events:4,delayed_events:1};
 const point=activitySeries([v],'2026-10-16','2026-10-17',cta,action)[0];expect(point).toMatchObject({views:1,errors:1,retry_attempts:2,dropped_events:1,received_events:4,delayed_events:1});expect(point.performance).toEqual([{metric:'lcp_ms',samples:1,p50:1200,p75:1200,p95:1200}]);
});
it('bounds the calendar expansion independently of its caller',()=>{expect(()=>activitySeries([],'2026-01-01','2026-12-31',cta,action)).toThrow('CHART_DATE_RANGE');});

import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {batch} from './fixtures.js';
import {viewFacts,cohortSegments} from '../packages/domain/metrics.js';
import {engagement,percentile,wilson} from '../packages/domain/advanced.js';
import type {Event} from '../packages/contracts/events.js';
const base=()=>batch().events[0];
function measure(events:Event[],device='all'){const facts=viewFacts(events);return engagement([{facts,segments:cohortSegments(facts.segments,device)}],'hero-register','registration-start');}
it('requires primary CTA exposure before activation, regardless of receipt order',()=>{
 const b=base(),exposure={...b,type:'exposure',elapsed_ms:2000,element_id:'hero-register',qualified_ms:1000,threshold:0.5,first_qualified:true} as Event,action={...b,type:'activation',elapsed_ms:3000,element_id:'hero-register',action_id:'registration-start',method:'pointer'} as Event;
 expect(measure([action,b,exposure]).funnel.ordered_activated_views).toBe(1);
 expect(measure([b,exposure,{...action,elapsed_ms:1500}]).funnel.ordered_activated_views).toBe(0);
 expect(measure([b,exposure,{...action,element_id:'games-register'} as Event]).funnel.ordered_activated_views).toBe(0);
});
it('keeps the selected device cohort when a view resizes',()=>{
 const b=base(),mobile={...b,segment_id:randomUUID(),viewport:{...b.viewport,width:390,document_width:390}};
 const events=[b,{...mobile,type:'exposure',elapsed_ms:2000,element_id:'hero-register',qualified_ms:1000,threshold:0.5,first_qualified:true},{...mobile,type:'activation',elapsed_ms:3000,element_id:'hero-register',action_id:'registration-start',method:'keyboard'}] as Event[];
 expect(measure(events,'desktop').funnel.ordered_activated_views).toBe(0);expect(measure(events,'mobile').funnel.ordered_activated_views).toBe(1);
});
it('forms bounded repeated-click clusters, links no-response signals once, and retains normalized coordinates',()=>{
 const b=base(),click={...b,type:'click',elapsed_ms:500,document_x:200,document_y:400,client_x:200,client_y:400,layer:'document',pointer:'mouse',event_id:randomUUID(),target:{element_id:'hero-register',x_fraction:0.5,y_fraction:0.5,rect:{x:100,y:380,width:200,height:40}}} as Event;
 const dead={...b,type:'diagnostic',kind:'dead_click',elapsed_ms:1800,related_event_id:click.event_id} as Event;
 const events=[b,click,{...click,event_id:randomUUID(),elapsed_ms:700},{...click,event_id:randomUUID(),elapsed_ms:900},dead,{...dead,event_id:randomUUID()},{...dead,event_id:randomUUID(),related_event_id:randomUUID()}] as Event[];
 const facts=viewFacts(events),s=facts.segments[b.segment_id];expect(s.diagnostics?.rage_clicks).toBe(1);expect(s.diagnostics?.dead_clicks).toBe(1);expect(s.diagnostics?.rage_points[0].x_fraction).toBe(0.5);
});
it('uses per-view performance maxima and cumulative delivery maxima without counting snapshots twice',()=>{
 const b=base(),events=[b,{...b,type:'performance',metric:'lcp_ms',value:2000},{...b,type:'performance',metric:'lcp_ms',value:3000},{...b,type:'delivery',retry_attempts:1,dropped_events:2,transport_failures:3},{...b,type:'delivery',retry_attempts:2,dropped_events:2,transport_failures:4}] as Event[],result=measure(events);
 expect(result.performance[0]).toMatchObject({metric:'lcp_ms',samples:1,p75:3000});expect(result.delivery).toEqual({retry_attempts:2,dropped_events:2,transport_failures:4});
});
it('returns uncertainty and unavailable quantiles honestly for small or absent cohorts',()=>{expect(percentile([],0.75)).toBeNull();expect(wilson(0,0)).toBeNull();expect(wilson(1,1)!.low).toBeLessThan(25);expect(wilson(0,1)!.high).toBeGreaterThan(75);expect(percentile([4,1,2,3],0.75)).toBe(3);});

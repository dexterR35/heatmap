import {it,expect} from 'vitest';
import {requiredSample,sampleRatio,binaryDifference,experimentDecision} from '../packages/domain/experimentation.js';
import {densityGrid,normalisedPoints} from '../packages/heatmap-renderer/index.js';
it('plans independent binary units and reports score-based difference uncertainty',()=>{
 expect(requiredSample(.05,.2)).toBeGreaterThan(8000);expect(requiredSample(.05,.2)).toBeLessThan(9000);
 expect(()=>requiredSample(.8,.5)).toThrow();expect(()=>requiredSample(0,.2)).toThrow();
 expect(sampleRatio(500,500).failed).toBe(false);expect(sampleRatio(900,100).failed).toBe(true);
 const d=binaryDifference(50,1000,100,1000)!;expect(d.difference_pp).toBeCloseTo(5);expect(d.low_pp).toBeGreaterThan(0);expect(d.high_pp).toBeLessThan(10);
 expect(binaryDifference(0,0,1,100)).toBeNull();expect(binaryDifference(0,100,0,100)!.low_pp).toBeLessThan(0);
});
it('does not announce an early, incomplete, biased or generated winner',()=>{
 const a={assigned:1000,rendered:1000,mature:1000,successes:50},b={...a,successes:100};
 const input={kind:'ab',status:'completed',active_days:14,minimum_days:14,required_per_arm:800,control:a,treatment:b,pending:0,source:'recorded'};
 expect(experimentDecision(input).decision).toBe('TREATMENT_IMPROVES');
 expect(experimentDecision({...input,status:'running'}).decision).toBe('INCONCLUSIVE');
 expect(experimentDecision({...input,pending:1}).blockers).toContain('ATTRIBUTION_WINDOW_OPEN');
 expect(experimentDecision({...input,treatment:{...b,rendered:999}}).ready).toBe(false);
 expect(experimentDecision({...input,treatment:{...b,assigned:2000}}).blockers).toContain('ALLOCATION_MISMATCH');
 expect(experimentDecision({...input,source:'seeded'}).decision).toBe('SAMPLE_DATA');
 expect(experimentDecision({...input,kind:'aa',treatment:a}).decision).toBe('AA_CHECK_PASSED');
});
it('makes identical per-view click rates comparable across different traffic volumes',()=>{
 const a=normalisedPoints([{x:50,y:50,weight:10}],100),b=normalisedPoints([{x:50,y:50,weight:100}],1000);
 expect([...densityGrid(a,200,200,32).values]).toEqual([...densityGrid(b,200,200,32).values]);expect(normalisedPoints([{x:1,y:1}],0)).toEqual([]);
});

import {it,expect} from 'vitest';
import {scrollMetrics,viewFacts} from '../packages/domain/metrics.js';
import {densityGrid,heatColor} from '../packages/heatmap-renderer/index.js';
import {batch} from './fixtures.js';
it('separates initial reach from scrolling',()=>{expect(scrollMetrics(0,2000,1000)).toEqual({reach:50,scroll:0});expect(scrollMetrics(1000,2000,1000)).toEqual({reach:100,scroll:100});expect(scrollMetrics(0,500,900)).toEqual({reach:100,scroll:0});});
it('merges cumulative progress using maxima',()=>{const b=batch(),base=b.events[0];const f=viewFacts([base,{...base,type:'progress',max_reach_px:1800,max_reach_percent:90,max_scroll_percent:80,visible_ms:3000,geometry_stable:true},{...base,type:'progress',max_reach_px:2000,max_reach_percent:95,max_scroll_percent:90,visible_ms:5000,geometry_stable:true}]);expect(f.visible_ms).toBe(5000);expect(f.max_reach).toBe(95);});
it('keyboard activations never create heatmap positions',()=>{const base=batch().events[0];expect(viewFacts([{...base,type:'activation',action_id:'registration-start',method:'keyboard'}]).clicks).toBe(0);});
it('density increases with repeated observations and clips safely',()=>{const one=densityGrid([{x:50,y:50}],100,100),two=densityGrid([{x:50,y:50},{x:50,y:50}],100,100);expect(two.max).toBeCloseTo(one.max*2);expect(densityGrid([{x:NaN,y:1}],100,100).max).toBe(0);expect(heatColor(1)).toEqual([226,30,55]);});

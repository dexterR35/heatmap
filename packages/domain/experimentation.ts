import {wilson} from './advanced.js';

// Fixed-horizon, two-sided alpha=.05 and power=.80. Binary, independent units,
// equal allocation; normal-approximation planning, not observed-effect power.
export function requiredSample(baseline:number,relativeEffect:number) {
 const target=baseline*(1+relativeEffect);
 if(!Number.isFinite(baseline)||!Number.isFinite(relativeEffect)||baseline<=0||baseline>=1||relativeEffect<=0||relativeEffect>1||target>=1)throw new Error('INVALID_POWER_PLAN');
 const mean=(baseline+target)/2,difference=target-baseline;
 const n=Math.ceil((1.95996398454*Math.sqrt(2*mean*(1-mean))+.84162123357*Math.sqrt(baseline*(1-baseline)+target*(1-target)))**2/difference**2);
 if(n>10000000)throw new Error('POWER_PLAN_TOO_LARGE');return n;
}
// Abramowitz & Stegun 7.1.26; sufficient for the displayed normal/chi-square tail.
function erfc(x:number){const t=1/(1+.3275911*Math.abs(x)),poly=(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t;const q=poly*Math.exp(-x*x);return x<0?2-q:q;}
export function sampleRatio(a:number,b:number) {
 const n=a+b;if(!n)return {p_value:null,failed:false,threshold:.001};
 const chi=(a-b)**2/n,p=erfc(Math.sqrt(chi/2));return {p_value:Math.min(1,p),failed:p<.001,threshold:.001};
}
export function binaryDifference(a:number,na:number,b:number,nb:number) {
 if(!na||!nb)return null;
 const ca=wilson(a,na)!,cb=wilson(b,nb)!,pa=a/na,pb=b/nb,d=pb-pa;
 // Newcombe independent-proportions interval using Wilson score limits.
 const low=d-Math.sqrt((pb-cb.low/100)**2+(ca.high/100-pa)**2),high=d+Math.sqrt((cb.high/100-pb)**2+(pa-ca.low/100)**2);
 const pooled=(a+b)/(na+nb),se=Math.sqrt(pooled*(1-pooled)*(1/na+1/nb));
 return {difference_pp:100*d,relative_lift:pa?100*d/pa:null,low_pp:100*Math.max(-1,low),high_pp:100*Math.min(1,high),confidence:.95,p_value:se?erfc(Math.abs(d/se)/Math.sqrt(2)):1,method:'Newcombe-Wilson; fixed horizon; two-sided 95%'};
}
export function experimentDecision(input:{kind:string;status:string;active_days:number;minimum_days:number;required_per_arm:number;control:{assigned:number;mature:number;successes:number;rendered:number};treatment:{assigned:number;mature:number;successes:number;rendered:number};pending:number;source:string}) {
 const {control:a,treatment:b}=input,srm=sampleRatio(a.assigned,b.assigned),effect=binaryDifference(a.successes,a.mature,b.successes,b.mature);
 const blockers:string[]=[];
 if(srm.failed)blockers.push('ALLOCATION_MISMATCH');
 if(a.rendered!==a.assigned||b.rendered!==b.assigned)blockers.push('RENDERING_INCOMPLETE');
 if(input.pending)blockers.push('ATTRIBUTION_WINDOW_OPEN');
 if(a.mature<input.required_per_arm||b.mature<input.required_per_arm)blockers.push('INSUFFICIENT_SAMPLE');
 if(input.active_days<input.minimum_days)blockers.push('MINIMUM_DURATION_NOT_MET');
 if(input.status!=='completed')blockers.push('EXPERIMENT_NOT_COMPLETED');
 const ready=!blockers.length;
 let decision='INCONCLUSIVE';
 if(ready&&effect)decision=input.kind==='aa'?(effect.low_pp>0||effect.high_pp<0?'AA_DIFFERENCE_DETECTED':'AA_CHECK_PASSED'):effect.low_pp>0?'TREATMENT_IMPROVES':effect.high_pp<0?'CONTROL_IMPROVES':'NO_CLEAR_DIFFERENCE';
 if(input.source==='seeded')decision='SAMPLE_DATA';
 return {decision,blockers,ready:ready&&input.source!=='seeded',srm,effect,exploratory:!ready,definition:'All assigned eligible units; outcomes within the prespecified window; only fully matured units enter the current rate. Final decisions require completed collection, full maturity and validity checks.'};
}

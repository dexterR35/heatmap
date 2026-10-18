// Reference backend adapter only. Do not import into a browser bundle.
// The actual host owns consent, stable random unit tokens, rendered variants and
// business completions. A key is never emitted to a landing page or URL.
import type {VisitInput,OutcomeInput} from '../packages/contracts/acquisition.js';
type Assignment={visit_id:string;variant:string;revision:string;campaign:string;page_key:string;experiment_id:string|null};
export function acquisitionBackend(endpoint:string,key:string){
 const url=new URL(endpoint);
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||(url.protocol!=='https:'&&!(url.protocol==='http:'&&url.hostname==='127.0.0.1')))throw new Error('Approved HTTPS endpoint required (HTTP allowed only on loopback).');
 if(!/^ak_[A-Za-z0-9_-]{43}$/.test(key))throw new Error('Backend acquisition key required.');
 async function send<T>(path:string,body:unknown):Promise<T>{const response=await fetch(new URL(path,url),{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','X-Acquisition-Key':key},body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});if(!response.ok)throw new Error('ACQUISITION_BACKEND_'+response.status);return await response.json() as T;}
 return {
  assign:(visit:VisitInput)=>send<Assignment>('/v1/acquisition/visits',visit),
  rendered:(assignment:Assignment)=>send('/v1/acquisition/rendered',{visit_id:assignment.visit_id,variant:assignment.variant,revision:assignment.revision}),
  completed:(event:OutcomeInput)=>send('/v1/acquisition/outcomes',event),
  withdraw:(visit_id:string)=>send('/v1/acquisition/withdraw',{visit_id}),
 };
}

import {useSyncExternalStore} from 'react';
// Shared audience segment for every report screen. A small external store (Zustand-style API) without a dependency.
export interface Segments {channel:string;browser:string;os:string;client_device:string;country:string}
const empty:Segments={channel:'',browser:'',os:'',client_device:'',country:''};
let state=empty;const listeners=new Set<()=>void>();
const emit=()=>{for(const l of listeners)l();};
const api={set:(next:Partial<Segments>)=>{state={...state,...next};emit();},clear:()=>{state=empty;emit();}};
export function useSegments(){
 const segments=useSyncExternalStore(l=>{listeners.add(l);return()=>listeners.delete(l);},()=>state,()=>state);
 return {segments,...api};
}
// Query-string parameters for the report API: only the segments that are set.
export const segmentQuery=(s:Segments)=>Object.fromEntries(Object.entries(s).filter(([,v])=>v));

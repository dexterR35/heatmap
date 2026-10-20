// The only browser storage Infrared uses. Journeys are opt-in per site: a tab-only ID in sessionStorage,
// written only after consent, gone when the tab closes, renewed after 30 minutes without a page view,
// and removed as soon as consent is withdrawn.
const JOURNEY_KEY='infrared.journey';
export function readJourney():{id:string;seq:number}|undefined{
 try{
  const now=Date.now(),raw=JSON.parse(sessionStorage.getItem(JOURNEY_KEY)??'null');
  const fresh=raw&&typeof raw.id==='string'&&/^[0-9a-f-]{36}$/.test(raw.id)&&Number.isInteger(raw.seq)&&raw.seq<1000&&now-raw.last<1800000;
  const next={id:fresh?raw.id:crypto.randomUUID(),seq:fresh?raw.seq+1:1};
  sessionStorage.setItem(JOURNEY_KEY,JSON.stringify({...next,last:now}));return next;
 }catch{return undefined;}
}
export function removeJourney(){try{sessionStorage.removeItem(JOURNEY_KEY);}catch{/* storage unavailable */}}

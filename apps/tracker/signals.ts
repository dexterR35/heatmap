import type {Event as TrackedEvent} from '../../packages/contracts/events.js';
type Signal=Extract<TrackedEvent,{type:'attention'|'movement'|'form'|'hover'|'exit'|'engagement'}>;
type Payload=Signal extends infer E?E extends Signal?Omit<E,'event_id'|'seq'|'elapsed_ms'|'segment_id'|'viewport'>:never:never;
interface Hooks {
 active:()=>boolean;privateTarget:(el:Element,x:number,y:number,coordinates?:boolean,path?:EventTarget[])=>boolean;
 emit:(payload:Payload)=>unknown;flush:(keepalive:boolean)=>void;elements:string[];segment:()=>string;reach:()=>number;startedAt:number;
}
const CODE=/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,63}$/,CELL=8,BANDS=20;
// Behaviour signals. Coordinates and durations only: no text, values, URLs or selectors.
export function installSignals(h:Hooks){
 let budget=400;const cleanups:(()=>void)[]=[];
 const emit=(p:Payload)=>{if(h.active()&&budget>0){budget--;h.emit(p);}};
 const on=(target:EventTarget,name:string,fn:(e:any)=>void,capture=false)=>{const safe=(e:Event)=>{try{fn(e);}catch{/* ignored */}};target.addEventListener(name,safe as EventListener,{passive:true,capture});cleanups.push(()=>target.removeEventListener(name,safe as EventListener,{capture}));};
 const now=()=>performance.now();

 // Engagement: active while the visitor interacted within the last 5 s and the page is visible.
 let lastInput=0,firstInteraction:number|undefined,active=0,idle=0,engagementSent='';
 const input=()=>{const t=now();lastInput=t;firstInteraction??=Math.round(t-h.startedAt);};
 for(const name of ['pointerdown','keydown','scroll','wheel','touchstart'])on(window,name,input);

 // Attention: visible time per 5% band of the document, for the current viewport segment.
 let bands=new Array(BANDS).fill(0),bandSegment=h.segment(),attentionSent='';
 // Movement: mouse positions every 100 ms, binned into the same 8 px cells as click maps.
 let cells=new Map<string,number>(),cellSegment=h.segment(),lastMove=0;
 const sendMovement=()=>{if(!cells.size)return;const all=[...cells].map(([k,n])=>{const [x,y]=k.split(':').map(Number);return {x,y,n:Math.min(1000,n)};});cells=new Map();for(let i=0;i<all.length&&i<600;i+=200)emit({type:'movement',cells:all.slice(i,i+200)});};
 on(document,'pointermove',(e:PointerEvent)=>{
  if(e.pointerType!=='mouse'||!h.active())return;const t=now();if(t-lastMove<100)return;lastMove=t;lastInput=t;
  if(!(e.target instanceof Element)||h.privateTarget(e.target,e.clientX,e.clientY,true,e.composedPath()))return;
  if(h.segment()!==cellSegment){cells=new Map();cellSegment=h.segment();}
  const de=document.documentElement,x=Math.floor((e.clientX+scrollX)/CELL)*CELL,y=Math.floor((e.clientY+scrollY)/CELL)*CELL;
  if(x<0||y<0||x>de.scrollWidth||y>de.scrollHeight||cells.size>=2000)return;
  const key=x+':'+y;cells.set(key,(cells.get(key)??0)+1);
 });

 const sendPeriodic=()=>{
  const b=bands.map(Math.round),key=b.join(',');if(b.some(Boolean)&&key!==attentionSent){attentionSent=key;emit({type:'attention',bands:b});}
  const eng=Math.round(active)+':'+Math.round(idle);if(eng!==engagementSent&&(active||idle)){engagementSent=eng;emit({type:'engagement',active_ms:Math.round(active),idle_ms:Math.round(idle),...(firstInteraction!==undefined?{first_interaction_ms:Math.min(86400000,firstInteraction)}:{})});}
  sendMovement();
 };
 let lastTick=now(),ticks=0;
 const tick=setInterval(()=>{try{
  const t=now(),dt=Math.min(2000,t-lastTick);lastTick=t;if(!h.active())return;
  if(t-lastInput<5000)active+=dt;else idle+=dt;
  if(h.segment()!==bandSegment){bands=new Array(BANDS).fill(0);bandSegment=h.segment();attentionSent='';}
  const de=document.documentElement,height=Math.max(de.scrollHeight,innerHeight),top=Math.max(0,scrollY),bottom=Math.min(height,top+innerHeight);
  for(let i=0;i<BANDS;i++){const a=height*i/BANDS,b=height*(i+1)/BANDS,overlap=Math.max(0,Math.min(b,bottom)-Math.max(a,top));if(overlap>0)bands[i]+=dt*overlap/(b-a);}
  if(++ticks%5===0)sendPeriodic();
 }catch{/* ignored */}},1000);
 cleanups.push(()=>clearInterval(tick));

 // Hover on registered elements, reported once the pointer has rested at least 300 ms.
 const hovering=new Map<Element,number>(),hoverCounts=new Map<string,number>();
 const registered=(el:EventTarget|null)=>{const node=el instanceof Element?el.closest('[data-hm-id]'):null,id=node?.getAttribute('data-hm-id')??'';return node&&h.elements.includes(id)?{node,id}:null;};
 on(document,'pointerover',(e:PointerEvent)=>{if(e.pointerType!=='mouse')return;const r=registered(e.target);if(r&&!hovering.has(r.node)&&!h.privateTarget(r.node,0,0,false))hovering.set(r.node,now());});
 on(document,'pointerout',(e:PointerEvent)=>{
  const r=registered(e.target);if(!r)return;const start=hovering.get(r.node);if(start===undefined||(e.relatedTarget instanceof Node&&r.node.contains(e.relatedTarget)))return;
  hovering.delete(r.node);const ms=now()-start,count=hoverCounts.get(r.id)??0;
  if(ms>=300&&count<5){hoverCounts.set(r.id,count+1);emit({type:'hover',element_id:r.id,hover_ms:Math.min(600000,Math.round(ms))});}
 });

 // Exits: a link to another page, the pointer leaving through the top edge, or the tab being hidden.
 let intentAt=0;
 const leaving=(kind:'link'|'exit_intent'|'hidden')=>{emit({type:'exit',kind,reach_percent:Math.min(100,Math.max(0,h.reach()))});if(kind!=='exit_intent'){sendPeriodic();h.flush(true);}};
 on(document,'mouseout',(e:MouseEvent)=>{if(!e.relatedTarget&&e.clientY<=0&&now()-intentAt>10000){intentAt=now();leaving('exit_intent');}});
 on(document,'visibilitychange',()=>{if(document.hidden)leaving('hidden');});

 // Forms that opt in with data-hm-form / data-hm-field. IDs, timing and booleans only: never what was typed.
 const started=new Map<string,number>(),focused=new Map<Element,number>();let formEvents=0;
 const formOf=(el:EventTarget|null)=>{if(!(el instanceof Element))return null;const field=el.closest('[data-hm-field]'),form=el.closest('form[data-hm-form]');const formId=form?.getAttribute('data-hm-form')??'',fieldId=field?.getAttribute('data-hm-field')??'';
  if(!form||!CODE.test(formId)||(field&&(!CODE.test(fieldId)||!form.contains(field)))||el.closest('[data-hm-private],[data-hm-ignore]'))return null;return {form,formId,field,fieldId};};
 const formEmit=(p:Extract<Payload,{type:'form'}>)=>{if(formEvents<300){formEvents++;emit(p);}};
 on(document,'focusin',(e:FocusEvent)=>{const f=formOf(e.target);if(!f?.field)return;if(!started.has(f.formId)){started.set(f.formId,now());formEmit({type:'form',form_id:f.formId,action:'start'});}focused.set(f.field,now());},true);
 on(document,'focusout',(e:FocusEvent)=>{const f=formOf(e.target);if(!f?.field)return;const t=focused.get(f.field);if(t===undefined)return;focused.delete(f.field);
  const input=f.field.matches('input,select,textarea')?f.field as HTMLInputElement:f.field.querySelector('input,select,textarea') as HTMLInputElement|null;
  const filled=!!input&&((input.type==='checkbox'||input.type==='radio')?input.checked:input.value.length>0);
  formEmit({type:'form',form_id:f.formId,field_id:f.fieldId,action:'field_complete',duration_ms:Math.min(86400000,Math.round(now()-t)),filled});},true);
 on(document,'invalid',(e:Event)=>{const f=formOf(e.target);if(f?.field)formEmit({type:'form',form_id:f.formId,field_id:f.fieldId,action:'field_error'});},true);
 on(document,'submit',(e:SubmitEvent)=>{const f=formOf(e.target);if(!f)return;const t=started.get(f.formId);formEmit({type:'form',form_id:f.formId,action:'submit',...(t!==undefined?{duration_ms:Math.min(86400000,Math.round(now()-t))}:{})});sendPeriodic();h.flush(true);},true);

 return {
  click(e:MouseEvent){
   input();
   const link=e.target instanceof Element?e.target.closest('a[href]') as HTMLAnchorElement|null:null;
   if(link&&!link.hasAttribute('download')){try{const to=new URL(link.href,location.href);if((to.protocol==='https:'||to.protocol==='http:')&&(to.origin!==location.origin||to.pathname!==location.pathname||to.search!==location.search))leaving('link');}catch{/* ignored */}}
  },
  destroy(){for(const fn of cleanups)fn();budget=0;},
 };
}

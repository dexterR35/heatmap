import type {ReactNode} from 'react';
import {Compass,DoorOpen,FormInput,Hand,Route,Timer,Users} from 'lucide-react';
import {useSegments,type Segments} from './segment-store.js';

// Reusable building blocks for the audience and behaviour reports.

const pct=(n:number|null|undefined)=>n===null||n===undefined||!Number.isFinite(n)?'—':(Math.round(n*10)/10)+'%';
const secs=(n:number|null|undefined)=>n===null||n===undefined?'—':n<60?Math.round(n)+' s':Math.floor(n/60)+' min '+Math.round(n%60)+' s';
const ms=(n:number|null|undefined)=>n===null||n===undefined?'—':n<1000?Math.round(n)+' ms':secs(n/1000);
const regions=typeof Intl!=='undefined'&&'DisplayNames' in Intl?new Intl.DisplayNames(['en'],{type:'region'}):null;
const nice=(dimension:string,key:string)=>dimension==='country'?(regions?.of(key)??key):key.charAt(0).toUpperCase()+key.slice(1).replaceAll('_',' ');

export function Panel({title,description,icon,label,children}:{title:string;description?:ReactNode;icon?:ReactNode;label:string;children:ReactNode}){
 return <section className="panel analytics-section" aria-label={label}><div className="panel-header"><div><h2>{title}</h2>{description&&<p>{description}</p>}</div>{icon}</div>{children}</section>;
}

export function MetricTile({label,value,hint}:{label:string;value:ReactNode;hint?:string}){
 return <div className="metric-tile"><span>{label}</span><strong>{value}</strong>{hint&&<small>{hint}</small>}</div>;
}

interface Bucket {key:string;views:number;activated:number;activation_rate:number}
interface Breakdown {rows:Bucket[];other:{views:number;activated:number;activation_rate:number};unknown:number;suppressed_buckets:number}
// One dimension (channel, browser, country…): share of views and conversion per value. Clicking a row filters every report.
export function BreakdownTable({title,dimension,data,filter}:{title:string;dimension:string;data:Breakdown;filter?:keyof Segments}){
 const {segments,set}=useSegments();const total=data.rows.reduce((n,r)=>n+r.views,0)+data.other.views;
 if(!total)return <div className="breakdown empty"><h3>{title}</h3><p>No data yet for this view.</p></div>;
 return <div className="breakdown"><h3>{title}</h3><table aria-label={title}><thead><tr><th>{nice('',dimension)}</th><th>Views</th><th>Conversion</th></tr></thead><tbody>
  {data.rows.map(r=>{const active=filter&&segments[filter]===r.key;return <tr key={r.key} className={active?'is-active':''}>
   <td>{filter?<button type="button" className="link-btn" aria-pressed={!!active} onClick={()=>set({[filter]:active?'':r.key})}>{nice(dimension,r.key)}</button>:nice(dimension,r.key)}
    <span className="share" style={{width:100*r.views/total+'%'}}/></td><td>{r.views}</td><td>{pct(r.activation_rate)}</td></tr>;})}
  {data.other.views>0&&<tr className="muted"><td>Other{data.suppressed_buckets?` (${data.suppressed_buckets} small groups hidden for privacy)`:''}</td><td>{data.other.views}</td><td>{pct(data.other.activation_rate)}</td></tr>}
 </tbody></table>{data.unknown>0&&<p className="hint">{data.unknown} views without this information.</p>}</div>;
}

const CHANNELS=['direct','search','social','paid','email','referral','internal','unknown'],BROWSERS=['chrome','safari','firefox','edge','samsung','opera','other'],SYSTEMS=['windows','macos','ios','android','linux','chromeos','other'];
// Shared audience filters. They apply to every report screen through one store.
export function SegmentFilterBar({countries=[]}:{countries?:string[]}){
 const {segments,set,clear}=useSegments();const any=Object.values(segments).some(Boolean);
 const select=(key:keyof Segments,label:string,values:string[])=><label>{label}<select className="input" aria-label={'Segment '+label.toLowerCase()} value={segments[key]} onChange={e=>set({[key]:e.target.value})}><option value="">All</option>{values.map(v=><option key={v} value={v}>{nice(key==='country'?'country':'',v)}</option>)}</select></label>;
 return <div className="segment-bar" role="group" aria-label="Audience segment">
  {select('channel','Source',CHANNELS)}{select('client_device','Device type',['mobile','tablet','desktop'])}{select('browser','Browser',BROWSERS)}{select('os','OS',SYSTEMS)}
  {select('country','Country',[...new Set([...countries,...(segments.country?[segments.country]:[])])].sort())}
  {any&&<button type="button" className="btn" onClick={clear}>Clear segment</button>}
 </div>;
}

// Average visible time per 5% band of the page, as a vertical heat strip.
export function AttentionStrip({bands}:{bands:number[]}){
 const max=Math.max(1,...bands);
 return <ol className="attention-strip" aria-label="Attention by page depth">{bands.map((v,i)=><li key={i} style={{'--heat':v/max} as React.CSSProperties}><span>{i*5}–{i*5+5}%</span><b>{ms(v)}</b></li>)}</ol>;
}

export function AudiencePanel({report}:{report:any}){
 const a=report.behaviour?.audience;if(!a)return null;
 return <Panel title="Who arrives, and how" label="Audience and sources" icon={<Users size={20}/>} description="Consented views by traffic source and device. Click a value to filter every report.">
  <div className="breakdown-grid">
   <BreakdownTable title="Source" dimension="channel" data={a.channel} filter="channel"/>
   <BreakdownTable title="Search engine or network" dimension="engine" data={a.engine}/>
   <BreakdownTable title="UTM source" dimension="utm_source" data={a.utm_source}/>
   <BreakdownTable title="UTM campaign" dimension="utm_campaign" data={a.utm_campaign}/>
   <BreakdownTable title="Device type" dimension="device" data={a.device} filter="client_device"/>
   <BreakdownTable title="Browser" dimension="browser" data={a.browser} filter="browser"/>
   <BreakdownTable title="Operating system" dimension="os" data={a.os} filter="os"/>
   <BreakdownTable title="Country" dimension="country" data={a.country} filter="country"/>
   <BreakdownTable title="Language" dimension="language" data={a.language}/>
  </div>
 </Panel>;
}

export function BehaviourPanels({report}:{report:any}){
 const b=report.behaviour;if(!b)return null;const e=b.engagement,x=b.exits,exitTotal=x.link+x.exit_intent+x.hidden;
 return <>
  <Panel title="Engagement" label="Engagement" icon={<Timer size={20}/>} description="Active time counts only while the visitor interacts with a visible page.">
   <div className="metric-row">
    <MetricTile label="Active time per view" value={secs(e.avg_active_seconds)}/><MetricTile label="Idle time per view" value={secs(e.avg_idle_seconds)}/>
    <MetricTile label="First interaction" value={ms(e.median_first_interaction_ms)} hint="median"/><MetricTile label="Engaged views" value={pct(e.engaged_rate)} hint="10 s or more active"/>
   </div>
  </Panel>
  <Panel title="Where attention goes" label="Attention by depth" icon={<Compass size={20}/>} description={`Average visible time per 5% of the page · ${b.attention.segments} viewport segments`}>
   {b.attention.segments?<AttentionStrip bands={b.attention.bands}/>:<p className="hint">No attention data yet for this view.</p>}
  </Panel>
  <Panel title="Hesitation on calls to action" label="CTA hover" icon={<Hand size={20}/>} description="Visitors who rested the pointer on an element for at least 300 ms. Desktop only.">
   {b.hover.length?<table className="data-grid" aria-label="CTA hover"><thead><tr><th>Element</th><th>Hovered views</th><th>Avg hover</th><th>Hovered, never clicked</th></tr></thead><tbody>
    {b.hover.map((h:any)=><tr key={h.element_id}><td><code>{h.element_id}</code></td><td>{h.hovered_views}</td><td>{ms(h.avg_hover_ms)}</td><td>{h.hovered_without_click} ({pct(h.hesitation_rate)})</td></tr>)}</tbody></table>:<p className="hint">No hover data yet.</p>}
  </Panel>
  <Panel title="Forms" label="Form analytics" icon={<FormInput size={20}/>} description={<>Field timing and drop-off for forms marked with <code>data-hm-form</code>. What visitors type is never collected.</>}>
   {b.forms.length?b.forms.map((f:any)=><div className="form-funnel" key={f.form_id}>
    <div className="metric-row"><MetricTile label={'Form '+f.form_id} value={f.started+' started'}/><MetricTile label="Submitted" value={f.submitted} hint={pct(f.completion_rate)}/><MetricTile label="Time to submit" value={ms(f.median_duration_ms)} hint="median"/></div>
    <table className="data-grid" aria-label={'Fields of '+f.form_id}><thead><tr><th>Field</th><th>Reached</th><th>Filled</th><th>Errors</th><th>Avg time</th><th>Last field before leaving</th></tr></thead><tbody>
     {f.fields.map((x:any)=><tr key={x.field_id}><td><code>{x.field_id}</code></td><td>{pct(x.reach_rate)}</td><td>{pct(x.filled_rate)}</td><td>{x.errors}</td><td>{ms(x.avg_ms)}</td><td className={x.drop_off_rate>=20?'warn':''}>{x.drop_offs} ({pct(x.drop_off_rate)})</td></tr>)}</tbody></table>
   </div>):<p className="hint">No form data yet. Add <code>data-hm-form</code> to a form and <code>data-hm-field</code> to its fields.</p>}
  </Panel>
  <Panel title="How visits end" label="Exits" icon={<DoorOpen size={20}/>} description="The last exit signal of each view, and how far it had scrolled.">
   <div className="metric-row">
    <MetricTile label="Followed a link" value={pct(exitTotal?100*x.link/exitTotal:null)}/><MetricTile label="Pointer left the top" value={pct(exitTotal?100*x.exit_intent/exitTotal:null)} hint="exit intent, desktop"/>
    <MetricTile label="Tab hidden or closed" value={pct(exitTotal?100*x.hidden/exitTotal:null)}/><MetricTile label="Depth at exit" value={x.median_exit_reach===null?'—':Math.round(x.median_exit_reach)+'%'} hint="median"/>
   </div>
  </Panel>
  {b.journeys&&<Panel title="Journeys" label="Journeys" icon={<Route size={20}/>} description="Pages viewed in the same browser tab. Only on sites with journeys enabled.">
   <div className="metric-row"><MetricTile label="Entry page" value={pct(b.journeys.entry_rate)} hint="first page of the tab"/><MetricTile label="Exit page" value={pct(b.journeys.exit_rate)} hint="no later page recorded"/></div>
   <div className="breakdown-grid">
    {(['previous','next'] as const).map(side=><div className="breakdown" key={side}><h3>{side==='previous'?'Came from':'Went to'}</h3><table aria-label={side==='previous'?'Previous pages':'Next pages'}><tbody>
     {b.journeys[side].rows.map((r:any)=><tr key={r.page_key}><td><code>{r.page_key}</code></td><td>{r.views}</td></tr>)}
     {b.journeys[side].suppressed>0&&<tr className="muted"><td>Small groups hidden for privacy</td><td>{b.journeys[side].suppressed}</td></tr>}</tbody></table></div>)}
   </div>
  </Panel>}
 </>;
}

import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowRight,ArrowUpRight,Info,RefreshCw,TriangleAlert} from 'lucide-react';
import {CampaignCharts} from './chart-loader.js';
import {MoreAnalysis} from './workspace-ui.js';
import {DataTable} from './data-table.js';

type Api=(url:string,body?:unknown,method?:string)=>Promise<any>;
const number=(n:number|undefined)=>new Intl.NumberFormat('en-GB',{maximumFractionDigits:0}).format(n??0);
const percent=(n:number|undefined)=>(n??0).toFixed(1)+'%';

export function CampaignDashboard({api,from,to,device,dataSource,campaign,reloadToken,onPage,scope}:{api:Api;scope?:{market:string;product:string;brand:string};from:string;to:string;device:string;dataSource:string;campaign:string;reloadToken:number;onPage:(value:string)=>void}){
 const[snapshot,setSnapshot]=useState<{query:string;data:any}|null>(null),[error,setError]=useState(''),[tableSearch,setTableSearch]=useState('');
 const query=new URLSearchParams({from,to,device,data_source:dataSource,...Object.fromEntries(Object.entries(scope??{}).filter(([,v])=>v)),...(campaign?{campaign}:{})}).toString();
 const data=snapshot?.query===query?snapshot.data:null;
 const requestVersion=useRef(0);
 const load=useCallback(async()=>{
  const version=++requestVersion.current;
  try{const next=await api('/api/campaigns?'+query);if(version===requestVersion.current){setSnapshot({query,data:next});setError('');}}
  catch(e){if(version===requestVersion.current)setError((e as Error).message);}
 },[api,query]);
 useEffect(()=>{setSnapshot(null);void load();const timer=setInterval(()=>{if(!document.hidden)void load();},15000);return()=>{requestVersion.current++;clearInterval(timer);};},[load,reloadToken]);
 const pages:any[]=data?.pages??[];
 const tablePages=pages.filter(p=>(p.name+' '+p.site_name+' '+p.revision).toLowerCase().includes(tableSearch.toLowerCase()));
 const eligible=pages.filter(p=>!p.suppressed);
 const exposed=eligible.reduce((sum,p)=>sum+(p.funnel?.exposed_views??0),0);
 const activated=eligible.reduce((sum,p)=>sum+(p.funnel?.ordered_activated_views??0),0);
 return <>
  {error&&<div className="notice error" role="alert">{error}</div>}
  <div className="overview-metrics analytic-metrics">
   <div className="analytic-metric"><small>Tracked page views</small><strong>{data?number(data.totals.tracked_views):'—'}</strong><span>Consented views · not unique visitors</span></div>
   <div className="analytic-metric"><small>Pointer clicks</small><strong>{data?number(data.totals.clicks):'—'}</strong><span>Across reportable landing pages</span></div>
   <div className="analytic-metric"><small>CTA activation rate <Info size={13} aria-label="Primary CTA activation after exposure, divided by exposed views"/></small><strong>{data&&exposed?percent(100*activated/exposed):'—'}</strong><span>{data?`${number(activated)} activated / ${number(exposed)} exposed views`:'Waiting for observations'}</span></div>
  </div>
  <CampaignCharts data={data}/>
  <section className="panel analytics-section" aria-label="Campaign performance">
   <div className="panel-header"><div><h2>Landing page performance <span className="count-pill">{pages.length}</span></h2><p>Select a page to explore its heatmap.</p></div><div className="search-box"><input type="search" aria-label="Search campaign table" placeholder="Search landing pages…" value={tableSearch} onChange={e=>setTableSearch(e.target.value)}/></div></div>
   <DataTable<any> name="Campaign performance" className="campaign-table" data={tablePages} rowId={p=>p.site_id+'/'+p.page_key} initialSorting={[{id:'views',desc:true}]} loading={!data&&!error} error={error} onRetry={()=>void load()} resetKey={query+'|'+tableSearch} columns={[
    {id:'name',label:'LANDING PAGE',value:p=>p.name,render:p=><><button className="text-button campaign-name" onClick={()=>onPage(p.site_id+'/'+p.page_key)}>{p.name}</button><small className="table-detail">{p.site_name} · {p.revision}</small>{p.suppressed&&<small className="table-detail">Below the {p.minimum_views}-view threshold</small>}</>},
    {id:'views',label:'VIEWS',value:p=>p.suppressed?undefined:p.views,render:p=>p.suppressed?'—':number(p.views)},
    {id:'clicks',label:'CLICKS',value:p=>p.suppressed?undefined:p.clicks,render:p=>p.suppressed?'—':number(p.clicks)},
    {id:'activation',label:'CTA ACTIVATION',value:p=>p.suppressed||!p.funnel.exposed_views?undefined:p.funnel.ordered_activation_rate,render:p=>p.suppressed||!p.funnel.exposed_views?'—':<span title={p.funnel.ordered_activated_views+' activated / '+p.funnel.exposed_views+' exposed views'}>{percent(p.funnel.ordered_activation_rate)}</span>},
    {id:'reach',label:'SCROLL REACH',value:p=>p.suppressed||!p.views?undefined:p.avg_reach,render:p=>p.suppressed||!p.views?'—':percent(p.avg_reach)},
    {id:'actions',label:'',sortable:false,value:p=>p.page_key,render:p=><button className="table-explore" aria-label={'View heatmap for '+p.name} onClick={()=>onPage(p.site_id+'/'+p.page_key)}><ArrowUpRight size={17}/></button>},
   ]}/>
   <div className="table-footer"><span>{data?`${number(data.totals.reportable_pages)} reportable pages · ${number(data.totals.suppressed_pages)} below reporting threshold`:'Loading recorded counts'}</span><button className="text-button" onClick={()=>void load()}><RefreshCw size={13}/>Refresh</button></div>
  </section>
  <MoreAnalysis description="Device breakdown, CTA exposure and experience signals">
   <CampaignCharts data={data} variant="detail"/>
   <section className="panel analytics-section" aria-label="Detailed campaign metrics"><div className="panel-header"><div><h2>Campaign detail</h2><p>Exposure, experience signals and sampling by page.</p></div></div><DataTable<any> name="Campaign detail" data={eligible} rowId={p=>p.site_id+'/'+p.page_key} resetKey={query} columns={[
    {id:'name',label:'LANDING PAGE',value:p=>p.name},{id:'exposure',label:'CTA EXPOSURE',value:p=>p.views?p.funnel.exposure_rate:undefined,render:p=>p.views?percent(p.funnel.exposure_rate):'—'},
    {id:'activation',label:'ORDERED ACTIVATION',value:p=>p.funnel.ordered_activated_views,render:p=>p.funnel.ordered_activated_views+' / '+p.funnel.exposed_views},
    {id:'rage',label:'REPEATED CLUSTERS',value:p=>p.diagnostics.rage_clicks},{id:'dead',label:'NO-RESPONSE SIGNALS',value:p=>p.diagnostics.dead_clicks},{id:'sample',label:'SAMPLE RATES',value:p=>p.sample_rates?.join(','),render:p=>p.sample_rates?.map((n:number)=>percent(100*n)).join(', ')||'—'},
   ]}/></section>
  </MoreAnalysis>
  {!!data?.insights.length&&<section className="panel analytics-section" aria-label="Investigation shortlist"><div className="panel-header"><h2>Worth a closer look</h2></div><div className="insight-list">{data.insights.map((item:any)=><div key={item.site_id+item.page_key+item.code}><TriangleAlert size={18}/><div><strong>{data.pages.find((p:any)=>p.site_id===item.site_id&&p.page_key===item.page_key)?.name}</strong><p>{item.message}</p></div><button className="text-button" onClick={()=>onPage(item.site_id+'/'+item.page_key)}>Inspect<ArrowRight size={13}/></button></div>)}</div></section>}
  <details className="report-method"><summary>How to read these numbers</summary><p>Tracked counts are unweighted and exclude suppressed cohorts. Different sample rates and audiences can limit comparisons. CTA activation means a primary action after qualified exposure; it does not establish a completed registration. Small cohorts are provisional. Diagnostic signals suggest investigation, and an empty shortlist does not establish the absence of problems.</p></details>
 </>;
}

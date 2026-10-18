import {useEffect,useState} from 'react';
import {Camera,CheckCheck,FileImage,Info,Monitor,RefreshCw} from 'lucide-react';
import {DataTable} from './data-table.js';

type Api = (url:string,body?:unknown,method?:string) => Promise<any>;

export function ReferencePicker({report,value,onChange,width,loading}:{report:any;value:string;onChange:(id:string)=>void;width:string;loading:boolean}) {
  const available = report?.references?.filter((r:any) => r.status==='approved' && r.manifest.viewport.width===Number(width) &&
    ['revision','locale','variant','state'].every(k => r.manifest[k]===(k==='revision'?(report.selected_revision??report.page.revision):report.page[k]))) ?? [];
  return <div className="reference-picker">
    <FileImage size={16}/><label htmlFor="reference-choice">Reference screenshot</label>
    <select id="reference-choice" aria-label="Reference screenshot" value={value} onChange={e=>onChange(e.target.value)} disabled={loading||!width||!available.length}>
      <option value="">Latest compatible approved layout</option>
      {available.map((r:any)=><option value={r.id} key={r.id}>{r.manifest.revision} · {r.manifest.viewport.width}px · {new Date(r.created_at).toLocaleString('en-GB',{timeZone:'Europe/Bucharest'})}</option>)}
    </select>
    <span>{!width?'Exact viewport required':`${available.length} approved layout${available.length===1?'':'s'}`}</span>
  </div>;
}

export function CapturePanel({siteId,pageKey,synthetic,width,variant,api,onComplete,notify,fail}:{variant?:string;siteId:string;pageKey:string;synthetic:boolean;width:string;api:Api;onComplete:()=>Promise<void>;notify:(s:string)=>void;fail:(s:string)=>void}) {
  const [captureWidth,setCaptureWidth] = useState(width||'1440');
  const [job,setJob] = useState<any>(null),[starting,setStarting] = useState(false);
  const active = job && ['queued','running'].includes(job.status);
  useEffect(()=>{setCaptureWidth(width||'1440');setJob(null);},[siteId,pageKey,width]);
  useEffect(()=>{
    if(!active)return;
    let live=true,pending=false;
    const poll=async()=>{
      if(pending)return;pending=true;
      try {
        const next=await api('/api/captures/'+job.id);
        if(!live)return;setJob(next);
        if(next.status==='pending-review'){await onComplete();notify('Screenshot captured. Review and approve the new layout.');}
        if(next.status==='failed')fail(captureMessage(next.error_code));
      }catch{if(live)fail('Could not refresh capture status. The job remains available on the server.');}
      finally{pending=false;}
    };
    const timer=setInterval(()=>void poll(),1000);void poll();
    return()=>{live=false;clearInterval(timer);};
  },[job?.id,active]);
  async function start(){
    setStarting(true);
    try {
      const w=Number(captureWidth),height=w<768?844:900;
      const result=await api(`/api/pages/${encodeURIComponent(siteId)}/${encodeURIComponent(pageKey)}/capture`,{width:w,height,variant});
      setJob(result);
    }catch(e){fail(captureMessage((e as Error).message));}
    finally{setStarting(false);}
  }
  return <section className="panel content-panel capture-panel">
    <span className="section-icon purple"><Camera size={22}/></span>
    <h2>Capture this landing page</h2><p>Variant: <strong>{variant??'control'}</strong></p>
    <p>Render the selected local page in an isolated browser. The screenshot and geometry arrive here for your review before they can be used in a heatmap.</p>
    <label className="capture-width">Viewport width<select aria-label="Capture viewport width" value={captureWidth} disabled={active||starting} onChange={e=>setCaptureWidth(e.target.value)}>
      {[...new Set([390,768,1024,1440,1920,...(Number(width)>=240&&Number(width)<=1920?[Number(width)]:[])])].sort((a,b)=>a-b).map(w=><option key={w} value={w}>{w}px · {w<768?'mobile':w<1200?'tablet':'desktop'}</option>)}
    </select></label>
    <button className="btn primary" disabled={!synthetic||active||starting} onClick={()=>void start()}>
      {active||starting?<RefreshCw size={15} className="spin"/>:<Camera size={15}/>}
      {starting?'Starting capture…':active?'Capturing selected page…':'Capture selected page'}
    </button>
    {job?.status==='pending-review'&&<div className="capture-success"><CheckCheck size={16}/> Screenshot ready for review below.</div>}
    <div className="info-box"><Info size={16}/><span>{synthetic?'Only the selected page is captured. No visitor session or behavior is recorded.':'Automatic capture is limited to local fixtures in this release. Import a reviewed public-page screenshot and manifest for a real-site draft.'}</span></div>
  </section>;
}

function captureMessage(code:string){
  const messages:Record<string,string>={
    CAPTURE_BUSY:'Another screenshot capture is running. Try again when it finishes.',
    CAPTURE_BROWSER_UNAVAILABLE:'The capture browser is unavailable. Run pnpm exec playwright install chromium, then retry.',
    CAPTURE_FAILED:'The local page could not be captured. Check that the demo server and Playwright browser are available.',
    CAPTURE_TIMED_OUT:'The capture timed out. Try again after checking the local page.',
    EXTERNAL_CAPTURE_DISABLED:'Automatic capture is currently limited to the local demo pages.',
  };
  return messages[code]||code.replaceAll('_',' ').toLowerCase();
}

export function ElementTable({report,loading}:{report:any;loading:boolean}){
  if(!report||report.suppressed)return null;
  return <section className="panel element-report" aria-label="Element engagement report">
    <div className="panel-header"><div><h2>Element engagement</h2><p>Clicks include repeats. Exposure and activation counts use distinct views in the selected device and viewport.</p></div><span className="badge">{loading?'Refreshing…':'Aggregation v'+report.quality.aggregation_version}</span></div>
    <DataTable<any> name="Element engagement" data={report.elements} rowId={el=>el.id} resetKey={report.page.site_id+'/'+report.page.page_key+'/'+report.data_source+'/'+report.from+'/'+report.to} columns={[
      {id:'id',label:'REGISTERED ELEMENT',value:el=>el.id,render:el=><code>{el.id}</code>},{id:'clicks',label:'CLICKS',value:el=>el.click_count},{id:'exposed',label:'EXPOSED VIEWS',value:el=>el.exposed_views},{id:'activated',label:'ACTIVATED VIEWS',value:el=>el.activated_views},{id:'rate',label:'ACTIVATION AMONG EXPOSED',value:el=>el.exposed_views?100*el.exposed_activated_views/el.exposed_views:undefined,render:el=>el.exposed_views?(100*el.exposed_activated_views/el.exposed_views).toFixed(1)+'%':'—'},
    ]}/>
    <div className="table-footer"><span><Monitor size={14}/> Exposure means qualified viewport visibility; it does not establish attention or a completed registration.</span></div>
  </section>;
}

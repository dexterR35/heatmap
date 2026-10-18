import {useState} from 'react';
import {ArrowUpRight,CheckCheck,FileImage,Monitor,Upload} from 'lucide-react';
import {CapturePanel} from './heatmap-tools.js';

export function ReferenceLibrary({report,site,page,width,reload,notify,fail,api,onUse}:{report:any;site:any;page:any;width:string;reload:()=>Promise<void>;notify:(s:string)=>void;fail:(s:string)=>void;api:(url:string,body?:unknown)=>Promise<any>;onUse:(ref:any)=>void}) {
  const [image,setImage]=useState<File|null>(null),[manifest,setManifest]=useState<File|null>(null),[busy,setBusy]=useState(false);
  async function upload(){
    if(!image||!manifest||!page)return;
    setBusy(true);
    try {
      if(image.size>5500000||manifest.size>64000)throw new Error('The reference files exceed the upload limit.');
      let data:any;
      try{data=JSON.parse(await manifest.text());}catch{throw new Error('The layout manifest must be valid JSON.');}
      if(data.site_id!==page.site_id||data.page_key!==page.page_key)throw new Error('This manifest belongs to a different page. Select its page before importing.');
      const base64=await new Promise<string>((resolve,reject)=>{
        const reader=new FileReader();reader.onerror=()=>reject(new Error('Could not read the selected image.'));
        reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(image);
      });
      await api('/api/references/import',{manifest:data,image_base64:base64});
      await reload();notify('Reference imported. Review the full image before approval.');
      setImage(null);setManifest(null);
    }catch(e){fail((e as Error).message);}finally{setBusy(false);}
  }
  if(!page||!site)return <section className="panel content-panel"><h2>Select a landing page</h2><p>Its capture and reference history will appear here.</p></section>;
  const references=report?.references??[];
  return <>
    <div className="two-column reference-actions">
      <CapturePanel key={page.site_id+page.page_key} siteId={page.site_id} pageKey={page.page_key} synthetic={site.environment==='synthetic'} variant={report?.selected_variant??page.variant} width={width} api={api} onComplete={reload} notify={notify} fail={fail}/>
      <section className="panel content-panel">
        <span className="section-icon"><Upload size={21}/></span><h2>Import an approved public layout</h2>
        <p>Upload a PNG or WebP with its matching JSON geometry manifest. Imports are private, masked, and held for review.</p>
        <label className="file-field">Screenshot<input type="file" accept="image/png,image/webp" onChange={e=>setImage(e.target.files?.[0]||null)}/></label>
        <label className="file-field">Layout manifest<input type="file" accept="application/json,.json" onChange={e=>setManifest(e.target.files?.[0]||null)}/></label>
        <button className="btn primary" disabled={!image||!manifest||busy} onClick={()=>void upload()}><Upload size={15}/>{busy?'Importing…':'Import for review'}</button>
      </section>
    </div>
    <div className="reference-history-heading"><div><h2>Reference history</h2><p>{page.name} · {references.length} stored layouts · review an image before approval</p></div></div>
    <div className="reference-grid">
      {references.map((ref:any)=><section className="panel reference-card" key={ref.id} data-reference-id={ref.id}>
        <div className="reference-thumb"><img src={`/api/references/${ref.id}/image`} alt={`Reference ${ref.manifest.viewport.width}px`}/><span className={'badge '+(ref.status==='approved'?'green':'orange')}>{ref.status}</span></div>
        <div className="reference-details"><h3>{page.name}</h3><p><Monitor size={13}/>{ref.manifest.viewport.width} × {ref.manifest.viewport.height}px <span>·</span> {ref.manifest.revision}</p><small>{new Date(ref.created_at).toLocaleString('en-GB',{timeZone:'Europe/Bucharest'})}</small>
          <a className="reference-review-link" href={`/api/references/${ref.id}/image`} target="_blank" rel="noreferrer">Review full image <ArrowUpRight size={13}/></a>
          {ref.status==='approved'?<button className="btn full" onClick={()=>onUse(ref)}><FileImage size={14}/>Use this layout</button>:
            <button className="btn full" onClick={async()=>{try{await api(`/api/references/${ref.id}/approve`,{});await reload();notify('Reference approved. It can now be selected in Heatmaps.');}catch(e){fail((e as Error).message);}}}><CheckCheck size={15}/>Approve reviewed layout</button>}
        </div>
      </section>)}
      {!references.length&&<section className="panel content-panel no-references"><FileImage size={28}/><h2>Your first reference starts here.</h2><p>Capture the selected local page or import a reviewed public-page image and manifest.</p></section>}
    </div>
  </>;
}

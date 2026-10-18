import {ArrowUpRight,LayoutTemplate} from 'lucide-react';
import {selectorURL} from '../../../packages/domain/matcher.js';
import {DataTable} from './data-table.js';
import {useInstallationChecks,InstallationStatus,InstallationCheckButton} from './installation-status.js';

export function RegistryTable({pages,onSelect,onToggle,resetKey,api,role,refresh}:{api:(url:string,body?:unknown,method?:string)=>Promise<any>;role:string;refresh:number;pages:any[];onSelect:(id:string)=>void;onToggle:(page:any)=>void;resetKey:string}){
 const checks=useInstallationChecks(api,refresh);
 return <>{checks.error&&<div className="notice error" role="alert">{checks.error}</div>}<DataTable name="Landing pages" data={pages} rowId={p=>p.site_id+'/'+p.page_key} resetKey={resetKey} columns={[
  {id:'name',label:'LANDING PAGE',value:p=>p.name,render:p=><button className="page-name" onClick={()=>onSelect(p.site_id+'/'+p.page_key)}><span className={'page-favicon '+(p.page_key.includes('christmas')?'purple':'')}><LayoutTemplate size={19}/></span><span><strong>{p.name}</strong><small>{selectorURL(p.selector)}</small></span></button>},
  {id:'installation',label:'LINK / PIXEL / ACTIVITY',value:p=>checks.find(p)?.collection??'unchecked',render:p=><InstallationStatus status={checks.find(p)}/>},{id:'check',label:'VERIFY',sortable:false,value:p=>p.page_key,render:p=><InstallationCheckButton page={p} checks={checks} role={role}/>},{id:'environment',label:'ENVIRONMENT',value:p=>p.site_id==='local-demo'?'Local test page':'Real-site draft',render:p=><span className={'badge '+(p.site_id==='local-demo'?'blue':'neutral')}>{p.site_id==='local-demo'?'Local test page':'Real-site draft'}</span>},
  {id:'collection',label:'COLLECTION',value:p=>p.enabled?'Collection enabled':p.approval_state==='pending'?'Pending approval':'Paused',render:p=><button className="status-button" onClick={()=>onToggle(p)} title={p.enabled?'Pause collection':'Resume local collection'}><span className={'badge '+(p.enabled?'green':'neutral')}><span className="dot"/>{p.enabled?'Collection enabled':p.approval_state==='pending'?'Pending approval':'Paused'}</span></button>},
  
  
  {id:'revision',label:'REVISION',value:p=>p.revision,render:p=><code className="revision">{p.revision}</code>},
  {id:'actions',label:'',sortable:false,value:p=>p.page_key,render:p=><button className="row-action" onClick={()=>onSelect(p.site_id+'/'+p.page_key)}>View heatmap <ArrowUpRight size={15}/></button>},
 ]}/></>;
}

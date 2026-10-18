import {useCallback,useEffect,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import './installation-status.css';
type Api=(url:string,body?:unknown,method?:string)=>Promise<any>;
const key=(p:any)=>p.site_id+'/'+p.page_key;
const text:Record<string,string>={reachable:'Success · page loads',blocked:'Blocked · cannot inspect',unreachable:'Unreachable',http_error:'HTTP error',different_page:'Redirects to a different page',not_html:'Not an HTML page',redirect_error:'Redirect could not be verified',detected:'Pixel code detected',not_found_in_html:'Pixel not found in HTML',unverified:'Pixel unverified'};
const reason:Record<string,string>={ACCESS_OR_BOT_PROTECTION:'The server refused this check. This does not prove that the pixel is missing.',REDIRECT_CHANGED_LANDING_PAGE:'The URL ended on a different page or campaign. Check its redirect rules.',DYNAMIC_OR_CONSENT_LOADING_NOT_VERIFIED:'The pixel may load through consent or a tag manager. Static inspection cannot verify that.',DOCUMENT_TRUNCATED:'The document exceeded the inspection limit. The result is incomplete.',UNSAFE_TARGET:'This checker accepts public HTTPS pages and the configured local demo only.',CHECK_TIMEOUT:'The check timed out after 12 seconds.',NETWORK_OR_TLS_ERROR:'The page could not be reached or its TLS connection failed.',HTTP_ERROR:'The page returned an unsuccessful HTTP response.',NOT_AN_HTML_PAGE:'This URL did not return a landing-page document.',REDIRECT_LIMIT_OR_INVALID:'The page returned too many redirects or an invalid destination.'};
export function useInstallationChecks(api:Api,refresh=0){
 const[rows,setRows]=useState<any[]>([]),[busy,setBusy]=useState<string[]>([]),[error,setError]=useState('');
 const reload=useCallback(async()=>{const result=await api('/api/installations');setRows(result.rows);},[api]);
 useEffect(()=>{let live=true;api('/api/installations').then(r=>{if(live)setRows(r.rows);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[api,refresh]);
 async function check(p:any){const id=key(p);setBusy(v=>[...v,id]);setError('');try{await api(`/api/pages/${encodeURIComponent(p.site_id)}/${encodeURIComponent(p.page_key)}/check-installation`,{});await reload();}catch(e){setError((e as Error).message);}finally{setBusy(v=>v.filter(k=>k!==id));}}
 return {rows,busy,error,check,reload,find:(p:any)=>rows.find(r=>key(r)===key(p))};
}
export function InstallationStatus({status,compact=false}:{status:any;compact?:boolean}){
 const c=status?.check,enabled=status?.collection==='enabled',receiving=status?.recent_events===true;
 return <div className="installation-status" aria-label="Installation status"><span className={'badge '+(receiving&&enabled?'green':'neutral')}>{!status?'Loading status…':receiving&&enabled?(status.environment==='local_demo'?'Receiving · local demo':'Receiving events'):status.collection==='stopped'?'Collection stopped':!enabled?'Draft · collection disabled':'No recent events'}</span>{!compact&&<>
 <span className={c?.link==='reachable'?'installation-good':'installation-muted'}>{c?`${text[c.link]??c.link}${c.http_status?' · HTTP '+c.http_status:''}`:'Link not checked'}</span>
 <span>{c?text[c.pixel]??c.pixel:'Pixel not checked'}</span>
 {c?.response_ms!==null&&c?.response_ms!==undefined&&<small>Response headers: {(c.response_ms/1000).toFixed(2)}s · document: {(c.document_ms/1000).toFixed(2)}s. Measured from this server, excluding browser rendering.</small>}
 {receiving&&<small>Recorded events received in the last 24h{!enabled?' · collection is now disabled':''}.</small>}
 {!receiving&&status&&<small>No recorded events received in the last 24h.{status.last_event_at?' Last event: '+new Date(status.last_event_at).toLocaleString('en-GB',{timeZone:'UTC'})+' UTC':''}</small>}
 {c?.pixel==='detected'&&<small>{c.identity==='matched'?'Site key matches.':'Site key unverified.'} {c.endpoint==='matched'?'Collector setting matches.':'Collector setting unverified.'} Execution and consent flow still require a browser check.</small>}
 {c?.reason&&<small>{reason[c.reason]??'Inspection incomplete.'}</small>}
 {c?.scripts_unchecked>0&&<small>{c.scripts_unchecked} script(s) were outside static inspection.</small>}
 {status&&<small>Processing: {status.pending_views} pending view(s), {status.failed_views} failed.{status.pending_views>0?` Oldest waiting: ${Math.round(status.oldest_pending_seconds)}s.`:''}</small>}
 {c&&<small>Checked {new Date(c.checked_at).toLocaleString('en-GB',{timeZone:'UTC'})} UTC · {c.scripts_checked} script(s) inspected</small>}
 </>}</div>;
}
export function InstallationCheckButton({page,checks,role}:{page:any;checks:ReturnType<typeof useInstallationChecks>;role:string}){
 if(!['owner','administrator','analyst','installer'].includes(role))return null;
 const busy=checks.busy.includes(key(page));return <button className="btn installation-check-button" disabled={busy||checks.busy.length>=3} onClick={()=>void checks.check(page)}><RefreshCw size={14} className={busy?'spin':''}/>{busy?'Checking…':'Check link & pixel'}</button>;
}
export function InstallationCheckPanel({api,page,role,refresh=0}:{api:Api;page:any;role:string;refresh?:number}){
 const checks=useInstallationChecks(api,refresh);if(!page)return null;
 return <section className="panel content-panel installation-check-panel" aria-label="Landing page installation check"><div className="growth-heading"><div><h2>Link & pixel verification</h2><p>Saving a page in the registry does not install its pixel.</p></div><InstallationCheckButton page={page} checks={checks} role={role}/></div>{checks.error&&<div role="alert" className="notice error">{checks.error}</div>}<InstallationStatus status={checks.find(page)}/><p className="small-note">The check reads the registered URL and up to four scripts from the same origin. It does not run JavaScript or grant consent. Recent activity uses received Recorded events for this page; sample and legacy data are excluded.</p></section>;
}

import {randomUUID} from 'node:crypto';
import type {DB} from '../../packages/db/index.js';
import type {RegistryRow} from '../../packages/contracts/acquisition.js';
import {parseAddress,selectorsOverlap,type Selector} from '../../packages/domain/matcher.js';
import {validateSelector} from '../../packages/security/validation.js';
import {Problem,canonical} from './security.js';
type Access=(site:string,tx:DB)=>Promise<unknown>;
export async function importRegistry(db:DB,rows:RegistryRow[],dryRun:boolean,owner:boolean,access:Access){
 return db.transaction(async tx=>{
  const plans:any[]=[],errors:{row:number;code:string}[]=[],seen=new Set<string>(),siteMetadata=new Map<string,string>();
  const siblings=new Map<string,{page_key:string;selector:Selector}[]>();
  for(let i=0;i<rows.length;i++)try{
   const r=rows[i],u=parseAddress(r.url);if(!u||u.hash||[...u.searchParams.keys()].some(k=>k!=='lp')||!u.searchParams.get('lp'))throw new Problem(422,'EXACT_LP_URL_REQUIRED');
   const selector:Selector={origin:u.origin,path:u.pathname,query_equals:Object.fromEntries(u.searchParams),ignored_query_names:[],other_query_policy:'reject',duplicate_query_policy:'reject',fragment_policy:'ignore_anchor'};validateSelector(selector);
   try{new Intl.DateTimeFormat('en',{timeZone:r.report_timezone});}catch{throw new Problem(422,'TIMEZONE_INVALID');}
   const identity=u.origin+'/'+r.page_key;if(seen.has(identity))throw new Problem(422,'DUPLICATE_IMPORT_IDENTITY');seen.add(identity);
   const metadata=canonical({brand:r.brand,currency:r.currency,report_timezone:r.report_timezone});if(siteMetadata.has(u.origin)&&siteMetadata.get(u.origin)!==metadata)throw new Problem(422,'SITE_METADATA_CONFLICT');siteMetadata.set(u.origin,metadata);
   const[site]=await tx.query('SELECT * FROM sites WHERE origin=$1 FOR UPDATE',[u.origin]);if(site)await access(site.id,tx);else if(!owner)throw new Problem(403,'OWNER_REQUIRED');
   if(!site&&u.protocol!=='https:')throw new Problem(422,'REAL_ORIGIN_REQUIRES_HTTPS');
   if(!siblings.has(u.origin))siblings.set(u.origin,site?await tx.query('SELECT page_key,selector FROM pages WHERE site_id=$1',[site.id]):[]);
   const same=siblings.get(u.origin)!.find(p=>p.page_key===r.page_key);
   if(same&&canonical(same.selector.query_equals)!==canonical(selector.query_equals)||same&&(same.selector.origin!==selector.origin||same.selector.path!==selector.path))throw new Problem(409,'PAGE_IDENTITY_CONFLICT');
   if(siblings.get(u.origin)!.some(p=>p.page_key!==r.page_key&&selectorsOverlap(p.selector,selector)))throw new Problem(409,'SELECTOR_OVERLAP');
   if(site&&(site.brand!==r.brand||site.currency!==r.currency||site.report_timezone!==r.report_timezone)&&(await tx.query("SELECT 1 FROM experiments WHERE site_id=$1 AND status IN ('running','paused') LIMIT 1",[site.id])).length)throw new Problem(409,'ACTIVE_EXPERIMENT_METADATA_LOCKED');
   if(site&&(await tx.query("SELECT 1 FROM experiments WHERE site_id=$1 AND page_key=$2 AND status IN ('running','paused') LIMIT 1",[site.id,r.page_key])).length)throw new Problem(409,'ACTIVE_EXPERIMENT_METADATA_LOCKED');
   if(!same)siblings.get(u.origin)!.push({page_key:r.page_key,selector});plans.push({row:i+1,action:same?'update':'create',site_id:site?.id??null,page_key:r.page_key,origin:u.origin,selector,record:r});
  }catch(error){errors.push({row:i+1,code:error instanceof Problem?error.code:'IMPORT_ROW_INVALID'});}
  if(dryRun||errors.length)return {dry_run:dryRun,applied:false,errors,plan:plans.map(({selector,record,...p})=>p)};
  const ids=new Map<string,string>();
  for(const p of plans){const r=p.record as RegistryRow;let id=p.site_id??ids.get(p.origin);if(!id){id=randomUUID();await tx.query("INSERT INTO sites(id,site_key,name,origin,domain_group,market,family,environment,brand,currency,report_timezone) VALUES($1,$2,$3,$4,$3,$5,'go','real',$6,$7,$8)",[id,'site_'+randomUUID().replaceAll('-',''),new URL(p.origin).hostname,p.origin,r.market,r.brand,r.currency,r.report_timezone]);ids.set(p.origin,id);}
   await tx.query('UPDATE sites SET brand=$2,currency=$3,report_timezone=$4,config_version=config_version+1 WHERE id=$1',[id,r.brand,r.currency,r.report_timezone]);
   await tx.query('INSERT INTO pages(site_id,page_key,name,selector,product,market,locale,page_family,acquisition_goal) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(site_id,page_key) DO UPDATE SET name=EXCLUDED.name,product=EXCLUDED.product,market=EXCLUDED.market,locale=EXCLUDED.locale,page_family=EXCLUDED.page_family,acquisition_goal=EXCLUDED.acquisition_goal',[id,r.page_key,r.name,JSON.stringify(p.selector),r.product,r.market,r.locale,r.page_family,r.acquisition_goal]);
   await tx.query('INSERT INTO config_history(site_id,version,sample_rate) SELECT id,config_version,sample_rate FROM sites WHERE id=$1 ON CONFLICT DO NOTHING',[id]);p.site_id=id;
  }
  return {dry_run:false,applied:true,errors:[],plan:plans.map(({selector,record,...p})=>p)};
 });
}

import {unlink} from 'node:fs/promises';
import path from 'node:path';
import type {DB} from '../../packages/db/index.js';
import {audit} from './security.js';
export async function retention(db:DB,dataDir:string){
 const [settings]=await db.query("SELECT value FROM settings WHERE key='privacy'");const cutoff=new Date(Date.now()-settings.value.raw_days*86400000).toISOString(),refCutoff=new Date(Date.now()-settings.value.reference_days*86400000).toISOString();
 const refs=await db.query('SELECT id,object_key FROM page_references WHERE created_at<$1',[refCutoff]);
 const deleted=await db.transaction(async tx=>{
  // Never remove evidence awaiting processing or recovery.
  const views=await tx.query("SELECT v.site_id,v.view_id FROM views v WHERE started_at<$1 AND NOT EXISTS(SELECT 1 FROM jobs j WHERE j.site_id=v.site_id AND j.view_id=v.view_id AND j.state<>'done')",[cutoff]);
  for(const v of views){for(const table of ['events','view_facts','jobs'])await tx.query(`DELETE FROM ${table} WHERE site_id=$1 AND view_id=$2`,[v.site_id,v.view_id]);await tx.query('DELETE FROM views WHERE site_id=$1 AND view_id=$2',[v.site_id,v.view_id]);}
  await tx.query("DELETE FROM capture_jobs WHERE created_at<$1 AND status NOT IN ('queued','running')",[cutoff]);
  await tx.query("UPDATE experiments SET evidence_pruned=true WHERE final_readout IS NULL AND id IN (SELECT experiment_id FROM acquisition_visits WHERE created_at<$1 AND created_at+attribution_hours*interval '1 hour'<now())",[cutoff]);
  await tx.query('DELETE FROM acquisition_visits WHERE created_at<$1 AND created_at+attribution_hours*interval \'1 hour\'<now()',[cutoff]);
  await tx.query('DELETE FROM acquisition_spend WHERE day<$1::date',[cutoff]);
  await tx.query('DELETE FROM page_references WHERE created_at<$1',[refCutoff]);await tx.query('DELETE FROM sessions WHERE expires_at<now()');await tx.query("DELETE FROM ingestion_quotas WHERE day<CURRENT_DATE-7");await audit(tx,null,'retention_completed',null,{deleted_views:views.length,deleted_references:refs.length});return views.length;
 });
 for(const ref of refs)if(/^[\da-f-]+\.png$/.test(ref.object_key))await unlink(path.join(dataDir,'references',ref.object_key)).catch(()=>{});
 return {deleted_views:deleted,deleted_references:refs.length,cutoff};
}

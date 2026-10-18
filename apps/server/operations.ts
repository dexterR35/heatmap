import {randomUUID} from 'node:crypto';
import path from 'node:path';
import type {DB} from '../../packages/db/index.js';
import {Problem,audit} from './security.js';
import {retention} from './retention.js';
import {saveBackup,pruneBackups} from './backup-service.js';
import {recentIngestion,telemetrySnapshot} from './telemetry.js';
export interface OperationsSettings {automatic_retention:boolean;retention_hour_utc:number;automatic_backup:boolean;backup_hour_utc:number;backup_days:number;queue_warning_seconds:number;rejection_warning_percent:number}
export async function operationStatus(db:DB){
 const[settings]=await db.query("SELECT value FROM settings WHERE key='operations'");const jobs=await db.query('SELECT state,count(*)::int AS count FROM jobs GROUP BY state');
 const[lag]=await db.query("SELECT COALESCE(EXTRACT(epoch FROM(now()-min(updated_at))),0)::double precision AS seconds FROM jobs WHERE state IN ('pending','processing')");
 const runs=await db.query('SELECT id,kind,status,started_at,finished_at,detail,error_code FROM operation_runs ORDER BY started_at DESC LIMIT 30'),alerts=await db.query('SELECT * FROM operation_alerts ORDER BY active DESC,last_seen DESC LIMIT 30');
 return {settings:settings.value as OperationsSettings,jobs,queue_lag_seconds:Number(lag.seconds),runs,alerts,telemetry:telemetrySnapshot(),collector_window:recentIngestion(),checked_at:new Date().toISOString(),backups_encrypted:false,external_notifications_configured:false};
}
export function createOperations(db:DB,dataDir:string,backupRoot=path.join(dataDir,'backups')){
 let timer:ReturnType<typeof setInterval>|undefined,closing=false;const running=new Set<Promise<unknown>>();
 async function run(kind:'retention'|'backup'|'monitor',force=false){
  if(closing)throw new Problem(503,'OPERATIONS_STOPPING');
  const id=randomUUID();const claimed=await db.transaction(async tx=>{
   const[row]=await tx.query("SELECT value FROM settings WHERE key='operations' FOR UPDATE");const settings=row.value as OperationsSettings;
   await tx.query("UPDATE operation_runs SET status='failed',error_code='OPERATION_INTERRUPTED',finished_at=now() WHERE status='running' AND started_at<now()-interval '30 minutes'");
   if((await tx.query("SELECT id FROM operation_runs WHERE status='running' AND (kind=$1 OR (kind IN ('backup','retention') AND $1 IN ('backup','retention'))) LIMIT 1",[kind])).length){if(force)throw new Problem(409,'OPERATION_BUSY');return null;}
   const[last]=await tx.query("SELECT started_at FROM operation_runs WHERE kind=$1 AND status IN ('completed','failed') ORDER BY started_at DESC LIMIT 1",[kind]);
   if(!force){const now=new Date();if(kind==='monitor'){if(last&&Date.now()-new Date(last.started_at).getTime()<55000)return null;}else {if(kind==='retention'&&!settings.automatic_retention||kind==='backup'&&!settings.automatic_backup)return null;const hour=kind==='retention'?settings.retention_hour_utc:settings.backup_hour_utc;if(now.getUTCHours()<hour||last&&new Date(last.started_at).toISOString().slice(0,10)===now.toISOString().slice(0,10))return null;}}
   await tx.query("INSERT INTO operation_runs(id,kind,status) VALUES($1,$2,'running')",[id,kind]);return settings;
  });if(!claimed)return {skipped:true};
  try{
   let detail:Record<string,unknown>={};
   if(kind==='retention')detail=await retention(db,dataDir);
   if(kind==='backup'){const stamp=new Date().toISOString().replaceAll('-','').replaceAll(':','').replace(/\.\d{3}Z$/,'Z');detail=await saveBackup(db,dataDir,path.join(backupRoot,'heatmap-'+stamp+'-'+id));await pruneBackups(backupRoot,claimed.backup_days);}
   if(kind==='monitor'){
    const status=await operationStatus(db),failed=status.jobs.filter(j=>j.state==='failed').reduce((n,j)=>n+j.count,0),window=recentIngestion();const[backup]=await db.query("SELECT status,started_at FROM operation_runs WHERE kind='backup' AND status IN ('completed','failed') ORDER BY started_at DESC LIMIT 1");const checks=[{code:'WORKER_FAILED',active:failed>0,severity:'critical',detail:{jobs:failed}},{code:'QUEUE_DELAY',active:status.queue_lag_seconds>claimed.queue_warning_seconds,severity:'warning',detail:{seconds:Math.round(status.queue_lag_seconds)}},{code:'INGESTION_REJECTIONS',active:!!window&&window.requests>=20&&100*window.rejections/window.requests>=claimed.rejection_warning_percent,severity:'warning',detail:{requests:window?.requests??0,rejections:window?.rejections??0}},{code:'BACKUP_FAILED',active:backup?.status==='failed',severity:'critical',detail:{last_attempt:backup?.started_at??null}},{code:'BACKUP_OVERDUE',active:claimed.automatic_backup&&(!backup||Date.now()-new Date(backup.started_at).getTime()>26*3600000),severity:'warning',detail:{last_attempt:backup?.started_at??null}}];
    for(const c of checks)if(c.active)await db.query("INSERT INTO operation_alerts(code,severity,detail) VALUES($1,$2,$3) ON CONFLICT(code) DO UPDATE SET active=true,severity=EXCLUDED.severity,detail=EXCLUDED.detail,last_seen=now(),resolved_at=NULL",[c.code,c.severity,JSON.stringify(c.detail)]);else await db.query("UPDATE operation_alerts SET active=false,resolved_at=now(),last_seen=now() WHERE code=$1 AND active=true",[c.code]);detail={active_alerts:checks.filter(c=>c.active).length};
   }
   await db.query("UPDATE operation_runs SET status='completed',finished_at=now(),detail=$2 WHERE id=$1",[id,JSON.stringify(detail)]);if(kind==='monitor')await db.query("DELETE FROM operation_runs WHERE kind='monitor' AND status<>'running' AND started_at<now()-interval '30 days'");else await audit(db,null,'operation_completed',null,{kind,id});return {id,status:'completed',detail};
  }catch(error){await db.query("UPDATE operation_runs SET status='failed',finished_at=now(),error_code='OPERATION_FAILED' WHERE id=$1",[id]);if(force)throw new Problem(500,'OPERATION_FAILED');return {id,status:'failed'};}
 }
 const tracked=(kind:'retention'|'backup'|'monitor',force=false)=>{const task=run(kind,force);running.add(task);void task.finally(()=>running.delete(task)).catch(()=>{});return task;};
 return {run:tracked,start(){timer=setInterval(()=>{if(closing)return;void tracked('monitor').then(()=>tracked('retention')).then(()=>tracked('backup')).catch(()=>{});},60000);timer.unref();},async close(){closing=true;if(timer)clearInterval(timer);await Promise.allSettled([...running]);}};
}

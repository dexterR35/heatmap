import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {mkdir,rm,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'node:http';
import {testDB,batch,demoOrigin} from './fixtures.js';
import type {DB} from '../packages/db/index.js';
import {ingest} from '../apps/server/ingestion.js';
import {createOperations,operationStatus} from '../apps/server/operations.js';
import {verifyBackup,saveBackup} from '../apps/server/backup-service.js';
import {metricsEndpoint,createTelemetry,telemetrySnapshot} from '../apps/server/telemetry.js';
let db:DB,ops:ReturnType<typeof createOperations>;const root=path.resolve('.local','operations-test-'+randomUUID());
beforeAll(async()=>{db=await testDB();await mkdir(root,{recursive:true});ops=createOperations(db,root);});
afterAll(async()=>{await ops.close();await db.close();if(path.dirname(root)!==path.resolve('.local')||!/^operations-test-[a-f0-9-]{36}$/.test(path.basename(root)))throw new Error('UNSAFE_TEST_CLEANUP');await rm(root,{recursive:true,force:true});});
it('leaves automatic backup off until configured, and excludes overlapping maintenance',async()=>{
 expect(await ops.run('backup')).toEqual({skipped:true});const id=randomUUID();await db.query("INSERT INTO operation_runs(id,kind,status) VALUES($1,'retention','running')",[id]);await expect(ops.run('backup',true)).rejects.toMatchObject({code:'OPERATION_BUSY'});await db.query('DELETE FROM operation_runs WHERE id=$1',[id]);
});
it('creates a verified consistent backup and detects subsequent corruption',async()=>{
 const result=await ops.run('backup',true);expect(result).toMatchObject({status:'completed'});const status=await operationStatus(db),backup=status.runs.find(r=>r.kind==='backup')!,folder=path.join(root,'backups',backup.detail.name),data=await verifyBackup(folder);expect(data.sites.length).toBeGreaterThan(0);expect(data.sessions).toBeUndefined();
 const json=await readFile(path.join(folder,'database.json'),'utf8');await writeFile(path.join(folder,'database.json'),json+' ');await expect(verifyBackup(folder)).rejects.toThrow('BACKUP_CHECKSUM_FAILED');await writeFile(path.join(folder,'database.json'),json);
 await expect(saveBackup(db,root,path.join(root,'database'))).rejects.toThrow('BACKUP_TARGET_INVALID');
});
it('persists and resolves alerts and recovers interrupted maintenance claims',async()=>{
 const b=batch();await ingest(db,b,demoOrigin);await db.query("UPDATE jobs SET state='failed' WHERE view_id=$1",[b.view_id]);await db.query("INSERT INTO operation_runs(id,kind,status,started_at) VALUES($1,'retention','running',now()-interval '31 minutes')",[randomUUID()]);await ops.run('monitor',true);let status=await operationStatus(db);expect(status.alerts.find(a=>a.code==='WORKER_FAILED')?.active).toBe(true);expect(status.runs.some(r=>r.error_code==='OPERATION_INTERRUPTED')).toBe(true);
 await db.query("UPDATE jobs SET state='done' WHERE view_id=$1",[b.view_id]);await ops.run('monitor',true);status=await operationStatus(db);expect(status.alerts.find(a=>a.code==='WORKER_FAILED')?.active).toBe(false);expect(status.alerts.find(a=>a.code==='WORKER_FAILED')?.resolved_at).toBeTruthy();
});
it('exports aggregate route templates only and validates the operator metrics endpoint',async()=>{
 for(const value of ['http://outside.example.invalid/v1/metrics','https://user:pass@example.invalid/','https://example.invalid/?token=x','file:///tmp/metrics'])expect(()=>metricsEndpoint(value)).toThrow();expect(metricsEndpoint('http://127.0.0.1:4318/v1/metrics')).toBe('http://127.0.0.1:4318/v1/metrics');
 const telemetry=createTelemetry('test-service',db);try{telemetry.recordRequest('/v1/config/:siteKey','GET',200,12);telemetry.recordWorker(2);const snapshot=telemetrySnapshot().find(s=>s.service==='test-service');expect(snapshot?.requests).toBe(1);expect(snapshot?.routes[0].route).toBe('/v1/config/:siteKey');expect(JSON.stringify(snapshot)).not.toContain('site_local_demo_2026');}finally{await telemetry.close();}
});
it('delivers request, queue and worker metrics to a configured loopback OTLP receiver',async()=>{
 const payloads:string[]=[];const receiver=createServer((req,res)=>{expect(req.url).toBe('/v1/metrics');const chunks:Buffer[]=[];req.on('data',chunk=>chunks.push(chunk));req.on('end',()=>{payloads.push(Buffer.concat(chunks).toString('utf8'));res.writeHead(200,{'Content-Type':'application/json'});res.end('{}');});});
 await new Promise<void>(resolve=>receiver.listen(0,'127.0.0.1',resolve));const previous=process.env.HEATMAP_OTEL_METRICS_ENDPOINT;process.env.HEATMAP_OTEL_METRICS_ENDPOINT='http://127.0.0.1:'+(receiver.address() as {port:number}).port+'/v1/metrics';const telemetry=createTelemetry('export-test',db);
 try{telemetry.recordRequest('/v1/config/:siteKey','GET',200,15);telemetry.recordWorker(2);await telemetry.provider.forceFlush();expect(payloads.length).toBeGreaterThan(0);const content=payloads.join('');expect(content).toContain('heatmap.http.requests');expect(content).toContain('heatmap.queue.jobs');expect(content).toContain('heatmap.worker.processed');expect(content).not.toContain('site_local_demo_2026');}finally{await telemetry.close();if(previous===undefined)delete process.env.HEATMAP_OTEL_METRICS_ENDPOINT;else process.env.HEATMAP_OTEL_METRICS_ENDPOINT=previous;receiver.closeAllConnections();await new Promise<void>(resolve=>receiver.close(()=>resolve()));}
});

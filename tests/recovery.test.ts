import {it,expect} from 'vitest';
import {testDB,batch,demoOrigin} from './fixtures.js';
import {ingest,processJobs} from '../apps/server/ingestion.js';
it('recovers an expired job lease and recomputes facts idempotently',async()=>{const db=await testDB();try{const b=batch();await ingest(db,b,demoOrigin);await db.query("UPDATE jobs SET state='processing',locked_until=now()-interval '1 minute'");expect(await processJobs(db)).toBe(1);await db.query("UPDATE jobs SET state='pending'");expect(await processJobs(db)).toBe(1);const [r]=await db.query('SELECT count(*)::int AS n FROM view_facts');expect(r.n).toBe(1);}finally{await db.close();}});
it('persists failed attempts, backs off, and dead-letters a poison job after five attempts',async()=>{
 const db=await testDB();try{
  await ingest(db,batch(),demoOrigin);
  const failing={...db,query:async<T>(sql:string,params?:any[]):Promise<T[]>=>{if(sql.startsWith('SELECT payload FROM events'))throw new Error('test-compute-failure');return db.query<T>(sql,params);}};
  expect(await processJobs(failing)).toBe(0);
  let[job]=await db.query('SELECT * FROM jobs');expect(job.attempts).toBe(1);expect(job.state).toBe('pending');expect(new Date(job.next_attempt_at).getTime()).toBeGreaterThan(Date.now());
  expect(await processJobs(failing)).toBe(0);
  for(let i=0;i<4;i++){await db.query('UPDATE jobs SET next_attempt_at=now()');await processJobs(failing);}
  [job]=await db.query('SELECT * FROM jobs');expect(job.attempts).toBe(5);expect(job.state).toBe('failed');expect(job.last_error).toBe('WORKER_PROCESS_FAILED');
 }finally{await db.close();}
});

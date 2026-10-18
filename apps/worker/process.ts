import {randomUUID} from 'node:crypto';
import type {DB} from '../../packages/db/index.js';
import type {Event} from '../../packages/contracts/events.js';
import {viewFacts} from '../../packages/domain/metrics.js';
interface Job {id:string;site_id:string;view_id:string;attempts:number}

export async function processJobs(db:DB,limit=50) {
  let processed=0;
  // A process can die after its last persisted claim, before its catch handler.
  // Exhausted expired leases must leave processing instead of remaining stuck.
  await db.query("UPDATE jobs SET state='failed',last_error='WORKER_RETRY_LIMIT',locked_until=NULL,worker_id=NULL,updated_at=now() WHERE attempts>=5 AND (state='pending' OR (state='processing' AND locked_until<now()))");
  for(let i=0;i<limit;i++) {
    const workerId=randomUUID();
    const job=await db.transaction(async tx=>{
      const [next]=await tx.query<Job>("SELECT * FROM jobs WHERE (state='pending' OR (state='processing' AND locked_until<now())) AND next_attempt_at<=now() AND attempts<5 ORDER BY updated_at LIMIT 1 FOR UPDATE SKIP LOCKED");
      if(!next)return null;
      await tx.query("UPDATE jobs SET state='processing',worker_id=$2,locked_until=now()+interval '30 seconds',attempts=attempts+1 WHERE id=$1",[next.id,workerId]);
      return {...next,attempts:next.attempts+1};
    });
    if(!job)break;
    try {
      const rows=await db.query<{payload:Event}>('SELECT payload FROM events WHERE site_id=$1 AND view_id=$2',[job.site_id,job.view_id]);
      const facts=viewFacts(rows.map(r=>r.payload));
      const committed=await db.transaction(async tx=>{
        const [lease]=await tx.query('SELECT state,worker_id,locked_until FROM jobs WHERE id=$1 FOR UPDATE',[job.id]);
        if(!lease||lease.state!=='processing'||lease.worker_id!==workerId||new Date(lease.locked_until).getTime()<=Date.now())return false;
        await tx.query('INSERT INTO view_facts(site_id,view_id,has_page_view,facts,aggregation_version) VALUES($1,$2,$3,$4,3) ON CONFLICT(site_id,view_id) DO UPDATE SET has_page_view=EXCLUDED.has_page_view,facts=EXCLUDED.facts,aggregation_version=3,processed_at=now()',[job.site_id,job.view_id,facts.has_page_view,JSON.stringify(facts)]);
        await tx.query("UPDATE jobs SET state='done',locked_until=NULL,last_error=NULL,updated_at=now() WHERE id=$1",[job.id]);
        return true;
      });
      if(committed)processed++;
    }catch{
      // The persisted claim survives a rolled-back computation. Retry a bounded number of times.
      const state=job.attempts>=5?'failed':'pending',delay=Math.min(300,2**job.attempts);
      await db.query("UPDATE jobs SET state=$3,last_error='WORKER_PROCESS_FAILED',locked_until=NULL,next_attempt_at=now()+($4::double precision*interval '1 second'),updated_at=now() WHERE id=$1 AND worker_id=$2 AND state='processing'",[job.id,workerId,state,delay]);
    }
  }
  return processed;
}

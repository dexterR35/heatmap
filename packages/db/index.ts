import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
export interface DB {
  query<T = Record<string, any>>(sql:string, params?:any[]):Promise<T[]>;
  exec(sql:string):Promise<void>;
  transaction<T>(fn:(tx:DB)=>Promise<T>):Promise<T>;
  close():Promise<void>;
}
export async function openDB(url?:string, dataDir='.local/database'):Promise<DB> {
  if(url) {
    const pool=new pg.Pool({connectionString:url,max:8,statement_timeout:10000,connectionTimeoutMillis:3000,options:'-c timezone=UTC'});
    const wrap=(q:pg.Pool|pg.PoolClient):DB=>({
      query:async<T>(s:string,p:any[]=[]) => (await q.query(s,p)).rows as T[],
      exec:async s=>{await q.query(s);},
      transaction:async fn=>{const c=await pool.connect();try{await c.query('BEGIN');const r=await fn(wrap(c));await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}},
      close:()=>pool.end(),
    });
    return wrap(pool);
  }
  if(dataDir!=='memory://')await mkdir(dataDir,{recursive:true});
  const database=new PGlite(dataDir);
  await database.waitReady;
  await database.exec("SET TIME ZONE 'UTC'");
  const wrap=(q:any):DB=>({query:async<T>(s:string,p:any[]=[]) => (await q.query(s,p)).rows as T[],exec:async s=>{await q.exec(s);},transaction:fn=>q.transaction((tx:any)=>fn(wrap(tx))),close:()=>database.close()});
  return wrap(database);
}
export async function migrate(db:DB) {
  for (const file of ['001_initial.sql','002_capture_and_facts.sql','003_data_sources.sql','004_analytics_operations.sql','005_acquisition_experiments.sql','006_installation_checks.sql']) {
    await db.exec(await readFile(path.resolve('packages/db',file),'utf8'));
  }
}

import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {testDB} from './fixtures.js';
import {createManagement} from '../apps/server/management.js';
import {digest} from '../apps/server/security.js';
import type {DB} from '../packages/db/index.js';

let db:DB,app:ReturnType<typeof createManagement>;
const owner=randomUUID(),viewer=randomUUID(),host='127.0.0.1:3000';
const headers={host,cookie:'ir_session='+owner};
beforeAll(async()=>{
 db=await testDB();app=createManagement(db,new Map());await app.ready();
 for(const [id,role,session] of [['table-owner','owner',owner],['table-viewer','viewer',viewer]]){
  await db.query('INSERT INTO users(id,email,password_hash,role) VALUES($1,$2,$3,$4)',[id,id+'@example.invalid','not-used-for-login',role]);
  await db.query("INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES($1,$2,'test',now()+interval '1 hour')",[digest(session),id]);
 }
 await db.query("INSERT INTO audit(id,action,site_id,detail,created_at) SELECT 'table_'||lpad(n::text,3,'0'),CASE WHEN n=104 THEN 'percent%_marker' ELSE 'operation_action' END,'local-demo','{\"never_return\":\"private audit detail\"}'::jsonb,'2020-01-01T00:00:00Z'::timestamptz FROM generate_series(0,104) n");
 await db.query("INSERT INTO operation_runs(id,kind,status,started_at,finished_at,detail) SELECT 'table_run_'||lpad(n::text,3,'0'),'monitor','completed','2020-01-01T00:00:00Z'::timestamptz,CASE WHEN n=20 THEN NULL ELSE '2020-01-01T01:00:00Z'::timestamptz END,'{}'::jsonb FROM generate_series(0,20) n");
});
afterAll(async()=>{await app.close();await db.close();});
const get=(url:string)=>app.inject({url,headers});
it('paginates beyond the old 100-row audit cap with stable tied ordering and exact totals',async()=>{
 const first=(await get('/api/tables/audit?page_size=10')).json();
 expect(first.pagination).toEqual({pageIndex:0,pageSize:10,rowCount:105,pageCount:11});expect(first.rows[0].id).toBe('table_104');expect(JSON.stringify(first.rows)).not.toContain('private audit detail');
 const second=(await get('/api/tables/audit?page=1&page_size=10&as_of='+first.snapshot)).json();expect(second.rows).toHaveLength(10);expect(second.rows[0].id).toBe('table_094');expect(new Set([...first.rows,...second.rows].map(r=>r.id)).size).toBe(20);
 const last=(await get('/api/tables/audit?page=999999&page_size=10')).json();expect(last.pagination.pageIndex).toBe(10);expect(last.rows).toHaveLength(5);
});
it('filters literal search before counting and paging, without wildcard or SQL interpretation',async()=>{
 const percent=(await get('/api/tables/audit?search='+encodeURIComponent('%_'))).json();expect(percent.pagination.rowCount).toBe(1);expect(percent.rows[0].action).toBe('percent%_marker');
 const injection=(await get('/api/tables/audit?search='+encodeURIComponent("' OR 1=1 --"))).json();expect(injection.pagination.rowCount).toBe(0);expect(injection.rows).toEqual([]);
 const empty=(await get('/api/tables/audit?page=50&search=absent')).json();expect(empty.pagination).toEqual({pageIndex:0,pageSize:10,rowCount:0,pageCount:0});
});
it('keeps appended actions outside an existing paging snapshot until refresh',async()=>{
 // Exercise a known time boundary; two fast requests can share the same
 // millisecond, in which case now() is not actually after the inclusive cutoff.
 const first=(await get('/api/tables/audit?page_size=5&as_of=2020-01-01T00:00:00.000Z')).json();await db.query("INSERT INTO audit(id,action,created_at) VALUES('table_new','new action','2020-01-01T00:00:00.001Z')");
 const same=(await get('/api/tables/audit?page_size=5&as_of='+first.snapshot)).json();expect(same.rows.map((r:any)=>r.id)).toEqual(first.rows.map((r:any)=>r.id));expect(same.pagination.rowCount).toBe(first.pagination.rowCount);
 const fresh=(await get('/api/tables/audit?page_size=5')).json();expect(fresh.rows[0].id).toBe('table_new');expect(fresh.pagination.rowCount).toBe(first.pagination.rowCount+1);
});
it('serves complete maintenance history and sorts nullable fields with nulls last',async()=>{
 const result=(await get('/api/tables/operations?page=2&page_size=10')).json();expect(result.pagination).toEqual({pageIndex:2,pageSize:10,rowCount:21,pageCount:3});expect(result.rows).toHaveLength(1);
 const nullable=(await get('/api/tables/operations?sort=finished_at&direction=asc&page_size=25')).json();expect(nullable.rows.at(-1).id).toBe('table_run_020');
 const filtered=(await get('/api/tables/operations?search=failed')).json();expect(filtered.pagination.rowCount).toBe(0);
});
it('enforces authentication, owner-only history and strict bounded query validation',async()=>{
 for(const endpoint of ['/api/tables/audit','/api/tables/operations']){
  expect((await app.inject({url:endpoint,headers:{host}})).statusCode).toBe(401);
  expect((await app.inject({url:endpoint,headers:{host,cookie:'ir_session='+viewer}})).statusCode).toBe(403);
  for(const query of ['page=-1','page=1.5','page=01','page=1000000','page=1&page=2','page_size=0','page_size=10000','sort=id','direction=DESC','secret=1','search=%00','as_of=2020-99-01T00:00:00.000Z'])expect((await get(endpoint+'?'+query)).statusCode,endpoint+'?'+query).toBe(400);
 }
 expect((await get('/api/tables/audit?sort='+encodeURIComponent('created_at;DROP TABLE audit'))).statusCode).toBe(400);
});

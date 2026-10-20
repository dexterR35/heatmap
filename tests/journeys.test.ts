import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {batch,demoOrigin,testDB} from './fixtures.js';
import type {DB} from '../packages/db/index.js';
import {createCollector} from '../apps/server/collector.js';
let db:DB,collector:ReturnType<typeof createCollector>;
beforeAll(async()=>{db=await testDB();collector=createCollector(db);await collector.app.ready();});
afterAll(async()=>{await collector.app.close();await db.close();});
const send=(context:object)=>{const b=batch();return collector.app.inject({method:'POST',url:'/v1/events',headers:{origin:demoOrigin},payload:{...b,context:{...b.context,...context}}});};

it('refuses tab session IDs unless the site enabled journeys',async()=>{
 expect((await send({session_id:randomUUID(),session_seq:1})).statusCode).toBe(422);
 expect((await collector.app.inject({url:'/v2/config/site_local_demo_2026',headers:{origin:demoOrigin}})).json().journeys).toBeUndefined();
});
it('stores the journey with each view once enabled, and requires both fields',async()=>{
 await db.query("UPDATE sites SET journeys_enabled=true WHERE id='local-demo'");
 expect((await collector.app.inject({url:'/v2/config/site_local_demo_2026',headers:{origin:demoOrigin}})).json().journeys).toBe(true);
 const id=randomUUID();
 expect((await send({session_id:id,session_seq:1})).statusCode).toBe(204);
 expect((await send({session_id:id})).statusCode).toBe(422);
 expect((await send({session_id:id,session_seq:0})).statusCode).toBe(400);
 expect((await db.query("SELECT 1 FROM views WHERE context->>'session_id'=$1",[id])).length).toBe(1);
});

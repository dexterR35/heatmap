import {it,expect} from 'vitest';
import {batch,demoOrigin,testDB} from './fixtures.js';
import {seedRegistry} from '../apps/server/seed.js';
import {ingest} from '../apps/server/ingestion.js';
import {createCollector} from '../apps/server/collector.js';

it('moves the saved demo to a new port without replacing recorded data or policies',async()=>{
 const db=await testDB();
 const collector=createCollector(db);
 try{
  const recorded=batch();await ingest(db,recorded,demoOrigin);
  await db.query("UPDATE pages SET enabled=false,revision='custom-revision' WHERE site_id='local-demo' AND page_key='casino-halloween'");
  const [before]=await db.query("SELECT * FROM sites WHERE id='local-demo'");
  const realBefore=await db.query("SELECT id,origin FROM sites WHERE environment='real' ORDER BY id");
  const nextOrigin='http://127.0.0.1:4174';
  await seedRegistry(db,nextOrigin);
  const [after]=await db.query("SELECT * FROM sites WHERE id='local-demo'");
  expect(after).toEqual({...before,origin:nextOrigin,config_version:before.config_version+1});
  const pages=await db.query("SELECT * FROM pages WHERE site_id='local-demo' ORDER BY page_key");
  expect(pages).toHaveLength(2);
  expect(pages.every(page=>page.selector.origin===nextOrigin)).toBe(true);
  expect(pages.find(page=>page.page_key==='casino-halloween')).toMatchObject({enabled:false,revision:'custom-revision'});
  expect(await db.query('SELECT event_id FROM events WHERE view_id=$1',[recorded.view_id])).toEqual([{event_id:recorded.events[0].event_id}]);
  expect(await db.query("SELECT id,origin FROM sites WHERE environment='real' ORDER BY id")).toEqual(realBefore);
  expect(await db.query("SELECT version FROM config_history WHERE site_id='local-demo' ORDER BY version")).toEqual([{version:1},{version:2}]);
  const response=await collector.app.inject({url:'/v2/config/site_local_demo_2026',headers:{origin:nextOrigin}});
  expect(response.statusCode).toBe(200);
  expect(response.headers['access-control-allow-origin']).toBe(nextOrigin);
  expect(response.json().pages[0].selector.origin).toBe(nextOrigin);
  expect((await collector.app.inject({url:'/v2/config/site_local_demo_2026',headers:{origin:demoOrigin}})).statusCode).toBe(403);
  await seedRegistry(db,nextOrigin);
  expect(await db.query("SELECT * FROM sites WHERE id='local-demo'")).toEqual([after]);
  expect(await db.query("SELECT version FROM config_history WHERE site_id='local-demo' ORDER BY version")).toHaveLength(2);
 }finally{await collector.app.close();await db.close();}
});

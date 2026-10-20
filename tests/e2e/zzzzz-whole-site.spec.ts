import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

const fixture=async()=>JSON.parse(await readFile(path.join(process.env.E2E_DATA_DIR!,'whole-site.json'),'utf8')) as {origin:string};
const status=(page:Page)=>page.evaluate(()=>(window as any).InfraredSDK?.getStatus().state);

test('whole-site mode: one snippet, a page per canonical path, client-side navigation and excluded areas',async({page})=>{
 const {origin}=await fixture();
 const batches:any[]=[];page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/v1/events'))batches.push(r.postDataJSON());});
 const open=async(route:string)=>{await page.goto(origin+route);await page.getByRole('button',{name:'Allow analytics'}).click();};

 await open('/');await expect.poll(()=>status(page)).toBe('ACTIVE');
 await page.getByRole('link',{name:'Sign up'}).click();
 // Client-side navigation to another path starts a new page view under that path's key.
 await page.evaluate(()=>history.pushState({},'','/about'));
 await expect.poll(()=>status(page)).toBe('ACTIVE');await page.evaluate(()=>(window as any).InfraredSDK.flush());
 await expect.poll(()=>batches.some(b=>b.context.page_key==='p.about')).toBe(true);
 // The home view's queued events were sent before switching, not dropped.
 expect(batches.filter(b=>b.context.page_key==='p.home').flatMap(b=>b.events).some((e:any)=>e.type==='page_view')).toBe(true);

 await open('/projects/123');await expect.poll(()=>status(page)).toBe('ACTIVE');
 await page.evaluate(()=>(window as any).InfraredSDK.flush());
 await expect.poll(()=>batches.some(b=>b.context.page_key==='p.projects.id')).toBe(true);

 // Sensitive areas are excluded by default: nothing loads or is sent there, even with consent.
 const before=batches.length;await open('/account/settings');await page.waitForTimeout(800);
 expect(await status(page)).toBeUndefined();expect(batches.length).toBe(before);

 const contexts=batches.map(b=>b.context);
 // Journeys: one tab-only session across the pages of this tab, numbered in visit order.
 const home=contexts.find(c=>c.page_key==='p.home'),about=contexts.find(c=>c.page_key==='p.about'),project=contexts.find(c=>c.page_key==='p.projects.id');
 expect(home.session_id).toMatch(/^[0-9a-f-]{36}$/);expect([about.session_id,project.session_id]).toEqual([home.session_id,home.session_id]);
 expect([home.session_seq,about.session_seq,project.session_seq]).toEqual([1,2,3]);
 // Withdrawing consent removes the stored journey immediately.
 await page.goto(origin+'/');await page.getByRole('button',{name:'Allow analytics'}).click();await expect.poll(()=>status(page)).toBe('ACTIVE');
 await page.evaluate(()=>(window as any).denyAnalytics());expect(await page.evaluate(()=>sessionStorage.getItem('infrared.journey'))).toBeNull();
 expect(contexts.find(c=>c.page_key==='p.home')).toMatchObject({page_path:'/',revision:'auto'});
 expect(contexts.find(c=>c.page_key==='p.projects.id')).toMatchObject({page_path:'/projects/:id'});
 expect(JSON.stringify(batches)).not.toContain('/projects/123');
 expect(batches.flatMap(b=>b.events).some((e:any)=>e.type==='activation'&&e.action_id==='signup')).toBe(true);

 // The pages exist in the dashboard, created on first visit.
 const session=JSON.parse(await readFile(path.join(process.env.E2E_DATA_DIR!,'browser-session.json'),'utf8'));
 await page.goto('/');await page.context().addCookies([{name:'ir_session',value:session.cookie,url:new URL(page.url()).origin,httpOnly:true,sameSite:'Strict'}]);
 const data=await (await page.request.get('/api/bootstrap')).json();
 const keys=data.pages.filter((p:any)=>p.site_id==='local-site').map((p:any)=>p.page_key).sort();
 expect(keys).toEqual(['p.about','p.home','p.projects.id']);
});

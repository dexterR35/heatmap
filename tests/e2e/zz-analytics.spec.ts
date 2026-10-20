import {test,expect} from '@playwright/test';
import {demoOrigin} from './environment.js';
test('diagnostic signals contain generic codes, link real clicks, and stop on withdrawal',async({page})=>{
 const batches:any[]=[];page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/v1/events'))batches.push(r.postDataJSON());});
 await page.goto(demoOrigin+'/casino/?lp=halloween');await page.getByRole('button',{name:'Allow demo analytics'}).click();await expect.poll(()=>page.evaluate(()=>(window as any).InfraredSDK?.getStatus().state)).toBe('ACTIVE');
 await page.evaluate(()=>{const button=document.createElement('button');button.id='no-response-probe';button.setAttribute('data-hm-id','hero-register');button.textContent='Diagnostic fixture control';button.style.cssText='position:absolute;left:30px;top:170px;z-index:50;width:180px;height:40px';document.body.appendChild(button);});
 await page.locator('#no-response-probe').click({clickCount:3});await page.waitForTimeout(1300);
 await page.evaluate(()=>{window.dispatchEvent(new ErrorEvent('error',{message:'PRIVATE_ERROR_SENTINEL_12345',filename:'https://private.invalid/profile',error:new Error('PRIVATE_STACK_SENTINEL')}));});await page.evaluate(()=>(window as any).InfraredSDK.flush());
 await expect.poll(()=>batches.flatMap(b=>b.events).filter(e=>e.type==='diagnostic').length).toBeGreaterThan(0);const events=batches.flatMap(b=>b.events);expect(events.some(e=>e.type==='diagnostic'&&e.kind==='runtime_error'&&e.code==='runtime-error')).toBe(true);const dead=events.filter(e=>e.type==='diagnostic'&&e.kind==='dead_click');expect(dead.length).toBeGreaterThan(0);expect(dead.every(d=>events.some(c=>c.type==='click'&&c.event_id===d.related_event_id))).toBe(true);expect(JSON.stringify(batches)).not.toMatch(/PRIVATE_|private\.invalid/);
 await page.getByRole('button',{name:'Privacy choices'}).click();const count=batches.length;await page.evaluate(()=>window.dispatchEvent(new ErrorEvent('error',{message:'AFTER_WITHDRAWAL'})));await page.waitForTimeout(1300);expect(batches).toHaveLength(count);expect(await page.evaluate(()=>(window as any).InfraredSDK.getStatus().queuedEvents)).toBe(0);
});

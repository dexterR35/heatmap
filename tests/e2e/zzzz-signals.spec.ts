import {demoOrigin} from './environment.js';
import {test,expect} from '@playwright/test';

test('behaviour signals: source, device, movement, hover, forms, attention and engagement without typed values',async({page})=>{
 const payloads:any[]=[];page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/v1/events'))payloads.push(r.postDataJSON());});
 await page.clock.install();
 await page.setViewportSize({width:1440,height:900});
 await page.goto(demoOrigin+'/casino/?lp=halloween');
 await page.getByRole('button',{name:'Allow demo analytics'}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).InfraredSDK?.getStatus().state)).toBe('ACTIVE');

 // An opt-in form, added at runtime so the reference screenshots keep their geometry.
 await page.evaluate(()=>{const form=document.createElement('form');form.setAttribute('data-hm-form','signup');form.innerHTML='<input data-hm-field="email" type="email" required aria-label="Signup email"><button type="button">Next</button>';document.body.appendChild(form);});
 const field=page.getByLabel('Signup email');await field.fill('secret-typed@example.com');await field.blur();

 // Hover the registered CTA for longer than 300 ms, then leave it.
 const cta=page.locator('[data-hm-id="hero-register"]');await cta.scrollIntoViewIfNeeded();const box=(await cta.boundingBox())!;
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.clock.runFor(450);await page.mouse.move(10,700);

 // Mouse movement samples (throttled to one per 100 ms).
 for(let i=0;i<5;i++){await page.mouse.move(300+i*40,500+i*10);await page.clock.runFor(120);}

 // Let the 5-second signal timer report attention and engagement, then flush.
 await page.clock.runFor(6000);await page.evaluate(()=>(window as any).InfraredSDK.flush());
 await expect.poll(()=>payloads.flatMap(b=>b.events).some((e:any)=>e.type==='attention')).toBe(true);

 const events=payloads.flatMap(b=>b.events),types=new Set(events.map((e:any)=>e.type));
 const view=events.find((e:any)=>e.type==='page_view');
 expect(view.source).toEqual({channel:'direct'});expect(view.client).toMatchObject({browser:'chrome',device:'desktop'});
 for(const type of ['movement','hover','form','attention','engagement'])expect(types.has(type),type).toBe(true);
 expect(events.find((e:any)=>e.type==='hover')).toMatchObject({element_id:'hero-register'});
 expect(events.filter((e:any)=>e.type==='form').map((e:any)=>e.action)).toEqual(expect.arrayContaining(['start','field_complete']));
 expect(events.find((e:any)=>e.type==='form'&&e.action==='field_complete')).toMatchObject({form_id:'signup',field_id:'email',filled:true});
 expect(JSON.stringify(payloads)).not.toContain('secret-typed');
 for(const cell of events.filter((e:any)=>e.type==='movement').flatMap((e:any)=>e.cells)){expect(cell.x%8).toBe(0);expect(cell.y%8).toBe(0);}
});

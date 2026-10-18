import {demoOrigin,collectorOrigin,credentialsFile} from './environment.js';
import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('stored-label XSS probes render as text and unsafe URLs produce no installation scope',async({page})=>{
 const credentials=JSON.parse(await readFile(credentialsFile,'utf8'));await page.goto('/');await page.getByLabel('Email address').fill(credentials.email);await page.getByLabel('Password',{exact:true}).fill(credentials.password);await page.getByRole('button',{name:'Sign in to workspace'}).click();await expect(page.getByRole('heading',{name:'Landing pages.'})).toBeVisible();
 const original=await (await page.request.get('/api/bootstrap')).json();let payload='';const dialogs:string[]=[];page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.dismiss();});await page.addInitScript(()=>{(window as any).__securityProbe=false;});
 await page.route('**/api/bootstrap',route=>route.fulfill({json:{...original,pages:original.pages.map((p:any,i:number)=>i===0?{...p,name:payload}:p)}}));
 for(const probe of ['<img src=x onerror="window.__securityProbe=true">','<svg onload="window.__securityProbe=true"></svg>','</script><script>window.__securityProbe=true</script>','\"><a href="javascript:alert(1)">click</a>']){
  payload=probe;await page.reload();const label=page.locator('.page-name strong').filter({hasText:probe});await expect(label).toBeVisible();await expect(label).toHaveText(probe);await expect(label.locator('img,svg,script,a')).toHaveCount(0);expect(await page.evaluate(()=>(window as any).__securityProbe)).toBe(false);
 }
 expect(dialogs).toEqual([]);await expect(page.locator('.local-box a')).toHaveAttribute('href',original.demo_url);
 await page.getByRole('button',{name:'Add landing page',exact:true}).click();
 for(const url of ['javascript:alert(1)','data:text/html,<svg onload=alert(1)>','https://user:pass@example.invalid/casino/']){await page.getByLabel('Landing page URL').fill(url);await expect(page.locator('.selector-preview')).toHaveCount(0);await expect(page.getByRole('button',{name:'Save disabled draft'})).toBeDisabled();}
 await page.keyboard.press('Escape');await page.screenshot({path:'.local/evidence/security-xss-probes.png',fullPage:true});
});

for(const boundary of ['data-hm-private','data-hm-ignore','contenteditable','form'])test('stops exposure when a registered element becomes '+boundary,async({page})=>{
 const payloads:any[]=[];page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/v1/events'))payloads.push(r.postDataJSON());});
 await page.clock.install();await page.goto(demoOrigin+'/casino/?lp=halloween');await page.clock.pauseAt(new Date(Date.now()+2000));
 await page.getByRole('button',{name:'Allow demo analytics'}).click();await expect.poll(()=>page.evaluate(()=>(window as any).NBHeatmap?.getStatus().state)).toBe('ACTIVE');
 await page.evaluate(boundary=>{const hero=document.querySelector('[data-hm-id="hero"]')!;if(boundary==='form'){const form=document.createElement('form');hero.replaceWith(form);form.appendChild(hero);}else hero.setAttribute(boundary,'true');},boundary);
 await page.clock.runFor(2000);await page.evaluate(()=>(window as any).NBHeatmap.flush());
 const exposures=payloads.flatMap(b=>b.events).filter(e=>e.type==='exposure'&&['hero','hero-register'].includes(e.element_id));expect(exposures).toEqual([]);
});

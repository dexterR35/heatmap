import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {credentialsFile,demoOrigin} from './environment.js';
async function login(page:Page){if(!process.env.E2E_DATA_DIR)throw new Error('DISPOSABLE_E2E_FIXTURE_REQUIRED');const session=JSON.parse(await readFile(path.join(path.dirname(credentialsFile),'browser-session.json'),'utf8'));await page.goto('/');await page.context().addCookies([{name:'ir_session',value:session.cookie,url:new URL(page.url()).origin,httpOnly:true,sameSite:'Strict'}]);await page.reload();await expect(page.getByRole('heading',{name:'Landing pages.'})).toBeVisible();}
test('market registry validates exact landing pages and scopes the portfolio',async({page})=>{
 await login(page);await page.goto('/#markets');await expect(page.getByRole('heading',{name:'Markets & registry.'})).toBeVisible();
 const before=await (await page.request.get('/api/bootstrap')).json();
 const rows=[{name:'UK Casino · Summer WO',page_key:'casino-summer-wo',url:'https://uk.landing.example.com/casino/?lp=summer-wo',market:'UK',product:'casino',brand:'example',locale:'en-GB',currency:'GBP',report_timezone:'Europe/London',page_family:'summer',acquisition_goal:'registration_completed'}];
 await page.getByLabel('Registry import JSON').fill(JSON.stringify(rows));await page.getByRole('button',{name:'Validate import',exact:true}).click();await expect(page.getByText('1 changes validated. Ready to apply.')).toBeVisible();
 expect((await (await page.request.get('/api/bootstrap')).json()).pages.length).toBe(before.pages.length);
 await page.getByRole('button',{name:'Apply validated changes',exact:true}).click();await expect(page.getByText('Registry updated. New real-site pages remain disabled.')).toBeVisible();
 await page.getByLabel('Portfolio market',{exact:true}).selectOption('UK');await page.getByLabel('Portfolio product',{exact:true}).selectOption('casino');
 const table=page.getByRole('table',{name:'Market landing pages',exact:true});await expect(table.locator('tbody tr[data-row-id]')).toHaveCount(1);await expect(table).toContainText('UK Casino');
 const data=await (await page.request.get('/api/bootstrap')).json();expect(data.pages.find((p:any)=>p.page_key==='casino-summer-wo').enabled).toBe(false);
 await page.screenshot({path:'.local/evidence/growth-market-registry.png',fullPage:true});await page.setViewportSize({width:375,height:812});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('registry drafts and read-only link checks never imply installation or manufacture traffic',async({page})=>{
 await login(page);await page.goto('/#markets');await page.getByLabel('Portfolio market',{exact:true}).selectOption('UK');
 const registry=page.getByRole('table',{name:'Market landing pages',exact:true});await expect(registry).toContainText('Draft · collection disabled');await expect(registry).toContainText('No recorded events received');await expect(page.getByText('Report date boundaries currently use UTC for every market',{exact:false})).toBeVisible();
 await page.goto('/#installation');await page.getByLabel('Landing page',{exact:true}).selectOption('local-demo/casino-halloween');
 const panel=page.getByRole('region',{name:'Landing page installation check',exact:true});
 const before=(await (await page.request.get('/api/installations')).json()).rows.find((r:any)=>r.site_id==='local-demo'&&r.page_key==='casino-halloween');
 const response=page.waitForResponse(r=>r.url().endsWith('/api/pages/local-demo/casino-halloween/check-installation')&&r.request().method()==='POST');
 await panel.getByRole('button',{name:'Check link & pixel',exact:true}).click();expect((await response).status()).toBe(200);
 await expect(panel).toContainText('Success · page loads · HTTP 200');await expect(panel).toContainText('Pixel code detected');await expect(panel).toContainText('Site key matches.');await expect(panel).toContainText('Response headers:');
 const after=(await (await page.request.get('/api/installations')).json()).rows.find((r:any)=>r.site_id==='local-demo'&&r.page_key==='casino-halloween');expect(after.last_event_at).toBe(before.last_event_at);
 await page.reload();await expect(panel).toContainText('Pixel code detected');await page.screenshot({path:'.local/evidence/installation-verified.png',fullPage:true});
 await page.setViewportSize({width:375,height:812});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('experiment assigns an actual browser cohort, maps its clicks and accepts backend demo outcomes once',async({page,context})=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await login(page);await page.goto('/#experiments');await page.getByRole('button',{name:'New experiment',exact:true}).click();await page.getByLabel('Experiment name',{exact:true}).fill('Browser acquisition acceptance');await page.getByLabel('Experiment landing page',{exact:true}).selectOption('local-demo/casino-halloween');await page.getByLabel('Experiment type',{exact:true}).selectOption('ab');await page.getByLabel('Treatment variant code',{exact:true}).fill('browser-treatment');await page.getByLabel('Experiment minimum days',{exact:true}).fill('1');await page.getByLabel('Experiment attribution hours',{exact:true}).fill('1');
 await page.getByRole('button',{name:'Create experiment draft',exact:true}).click();await expect(page.getByRole('region',{name:'Experiment readout'})).toContainText('Browser acquisition acceptance');await page.getByRole('button',{name:'Start experiment',exact:true}).click();await expect(page.getByRole('button',{name:'Pause assignments',exact:true})).toBeVisible();
 const bootstrap=await (await page.request.get('/api/bootstrap')).json(),e=bootstrap.experiments.find((e:any)=>e.name==='Browser acquisition acceptance'),headers={Origin:new URL(page.url()).origin,'X-CSRF-Token':bootstrap.user.csrf};
 const lab=await context.newPage();await lab.goto(demoOrigin+'/experiment-lab/');await lab.getByLabel('Running local experiment').selectOption(e.id);await lab.getByRole('button',{name:'Start consented preview',exact:true}).click();
 const frame=lab.frameLocator('#preview');await expect.poll(()=>frame.locator('html').evaluate(()=>(window as any).InfraredSDK?.getStatus().state)).toBe('ACTIVE');await frame.locator('[data-hm-id="hero-register"]').click();await frame.locator('html').evaluate(()=>(window as any).InfraredSDK.flush());
 const assigned=await frame.locator('html').getAttribute('data-hm-variant');expect([e.control_variant,e.treatment_variant]).toContain(assigned);
 await lab.getByRole('button',{name:'Complete demo registration',exact:true}).click();await expect(lab.getByRole('status')).toContainText('accepted once');await lab.getByRole('button',{name:'Complete demo registration',exact:true}).click();await lab.getByRole('button',{name:'Complete demo acquisition',exact:true}).click();await lab.screenshot({path:'.local/evidence/growth-experiment-lab.png',fullPage:true});
 const capture=await page.request.post('/api/pages/local-demo/casino-halloween/capture',{headers,data:{width:1440,height:900,variant:e.treatment_variant}});expect(capture.status()).toBe(202);const job=await capture.json();let state:any;
 await expect.poll(async()=>{state=await (await page.request.get('/api/captures/'+job.id)).json();return state.status;},{timeout:40000}).toBe('pending-review');expect((await page.request.post('/api/references/'+state.reference_id+'/approve',{headers,data:{}})).status()).toBe(200);
 const params=new URLSearchParams({site_id:'local-demo',page_key:'casino-halloween',variant:assigned!,experiment_id:e.id,mapping:'element',width:'1440',device:'all',data_source:'recorded'});let mapped:any;
 await expect.poll(async()=>{const response=await page.request.get('/api/reports?'+params);expect(response.status()).toBe(200);mapped=await response.json();return mapped.quality?.mapped;}).toBeGreaterThan(0);expect(mapped.summary.views).toBe(1);expect(mapped.reference.manifest.variant).toBe(assigned);
 const outcome=await (await page.request.get('/api/acquisition?data_source=recorded')).json();expect(outcome.rows.reduce((n:number,r:any)=>n+(r.registrations??0),0)).toBe(1);expect(outcome.rows.reduce((n:number,r:any)=>n+(r.qualified_acquisitions??0),0)).toBe(1);
 await page.getByRole('button',{name:'Refresh readout',exact:true}).click();await expect(page.getByRole('region',{name:'Experiment readout'})).toContainText('attribution window open');await expect(page.getByRole('region',{name:'Experiment readout'})).toContainText('inconclusive');await page.screenshot({path:'.local/evidence/growth-experiment-readout.png',fullPage:true});
 await page.getByRole('button',{name:'Close assignments',exact:true}).click();await expect(page.getByRole('region',{name:'Experiment readout'})).toContainText('completed');
 await page.goto('/#acquisition');await expect(page.getByRole('table',{name:'Acquisition performance',exact:true})).toContainText('Halloween casino');await page.screenshot({path:'.local/evidence/growth-acquisition.png',fullPage:true});
 await page.setViewportSize({width:375,height:812});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('.nav-group').filter({hasText:'Analysis'})).not.toHaveAttribute('open');await page.screenshot({path:'.local/evidence/growth-acquisition-mobile.png',fullPage:true});
 await lab.bringToFront();await lab.getByRole('button',{name:'Withdraw demo consent',exact:true}).click({timeout:10000});await expect(lab.getByRole('status')).toContainText('Consent withdrawn.');const sdkStatus=await frame.locator('html').evaluate(()=>(window as any).InfraredSDK.getStatus());expect(sdkStatus.queuedEvents).toBe(0);expect(sdkStatus.state).not.toBe('ACTIVE');const after=await (await page.request.get(`/api/experiments/${e.id}/readout`,{timeout:10000})).json();expect(after.blockers).toContain('PRIVACY_EXCLUSIONS');expect(errors).toEqual([]);await lab.close();
});

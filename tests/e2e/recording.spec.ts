import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {demoOrigin,credentialsFile} from './environment.js';
test('real browser clicks appear in recorded reports without generated samples',async({page,context})=>{
 const credentials=JSON.parse(await readFile(credentialsFile,'utf8'));await page.goto('/');await page.getByLabel('Email address').fill(credentials.email);await page.getByLabel('Password',{exact:true}).fill(credentials.password);await page.getByRole('button',{name:'Sign in to workspace'}).click();await expect(page.getByRole('heading',{name:'Landing pages.'})).toBeVisible();
 const reportURL='/api/reports?site_id=local-demo&page_key=casino-halloween&width=1440&device=desktop';
 const before=await(await page.request.get(reportURL)).json();expect(before.data_source).toBe('recorded');expect(before.summary.views).toBe(0);
 const samples=await(await page.request.get(reportURL+'&data_source=seeded')).json();expect(samples.summary.views).toBeGreaterThan(0);
 const landing=await context.newPage();await landing.setViewportSize({width:1440,height:900});await landing.goto(demoOrigin+'/casino/?lp=halloween');await expect(landing.locator('#tracking-status')).toContainText('awaiting consent');await landing.getByRole('button',{name:'Allow demo analytics'}).click();await expect.poll(()=>landing.evaluate(()=>(window as any).NBHeatmap?.getStatus().state)).toBe('ACTIVE');await expect(landing.locator('#tracking-status')).toContainText('Recording clicks');
 const accepted=landing.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/v1/events')&&r.status()===204);await landing.locator('[data-hm-id="hero-register"]').click();await landing.evaluate(()=>(window as any).NBHeatmap.flush());await accepted;
 await expect.poll(async()=>{const r=await(await page.request.get(reportURL)).json();return r.summary.clicks;}).toBeGreaterThan(before.summary.clicks);
 const after=await(await page.request.get(reportURL)).json();expect(after.summary.views).toBe(1);expect(after.quality.mapped).toBeGreaterThan(0);expect(after.points.length).toBeGreaterThan(0);await landing.close();
 await page.getByRole('button',{name:'Heatmaps',exact:true}).click();await expect(page.getByLabel('Data source')).toHaveValue('recorded');await expect(page.locator('.analytics-stats .stat').filter({hasText:'Pointer clicks'}).locator('strong')).toHaveText('1');
 await page.getByLabel('Data source').selectOption('seeded');await expect(page.locator('.analytics-stats .stat').filter({hasText:'Pointer clicks'}).locator('strong')).toHaveText(new Intl.NumberFormat('en-GB').format(samples.summary.clicks));
 await page.getByLabel('Data source').selectOption('recorded');await expect(page.locator('.analytics-stats .stat').filter({hasText:'Pointer clicks'}).locator('strong')).toHaveText('1');
 await expect.poll(()=>page.locator('.heat-canvas').evaluate((c:HTMLCanvasElement)=>{const pixels=c.getContext('2d')!.getImageData(0,0,c.width,c.height).data;return pixels.some((n,i)=>i%4===3&&n>0);})).toBe(true);await page.screenshot({path:'.local/evidence/recorded-clicks-verified.png',fullPage:true});
});

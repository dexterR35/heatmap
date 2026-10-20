import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
it('tracker has no storage, replay, or form-value capture APIs',async()=>{
 for(const file of ['tracker.ts','signals.ts','diagnostics.ts','bootstrap.ts']){const source=await readFile('apps/tracker/'+file,'utf8');
  for(const banned of ['localStorage','sessionStorage','indexedDB','document.cookie','sendBeacon','innerHTML','textContent','innerText','selectionStart','getSelection'])expect(source,file+' uses '+banned).not.toContain(banned);
  // A form field's value may only be checked for emptiness, never read or sent.
  for(const use of source.match(/\.value[^,;)]*/g)??[])expect(use,file).toMatch(/^\.value\.length>0$/);}
});
it('journeys are the only storage: one tab-only key, opt-in, removable',async()=>{
 const source=await readFile('apps/tracker/journey.ts','utf8');
 for(const banned of ['localStorage','indexedDB','document.cookie'])expect(source).not.toContain(banned);
 expect(source.match(/sessionStorage\.\w+/g)).toEqual(['sessionStorage.getItem','sessionStorage.setItem','sessionStorage.removeItem']);
 expect(source.match(/JOURNEY_KEY/g)?.length).toBe(4);
});
it('privacy boundaries are runtime checks, not just documentation',async()=>{const source=await readFile('apps/tracker/tracker.ts','utf8');for(const required of ['data-hm-private','data-hm-ignore','generation','AbortController','credentials:\'omit\'','permitted()','queue=[]'])expect(source).toContain(required);});

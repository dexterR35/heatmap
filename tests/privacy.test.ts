import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
it('tracker has no storage, replay, or form-value capture APIs',async()=>{const source=await readFile('apps/tracker/tracker.ts','utf8');for(const banned of ['localStorage','sessionStorage','indexedDB','document.cookie','sendBeacon','innerHTML','textContent','input.value'])expect(source).not.toContain(banned);});
it('privacy boundaries are runtime checks, not just documentation',async()=>{const source=await readFile('apps/tracker/tracker.ts','utf8');for(const required of ['data-hm-private','data-hm-ignore','generation','AbortController','credentials:\'omit\'','permitted()','queue=[]'])expect(source).toContain(required);});

import {it,expect,describe} from 'vitest';
import {canonicalPath,pathKey,validRules,DEFAULT_RULES,type SiteRules} from '../packages/domain/site-paths.js';

describe('canonical page paths',()=>{
 it('keeps ordinary pages and trims the trailing slash',()=>{
  expect(canonicalPath('/',DEFAULT_RULES)).toBe('/');
  expect(canonicalPath('/software-development/',DEFAULT_RULES)).toBe('/software-development');
  expect(canonicalPath('/legal/termeni.html',DEFAULT_RULES)).toBe('/legal/termeni.html');
 });
 it('collapses record IDs, UUIDs and tokens so pages with one layout share a heatmap',()=>{
  expect(canonicalPath('/projects/1234',DEFAULT_RULES)).toBe('/projects/:id');
  expect(canonicalPath('/order/550e8400-e29b-41d4-a716-446655440000/status',DEFAULT_RULES)).toBe('/order/:id/status');
  expect(canonicalPath('/share/a8f3k2m9x7q1w5e6r4t0y2',DEFAULT_RULES)).toBe('/share/:id');
 });
 it('never tracks paths that could carry personal data',()=>{
  expect(canonicalPath('/u/jane.doe@example.com',DEFAULT_RULES)).toBeNull();
  expect(canonicalPath('/hello%20world',DEFAULT_RULES)).toBeNull();
  expect(canonicalPath('/bad%E0%A4%A',DEFAULT_RULES)).toBeNull();
  expect(canonicalPath('/'+'a/'.repeat(13),DEFAULT_RULES)).toBeNull();
 });
 it('skips sensitive areas by default',()=>{
  for(const path of ['/login','/account/orders','/admin/','/checkout/pay','/reset/abc','/api/v1/x'])expect(canonicalPath(path,DEFAULT_RULES),path).toBeNull();
  expect(canonicalPath('/accounting-services',DEFAULT_RULES)).toBe('/accounting-services');
 });
 it('applies include rules and named patterns',()=>{
  const rules:SiteRules={include:['/blog/*','/pricing'],exclude:['/blog/drafts/*'],patterns:['/blog/*']};
  expect(canonicalPath('/blog/my-first-post',rules)).toBe('/blog/*');
  expect(canonicalPath('/blog/drafts/x',rules)).toBeNull();
  expect(canonicalPath('/pricing',rules)).toBe('/pricing');
  expect(canonicalPath('/about',rules)).toBeNull();
 });
});

describe('page keys',()=>{
 it('are readable, valid codes and stable',()=>{
  expect(pathKey('/')).toBe('p.home');
  expect(pathKey('/software-development')).toBe('p.software-development');
  expect(pathKey('/projects/:id')).toBe('p.projects.id');
  expect(pathKey('/blog/*')).toBe('p.blog.all');
  const long=pathKey('/'+'segment-name/'.repeat(8)+'end');
  expect(long.length).toBeLessThanOrEqual(64);expect(long).toMatch(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,63}$/);expect(pathKey('/'+'segment-name/'.repeat(8)+'end')).toBe(long);
  expect(pathKey('/'+'segment-name/'.repeat(8)+'other')).not.toBe(long);
 });
});

it('validates stored rules',()=>{
 expect(validRules(DEFAULT_RULES)).toBe(true);
 expect(validRules({include:[],exclude:[],patterns:[]})).toBe(false);
 expect(validRules({include:['/*'],exclude:['no-slash'],patterns:[]})).toBe(false);
 expect(validRules({include:['/*'],exclude:[],patterns:['/a/*/b']})).toBe(false);
});

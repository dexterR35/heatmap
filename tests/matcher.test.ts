import {describe,it,expect} from 'vitest';
import {matchesSelector,matchPage,selectorsOverlap,parseAddress,type Selector} from '../packages/domain/matcher.js';
const s:Selector={origin:'https://landing.example.com',path:'/casino/',query_equals:{lp:'halloween'},ignored_query_names:['utm_source'],other_query_policy:'reject',duplicate_query_policy:'reject',fragment_policy:'ignore_anchor'};
describe('exact landing-page scope',()=>{
 for(const tail of ['?lp=halloween','?lp=hallow%65en','?lp=halloween&utm_source=anything','#anchor?ignored=false']){
  if(tail.startsWith('#'))continue;
  it('accepts approved identity '+tail,()=>expect(matchesSelector(s.origin+s.path+tail,s)).toBe(true));
 }
 for(const address of ['https://landing.example.com/','https://landing.example.com/casino/','https://landing.example.com/casino/?lp=christmas','https://landing.example.com/casino/?lp=halloween&lp=halloween','https://landing.example.com/casino/?lp=halloween&%6cp=christmas','https://landing.example.com/casino/?lp=halloween&token=private','https://landing.example.com/casino/?lp=%2568alloween','https://landing.example.com/casino/?lp=Halloween','https://landing.example.com/casino?lp=halloween','https://landing.example.com/Casino/?lp=halloween','https://landing.example.com.attacker.invalid/casino/?lp=halloween','https://casino.landing.example.com/casino/?lp=halloween','https://landing.example.com:8443/casino/?lp=halloween','https://user@go.netbet.ro/casino/?lp=halloween','https://landing.example.com/casino/?lp=halloween%','https://landing.example.com/casino/?lp=halloween#/route','https://landing.example.com/casino%2f/?lp=halloween','https://landing.example.com/casino/../casino/?lp=halloween','http://go.netbet.ro/casino/?lp=halloween'])it('rejects '+address,()=>expect(matchesSelector(address,s)).toBe(false));
 it('does not collect ambiguous selectors',()=>expect(matchPage('https://landing.example.com/casino/?lp=halloween',[{page_key:'one',selector:s},{page_key:'two',selector:s}])).toBe(null));
 it('never matches disabled pages',()=>expect(matchPage('https://landing.example.com/casino/?lp=halloween',[{page_key:'one',selector:s,enabled:false}])).toBe(null));
 it('detects selector overlaps',()=>expect(selectorsOverlap(s,{...s,query_equals:{},ignored_query_names:['lp']})).toBe(true));
 it('separates same-path campaigns',()=>expect(selectorsOverlap(s,{...s,query_equals:{lp:'christmas'}})).toBe(false));
 it('bounds URL input',()=>expect(parseAddress('https://example.com/?x='+'a'.repeat(9000))).toBe(null));
 it('rejects encoded-dot normalization and malformed UTF-8 in ignored values',()=>{expect(matchesSelector('https://landing.example.com/casino/%2e%2e/casino/?lp=halloween',s)).toBe(false);expect(matchesSelector('https://landing.example.com/casino/?lp=halloween&utm_source=%ff',s)).toBe(false);});
 it('rejects conflicts between selectors and ignored keys',()=>expect(matchesSelector(s.origin+s.path+'?lp=halloween',{...s,ignored_query_names:['lp']})).toBe(false));
 it('does not treat inherited object names as approved query parameters',()=>{for(const name of ['constructor','toString','valueOf','hasOwnProperty','__proto__','prototype'])expect(matchesSelector(s.origin+s.path+'?lp=halloween&'+name+'=private',s),name).toBe(false);});
 it('rejects URL controls, parser-stripped whitespace and backslash normalization',()=>{for(const tail of ['&utm_source=%00','&utm_source=%0a','&utm_source=%7f','&utm_source=a\nb','&utm_source=a\\b'])expect(matchesSelector(s.origin+s.path+'?lp=halloween'+tail,s)).toBe(false);expect(parseAddress(' '+s.origin+s.path+'?lp=halloween')).toBeNull();});
});
describe('marketing tags and the ignore policy',()=>{
 const strict:Selector={...s,ignored_query_names:[]};
 it('tracks ad traffic on strict pages without pinning the tag values',()=>{
  expect(matchesSelector(s.origin+'/casino/?lp=halloween&utm_source=google&utm_medium=cpc&gclid=abc123',strict)).toBe(true);
  expect(matchesSelector(s.origin+'/casino/?lp=halloween&fbclid=xyz',strict)).toBe(true);
 });
 it('still rejects other unknown parameters on strict pages',()=>expect(matchesSelector(s.origin+'/casino/?lp=halloween&session=1',strict)).toBe(false));
 it('ignores any extra parameter under the ignore policy but keeps required values',()=>{
  const flexible:Selector={...strict,other_query_policy:'ignore'};
  expect(matchesSelector(s.origin+'/casino/?lp=halloween&session=1&ref=abc',flexible)).toBe(true);
  expect(matchesSelector(s.origin+'/casino/?lp=christmas&session=1',flexible)).toBe(false);
  expect(matchesSelector(s.origin+'/casino/?session=1',flexible)).toBe(false);
 });
 it('treats a flexible bare path as overlapping every variant on that path',()=>{
  const bare:Selector={...strict,query_equals:{},other_query_policy:'ignore'};
  expect(selectorsOverlap(bare,strict)).toBe(true);
  expect(selectorsOverlap({...strict,query_equals:{}},strict)).toBe(false);
 });
});

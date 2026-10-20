import {it,expect,afterEach} from 'vitest';
import {clientAddress,edgeCountry,setTrustedProxies,trustedProxies} from '../apps/server/client-address.js';
import {config} from '../packages/config/index.js';
const previous=config.trustedEdge;
afterEach(()=>{(config as any).trustedEdge=previous;setTrustedProxies('');});
const req=(peer:string,headers:Record<string,string>={})=>({headers,socket:{remoteAddress:peer},ip:peer}) as any;

it('uses the socket address unless Cloudflare is the declared edge',()=>{
 (config as any).trustedEdge='';
 expect(clientAddress(req('127.0.0.1',{'cf-connecting-ip':'203.0.113.9'}))).toBe('127.0.0.1');
});
it('trusts edge headers only from a trusted proxy address',()=>{
 (config as any).trustedEdge='cloudflare';
 expect(clientAddress(req('127.0.0.1',{'cf-connecting-ip':'203.0.113.9'}))).toBe('203.0.113.9');
 // A direct caller that bypasses the edge cannot choose its own address or country.
 expect(clientAddress(req('198.51.100.7',{'cf-connecting-ip':'203.0.113.9'}))).toBe('198.51.100.7');
 expect(edgeCountry(req('198.51.100.7',{'cf-ipcountry':'RO'}))).toBeNull();
 setTrustedProxies('172.16.0.0/12');
 expect(clientAddress(req('172.18.0.4',{'cf-connecting-ip':'2001:db8::1'}))).toBe('2001:db8::1');
 expect(edgeCountry(req('172.18.0.4',{'cf-ipcountry':'GB'}))).toBe('GB');
});
it('ignores malformed forwarded addresses',()=>{
 (config as any).trustedEdge='cloudflare';
 expect(clientAddress(req('127.0.0.1',{'cf-connecting-ip':'not-an-ip, 1.2.3.4'}))).toBe('127.0.0.1');
});
it('rejects invalid proxy configuration',()=>{
 for(const value of ['example.com','10.0.0.0/33','::1/129'])expect(()=>trustedProxies(value)).toThrow('TRUSTED_PROXIES_INVALID');
});

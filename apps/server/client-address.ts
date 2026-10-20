import {BlockList,isIP} from 'node:net';
import type {FastifyRequest} from 'fastify';
import {config} from '../../packages/config/index.js';

// Addresses allowed to speak for the visitor: the edge proxy (e.g. the cloudflared container) and loopback.
// TRUSTED_PROXIES takes a comma-separated list of IPs or CIDR ranges, such as 172.16.0.0/12.
export function trustedProxies(value=process.env.TRUSTED_PROXIES||''){
 const list=new BlockList();list.addAddress('127.0.0.1','ipv4');list.addAddress('::1','ipv6');list.addAddress('::ffff:127.0.0.1','ipv6');
 for(const entry of value.split(',').map(v=>v.trim()).filter(Boolean)){
  const [address,bits]=entry.split('/'),family=isIP(address);if(!family)throw new Error('TRUSTED_PROXIES_INVALID');
  const type=family===4?'ipv4':'ipv6';
  if(bits===undefined)list.addAddress(address,type);
  else{const prefix=Number(bits);if(!Number.isInteger(prefix)||prefix<0||prefix>(family===4?32:128))throw new Error('TRUSTED_PROXIES_INVALID');list.addSubnet(address,prefix,type);}
 }
 return list;
}
let proxies=trustedProxies();
export const setTrustedProxies=(value:string)=>{proxies=trustedProxies(value);};

const fromTrustedEdge=(req:FastifyRequest)=>{const peer=req.socket.remoteAddress??'',family=isIP(peer);return config.trustedEdge==='cloudflare'&&family>0&&proxies.check(peer,family===4?'ipv4':'ipv6');};

// The visitor's address for rate limits only. It is never stored.
export function clientAddress(req:FastifyRequest){
 const header=req.headers['cf-connecting-ip'];
 return fromTrustedEdge(req)&&typeof header==='string'&&isIP(header)?header:req.socket.remoteAddress??req.ip;
}
// Cloudflare's country code, only from the trusted edge. XX and T1 mean unknown and Tor.
export function edgeCountry(req:FastifyRequest){
 const header=req.headers['cf-ipcountry'];
 return fromTrustedEdge(req)&&typeof header==='string'&&/^[A-Z]{2}$/.test(header)&&header!=='XX'&&header!=='T1'?header:null;
}

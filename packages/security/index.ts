import { createHash, createHmac, randomBytes, randomUUID,timingSafeEqual } from 'node:crypto';
import { hash, verify, Algorithm } from '@node-rs/argon2';
import type { DB } from '../db/index.js';
export const digest=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
export const token=()=>randomBytes(32).toString('base64url');
export function equalToken(a:unknown,b:unknown){if(typeof a!=='string'||typeof b!=='string'||a.length>256||b.length>256)return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export const passwordHash=(p:string)=>hash(p,{algorithm:Algorithm.Argon2id,memoryCost:19456,timeCost:2,parallelism:1});
export const passwordVerify=(h:string,p:string)=>verify(h,p);
export class Problem extends Error {constructor(public status:number,public code:string){super(code);}}
export async function audit(db:DB,userId:string|null,action:string,siteId:string|null=null,detail:Record<string,unknown>={}) {
 await db.query('INSERT INTO audit(id,user_id,action,site_id,detail) VALUES($1,$2,$3,$4,$5)',[randomUUID(),userId,action,siteId,JSON.stringify(detail)]);
}
export class Limiter {
 private salt=token();private rotated=Date.now();private entries=new Map<string,{n:number;until:number}>();
 constructor(private readonly capacity=10000){}
 check(key:string,limit:number,window=60000) {
  const now=Date.now();if(now-this.rotated>3600000){this.entries.clear();this.salt=token();this.rotated=now;}
  const k=createHmac('sha256',this.salt).update(key).digest('hex');const v=this.entries.get(k);
  if(v&&v.until>=now){if(++v.n>limit)throw new Problem(429,'RATE_LIMIT');return;}
  // A full table must never reject unrelated callers. Windows restart by re-insertion, so the first entry is the oldest.
  this.entries.delete(k);if(this.entries.size>=this.capacity)this.entries.delete(this.entries.keys().next().value!);
  this.entries.set(k,{n:1,until:now+window});
 }
}
export function canonical(value:unknown):string {
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';
 return JSON.stringify(value);
}


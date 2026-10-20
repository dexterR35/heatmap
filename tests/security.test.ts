import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {testDB} from './fixtures.js';
import type {DB} from '../packages/db/index.js';
import {createManagement} from '../apps/server/management.js';
import {digest,passwordHash,Problem} from '../packages/security/index.js';
import {safeScriptJSON,decodeReferenceBase64,validateSelector} from '../packages/security/validation.js';
import {configuredOrigin,configuredPort} from '../packages/config/origins.js';
import {validCollectorOrigin,validSDKArtifact} from '../packages/domain/endpoint.js';
import {importReference,referenceImage,type Manifest} from '../apps/server/references.js';
let db:DB,app:ReturnType<typeof createManagement>,session='',csrf='';
const base={host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000'};
const auth=()=>({...base,cookie:session,'x-csrf-token':csrf});
const credentials={email:'security@example.invalid',password:'Synthetic security test password 2026'};
async function login(cookie=''){
 const pre=await app.inject({url:'/api/auth/csrf',headers:{...base,cookie}});
 const r=await app.inject({method:'POST',url:'/api/auth/login',headers:{...base,'x-csrf-token':pre.json().login_token,cookie:pre.cookies.map(c=>c.name+'='+c.value).join('; ')},payload:credentials});
 expect(r.statusCode).toBe(200);csrf=r.json().csrf;session=r.cookies.filter(c=>c.name==='ir_session').map(c=>c.name+'='+c.value).join('; ');return r;
}
beforeAll(async()=>{db=await testDB();await db.query("INSERT INTO users(id,email,password_hash,role) VALUES('security-owner',$1,$2,'owner')",[credentials.email,await passwordHash(credentials.password)]);app=createManagement(db,new Map());await app.ready();await login();});
afterAll(async()=>{await app.close();await db.close();});
it('rejects a forged unsigned pre-login cookie even when its header matches',async()=>{
 const r=await app.inject({method:'POST',url:'/api/auth/login',headers:{...base,cookie:'ir_login_csrf=attacker-choice','x-csrf-token':'attacker-choice'},payload:credentials});expect(r.statusCode).toBe(403);expect(r.json().error.code).toBe('CSRF_INVALID');
});
it('recovers login after idle expiry and rotates the expired session',async()=>{
 const old=session;await db.query("UPDATE sessions SET last_seen=now()-interval '2 hours' WHERE user_id='security-owner'");
 expect((await app.inject({url:'/api/bootstrap',headers:auth()})).statusCode).toBe(401);
 const pre=await app.inject({url:'/api/auth/csrf',headers:{...base,cookie:old}});expect(pre.json().token).toBe(pre.json().login_token);expect(pre.cookies.find(c=>c.name==='ir_login_csrf')!.value).not.toBe(pre.json().login_token);
 await login(old);expect(session).not.toBe(old);
 expect((await app.inject({url:'/api/bootstrap',headers:{...base,cookie:old}})).statusCode).toBe(401);
});
it('returns session CSRF and a fresh signed login token to an authenticated client',async()=>{
 const pre=await app.inject({url:'/api/auth/csrf',headers:auth()});expect(pre.json().token).toBe(csrf);expect(pre.json().login_token).not.toBe(csrf);
 const tampered=pre.cookies.map(c=>c.name+'='+c.value+'x').join('; ');
 const r=await app.inject({method:'POST',url:'/api/auth/login',headers:{...base,cookie:tampered,'x-csrf-token':pre.json().login_token},payload:credentials});expect(r.statusCode).toBe(403);
});
it('rejects query pollution, SQL-shaped identifiers, impossible dates and arbitrary filters',async()=>{
 for(const tail of ['&from=2026-02-30','&from=2026-01-01T00:00:00','&width=1440&width=390','&device=desktop%27OR1%3D1','&redirect=https://attacker.invalid','&reference_id=../secret']){
  const r=await app.inject({url:'/api/reports?site_id=local-demo&page_key=casino-halloween'+tail,headers:auth()});expect(r.statusCode,tail).toBe(400);expect(r.body).not.toContain('SELECT');
 }
 expect((await app.inject({url:'/api/install?site_id=local-demo&page_key=casino-halloween&callback=alert',headers:auth()})).statusCode).toBe(400);
});
it('rejects malformed selectors without a server error or creating a draft',async()=>{
 const selector={origin:'https://public.example.invalid',path:'/casino/',query_equals:{lp:'summer'},ignored_query_names:[],other_query_policy:'reject' as const,duplicate_query_policy:'reject' as const,fragment_policy:'ignore_anchor' as const};
 for(const changes of [{origin:'javascript:alert(1)'},{origin:'https://user:pass@public.example.invalid'},{origin:'https://public.example.invalid/path'},{path:'//attacker.invalid/'},{path:'/casino/../account'},{path:'/casino/%2e%2e/account'},{path:'/casino/?token=secret'},{query_equals:{lp:'<svg/onload=alert(1)>'}},{ignored_query_names:['constructor']},{ignored_query_names:['lp']}]){
  const r=await app.inject({method:'POST',url:'/api/landing-pages',headers:auth(),payload:{name:'Security fixture',page_key:'security-draft',product:'casino',selector:{...selector,...changes}}});expect(r.statusCode,JSON.stringify(changes)).toBe(422);
 }
 expect((await db.query("SELECT 1 FROM pages WHERE page_key='security-draft'")).length).toBe(0);
 expect(()=>validateSelector({...selector,query_equals:JSON.parse('{"constructor":"x"}')})).toThrow('SELECTOR_INVALID');
});
it('encodes script JSON without executable HTML delimiters and preserves its data',()=>{
 const value={name:'</script><svg onload=alert(1)> & \u2028\u2029'};const encoded=safeScriptJSON(value);expect(encoded).not.toMatch(/[<>&\u2028\u2029]/);expect(JSON.parse(encoded)).toEqual(value);
});
it('rejects malformed or noncanonical base64 before decoding an image',()=>{
 for(const value of ['', '!!!!','aGVsbG8','aGVsbG8=\n','data:image/png;base64,aGVsbG8='])expect(()=>decodeReferenceBase64(value)).toThrow('REFERENCE_ENCODING_INVALID');expect(decodeReferenceBase64('aGVsbG8=').toString()).toBe('hello');
});
it('rejects SVG, HTML and corrupt image input before storage',async()=>{
 const manifest:Manifest={schema_version:1,site_id:'local-demo',page_key:'casino-halloween',revision:'demo-v1',locale:'en-GB',variant:'control',state:'public-default',captured_at:new Date().toISOString(),viewport:{width:240,height:200,dpr:1},document:{width:240,height:200},layer:'document',elements:[],masks:[],capture_policy_version:'test'};
 for(const bytes of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'),Buffer.from('<script>alert(1)</script>')])await expect(importReference(db,'.local/unwritten',manifest,bytes)).rejects.toMatchObject({status:422,code:'REFERENCE_IMAGE_FORMAT_INVALID'});
 await expect(importReference(db,'.local/unwritten',manifest,Buffer.from([137,80,78,71,13,10,26,10]))).rejects.toMatchObject({status:422,code:'REFERENCE_IMAGE_INVALID'});
});
it('authorizes reference access before touching the filesystem',async()=>{
 const id=randomUUID();await db.query("INSERT INTO page_references(id,site_id,page_key,manifest,object_key) VALUES($1,'local-demo','casino-halloween','{}',$2)",[id,id+'.png']);
 await expect(referenceImage(db,'.local/does-not-exist',id,async()=>{throw new Problem(404,'SITE_NOT_FOUND');})).rejects.toMatchObject({code:'SITE_NOT_FOUND'});
});
it('requires safe absolute endpoint origins and distinct valid unprivileged ports',()=>{
 expect(configuredOrigin('https://collector.example.invalid','COLLECTOR')).toBe('https://collector.example.invalid');expect(configuredOrigin('http://127.0.0.1:8080','COLLECTOR')).toBe('http://127.0.0.1:8080');
 for(const v of ['http://collector.example.invalid','https://user:pass@example.invalid','https://example.invalid/path','https://example.invalid/','javascript:alert(1)','https://example.invalid?token=secret'])expect(()=>configuredOrigin(v,'COLLECTOR')).toThrow();
 for(const v of ['80','65536','3000x','-1',''])expect(()=>configuredPort(v,3000)).toThrow();
 for(const v of ['javascript:alert(1)','data:text/javascript,alert(1)','http://public.example.invalid','https://example.invalid/path','https://user@example.invalid'])expect(validCollectorOrigin(v)).toBe(false);
 expect(validSDKArtifact({file:'../../attacker.js',sri:'sha384-'+'a'.repeat(64)})).toBe(false);expect(validSDKArtifact({file:'tracker.1.0.0.'+'a'.repeat(16)+'.js',sri:'sha384-'+'a'.repeat(64)})).toBe(true);
});
it('sends restrictive headers and does not serve private files or collector management paths',async()=>{
 const r=await app.inject({url:'/api/bootstrap',headers:auth()});expect(r.statusCode).toBe(200);expect(r.headers['content-security-policy']).toContain("script-src 'self'");expect(r.headers['cache-control']).toBe('no-store');expect(r.headers['x-frame-options']).toBe('DENY');expect(r.headers['x-content-type-options']).toBe('nosniff');
 for(const url of ['/.env','/%2eenv','/.local/admin-credentials.json','/package.json']){const r=await app.inject({url,headers:base});expect(r.statusCode,url).toBe(404);expect(r.body).not.toContain('password');}
 const key=session.split('=')[1];expect((await db.query('SELECT token_hash FROM sessions WHERE token_hash=$1',[digest(key)])).length).toBe(1);expect((await db.query('SELECT token_hash FROM sessions WHERE token_hash=$1',[key])).length).toBe(0);
});
it('rejects expired signed login tokens and absolute-expired sessions',async()=>{
 const nonce='a'.repeat(43),cookie=app.signCookie(nonce+'.0000000000000');
 const r=await app.inject({method:'POST',url:'/api/auth/login',headers:{...base,cookie:'ir_login_csrf='+encodeURIComponent(cookie),'x-csrf-token':nonce},payload:credentials});expect(r.statusCode).toBe(403);
 const expired=randomUUID();await db.query("INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES($1,'security-owner','expired',now()-interval '1 minute')",[digest(expired)]);
 expect((await app.inject({url:'/api/bootstrap',headers:{...base,cookie:'ir_session='+expired}})).statusCode).toBe(401);
});

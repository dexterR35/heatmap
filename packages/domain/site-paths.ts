// Whole-site mode: turns a visited path into a stable page identity, the same way in the browser and on the server.
export interface SiteRules {include:string[];exclude:string[];patterns:string[]}
export const DEFAULT_EXCLUDES=['/login','/logout','/signin','/sign-in','/signup/*','/account/*','/my-account/*','/profile/*','/settings/*','/admin/*','/wp-admin/*','/checkout/*','/cart','/basket','/payment/*','/password/*','/reset/*','/verify/*','/unsubscribe/*','/api/*'];
export const DEFAULT_RULES:SiteRules={include:['/*'],exclude:DEFAULT_EXCLUDES,patterns:[]};
const SEGMENT=/^[a-z0-9][a-z0-9._~-]{0,63}$/i,PATTERN=/^\/(?:(?:[a-z0-9][a-z0-9._~-]{0,63}|:id)\/)*(?:[a-z0-9][a-z0-9._~-]{0,63}|:id|\*)?$/i;

export function validRules(r:unknown):r is SiteRules{
 if(typeof r!=='object'||r===null)return false;const x=r as Record<string,unknown>;
 return (['include','exclude','patterns'] as const).every(k=>Array.isArray(x[k])&&(x[k] as unknown[]).length<=50&&(x[k] as unknown[]).every(p=>typeof p==='string'&&p.length<=200&&PATTERN.test(p)))&&(x.include as unknown[]).length>0;
}
// An ID, token or hash in a path describes one record, not a page layout.
const idLike=(s:string)=>/^\d+$/.test(s)||/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)||/^[0-9a-f]{12,}$/i.test(s)||(s.length>=20&&/\d/.test(s)&&/[a-z]/i.test(s));
const matches=(pattern:string,segments:string[])=>{
 const p=pattern.split('/').filter(Boolean);
 for(let i=0;i<p.length;i++){if(p[i]==='*')return true;if(i>=segments.length)return false;if(p[i]!==':id'&&p[i].toLowerCase()!==segments[i].toLowerCase())return false;}
 return p.length===segments.length;
};

// Returns the canonical page path, or null when the path must not be tracked.
export function canonicalPath(pathname:string,rules:SiteRules):string|null{
 if(typeof pathname!=='string'||pathname.length>1024||!pathname.startsWith('/'))return null;
 let decoded:string;try{decoded=decodeURIComponent(pathname);}catch{return null;}
 if(/[@\s]/.test(decoded))return null;
 const raw=pathname.split('/').filter(Boolean);
 if(raw.length>12||raw.some(s=>!SEGMENT.test(s)&&!idLike(s)))return null;
 const segments=raw.map(s=>idLike(s)?':id':s);
 if(!rules.include.some(p=>matches(p,segments))||rules.exclude.some(p=>matches(p,segments)))return null;
 const pattern=rules.patterns.find(p=>matches(p,segments));
 return pattern??('/'+segments.join('/'));
}

// Server check for a path sent by the browser: it must be exactly what canonicalPath produces under the site's rules.
export function allowedCanonical(path:string,rules:SiteRules):boolean{
 if(!PATTERN.test(path)||(path!=='/'&&path.endsWith('/')))return false;
 return canonicalPath(path.replace(/:id/g,'0').replace(/\*$/,'x'),rules)===path;
}
// A stable page key for a canonical path, within the 64-character code format.
export function pathKey(path:string):string{
 const slug=path==='/'?'home':path.slice(1).replace(/\/\*$/,'.all').replace(/:id/g,'id').replace(/\//g,'.').replace(/[^a-zA-Z0-9_.-]/g,'-').toLowerCase();
 const base='p.'+slug;if(base.length<=64)return base;
 let h=5381;for(const c of path)h=((h<<5)+h+c.charCodeAt(0))>>>0;
 return base.slice(0,55)+'.'+h.toString(36).padStart(7,'0').slice(0,8);
}

import {Type as T} from '@sinclair/typebox';
import {parseAddress,codePattern,type Selector} from '../domain/matcher.js';
import {Problem} from './index.js';
import {channels,browsers,systems} from '../contracts/events.js';
const oneOf=(values:readonly string[])=>T.Union(values.map(v=>T.Literal(v)));

const code=T.String({pattern:codePattern.source,maxLength:64});
export const reportQuerySchema=T.Object({
  site_id:code,page_key:code,
  from:T.Optional(T.String({pattern:'^\\d{4}-\\d{2}-\\d{2}$'})),to:T.Optional(T.String({pattern:'^\\d{4}-\\d{2}-\\d{2}$'})),
  device:T.Optional(T.Union(['all','mobile','tablet','desktop'].map(v=>T.Literal(v)))),
  width:T.Optional(T.String({pattern:'^[0-9]{3,4}$'})),revision:T.Optional(code),reference_id:T.Optional(T.String({format:'uuid'})),
  data_source:T.Optional(T.Union([T.Literal('recorded'),T.Literal('seeded'),T.Literal('legacy')])),
  campaign:T.Optional(code),mapping:T.Optional(T.Union([T.Literal('document'),T.Literal('element')])),variant:T.Optional(code),experiment_id:T.Optional(T.String({format:'uuid'})),market:T.Optional(code),product:T.Optional(code),brand:T.Optional(code),
  channel:T.Optional(oneOf(channels)),browser:T.Optional(oneOf(browsers)),os:T.Optional(oneOf(systems)),client_device:T.Optional(oneOf(['mobile','tablet','desktop'])),country:T.Optional(T.String({pattern:'^[A-Z]{2}$'})),
},{additionalProperties:false});
export const installQuerySchema=T.Object({site_id:code,page_key:code},{additionalProperties:false});
export const portfolioQuerySchema=T.Omit(reportQuerySchema,['site_id','page_key','width','revision','reference_id','mapping','experiment_id','channel','browser','os','client_device','country']);
export const pagePolicySchema=T.Object({revision:T.Optional(code),campaign_codes:T.Array(code,{minItems:1,maxItems:32,uniqueItems:true}),diagnostics_enabled:T.Boolean(),diagnostic_error_codes:T.Array(code,{maxItems:16,uniqueItems:true}),primary_cta_id:code,primary_action_id:code},{additionalProperties:false});
export const operationSettingsSchema=T.Object({automatic_retention:T.Boolean(),retention_hour_utc:T.Integer({minimum:0,maximum:23}),automatic_backup:T.Boolean(),backup_hour_utc:T.Integer({minimum:0,maximum:23}),backup_days:T.Integer({minimum:1,maximum:90}),queue_warning_seconds:T.Integer({minimum:10,maximum:3600}),rejection_warning_percent:T.Integer({minimum:1,maximum:100})},{additionalProperties:false});

export function validateSelector(s:Selector) {
  if(s.other_query_policy!=='reject'&&s.other_query_policy!=='ignore')throw new Problem(422,'SELECTOR_INVALID');
  if(typeof s.origin!=='string'||typeof s.path!=='string'||!s.path.startsWith('/')||s.path.startsWith('//')||/[?#]/.test(s.path))throw new Problem(422,'SELECTOR_INVALID');
  const origin=parseAddress(s.origin+'/');
  if(!origin||origin.origin!==s.origin||origin.pathname!=='/')throw new Problem(422,'SELECTOR_INVALID');
  const keys=Object.keys(s.query_equals);
  if(keys.length>8||keys.some(k=>!codePattern.test(k)||['__proto__','constructor','prototype'].includes(k)||s.ignored_query_names.includes(k)))throw new Problem(422,'SELECTOR_INVALID');
  if(new Set(s.ignored_query_names).size!==s.ignored_query_names.length||s.ignored_query_names.some(k=>!codePattern.test(k)||['__proto__','constructor','prototype'].includes(k)))throw new Problem(422,'SELECTOR_INVALID');
  const url=new URL(s.path,s.origin);
  for(const[k,v]of Object.entries(s.query_equals)){if(typeof v!=='string'||!codePattern.test(v))throw new Problem(422,'SELECTOR_INVALID');url.searchParams.set(k,v);}
  if(!parseAddress(url.toString())||url.origin!==s.origin||url.pathname!==s.path)throw new Problem(422,'SELECTOR_INVALID');
}

export function safeScriptJSON(value:unknown) {
  return JSON.stringify(value).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
}

export function decodeReferenceBase64(input:string) {
  const bytes=Buffer.from(input,'base64');
  if(!bytes.length||bytes.toString('base64')!==input)throw new Problem(422,'REFERENCE_ENCODING_INVALID');
  return bytes;
}

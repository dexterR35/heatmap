// Turns raw browser facts into fixed categories on the device, so the raw user agent,
// referrer URL and click-ID values never leave the browser.
import type {Static} from '@sinclair/typebox';
import type {sourceSchema,clientSchema} from '../contracts/events.js';
export type TrafficSource=Static<typeof sourceSchema>;
export type ClientInfo=Static<typeof clientSchema>;
type Engine=NonNullable<TrafficSource['engine']>;

const SLUG=/^[a-z0-9][a-z0-9._-]{0,63}$/;
const CLICK_IDS:[string,NonNullable<TrafficSource['click_id']>,Engine][]=[['gclid','google','google'],['gbraid','google','google'],['wbraid','google','google'],['fbclid','meta','facebook'],['ttclid','tiktok','tiktok'],['msclkid','microsoft','bing'],['li_fat_id','linkedin','linkedin']];
const SEARCH:[RegExp,Engine][]=[[/(^|\.)google\./,'google'],[/(^|\.)bing\.com$/,'bing'],[/(^|\.)yahoo\./,'yahoo'],[/(^|\.)duckduckgo\.com$/,'duckduckgo'],[/(^|\.)yandex\./,'yandex'],[/(^|\.)baidu\.com$/,'baidu'],[/(^|\.)ecosia\.org$/,'ecosia']];
const SOCIAL:[RegExp,Engine][]=[[/(^|\.)(facebook\.com|fb\.com|fb\.me)$/,'facebook'],[/(^|\.)instagram\.com$/,'instagram'],[/(^|\.)tiktok\.com$/,'tiktok'],[/(^|\.)(x\.com|twitter\.com|t\.co)$/,'x'],[/(^|\.)(youtube\.com|youtu\.be)$/,'youtube'],[/(^|\.)(linkedin\.com|lnkd\.in)$/,'linkedin'],[/(^|\.)reddit\.com$/,'reddit'],[/(^|\.)pinterest\./,'pinterest'],[/(^|\.)snapchat\.com$/,'snapchat'],[/(^|\.)(whatsapp\.com|wa\.me)$/,'whatsapp'],[/(^|\.)(t\.me|telegram\.org)$/,'telegram']];
const PAID_MEDIUMS=new Set(['cpc','ppc','paid','paidsearch','paid-search','paid_search','paidsocial','paid-social','paid_social','display','cpm','cpv','banner','retargeting']);

const slug=(value:string|null)=>{const v=(value??'').trim().toLowerCase();return SLUG.test(v)?v:undefined;};
const hostOf=(referrer:string)=>{try{const u=new URL(referrer);return u.protocol==='https:'||u.protocol==='http:'?u.hostname.toLowerCase():'';}catch{return '';}};

export function trafficSource(search:string,referrer:string,host:string):TrafficSource {
 const params=new URLSearchParams(search);
 const click=CLICK_IDS.find(([name])=>params.has(name));
 const utm_source=slug(params.get('utm_source')),utm_medium=slug(params.get('utm_medium')),utm_campaign=slug(params.get('utm_campaign'));
 const ref=hostOf(referrer),search_engine=SEARCH.find(([re])=>re.test(ref))?.[1],social=SOCIAL.find(([re])=>re.test(ref))?.[1];
 let channel:TrafficSource['channel'];
 if(click||(utm_medium&&PAID_MEDIUMS.has(utm_medium)))channel='paid';
 else if(utm_medium==='email'||utm_medium==='newsletter')channel='email';
 else if(utm_medium==='social'||utm_medium==='social-organic')channel='social';
 else if(utm_medium==='organic'||search_engine)channel='search';
 else if(social)channel='social';
 else if(ref&&ref===host.toLowerCase())channel='internal';
 else if(ref)channel='referral';
 else if(utm_source||utm_medium||utm_campaign)channel='unknown';
 else channel='direct';
 const engine:Engine|undefined=click?.[2]??search_engine??social??(ref&&channel!=='internal'?'other':undefined);
 return {channel,...(engine?{engine}:{}),...(click?{click_id:click[1]}:{}),...(utm_source?{utm_source}:{}),...(utm_medium?{utm_medium}:{}),...(utm_campaign?{utm_campaign}:{})};
}

export function clientInfo(ua:string,touchPoints:number,mobileHint:boolean|undefined,language:string):ClientInfo {
 const ipadOS=/Macintosh/.test(ua)&&touchPoints>1;
 const os:ClientInfo['os']=/iPhone|iPad|iPod/.test(ua)||ipadOS?'ios':/Android/.test(ua)?'android':/CrOS/.test(ua)?'chromeos':/Windows/.test(ua)?'windows':/Mac OS X|Macintosh/.test(ua)?'macos':/Linux/.test(ua)?'linux':'other';
 const browser:ClientInfo['browser']=/SamsungBrowser/.test(ua)?'samsung':/OPR\/|Opera|OPiOS/.test(ua)?'opera':/Edg(e|A|iOS)?\//.test(ua)?'edge':/Firefox\/|FxiOS/.test(ua)?'firefox':/Chrome\/|CriOS/.test(ua)?'chrome':/Safari\//.test(ua)?'safari':'other';
 const device:ClientInfo['device']=/iPad/.test(ua)||ipadOS||(/Android/.test(ua)&&!/Mobile/.test(ua))||/Tablet/.test(ua)?'tablet':mobileHint||/Mobi|iPhone|iPod|Android/.test(ua)?'mobile':'desktop';
 const lang=(language||'').split('-')[0].toLowerCase();
 return {browser,os,device,...(/^[a-z]{2,3}$/.test(lang)?{language:lang}:{})};
}

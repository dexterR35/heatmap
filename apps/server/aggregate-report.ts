import type { DB } from '../../packages/db/index.js';
import type { Event } from '../../packages/contracts/events.js';
import { cohortSegments, deviceForWidth, type SegmentFact } from '../../packages/domain/metrics.js';
import { Problem } from './security.js';
import {engagement,percentile,type ObservationPoint} from '../../packages/domain/advanced.js';
import {activitySeries,segmentDevices} from '../../packages/domain/chart-series.js';

export interface ReportFilter {
  site_id: string; page_key: string; from?: string; to?: string;
  device?: string; width?: string; revision?: string; reference_id?: string;
  data_source?:'recorded'|'seeded'|'legacy';
  campaign?:string;mapping?:'document'|'element';variant?:string;experiment_id?:string;market?:string;product?:string;brand?:string;
}

export async function report(db: DB, f: ReportFilter, access:{includePendingReferences?:boolean}={}) {
  const dataSource=f.data_source??'recorded';if(!['recorded','seeded','legacy'].includes(dataSource))throw new Problem(400,'INVALID_DATA_SOURCE');
  const elementMapping=f.mapping==='element';
  for(const value of [f.from,f.to])if(value&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value))throw new Problem(400,'INVALID_DATE_RANGE');
  if (f.device && !['all','mobile','tablet','desktop'].includes(f.device)) throw new Problem(400, 'INVALID_DEVICE');
  if (f.width && (!/^\d{3,4}$/.test(f.width) || +f.width < 240 || +f.width > 7680)) throw new Problem(400, 'INVALID_VIEWPORT');
  const from = f.from ? new Date(f.from + 'T00:00:00Z') : new Date(Date.now() - 7 * 86400000);
  const to = f.to ? new Date(f.to + 'T00:00:00Z') : new Date();
  if (f.to) to.setUTCDate(to.getUTCDate() + 1);
  if (!Number.isFinite(+from) || !Number.isFinite(+to) || to < from || +to - +from > 93 * 86400000) throw new Problem(400, 'INVALID_DATE_RANGE');

  const [page] = await db.query('SELECT p.*,s.environment,s.origin,s.sample_rate FROM pages p JOIN sites s ON s.id=p.site_id WHERE p.site_id=$1 AND p.page_key=$2', [f.site_id, f.page_key]);
  if (!page) throw new Problem(404, 'PAGE_NOT_FOUND');
  const revision = f.revision || page.revision;
  if(f.experiment_id&&!(await db.query('SELECT 1 FROM experiments WHERE id=$1 AND site_id=$2 AND page_key=$3',[f.experiment_id,f.site_id,f.page_key])).length)throw new Problem(404,'EXPERIMENT_NOT_FOUND');
  const views = await db.query("SELECT v.*,f.facts,f.has_page_view,f.aggregation_version,f.processed_at FROM views v LEFT JOIN view_facts f ON f.site_id=v.site_id AND f.view_id=v.view_id WHERE v.site_id=$1 AND v.page_key=$2 AND v.started_at>=$3 AND v.started_at<$4 AND v.data_source=$5 AND ($6::text IS NULL OR v.context->>'campaign'=$6) AND ($7::text IS NULL OR EXISTS(SELECT 1 FROM acquisition_visits a WHERE a.id=v.context->>'acquisition_id' AND a.experiment_id=$7 AND a.site_id=v.site_id)) ORDER BY v.started_at LIMIT 50001", [f.site_id, f.page_key, from.toISOString(), to.toISOString(),dataSource,f.campaign??null,f.experiment_id??null]);
  if (views.length > 50000) throw new Problem(422, 'REPORT_BUDGET_EXCEEDED');
  const variant=f.variant||page.variant;
  const contextMatches = (c: Record<string, unknown>) => c.revision === revision && c.locale === page.locale && c.variant === variant && c.state === page.state;
  const contextViews=views.filter(v=>v.has_page_view&&v.aggregation_version>=2&&contextMatches(v.context)&&['market','product','brand'].every(k=>!f[k as keyof ReportFilter]||(v.acquisition_context[k]??'unknown')===f[k as keyof ReportFilter]));
  const selectedSegments=(v:any)=>cohortSegments(v.facts.segments,f.device,elementMapping?undefined:f.width);
  const confirmed = contextViews.filter(v => selectedSegments(v).length);

  const references = await db.query("SELECT id,manifest,status,created_at FROM page_references WHERE site_id=$1 AND page_key=$2 AND ($3::boolean OR status='approved') ORDER BY created_at DESC,id DESC LIMIT 100", [f.site_id, f.page_key,access.includePendingReferences===true]);
  const compatible = references.filter(r => r.status === 'approved' && contextMatches(r.manifest) && r.manifest.layer === 'document' &&
    (!f.width || r.manifest.viewport.width === Number(f.width)) && (!f.device || f.device === 'all' || deviceForWidth(r.manifest.viewport.width) === f.device));
  // A device category alone does not establish compatible pixel geometry.
  if (f.reference_id && !f.width) throw new Problem(400, 'REFERENCE_REQUIRES_VIEWPORT');
  const reference = f.reference_id ? compatible.find(r => r.id === f.reference_id) : f.width ? compatible[0] ?? null : null;
  if (f.reference_id && !reference) throw new Problem(422, 'REFERENCE_NOT_COMPATIBLE');
  const [privacy] = await db.query("SELECT value FROM settings WHERE key='privacy'");
  if (page.environment !== 'synthetic' && confirmed.length < privacy.value.minimum_views) return {suppressed:true as const,minimum_views:privacy.value.minimum_views,page,reference,references,data_source:dataSource,summary:undefined,daily:undefined,elements:undefined,points:undefined,quality:undefined,widths:undefined};

  const ids = new Set(confirmed.map(v => v.view_id));
  const rows = await db.query<{view_id: string; payload: Event}>('SELECT e.view_id,e.payload FROM events e JOIN views v ON v.site_id=e.site_id AND v.view_id=e.view_id WHERE e.site_id=$1 AND v.page_key=$2 AND v.started_at>=$3 AND v.started_at<$4 AND v.data_source=$5 AND e.event_type=\'click\' LIMIT 100001', [f.site_id, f.page_key, from.toISOString(), to.toISOString(),dataSource]);
  if (rows.length > 100000) throw new Problem(422, 'REPORT_BUDGET_EXCEEDED');
  const points = new Map<string, {x: number; y: number; weight: number}>();
  let incompatible = 0, unsupported = 0, masked = 0, mapped = 0, clickCount = 0,unregistered=0;
  const mapCoordinate=(p:ObservationPoint,width:number,height:number)=>{const m=reference?.manifest;if(!m)return null;if(p.layer!=='document'||p.visual_scale!==1||(p.visual_offset_x??0)!==0||(p.visual_offset_y??0)!==0)return null;
   let x=p.x,y=p.y;
   if(elementMapping){const element=m.elements.find((el:any)=>el.id===p.element_id);if(!element||p.x_fraction===undefined||p.y_fraction===undefined)return null;x=element.rect.x+p.x_fraction*element.rect.width;y=element.rect.y+p.y_fraction*element.rect.height;}
   else if(width!==m.viewport.width||Math.abs(height-m.document.height)>2)return null;
   if(m.masks.some((r:any)=>x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height))return null;
   return {x:Math.min(m.document.width-1,Math.max(0,Math.round(x/8)*8)),y:Math.min(m.document.height-1,Math.max(0,Math.round(y/8)*8)),weight:1};
  };
  for (const row of rows) {
    if (!ids.has(row.view_id) || row.payload.type !== 'click') continue;
    const e = row.payload;
    if ((f.device && f.device !== 'all' && deviceForWidth(e.viewport.width) !== f.device) || (!elementMapping&&f.width && e.viewport.width !== +f.width)) continue;
    clickCount++;
    const m = reference?.manifest;
    if (!m || (!elementMapping&&(e.viewport.width !== m.viewport.width || Math.abs(e.viewport.document_height - m.document.height) > 2))) {incompatible++; continue;}
    if (e.layer !== 'document' || e.viewport.visual_scale !== 1 || e.viewport.visual_offset_x !== 0 || e.viewport.visual_offset_y !== 0) {unsupported++; continue;}
    if(elementMapping&&!m.elements.some((el:any)=>el.id===e.target?.element_id)){unregistered++;continue;}
    const mappedPoint=mapCoordinate({x:e.document_x,y:e.document_y,element_id:e.target?.element_id,x_fraction:e.target?.x_fraction,y_fraction:e.target?.y_fraction,layer:e.layer,visual_scale:e.viewport.visual_scale},e.viewport.width,e.viewport.document_height);if(!mappedPoint){masked++;continue;}
    const {x,y}=mappedPoint;
    const key = x + ':' + y, p = points.get(key);
    if (p) p.weight++; else points.set(key, {x, y, weight: 1});
    mapped++;
  }

  const dates: Record<string, {date: string; views: number; activations: number}> = {};
  const widthSet = new Set<number>();
  for(const v of contextViews)for(const s of Object.values(v.facts.segments) as SegmentFact[])widthSet.add(s.width);
  const elements = (page.elements as string[]).map(id => ({id, click_count: 0, exposed_views: 0, activated_views: 0, exposed_activated_views: 0}));
  let activated = 0, reach = 0, visible = 0, exposed = 0, exposedActivated = 0;
  const scrollSegments: SegmentFact[] = [];
  for (const v of confirmed) {
    const selected = selectedSegments(v);
    const a = selected.some(s => s.actions.includes(page.primary_action_id??'registration-start'));
    const e = selected.some(s => s.exposures.includes(page.primary_cta_id??'hero-register'));
    activated += +a; exposed += +e; exposedActivated += +(a && e);
    reach += Math.max(0, ...selected.map(s => s.reach));
    visible += selected.reduce((n,s) => n+s.visible_ms,0);
    const date = new Date(v.started_at).toISOString().slice(0,10);
    const d = dates[date] ??= {date, views: 0, activations: 0}; d.views++; d.activations += +a;
    for (const el of elements) {
      const isExposed = selected.some(s => s.exposures.includes(el.id));
      const isActivated = selected.some(s => s.activated_elements.includes(el.id));
      el.exposed_views += +isExposed; el.activated_views += +isActivated;
      el.exposed_activated_views += +(isExposed && isActivated);
      el.click_count += selected.reduce((n,s) => n+(Object.hasOwn(s.element_clicks,el.id)?s.element_clicks[el.id]:0),0);
    }
    scrollSegments.push(...selected.filter(s => !reference || (s.width === reference.manifest.viewport.width && Math.abs(s.document_height-reference.manifest.document.height) <= 2)));
  }
  const scroll = Array.from({length: 21}, (_,i) => {
    const depth = i*5, reached = scrollSegments.filter(s => s.reach >= depth).length;
    return {depth, reached, segments: scrollSegments.length, percent: scrollSegments.length ? 100*reached/scrollSegments.length : 0};
  });
  const advanced=engagement(confirmed.map(v=>({facts:v.facts,segments:selectedSegments(v)})),page.primary_cta_id??'hero-register',page.primary_action_id??'registration-start');
  const qualityRows=confirmed.length?await db.query("SELECT e.view_id,count(*)::int AS events,count(*) FILTER(WHERE e.received_at>v.started_at+((e.payload->>'elapsed_ms')::double precision*interval '1 millisecond')+interval '60 seconds')::int AS delayed,max(GREATEST(0,EXTRACT(epoch FROM(e.received_at-v.started_at))*1000-(e.payload->>'elapsed_ms')::double precision)) AS max_delay_ms FROM events e JOIN views v ON v.site_id=e.site_id AND v.view_id=e.view_id WHERE e.site_id=$1 AND e.view_id=ANY($2::text[]) GROUP BY e.view_id",[f.site_id,confirmed.map(v=>v.view_id)]):[];
  const processed=confirmed.map(v=>v.processed_at).filter(Boolean).map(t=>new Date(t).getTime());
  const freshness={processed_through:processed.length?new Date(Math.max(...processed)).toISOString():null};
  const diagnosticPoints=(kind:'rage_points'|'dead_points')=>{const bins=new Map<string,{x:number;y:number;weight:number}>();let observations=0;for(const v of confirmed)for(const s of selectedSegments(v))for(const p of s.diagnostics?.[kind]??[]){if(++observations>100000)throw new Problem(422,'REPORT_BUDGET_EXCEEDED');const point=mapCoordinate(p,s.width,s.document_height);if(!point)continue;const key=point.x+':'+point.y,existing=bins.get(key);if(existing)existing.weight++;else bins.set(key,point);}return [...bins.values()];};
  const revisions=await db.query("SELECT context->>'revision' AS revision FROM views WHERE site_id=$1 AND page_key=$2 AND data_source=$3 GROUP BY context->>'revision' ORDER BY min(started_at) LIMIT 100",[f.site_id,f.page_key,dataSource]);
  const qualityByView=new Map(qualityRows.map(r=>[r.view_id,r]));
  const chartViews=confirmed.map(v=>({started_at:v.started_at,facts:v.facts,segments:selectedSegments(v),received_events:qualityByView.get(v.view_id)?.events??0,delayed_events:qualityByView.get(v.view_id)?.delayed??0})),chartMinimum=page.environment==='synthetic'?0:privacy.value.minimum_views;
  return {
    suppressed:false as const,page,reference,references,data_source:dataSource,selected_revision:revision,selected_variant:variant,variants:[...new Set([page.variant,...views.map(v=>v.context.variant)])],mapping:elementMapping?'element':'document',campaign:f.campaign??null,revisions:[...new Set([...revisions.map(r=>r.revision),page.revision])],...advanced,rage_points:diagnosticPoints('rage_points'),dead_points:diagnosticPoints('dead_points'),
    summary: {views: confirmed.length, clicks: clickCount, activated_views: activated, activation_rate: confirmed.length ? 100*activated/confirmed.length : 0, avg_reach: confirmed.length ? reach/confirmed.length : 0, avg_visible_seconds: confirmed.length ? visible/confirmed.length/1000 : 0, exposed_views: exposed, exposed_activated_views: exposedActivated, exposed_activation_rate: exposed ? 100*exposedActivated/exposed : 0},
    points: [...points.values()], daily: Object.values(dates).sort((a,b) => a.date.localeCompare(b.date)), scroll, elements,
    timeseries:activitySeries(chartViews,from.toISOString(),to.toISOString(),page.primary_cta_id,page.primary_action_id,chartMinimum),devices:segmentDevices(chartViews,chartMinimum),
    widths: [...widthSet].sort((a,b) => a-b),
    quality: {mapped, incompatible, unsupported, masked,unregistered,orphan_views: views.filter(v => v.has_page_view === false).length,pending_views:views.filter(v=>!v.facts||v.aggregation_version<3).length,advanced_views:confirmed.filter(v=>v.aggregation_version>=3).length,sample_rate:page.sample_rate,sample_rates:[...new Set(confirmed.map(v=>v.sample_rate))],aggregation_version:3,processed_through:freshness.processed_through,delayed_events:qualityRows.reduce((n,r)=>n+r.delayed,0),retained_events:qualityRows.reduce((n,r)=>n+r.events,0),p75_view_max_delay_ms:percentile(qualityRows.map(r=>Number(r.max_delay_ms)),0.75),provisional:true,delivery:'best-effort',private_exclusions:'not collected',total_observations:clickCount},
  };
}

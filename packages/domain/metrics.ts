import type { Event } from '../contracts/events.js';
import {enrichFacts,type Journey,type Diagnostics} from './advanced.js';

export interface SegmentFact {
  width: number; height: number; document_height: number;
  reach: number; visible_ms: number; clicks: number;
  actions: string[]; exposures: string[]; activated_elements: string[];
  element_clicks: Record<string, number>;
  journey?:Journey;diagnostics?:Diagnostics;performance?:Record<string,number>;
  attention?: number[];
}
export interface FormFact {started:boolean;submitted:boolean;duration_ms?:number;last_field?:string;fields:Record<string,{completions:number;filled:number;errors:number;ms:number}>}
export interface BehaviourFacts {
  source?: Extract<Event,{type:'page_view'}>['source']; client?: Extract<Event,{type:'page_view'}>['client'];
  hover: Record<string,{count:number;ms:number}>; forms: Record<string,FormFact>;
  exit?: {kind:'link'|'exit_intent'|'hidden';reach_percent:number};
  engagement?: {active_ms:number;idle_ms:number;first_interaction_ms?:number};
}

export function scrollMetrics(y: number, height: number, viewport: number) {
  return {
    reach: Math.min(100, 100 * Math.min(height, Math.max(0, y) + viewport) / height),
    scroll: height <= viewport ? 0 : Math.min(100, 100 * Math.max(0, y) / (height - viewport)),
  };
}

export function viewFacts(events: Event[]) {
  const actions = new Set<string>(), exposures = new Set<string>();
  const segments: Record<string, SegmentFact> = {};
  let clicks = 0;
  const behaviour: BehaviourFacts = {hover:Object.create(null),forms:Object.create(null)};
  for (const e of [...events].sort((a,b) => a.seq-b.seq || a.event_id.localeCompare(b.event_id))) {
    const s = segments[e.segment_id] ??= {
      width: e.viewport.width, height: e.viewport.height, document_height: e.viewport.document_height,
      reach: scrollMetrics(e.viewport.scroll_y, e.viewport.document_height, e.viewport.height).reach,
      visible_ms: 0, clicks: 0, actions: [], exposures: [], activated_elements: [], element_clicks: Object.create(null),
    };
    if (e.type === 'progress') {s.reach = Math.max(s.reach,e.max_reach_percent); s.visible_ms = Math.max(s.visible_ms,e.visible_ms);}
    if (e.type === 'click') {
      clicks++; s.clicks++;
      if (e.target) s.element_clicks[e.target.element_id] = (s.element_clicks[e.target.element_id] ?? 0) + 1;
    }
    if (e.type === 'exposure') {
      exposures.add(e.element_id);
      if (!s.exposures.includes(e.element_id)) s.exposures.push(e.element_id);
    }
    if (e.type === 'page_view') {if (e.source) behaviour.source = e.source; if (e.client) behaviour.client = e.client;}
    // Attention bands are cumulative per segment, so keep the largest value seen for each band.
    if (e.type === 'attention') s.attention = e.bands.map((v,i) => Math.max(v, s.attention?.[i] ?? 0));
    if (e.type === 'hover') {const h = behaviour.hover[e.element_id] ??= {count:0,ms:0}; h.count++; h.ms += e.hover_ms;}
    if (e.type === 'form') {
      const f = behaviour.forms[e.form_id] ??= {started:false,submitted:false,fields:Object.create(null)};
      if (e.action === 'start') f.started = true;
      if (e.action === 'submit') {f.started = true; f.submitted = true; if (e.duration_ms !== undefined) f.duration_ms = e.duration_ms;}
      if (e.field_id) {
        f.started = true; f.last_field = e.field_id;
        const field = f.fields[e.field_id] ??= {completions:0,filled:0,errors:0,ms:0};
        if (e.action === 'field_complete') {field.completions++; field.ms += e.duration_ms ?? 0; if (e.filled) field.filled++;}
        if (e.action === 'field_error') field.errors++;
      }
    }
    if (e.type === 'exit') behaviour.exit = {kind:e.kind,reach_percent:e.reach_percent};
    if (e.type === 'engagement') behaviour.engagement = {active_ms:Math.max(e.active_ms,behaviour.engagement?.active_ms ?? 0),idle_ms:Math.max(e.idle_ms,behaviour.engagement?.idle_ms ?? 0),...(e.first_interaction_ms !== undefined ? {first_interaction_ms:e.first_interaction_ms} : behaviour.engagement?.first_interaction_ms !== undefined ? {first_interaction_ms:behaviour.engagement.first_interaction_ms} : {})};
    if (e.type === 'activation') {
      actions.add(e.action_id);
      if (!s.actions.includes(e.action_id)) s.actions.push(e.action_id);
      if (e.element_id && !s.activated_elements.includes(e.element_id)) s.activated_elements.push(e.element_id);
    }
  }
  return {
    ...enrichFacts(events,segments),
    has_page_view: events.some(e => e.type === 'page_view'), clicks,
    max_reach: Math.max(0,...Object.values(segments).map(s => s.reach)),
    visible_ms: Object.values(segments).reduce((n,s) => n+s.visible_ms,0),
    actions: [...actions], exposures: [...exposures], segments, behaviour,
  };
}

export function deviceForWidth(width: number) {return width<768?'mobile':width<1200?'tablet':'desktop';}
export function cohortSegments(segments: Record<string,SegmentFact>, device?: string, width?: string) {
  return Object.values(segments).filter(s => (!device || device==='all' || deviceForWidth(s.width)===device) && (!width || s.width===Number(width)));
}

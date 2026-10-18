import { Type as T, type Static } from '@sinclair/typebox';
const obj = <P extends import('@sinclair/typebox').TProperties>(p: P) => T.Object(p, {additionalProperties: false});
const code = T.String({pattern: '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,63}$', maxLength: 64});
const uuid = T.String({format: 'uuid'});
const num = (min = 0, max = 100000) => T.Number({minimum: min, maximum: max});
export const viewportSchema = obj({width:T.Integer({minimum:240,maximum:7680}),height:T.Integer({minimum:200,maximum:4320}),dpr:num(0.5,8),visual_scale:num(0.25,8),visual_offset_x:num(-10000,10000),visual_offset_y:num(-10000,10000),scroll_x:num(),scroll_y:num(),document_width:T.Integer({minimum:240,maximum:100000}),document_height:T.Integer({minimum:200,maximum:100000})});
const rect = obj({x:num(-10000), y:num(-10000), width:num(0.01), height:num(0.01)});
const base = {event_id:uuid, seq:T.Integer({minimum:0, maximum:20000}), elapsed_ms:num(0,86400000), segment_id:uuid, viewport:viewportSchema};
export const eventSchema = T.Union([
  obj({...base, type:T.Literal('page_view')}),
  obj({...base, type:T.Literal('segment_start'), segment_ordinal:T.Integer({minimum:0,maximum:1000}), geometry_state:code}),
  obj({...base, type:T.Literal('click'), client_x:num(), client_y:num(), document_x:num(), document_y:num(), pointer:T.Union([T.Literal('mouse'),T.Literal('touch'),T.Literal('pen')]), layer:T.Union([T.Literal('document'),T.Literal('fixed'),T.Literal('sticky'),T.Literal('element-only')]), target:T.Optional(obj({element_id:code,x_fraction:num(0,1),y_fraction:num(0,1),rect}))}),
  obj({...base, type:T.Literal('activation'), action_id:code, element_id:T.Optional(code), method:T.Union([T.Literal('pointer'),T.Literal('keyboard'),T.Literal('host')])}),
  obj({...base, type:T.Literal('progress'), max_reach_px:num(), max_reach_percent:num(0,100), max_scroll_percent:num(0,100), visible_ms:num(0,86400000), geometry_stable:T.Boolean()}),
  obj({...base, type:T.Literal('exposure'), element_id:code, qualified_ms:num(1000,86400000), threshold:T.Literal(0.5), first_qualified:T.Boolean()}),
  obj({...base,type:T.Literal('diagnostic'),kind:T.Literal('dead_click'),related_event_id:uuid,element_id:T.Optional(code)}),
  obj({...base,type:T.Literal('diagnostic'),kind:T.Union([T.Literal('runtime_error'),T.Literal('unhandled_rejection')]),code}),
  obj({...base,type:T.Literal('performance'),metric:T.Union([T.Literal('navigation_load_ms'),T.Literal('fcp_ms'),T.Literal('lcp_ms'),T.Literal('interaction_latency_ms'),T.Literal('layout_shift')]),value:num(0,120000)}),
  obj({...base,type:T.Literal('delivery'),retry_attempts:T.Integer({minimum:0,maximum:20000}),dropped_events:T.Integer({minimum:0,maximum:20000}),transport_failures:T.Integer({minimum:0,maximum:20000})}),
]);
export const contextSchema = obj({page_key:code,revision:code,locale:code,variant:code,state:code,campaign:code,acquisition_id:T.Optional(uuid)});
export const batchSchema = obj({schema_version:T.Literal(1),sdk_version:T.String({maxLength:32}),site_key:T.String({pattern:'^site_[a-zA-Z0-9_-]{8,90}$',maxLength:96}),batch_id:uuid,config_version:T.Integer({minimum:1}),view_id:uuid,view_started_at:T.String({format:'date-time'}),sample_rate:num(0.000001,1),consent:obj({analytics:T.Literal(true),policy_version:code}),context:contextSchema,events:T.Array(eventSchema,{minItems:1,maxItems:50})});
export type Event = Static<typeof eventSchema>;
export type Viewport = Static<typeof viewportSchema>;
export type Context = Static<typeof contextSchema>;
export type Batch = Static<typeof batchSchema>;

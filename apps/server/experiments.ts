import {randomUUID} from 'node:crypto';
import type {DB} from '../../packages/db/index.js';
import type {ExperimentInput} from '../../packages/contracts/acquisition.js';
import {experimentDecision,requiredSample} from '../../packages/domain/experimentation.js';
import {Problem,token,canonical} from './security.js';
import {acquisitionContext,eligiblePage} from './acquisition.js';
import {engagement} from '../../packages/domain/advanced.js';

export const publicExperiment=(e:any)=>{const{salt,final_readout,...safe}=e;return {...safe,readout_frozen:!!final_readout};};
export async function createExperiment(db:DB,b:ExperimentInput){
 if(b.control_variant===b.treatment_variant)throw new Problem(422,'VARIANTS_MUST_DIFFER');
 let required:number;try{required=requiredSample(b.baseline_rate,b.mde_relative);}catch{throw new Problem(422,'INVALID_POWER_PLAN');}
 return db.transaction(async tx=>{const[page]=await tx.query('SELECT * FROM pages WHERE site_id=$1 AND page_key=$2',[b.site_id,b.page_key]),[site]=await tx.query('SELECT * FROM sites WHERE id=$1',[b.site_id]);if(!page||!site)throw new Problem(404,'PAGE_NOT_FOUND');if(b.control_variant!==page.variant)throw new Problem(422,'CONTROL_MUST_MATCH_PAGE_VARIANT');const[privacy]=await tx.query("SELECT value FROM settings WHERE key='privacy'");if(b.attribution_hours>privacy.value.raw_days*24)throw new Problem(422,'WINDOW_EXCEEDS_RETENTION');
 await tx.query('SELECT id FROM sites WHERE id=$1 FOR UPDATE',[b.site_id]);if((await tx.query('SELECT 1 FROM experiments WHERE site_id=$1 AND page_key=$2 AND revision=$3 AND treatment_variant=$4',[b.site_id,b.page_key,page.revision,b.treatment_variant])).length)throw new Problem(409,'VARIANT_CODE_ALREADY_USED');
 const id=randomUUID();const[e]=await tx.query('INSERT INTO experiments(id,site_id,page_key,name,kind,primary_metric,control_variant,treatment_variant,revision,baseline_rate,mde_relative,required_per_arm,minimum_days,attribution_hours,salt,context) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *',[id,b.site_id,b.page_key,b.name,b.kind,b.primary_metric,b.control_variant,b.treatment_variant,page.revision,b.baseline_rate,b.mde_relative,required,b.minimum_days,b.attribution_hours,token(),JSON.stringify(acquisitionContext(page,site))]);return publicExperiment(e);});
}
export async function changeExperimentState(db:DB,id:string,status:'running'|'paused'|'completed'){
 return db.transaction(async tx=>{
  // A site row serializes policy changes, assignment and lifecycle operations.
  const[identity]=await tx.query('SELECT site_id,page_key FROM experiments WHERE id=$1',[id]);if(!identity)throw new Problem(404,'EXPERIMENT_NOT_FOUND');
  await tx.query('SELECT id FROM sites WHERE id=$1 FOR UPDATE',[identity.site_id]);
  const[e]=await tx.query('SELECT * FROM experiments WHERE id=$1 FOR UPDATE',[id]);
  if(e.status===status)return publicExperiment(e);
  if(e.status==='completed'||(status==='paused'&&e.status!=='running')||(status==='completed'&&e.status==='draft'))throw new Problem(409,'INVALID_EXPERIMENT_TRANSITION');
  if(status==='running'){
   const{page,site}=await eligiblePage(tx,e.site_id,e.page_key);if(page.revision!==e.revision||canonical(acquisitionContext(page,site))!==canonical(e.context))throw new Problem(409,'EXPERIMENT_CONTEXT_CHANGED');
   const[other]=await tx.query("SELECT id FROM experiments WHERE site_id=$1 AND page_key=$2 AND id<>$3 AND status IN ('running','paused')",[e.site_id,e.page_key,e.id]);if(other)throw new Problem(409,'PAGE_EXPERIMENT_ALREADY_ACTIVE');
  }
  const[next]=await tx.query("UPDATE experiments SET status=$2,started_at=CASE WHEN $2='running' THEN COALESCE(started_at,now()) ELSE started_at END,active_seconds=active_seconds+CASE WHEN status='running' THEN GREATEST(0,EXTRACT(epoch FROM(now()-last_started_at))) ELSE 0 END,last_started_at=CASE WHEN $2='running' THEN now() ELSE NULL END,completed_at=CASE WHEN $2='completed' THEN now() ELSE NULL END WHERE id=$1 RETURNING *",[id,status]);
  // Invalidate SDK policy caches without invalidating already-issued view context.
  await tx.query('UPDATE sites SET config_version=config_version+1 WHERE id=$1',[e.site_id]);await tx.query('INSERT INTO config_history(site_id,version,sample_rate) SELECT id,config_version,sample_rate FROM sites WHERE id=$1',[e.site_id]);return publicExperiment(next);
 });
}
export async function experimentReadout(db:DB,id:string,source:'recorded'|'seeded'='recorded',inTransaction=false){
 const read=async(tx:DB)=>{if(!inTransaction)await tx.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const[e]=await tx.query('SELECT e.*,s.environment,p.name AS page_name FROM experiments e JOIN sites s ON s.id=e.site_id JOIN pages p ON p.site_id=e.site_id AND p.page_key=e.page_key WHERE e.id=$1',[id]);if(!e)throw new Problem(404,'EXPERIMENT_NOT_FOUND');
 if(source==='recorded'&&e.final_readout)return {...e.final_readout,archived:true};
 const rows=await tx.query("SELECT v.variant,v.device,count(*)::int AS assigned,count(*) FILTER(WHERE rendered_at IS NOT NULL)::int AS rendered,count(*) FILTER(WHERE created_at+attribution_hours*interval '1 hour'<=now())::int AS mature,count(*) FILTER(WHERE created_at+attribution_hours*interval '1 hour'<=now() AND EXISTS(SELECT 1 FROM acquisition_outcomes o WHERE o.visit_id=v.id AND o.kind=$3))::int AS successes FROM acquisition_visits v WHERE experiment_id=$1 AND data_source=$2 GROUP BY v.variant,v.device",[id,source,e.primary_metric]);
 const[privacy]=await tx.query("SELECT value FROM settings WHERE key='privacy'");const total=rows.reduce((n,r)=>n+r.assigned,0);
 if(e.environment!=='synthetic'&&total<privacy.value.minimum_views)return {experiment:publicExperiment(e),suppressed:true as const,minimum_views:privacy.value.minimum_views};
 const arm=(variant:string)=>rows.filter(r=>r.variant===variant).reduce<{variant:string;assigned:number;rendered:number;mature:number;successes:number}>((a,r)=>({variant,assigned:a.assigned+r.assigned,rendered:a.rendered+r.rendered,mature:a.mature+r.mature,successes:a.successes+r.successes}),{variant,assigned:0,rendered:0,mature:0,successes:0});
 const control=arm(e.control_variant),treatment=arm(e.treatment_variant),pending=total-control.mature-treatment.mature;
 const activeDays=(Number(e.active_seconds)+(e.status==='running'?Math.max(0,(Date.now()-new Date(e.last_started_at).getTime())/1000):0))/86400;
 const decision=experimentDecision({kind:e.kind,status:e.status,source,control,treatment,pending,active_days:activeDays,minimum_days:e.minimum_days,required_per_arm:e.required_per_arm});
 if(e.evidence_pruned){decision.blockers.push('HISTORY_EXPIRED');decision.ready=false;decision.decision=source==='seeded'?'SAMPLE_DATA':'INCONCLUSIVE';decision.exploratory=true;}
 if(e.privacy_exclusions&&source==='recorded'){decision.blockers.push('PRIVACY_EXCLUSIONS');decision.ready=false;decision.decision='INCONCLUSIVE';decision.exploratory=true;}
 const behavior=await tx.query("SELECT a.variant,f.facts FROM views v JOIN acquisition_visits a ON a.id=v.context->>'acquisition_id' AND a.site_id=v.site_id JOIN view_facts f ON f.site_id=v.site_id AND f.view_id=v.view_id WHERE a.experiment_id=$1 AND v.data_source=$2 AND a.data_source=$2 AND f.has_page_view=true AND f.aggregation_version>=3 LIMIT 50001",[id,source]);if(behavior.length>50000)throw new Problem(422,'EXPERIMENT_REPORT_BUDGET');
 const[page]=await tx.query('SELECT primary_cta_id,primary_action_id FROM pages WHERE site_id=$1 AND page_key=$2',[e.site_id,e.page_key]);
 const guardrails=[e.control_variant,e.treatment_variant].map(variant=>{const selected=behavior.filter(r=>r.variant===variant),summary=engagement(selected.map(r=>({facts:r.facts,segments:Object.values(r.facts.segments) as any[]})),page.primary_cta_id,page.primary_action_id);return {variant,tracked_views:selected.length,...summary};});
 const targetPp=100*e.baseline_rate*e.mde_relative;
 return {experiment:publicExperiment(e),suppressed:false as const,data_source:source,as_of:new Date().toISOString(),control,treatment,pending,active_days:activeDays,...decision,guardrails,planned_effect_pp:targetPp,practically_promising:decision.ready&&decision.effect!==null&&decision.effect.difference_pp>=targetPp,device_slices:rows.map(r=>({...r,exploratory:true})),allocation:'50/50 at the site-scoped unit; fixed for the experiment',multiplicity:'One prespecified primary comparison per experiment. Device slices and sampled behavior guardrails are exploratory and need a separate rollout review. No pooled winner across markets or correction across separately run experiments is claimed.'};
 };
 return inTransaction?read(db):db.transaction(read);
}
export async function freezeExperimentReadout(db:DB,id:string){return db.transaction(async tx=>{const[e]=await tx.query('SELECT site_id FROM experiments WHERE id=$1',[id]);if(!e)throw new Problem(404,'EXPERIMENT_NOT_FOUND');await tx.query('SELECT id FROM sites WHERE id=$1 FOR UPDATE',[e.site_id]);await tx.query('SELECT id FROM experiments WHERE id=$1 FOR UPDATE',[id]);const readout=await experimentReadout(tx,id,'recorded',true);if(!readout.ready)throw new Problem(409,'READOUT_NOT_READY');await tx.query('UPDATE experiments SET final_readout=$2 WHERE id=$1',[id,JSON.stringify(readout)]);return {ok:true,readout};});}
export async function approvedExperimentContexts(db:DB,siteId:string,page:any){
 const experiments=await db.query("SELECT id,control_variant,treatment_variant,revision FROM experiments WHERE site_id=$1 AND page_key=$2 AND status IN ('running','paused') AND revision=$3",[siteId,page.page_key,page.revision]);
 return experiments.flatMap(e=>[e.control_variant,e.treatment_variant].map(variant=>({experiment_id:e.id,revision:e.revision,locale:page.locale,state:page.state,variant})));
}

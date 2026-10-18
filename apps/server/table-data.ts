import {Type as T} from '@sinclair/typebox';
import type {DB} from '../../packages/db/index.js';
import {Problem} from './security.js';

export type TableQuery={page?:string;page_size?:string;sort?:string;direction?:'asc'|'desc';search?:string;as_of?:string};
export const historySorts={audit:['created_at','action','site_id'],operations:['started_at','finished_at','kind','status']} as const;
export function historyQuerySchema(kind:keyof typeof historySorts){return T.Object({
 page:T.Optional(T.String({pattern:'^(0|[1-9][0-9]{0,5})$'})),
 page_size:T.Optional(T.Union(['5','10','25','50'].map(value=>T.Literal(value)))),
 sort:T.Optional(T.Union(historySorts[kind].map(value=>T.Literal(value)))),
 direction:T.Optional(T.Union([T.Literal('asc'),T.Literal('desc')])),
 search:T.Optional(T.String({maxLength:120,pattern:'^[^\\u0000-\\u001f\\u007f]*$'})),
 as_of:T.Optional(T.String({maxLength:30,pattern:'^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$'})),
},{additionalProperties:false});}

export async function historyTable(db:DB,kind:keyof typeof historySorts,q:TableQuery){
 const page=Number(q.page??0),size=Number(q.page_size??10),sort=q.sort??historySorts[kind][0],direction=q.direction??'desc';
 if(!Number.isSafeInteger(page)||page<0||page>999999||![5,10,25,50].includes(size)||!(historySorts[kind] as readonly string[]).includes(sort)||!['asc','desc'].includes(direction))throw new Problem(400,'INVALID_TABLE_QUERY');
 const search=(q.search??'').trim();if(search.length>120||/[\u0000-\u001f\u007f]/.test(search))throw new Problem(400,'INVALID_TABLE_QUERY');
 const snapshot=q.as_of??new Date().toISOString();if(!Number.isFinite(Date.parse(snapshot))||new Date(snapshot).toISOString()!==snapshot||Date.parse(snapshot)>Date.now()+60000)throw new Problem(400,'INVALID_TABLE_SNAPSHOT');
 // Only allowlisted identifiers enter the SQL. Search, snapshot, page and size are bound values.
 // A single statement gives the count and rows the same database snapshot.
 const audit=kind==='audit',table=audit?'audit':'operation_runs',date=audit?'created_at':'started_at';
 const fields=audit?'id,action,site_id,created_at':'id,kind,status,started_at,finished_at,detail,error_code';
 const searchText=audit?"action||' '||COALESCE(site_id,'')":"kind||' '||status||' '||COALESCE(error_code,'')";
 const [result]=await db.query(`WITH matches AS MATERIALIZED (
  SELECT ${fields} FROM ${table} WHERE ${date}<=$1::timestamptz AND ($2::text='' OR strpos(lower(${searchText}),lower($2::text))>0)
 ), counted AS (SELECT count(*)::int AS total FROM matches)
 SELECT total,LEAST($3::int,GREATEST(0,(total-1)/$4::int)) AS page,
 COALESCE((SELECT jsonb_agg(to_jsonb(item)) FROM (
  SELECT * FROM matches ORDER BY ${sort} ${direction} NULLS LAST,id ${direction}
  LIMIT $4::int OFFSET LEAST($3::int,GREATEST(0,(total-1)/$4::int))*$4::int
 ) item),'[]'::jsonb) AS rows FROM counted`,[snapshot,search,page,size]);
 return {rows:result.rows,pagination:{pageIndex:result.page,pageSize:size,rowCount:result.total,pageCount:Math.ceil(result.total/size)},snapshot};
}

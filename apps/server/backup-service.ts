import {randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,rm,lstat,readdir} from 'node:fs/promises';
import path from 'node:path';
import type {DB} from '../../packages/db/index.js';
import {digest} from './security.js';
import {filesystemReferences} from '../../packages/storage/index.js';
export const backupTables=['sites','pages','config_history','users','site_memberships','views','events','jobs','view_facts','page_references','capture_jobs','settings','audit','ingestion_quotas','operation_runs','operation_alerts','acquisition_keys','experiments','acquisition_visits','acquisition_outcomes','acquisition_spend','installation_checks'] as const;
export async function saveBackup(db:DB,dataDir:string,target:string){
 const final=path.resolve(target),parent=path.dirname(final),stage=path.join(parent,'.backup-tmp-'+randomUUID());
 if([dataDir,path.join(dataDir,'database'),path.join(dataDir,'references')].some(dir=>final===path.resolve(dir))||final.startsWith(path.resolve(dataDir,'database')+path.sep)||final.startsWith(path.resolve(dataDir,'references')+path.sep))throw new Error('BACKUP_TARGET_INVALID');
 if(await lstat(final).then(()=>true,()=>false))throw new Error('BACKUP_TARGET_EXISTS');
 await mkdir(parent,{recursive:true,mode:0o700});await mkdir(path.join(stage,'references'),{recursive:true,mode:0o700});
 try{
  const data:Record<string,any>={schema_version:2,created_at:new Date().toISOString()};
  await db.transaction(async tx=>{await tx.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');for(const table of backupTables)data[table]=await tx.query('SELECT * FROM '+table);});
  const json=JSON.stringify(data),references:{object_key:string;sha256:string}[]=[];
  await writeFile(path.join(stage,'database.json'),json,{mode:0o600,flag:'wx'});
  for(const ref of data.page_references){const bytes=await filesystemReferences(dataDir).read(ref.object_key);const sha256=digest(bytes);if(sha256!==ref.manifest.image?.sha256)throw new Error('REFERENCE_CHECKSUM_FAILED');await writeFile(path.join(stage,'references',ref.object_key),bytes,{mode:0o600,flag:'wx'});references.push({object_key:ref.object_key,sha256});}
  await writeFile(path.join(stage,'backup-manifest.json'),JSON.stringify({schema_version:1,created_at:data.created_at,database_sha256:digest(json),references}),{mode:0o600,flag:'wx'});await rename(stage,final);await verifyBackup(final);return {name:path.basename(final),created_at:data.created_at,references:references.length,database_sha256:digest(json)};
 }catch(error){if(path.dirname(stage)!==parent||!/^\.backup-tmp-[a-f0-9-]{36}$/.test(path.basename(stage)))throw new Error('UNSAFE_BACKUP_CLEANUP');await rm(stage,{recursive:true,force:true});throw error;}
}
export async function verifyBackup(source:string){
 const json=await readFile(path.join(source,'database.json'),'utf8'),data=JSON.parse(json);if(![1,2].includes(data.schema_version))throw new Error('BACKUP_SCHEMA_UNSUPPORTED');
 if(data.schema_version===2){const manifest=JSON.parse(await readFile(path.join(source,'backup-manifest.json'),'utf8'));if(manifest.schema_version!==1||manifest.database_sha256!==digest(json))throw new Error('BACKUP_CHECKSUM_FAILED');const expected=new Map<string,string>((data.page_references??[]).map((r:any)=>[r.object_key,r.manifest.image.sha256]));if(manifest.references.length!==expected.size)throw new Error('BACKUP_REFERENCES_INVALID');const checked=new Set<string>();for(const ref of manifest.references){if(!/^[a-f0-9-]{36}\.png$/.test(ref.object_key)||checked.has(ref.object_key)||expected.get(ref.object_key)!==ref.sha256)throw new Error('BACKUP_REFERENCES_INVALID');const bytes=await readFile(path.join(source,'references',ref.object_key));if(digest(bytes)!==ref.sha256)throw new Error('REFERENCE_CHECKSUM_FAILED');checked.add(ref.object_key);}}
 return data;
}
export async function pruneBackups(root:string,days:number){
 const absolute=path.resolve(root);for(const entry of await readdir(absolute,{withFileTypes:true}).catch(()=>[])){if(!entry.isDirectory()||!/^heatmap-\d{8}T\d{6}Z-[a-f0-9-]{36}$/.test(entry.name))continue;const target=path.resolve(absolute,entry.name);if(path.dirname(target)!==absolute)throw new Error('UNSAFE_BACKUP_PRUNE');const stat=await lstat(target);if(stat.isSymbolicLink()||stat.mtimeMs>=Date.now()-days*86400000)continue;await verifyBackup(target);await rm(target,{recursive:true,force:false});}
}

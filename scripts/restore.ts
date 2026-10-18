import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {openDB,migrate} from '../packages/db/index.js';
import {config} from '../apps/server/config.js';
import {requireOffline} from './local-client.js';
import {verifyBackup,backupTables} from '../apps/server/backup-service.js';
import {filesystemReferences} from '../packages/storage/index.js';
import {digest} from '../apps/server/security.js';
await requireOffline();const source=process.argv[2];if(!source||!path.isAbsolute(source))throw new Error('Usage: pnpm restore <absolute-backup-directory>');const data=await verifyBackup(source);
// Validate each referenced private image before any database mutation.
for(const ref of data.page_references??[]){if(!/^[a-f0-9-]{36}\.png$/.test(ref.object_key))throw new Error('BACKUP_REFERENCES_INVALID');const bytes=await readFile(path.join(source,'references',ref.object_key));if(digest(bytes)!==ref.manifest.image?.sha256)throw new Error('REFERENCE_CHECKSUM_FAILED');}
const db=await openDB(config.databaseUrl,config.dataDir+'/database');try{
 await migrate(db);if((await db.query('SELECT 1 FROM sites LIMIT 1')).length)throw new Error('RESTORE_REQUIRES_EMPTY_DATABASE');
 await mkdir(config.dataDir+'/references',{recursive:true,mode:0o700});for(const ref of data.page_references??[])await filesystemReferences(config.dataDir).write(ref.object_key,await readFile(path.join(source,'references',ref.object_key)));
 await db.transaction(async tx=>{await tx.query('DELETE FROM settings');for(const table of backupTables)for(const row of data[table]??[]){if(table==='views'&&!Object.hasOwn(row,'data_source'))row.data_source='legacy';const keys=Object.keys(row);if(keys.some(k=>!/^[a-z_]+$/.test(k)))throw new Error('BACKUP_COLUMN_INVALID');await tx.query('INSERT INTO '+table+'('+keys.map(k=>'"'+k+'"').join(',')+') VALUES('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',keys.map(k=>typeof row[k]==='object'&&row[k]!==null?JSON.stringify(row[k]):row[k]));}});
 await migrate(db);await db.query("UPDATE jobs SET state='pending',attempts=0,next_attempt_at=now() WHERE EXISTS(SELECT 1 FROM view_facts f WHERE f.site_id=jobs.site_id AND f.view_id=jobs.view_id AND f.aggregation_version<3)");
 console.log('Backup verified and restored into an empty database. Sessions excluded.');
}finally{await db.close();}

import path from 'node:path';
import {openDB} from '../packages/db/index.js';
import {config} from '../apps/server/config.js';
import {requireOffline} from './local-client.js';
import {saveBackup} from '../apps/server/backup-service.js';
await requireOffline();const target=process.argv[2];if(!target||!path.isAbsolute(target)||path.resolve(target)===config.dataDir||path.resolve(target).startsWith(config.dataDir+path.sep))throw new Error('BACKUP_DESTINATION_MUST_BE_OUTSIDE_DATA_DIRECTORY');
const db=await openDB(config.databaseUrl,config.dataDir+'/database');try{await saveBackup(db,config.dataDir,target);console.log('Checksummed logical backup saved; sessions excluded. Protect the backup as sensitive application data.');}finally{await db.close();}

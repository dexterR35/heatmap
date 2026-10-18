import {openDB} from '../packages/db/index.js';
import {config} from '../apps/server/config.js';
import {requireOffline} from './local-client.js';
import {retention} from '../apps/server/retention.js';
await requireOffline();const db=await openDB(config.databaseUrl,config.dataDir+'/database');try{console.log(await retention(db,config.dataDir));}finally{await db.close();}

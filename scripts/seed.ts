import {openDB,migrate} from '../packages/db/index.js';
import {seedRegistry,seedTraffic} from '../apps/server/seed.js';
import {processJobs} from '../apps/server/ingestion.js';
import {config} from '../apps/server/config.js';
import {requireOffline} from './local-client.js';
await requireOffline();const db=await openDB(config.databaseUrl,config.dataDir+'/database');
try{await migrate(db);await seedRegistry(db,config.demoOrigin);const result=await seedTraffic(db,config.demoOrigin);while(await processJobs(db,100)){}console.log(result.seeded?'210 synthetic views persisted. Real collection remains disabled.':'Demo already seeded. No existing policy changed.');}finally{await db.close();}

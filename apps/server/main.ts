import {openDB,migrate} from '../../packages/db/index.js';
import {seedRegistry} from './seed.js';
import {createCollector} from './collector.js';
import {createManagement} from './management.js';
import {createDemo} from './demo.js';
import {processJobs} from './ingestion.js';
import {config} from './config.js';
const production=config.releaseStatus==='PRODUCTION';
const db=await openDB(config.databaseUrl,config.dataDir+'/database');await migrate(db);if(!production)await seedRegistry(db,config.demoOrigin);
await processJobs(db,1000);
const collector=createCollector(db),management=createManagement(db,collector.rejections),demo=production?null:createDemo(db);
await collector.app.listen({host:config.bindHost,port:config.collectorPort});await management.listen({host:config.bindHost,port:config.dashboardPort});await demo?.listen({host:config.bindHost,port:config.demoPort});
let working=false;const worker=setInterval(async()=>{if(working)return;working=true;try{await processJobs(db,50);}catch{console.error('WORKER_TRANSACTION_FAILED · durable jobs retained for retry');}finally{working=false;}},1000);
console.log(`Infrared: ${config.dashboardOrigin}
Collector: ${config.collectorOrigin}
`+(production?'PRODUCTION · approved sites collect':`Demo: ${config.demoOrigin}/casino/?lp=halloween
LOCAL DEMO · real sites collect only after owner approval`));
const stop=async()=>{clearInterval(worker);await Promise.all([collector.app.close(),management.close(),demo?.close()]);while(working)await new Promise(r=>setTimeout(r,50));await db.close();process.exit(0);};process.on('SIGINT',stop);process.on('SIGTERM',stop);

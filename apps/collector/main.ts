import {createCollector} from '../server/collector.js';
import {serviceDatabase,shutdown} from '../server/service-runtime.js';
import {config} from '../server/config.js';
const db=await serviceDatabase(),{app}=createCollector(db);
await app.listen({host:config.bindHost,port:config.collectorPort});
shutdown(async()=>{await app.close();await db.close();});
console.log('Collector ready · immutable SDK, selector-aware config and validated events only');

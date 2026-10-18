import {createManagement} from '../server/management.js';
import {serviceDatabase,shutdown} from '../server/service-runtime.js';
import {config} from '../server/config.js';
const db=await serviceDatabase(),app=createManagement(db,new Map());
await app.listen({host:config.bindHost,port:config.dashboardPort});
shutdown(async()=>{await app.close();await db.close();});
console.log('Private dashboard and management API ready');

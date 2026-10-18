import {createDemo} from '../server/demo.js';
import {config} from '../server/config.js';
import {shutdown} from '../server/service-runtime.js';
const app=createDemo();await app.listen({host:config.bindHost,port:config.demoPort});
shutdown(()=>app.close());console.log('Synthetic landing-page fixture server ready');

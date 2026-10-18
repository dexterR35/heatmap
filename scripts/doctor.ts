import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import net from 'node:net';
import {config} from '../apps/server/config.js';
const result:Record<string,unknown>={node:process.version,expected_runtime:'Node 24 LTS; compatible host Node >=24',mode:config.databaseUrl?'PostgreSQL':'Persistent PGlite',release:'LOCAL_DEMO',live_collection:'disabled',data_directory:config.dataDir,credentials_file_exists:existsSync(config.dataDir+'/admin-credentials.json'),database_directory_exists:existsSync(config.dataDir+'/database'),artifacts_built:existsSync('dist/sdk/artifact.json')};
for(const port of [config.dashboardPort,config.collectorPort,config.demoPort])result['port_'+port]=await new Promise(resolve=>{const server=net.createServer();server.once('error',()=>resolve('in use'));server.listen(port,'127.0.0.1',()=>server.close(()=>resolve('available')));});
if(existsSync('dist/sdk/artifact.json'))result.sdk=JSON.parse(await readFile('dist/sdk/artifact.json','utf8'));
console.log(JSON.stringify(result,null,2));

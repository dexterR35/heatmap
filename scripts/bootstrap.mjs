import {randomBytes} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
let env;try{env=await readFile('.env','utf8');}catch{env=await readFile('.env.example','utf8');}
if(!/^POSTGRES_PASSWORD=.+$/m.test(env)){env+='\nPOSTGRES_PASSWORD='+randomBytes(32).toString('hex')+'\n';await writeFile('.env',env,{mode:0o600});}
console.log('Local Docker environment prepared. Existing secrets preserved. No secret values printed.');

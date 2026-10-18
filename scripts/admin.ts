import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {openDB,migrate} from '../packages/db/index.js';
import {passwordHash,token,audit} from '../apps/server/security.js';
import {seedRegistry} from '../apps/server/seed.js';
import {config} from '../apps/server/config.js';
import {requireOffline} from './local-client.js';
await requireOffline();const command=process.argv[2];if(!['create-user','bootstrap-local'].includes(command||''))throw new Error('Usage: pnpm admin create-user | bootstrap-local');
const db=await openDB(config.databaseUrl,config.dataDir+'/database');await migrate(db);await seedRegistry(db,config.demoOrigin);
try {
 if(command==='bootstrap-local'){
  if((await db.query('SELECT id FROM users LIMIT 1')).length){console.log('Administrator already exists. No credentials changed.');}
  else {const credentials={email:'admin@local.test',password:token()};const id=randomUUID();await db.query("INSERT INTO users(id,email,password_hash,role) VALUES($1,$2,$3,'owner')",[id,credentials.email,await passwordHash(credentials.password)]);await mkdir(config.dataDir,{recursive:true});await writeFile(config.dataDir+'/admin-credentials.json',JSON.stringify(credentials,null,2),{mode:0o600,flag:'wx'});await audit(db,id,'local_admin_created');console.log('Unique local administrator created. Credentials: .local/admin-credentials.json (ignored by Git).');}
 }else {
  const rl=createInterface({input:stdin,output:stdout});const email=(await rl.question('Administrator email: ')).toLowerCase().trim();
  // Input is read in raw mode to avoid echoing the secret in terminal history.
  rl.close();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('INVALID_EMAIL');if(!stdin.isTTY)throw new Error('Interactive terminal required. Use bootstrap-local for a generated local-only password.');
  stdout.write('Password (minimum 12 characters, hidden): ');stdin.setRawMode(true);stdin.resume();stdin.setEncoding('utf8');
  const password=await new Promise<string>((resolve,reject)=>{let p='';const onData=(key:string)=>{if(key==='\r'||key==='\n'){stdin.off('data',onData);stdin.setRawMode(false);stdin.pause();stdout.write('\n');resolve(p);}else if(key==='\u0003'){stdin.setRawMode(false);reject(new Error('CANCELLED'));}else if(key==='\u007f'||key==='\b')p=p.slice(0,-1);else p+=key;};stdin.on('data',onData);});
  if(password.length<12||password.length>256)throw new Error('PASSWORD_LENGTH');const id=randomUUID();await db.query("INSERT INTO users(id,email,password_hash,role) VALUES($1,$2,$3,'owner')",[id,email,await passwordHash(password)]);await audit(db,id,'admin_created');console.log('Administrator created.');
 }
}finally{await db.close();}

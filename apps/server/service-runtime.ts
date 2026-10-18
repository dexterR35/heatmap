import {openDB,type DB} from '../../packages/db/index.js';
import {config} from './config.js';

export async function serviceDatabase():Promise<DB> {
  if(!config.databaseUrl)throw new Error('Independent services require DATABASE_URL. Use pnpm start for native PGlite mode.');
  const db=await openDB(config.databaseUrl);
  const [schema]=await db.query('SELECT max(version) AS version FROM schema_migrations');
  if(Number(schema?.version)<6){await db.close();throw new Error('Run pnpm db:migrate before starting services.');}
  return db;
}

export function shutdown(close:()=>Promise<void>) {
  let stopping=false;
  const stop=()=>{if(stopping)return;stopping=true;void close().then(()=>process.exit(0)).catch(()=>process.exit(1));};
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
}

import {mkdir,readFile,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';

export interface ReferenceStorage {
  write(key:string,bytes:Buffer):Promise<void>;
  read(key:string):Promise<Buffer>;
  remove(key:string):Promise<void>;
}
export function filesystemReferences(dataDir:string):ReferenceStorage {
  const root=path.resolve(dataDir,'references');
  const file=(key:string)=>{
    if(!/^[\da-f-]{36}\.png$/.test(key))throw new Error('STORAGE_KEY_INVALID');
    return path.join(root,key);
  };
  return {
    async write(key,bytes){const target=file(key);await mkdir(root,{recursive:true});await writeFile(target,bytes,{flag:'wx'});},
    read:key=>readFile(file(key)),
    async remove(key){await unlink(file(key)).catch((e:NodeJS.ErrnoException)=>{if(e.code!=='ENOENT')throw e;});},
  };
}

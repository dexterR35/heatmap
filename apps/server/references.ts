import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { Type as T, type Static } from '@sinclair/typebox';
import type { DB } from '../../packages/db/index.js';
import { digest,Problem } from './security.js';
import {filesystemReferences} from '../../packages/storage/index.js';
const obj=<P extends import('@sinclair/typebox').TProperties>(p:P)=>T.Object(p,{additionalProperties:false});
const code=T.String({pattern:'^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,63}$'}),n=T.Number({minimum:0,maximum:100000});
const rect=obj({x:n,y:n,width:n,height:n});
export const manifestSchema=obj({schema_version:T.Literal(1),site_id:code,page_key:code,revision:code,locale:code,variant:code,state:code,captured_at:T.String({format:'date-time'}),viewport:obj({width:T.Integer({minimum:240,maximum:7680}),height:T.Integer({minimum:200,maximum:4320}),dpr:T.Literal(1)}),document:obj({width:T.Integer({minimum:240,maximum:7680}),height:T.Integer({minimum:200,maximum:20000})}),layer:T.Literal('document'),elements:T.Array(obj({id:code,rect,layer:T.Literal('document')}),{maxItems:100}),masks:T.Array(rect,{maxItems:100}),capture_policy_version:code});
export type Manifest=Static<typeof manifestSchema>;
export const referenceImportSchema=obj({manifest:manifestSchema,image_base64:T.String({maxLength:7500000})});
let importing=0;
export async function importReference(db:DB,dataDir:string,manifest:Manifest,buffer:Buffer) {
 if(importing>=2)throw new Problem(429,'REFERENCE_IMPORT_BUSY');importing++;
 try{return await importValidatedReference(db,dataDir,manifest,buffer);}finally{importing--;}
}
async function importValidatedReference(db:DB,dataDir:string,manifest:Manifest,buffer:Buffer) {
 const [page]=await db.query('SELECT * FROM pages WHERE site_id=$1 AND page_key=$2',[manifest.site_id,manifest.page_key]);
 const variant=page&&(page.variant===manifest.variant||(await db.query("SELECT id FROM experiments WHERE site_id=$1 AND page_key=$2 AND revision=$3 AND (control_variant=$4 OR treatment_variant=$4)",[manifest.site_id,manifest.page_key,manifest.revision,manifest.variant])).length>0);
 if(!page||!variant||['revision','locale','state'].some(k=>page[k]!==manifest[k as keyof Manifest]))throw new Problem(422,'REFERENCE_CONTEXT_MISMATCH');
 if(manifest.document.width!==manifest.viewport.width||manifest.elements.some(e=>!page.elements.includes(e.id))||new Set(manifest.elements.map(e=>e.id)).size!==manifest.elements.length)throw new Problem(422,'REFERENCE_GEOMETRY_INVALID');
 if(manifest.document.width*manifest.document.height>40000000||buffer.length>5500000)throw new Problem(413,'REFERENCE_TOO_LARGE');
 const png=buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const webp=buffer.subarray(0,4).toString('ascii')==='RIFF'&&buffer.subarray(8,12).toString('ascii')==='WEBP';
 if(!png&&!webp)throw new Problem(422,'REFERENCE_IMAGE_FORMAT_INVALID');
 const meta=await sharp(buffer,{limitInputPixels:40000000}).metadata().catch(()=>{throw new Problem(422,'REFERENCE_IMAGE_INVALID');});
 if(!['png','webp'].includes(meta.format||'')||(meta.pages??1)!==1||meta.width!==manifest.document.width||meta.height!==manifest.document.height)throw new Problem(422,'REFERENCE_IMAGE_MISMATCH');
 for(const r of [...manifest.masks,...manifest.elements.map(e=>e.rect)])if(r.x+r.width>manifest.document.width+2||r.y+r.height>manifest.document.height+2)throw new Problem(422,'REFERENCE_GEOMETRY_INVALID');
 const masks=manifest.masks.filter(r=>r.width>0&&r.height>0).map(r=>({input:Buffer.from(`<svg width="${Math.ceil(r.width)}" height="${Math.ceil(r.height)}"><rect width="100%" height="100%" fill="#252731"/></svg>`),left:Math.floor(r.x),top:Math.floor(r.y)}));
 const clean=await sharp(buffer,{limitInputPixels:40000000}).composite(masks).png().toBuffer().catch(()=>{throw new Problem(422,'REFERENCE_IMAGE_INVALID');});
 const id=randomUUID(),objectKey=id+'.png',image={object_key:objectKey,sha256:digest(clean),pixel_width:meta.width,pixel_height:meta.height,css_to_image_scale:1};
 const storage=filesystemReferences(dataDir);await storage.write(objectKey,clean);
 try{await db.query('INSERT INTO page_references(id,site_id,page_key,manifest,object_key) VALUES($1,$2,$3,$4,$5)',[id,manifest.site_id,manifest.page_key,JSON.stringify({...manifest,image,capture_status:'pending-review'}),objectKey]);}catch(error){await storage.remove(objectKey);throw error;}return id;
}
export async function referenceImage(db:DB,dataDir:string,id:string,authorize:(siteId:string,status:string)=>Promise<unknown>) {
 const [ref]=await db.query('SELECT * FROM page_references WHERE id=$1',[id]);if(!ref)throw new Problem(404,'REFERENCE_NOT_FOUND');
 await authorize(ref.site_id,ref.status);
 if(!/^[\da-f-]+\.png$/.test(ref.object_key))throw new Problem(500,'STORAGE_KEY_INVALID');
 return {ref,buffer:await filesystemReferences(dataDir).read(ref.object_key)};
}

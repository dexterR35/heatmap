export function configuredOrigin(value:string,name:string) {
  let url:URL;
  try{url=new URL(value);}catch{throw new Error(name+'_INVALID_ORIGIN');}
  if(url.origin!==value||url.username||url.password||!['http:','https:'].includes(url.protocol))throw new Error(name+'_INVALID_ORIGIN');
  if(url.protocol==='http:'&&!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw new Error(name+'_HTTPS_REQUIRED');
  return value;
}
export function configuredPort(value:string|undefined,fallback:number) {
  if(value!==undefined&&!/^\d{1,5}$/.test(value))throw new Error('PORT_INVALID');
  const port=value===undefined?fallback:Number(value);
  if(port<1024||port>65535)throw new Error('PORT_INVALID');return port;
}

import {parseAddress} from './matcher.js';
export function validCollectorOrigin(value:unknown):value is string {
 if(typeof value!=='string')return false;const url=parseAddress(value);return !!url&&url.origin===value;
}
export function validSDKArtifact(artifact:{file:string;sri:string}) {
 return /^tracker\.1\.0\.0\.[a-f0-9]{16}\.js$/.test(artifact?.file)&&/^sha384-[A-Za-z0-9+/]{64}$/.test(artifact?.sri);
}

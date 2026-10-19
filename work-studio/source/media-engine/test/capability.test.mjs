import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto});
const dir=await mkdtemp(join(tmpdir(),'studio-auth-'));
try{
 const out=join(dir,'capability.mjs');await build({entryPoints:['src/capability.ts'],outfile:out,bundle:true,platform:'node',format:'esm'});
 const {verifyCapability}=await import(pathToFileURL(out));
 const now=1700000000,secret='test-only-secret';
 const valid={sub:'1',role:'Super Administrator',iat:now,exp:now+60,nonce:'a'.repeat(32)};
 async function sign(p){const data=btoa(JSON.stringify(p));const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return data+'.'+Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(data))).toString('hex');}
 assert.deepEqual(await verifyCapability(await sign(valid),secret,now),valid);
 const rejected=[null,[],{...valid,sub:''},{...valid,role:'Member'},{...valid,iat:undefined},{...valid,iat:'1700000000'},{...valid,iat:now+31},{...valid,exp:now},{...valid,exp:now+61},{...valid,exp:now-1},{...valid,nonce:'short'}];
 for(const p of rejected)assert.equal(await verifyCapability(await sign(p),secret,now),null);
 const token=await sign(valid);assert.equal(await verifyCapability(token+'.extra',secret,now),null);assert.equal(await verifyCapability(token,'wrong',now),null);assert.equal(await verifyCapability(token,'',now),null);assert.equal(await verifyCapability('broken',secret,now),null);
 console.log('Capability checks passed: valid grant plus 15 rejection cases.');
}finally{await rm(dir,{recursive:true,force:true});}

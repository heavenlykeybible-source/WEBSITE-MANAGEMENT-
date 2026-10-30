import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {webcrypto,createHmac} from 'node:crypto';
import ts from 'typescript';

const root=fileURLToPath(new URL('../',import.meta.url));
const source=readFileSync(resolve(root,'src/index.ts'),'utf8');
const start=source.indexOf('type Capability =');
const end=source.indexOf('function audit(',start);
assert.ok(start>=0&&end>start,'Production capability verifier must be present');
const compiled=ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const verifier=runInNewContext(compiled+';verifyCapability',{crypto:webcrypto,TextEncoder,Uint8Array,Set,JSON,Math,Date,Number,String,Array,Error,atob});
const secret='test-secret-at-least-32-random-bytes-long';
const now=Math.floor(Date.now()/1000);
const healthy={sub:'owner-1',role:'Super Administrator',iat:now-60,exp:now+3600,nonce:'test-unique-nonce'};
function token(payload){
 const encoded=Buffer.from(JSON.stringify(payload)).toString('base64');
 const signature=createHmac('sha256',secret).update(encoded).digest('hex');
 return encoded+'.'+signature;
}
assert.equal((await verifier(token(healthy),secret))?.sub,healthy.sub,'Legitimate signed owner token should work');
for(const role of ['Administrator','Deputy Super Administrator']){
 assert.equal((await verifier(token({...healthy,role}),secret))?.role,role,'Approved administrator should work');
}
for(const value of [null,[],false,42,{},'hello',{...healthy,iat:null},{...healthy,iat:'0'},
 {...healthy,iat:now+1000},{...healthy,exp:null},{...healthy,exp:'9999999999'},
 {...healthy,exp:now-1},{...healthy,exp:healthy.iat},{...healthy,nonce:''},
 {...healthy,sub:null},{...healthy,role:'Viewer'}, {...healthy,sub:'x'.repeat(300)},
 {...healthy,nonce:'x'.repeat(300)}]){
 assert.equal(await verifier(token(value),secret),null,'Reject unauthorized or malformed token payload '+JSON.stringify(value));
}
for(const malformed of ['', 'aaa','a.b.c','x.'.repeat(3000),'@@@.'+'a'.repeat(64),
 token(healthy)+'extra',token(healthy).replace(/.$/,'a')]){
 assert.equal(await verifier(malformed,secret),null,'Malformed token must fail closed');
}
assert.equal(await verifier(token(healthy),'wrong-secret'),null,'Incorrect signing key must be rejected');
console.log('Account 2 signed capability authentication security checks passed');

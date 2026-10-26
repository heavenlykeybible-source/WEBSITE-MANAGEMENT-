import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const entry=process.argv[2];
if(!entry)throw Error('Provide the built Account 9 Worker file');
const worker=(await import(pathToFileURL(entry).href)).default;
const request=path=>new Request('https://video.example'+path);
async function read(path,env={}){
  const response=await worker.fetch(request(path),env);
  return {status:response.status,body:await response.json()};
}
const withoutResources=await read('/api/health');
assert.equal(withoutResources.status,503,'Missing Cloudflare bindings must block readiness');
assert.equal(withoutResources.body.status,'degraded');
const healthyEnv={
  DB:{prepare(){return {async all(){return {results:[]}}}}},
  MEDIA:{async get(){return null},async put(){}},
  AI:{async run(){return {}}}
};
const healthy=await read('/api/health',healthyEnv);
assert.deepEqual(healthy,{status:200,body:{status:'ready'}},'All bindings and required D1 tables must pass');
const badDB={...healthyEnv,DB:{prepare(){throw Error('missing D1 table')}}};
assert.equal((await read('/api/health',badDB)).status,503,'Missing DB schema must fail readiness');
assert.equal((await read('/api/health',{...healthyEnv,MEDIA:null})).status,503,'Missing R2 must fail readiness');
assert.equal((await read('/api/health',{...healthyEnv,AI:null})).status,503,'Missing AI must fail readiness');
for(const path of ['/api/me','/api/projects','/api/media']){
  const result=await read(path,healthyEnv);
  assert.equal(result.status,401,'Private API must reject anonymous access: '+path);
}
console.log('PASS packaged Worker health, missing DB schema, D1/R2/AI and API authentication smoke checks');

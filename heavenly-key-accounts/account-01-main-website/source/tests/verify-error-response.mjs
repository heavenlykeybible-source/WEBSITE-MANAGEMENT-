// Exercise actual service-worker response handling using Node's web primitives.
// No network, browser extensions, secrets, production data or new dependencies.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const workerSource=readFileSync(resolve(root,'service-worker.js'),'utf8');
const pages={'/404.html':readFileSync(resolve(root,'404.html'),'utf8'),'/500.html':readFileSync(resolve(root,'500.html'),'utf8')};
const callbacks=new Map(),written=[];
const store={match:async key=>{
 const path=typeof key==='string'?key:new URL(key.url).pathname;
 return pages[path]?new Response(pages[path],{status:200,headers:{'Content-Type':'text/html'}}):null;
},open:async()=>({put:async(request,response)=>written.push({request,response})})};
let originResponse=()=>new Response('ok');
const self={location:{origin:'https://heavenlykey.org'},addEventListener:(name,fn)=>callbacks.set(name,fn)};
runInNewContext(workerSource,{self,caches:store,fetch:async req=>{
 const path=typeof req==='string'?req:new URL(req.url).pathname;
 return pages[path]?new Response(pages[path]):originResponse(req);
},Response,URL,console});
async function navigate(path,status,body='origin status'){
 originResponse=()=>new Response(body,{status,headers:{'Content-Type':'text/html'}});
 let pending;const request=new Request('https://heavenlykey.org'+path,{headers:{Accept:'text/html'}});
 callbacks.get('fetch')({request,respondWith:p=>pending=p});
 assert.ok(pending,'Worker did not intercept public HTML navigation '+path);
 return await pending;
}
for(const [status,path,expected] of [[404,'/missing-20261026','Page not found'],[500,'/service-error-20261026','This page cannot be opened'],[503,'/service-unavailable-20261026','This page cannot be opened']]){
 const response=await navigate(path,status);
 assert.equal(response.status,status,'Do not mask HTTP error status');
 assert.match(response.headers.get('Content-Type'),/text\/html/i);
 assert.equal(response.headers.get('Cache-Control'),'no-store');
 assert.ok((await response.text()).toLowerCase().includes(expected.toLowerCase()));
}
const good=await navigate('/pages/about',200,'real ministry page');
assert.equal(await good.text(),'real ministry page','Successful website content must remain unchanged');
for(const path of ['/home','/pages/admin']) {
 let captured=false;callbacks.get('fetch')({request:new Request('https://heavenlykey.org'+path,{headers:{Accept:'text/html'}}),respondWith:()=>{captured=true}});
 assert.equal(captured,false,'Protected pages must not be intercepted '+path);
}
assert.ok(!written.some(x=>x.response.status>=400),'Do not cache HTTP error responses');
console.log('Error recovery worker checks passed: 404/500/503, HTTP status, 200 content, private routes and cache behavior.');

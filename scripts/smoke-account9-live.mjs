// Read-only post-deployment smoke checks. Never sends credentials or writes data.
import assert from 'node:assert/strict';
const raw=process.env.ACCOUNT9_LIVE_URL;
if(!raw)throw Error('Set ACCOUNT9_LIVE_URL to the exact approved Account 9 deployment origin.');
const origin=new URL(raw);
if(origin.protocol!=='https:'||!['editor.heavenlykey.org','mediaeditor.heavenlykey.org','videoeditor.heavenlykey.org'].includes(origin.hostname)||origin.port||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/')throw Error('ACCOUNT9_LIVE_URL must be an HTTPS origin ending in /');
const controller=new AbortController();
const timer=setTimeout(()=>controller.abort(),12000);
try{
  const get=path=>fetch(new URL(path,origin),{method:'GET',redirect:'error',cache:'no-store',signal:controller.signal,headers:{accept:path==='/api/health'?'application/json':'text/html'}});
  const home=await get('/');
  assert.equal(home.status,200,'Editor must load successfully');
  assert.ok((home.headers.get('content-type')||'').includes('text/html'),'Editor must serve HTML');
  const html=await home.text();
  for(const id of ['id="vf"','id="af"','id="vexp"','id="aexp"'])assert.ok(html.includes(id),'Missing live editor control: '+id);
  console.log('PASS live editor route and core controls');
  const health=await get('/api/health');
  const data=await health.json();
  assert.equal(health.status,200,'Cloudflare DB, R2, and AI bindings or D1 schema are not ready');
  assert.deepEqual(data,{status:'ready'},'Health must be the minimal healthy response');
  console.log('PASS live Cloudflare D1 schema, R2 and AI binding readiness');
}catch(error){
  console.error('Account 9 live smoke failed:',error.message);
  process.exitCode=1;
}finally{
  clearTimeout(timer);
}

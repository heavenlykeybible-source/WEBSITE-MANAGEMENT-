// Read-only post-deployment smoke checks. Never sends credentials or writes data.
import assert from 'node:assert/strict';
const raw=process.env.ACCOUNT9_LIVE_URL;
if(!raw)throw Error('Set ACCOUNT9_LIVE_URL to the exact approved Account 9 deployment origin.');
const origin=new URL(raw);
if(origin.protocol!=='https:'||!['mediaguru.heavenlykey.org'].includes(origin.hostname)||origin.port||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/')throw Error('ACCOUNT9_LIVE_URL must be an HTTPS origin ending in /');
// Apply a separate timeout to each request: one slow asset must not consume
// the entire verification budget for subsequent routes.
const REQUEST_TIMEOUT_MS=12000;
try{
  const get=path=>fetch(new URL(path,origin),{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS),headers:{accept:path.startsWith('/api/')?'application/json':path.endsWith('.js')?'text/javascript':path.endsWith('.json')?'application/json':'text/html'}});
  const home=await get('/');
  assert.equal(home.status,200,'Editor must load successfully');
  assert.ok((home.headers.get('content-type')||'').includes('text/html'),'Editor must serve HTML');
  assert.ok(home.headers.get('content-security-policy'),'Live editor must enforce a Content Security Policy');
  assert.equal(home.headers.get('x-content-type-options'),'nosniff','Live editor must prevent MIME sniffing');
  const html=await home.text();
  for(const id of ['id="vf"','id="af"','id="vexp"','id="aexp"'])assert.ok(html.includes(id),'Missing live editor control: '+id);
  console.log('PASS live editor route and core controls');
  const health=await get('/api/health');
  assert.equal(health.status,200,'Cloudflare DB, R2, and AI bindings or D1 schema are not ready');
  assert.ok((health.headers.get('content-type')||'').includes('application/json'),'Health endpoint must return JSON');
  const data=await health.json();
  assert.deepEqual(data,{status:'ready'},'Health must be the minimal healthy response');
  console.log('PASS live Cloudflare D1 schema, R2 and AI binding readiness');
  // Verify public asset routing, security headers and private endpoint isolation.
  for(const [route,mime] of [['/timeline.js','javascript'],['/integrations.js','javascript'],['/ai-tools.js','javascript'],['/gateway-ui.js','javascript'],['/voice-enhance.js','javascript'],['/voice-studio.js','javascript'],['/offline-status.js','javascript'],['/sw.js','javascript'],['/manifest.json','json']]){
    const response=await get(route);
    assert.equal(response.status,200,'Missing deployed editor asset '+route);
    assert.ok((response.headers.get('content-type')||'').includes(mime),'Incorrect MIME for '+route);
    assert.equal(response.headers.get('x-content-type-options'),'nosniff','Missing MIME protection on '+route);
    assert.ok(response.headers.get('content-security-policy'),'Missing security policy on '+route);
    assert.ok((await response.arrayBuffer()).byteLength>0,'Empty asset '+route);
  }
  for(const route of ['/assets/favicon.png','/assets/logo-256.png','/assets/logo-512.png']){
    const response=await get(route);
    assert.equal(response.status,200,'Missing deployed branding asset '+route);
    assert.ok((response.headers.get('content-type')||'').includes('image/png'),'Incorrect image MIME for '+route);
    assert.ok((await response.arrayBuffer()).byteLength>0,'Empty branding asset '+route);
  }
  console.log('PASS live editor assets, branding and PWA');
  const manifestResponse=await get('/manifest.json');
  assert.equal(manifestResponse.status,200,'Missing installable editor manifest');
  const manifest=await manifestResponse.json();
  assert.equal(manifest.start_url,'/','Installed editor must start at the public editor');
  assert.equal(manifest.display,'standalone','Installed editor must support standalone display');
  assert.ok(Array.isArray(manifest.icons)&&manifest.icons.length>=2,'Editor needs installable app icons');
  assert.equal(manifest.scope,'/','Installed editor must remain scoped to Account 9 origin');
  assert.ok(manifest.name&&manifest.short_name,'Installable editor must expose accessible app names');
  for(const icon of manifest.icons){
    assert.ok(typeof icon.src==='string'&&icon.src.startsWith('/assets/'),'App icon must use a local asset');
    assert.equal(icon.type,'image/png','App icons must declare PNG MIME');
    const iconResponse=await get(icon.src);
    assert.equal(iconResponse.status,200,'Manifest icon not deployed: '+icon.src);
    assert.ok((iconResponse.headers.get('content-type')||'').includes('image/png'),'Manifest icon has incorrect MIME: '+icon.src);
  }
  console.log('PASS installable app manifest and linked icons');
  for(const path of ['/api/me','/api/projects','/api/media']){
    const result=await get(path);
    assert.equal(result.status,401,'Unauthenticated private API exposed: '+path);
    const payload=await result.text();
    assert.ok(!/pass_hash|token_hash|r2_key/.test(payload),'Private data leaked from '+path);
  }
  console.log('PASS unauthenticated cloud data protection');
}catch(error){
  console.error('Account 9 live smoke failed:',error.message);
  process.exitCode=1;
}

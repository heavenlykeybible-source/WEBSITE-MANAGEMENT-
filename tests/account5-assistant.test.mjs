import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import app from '../public-assistant/app-worker.mjs';
test('Standalone assistant is a real accessible page and API remains isolated',async()=>{
 const r=await app.fetch(new Request('https://heavenlykey-public-assistant.heavenlykeyapp.workers.dev/'),{});assert.equal(r.status,200);const html=await r.text();assert.match(html,/Online Assistant/);assert.match(html,/fetch\('\/v1\/assistant'/);assert.match(html,/textContent=text/);assert.doesNotMatch(html,/localStorage|document\.cookie|innerHTML/);assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal((await app.fetch(new Request('https://example.test/api/admin'),{})).status,404);
 const ownOrigin=await app.fetch(new Request('https://heavenlykey-public-assistant.heavenlykeyapp.workers.dev/v1/assistant',{method:'OPTIONS',headers:{Origin:'https://heavenlykey-public-assistant.heavenlykeyapp.workers.dev'}}),{});assert.equal(ownOrigin.status,200);
});
test('Deployment refuses wrong accounts and preserves existing assistant namespace',async()=>{
 const originalFetch=globalThis.fetch,oldAccount=process.env.CLOUDFLARE_ACCOUNT_ID,oldToken=process.env.CLOUDFLARE_API_TOKEN;process.env.CLOUDFLARE_ACCOUNT_ID='a'.repeat(32);process.env.CLOUDFLARE_API_TOKEN='fixture';
 try{for(const mode of ['wrong-account','missing-directory','new','existing']){
  let writes=0,metadata;const binding=[{name:'LIMITS',type:'durable_object_namespace',class_name:'PublicChatLimits',namespace_id:'original-counter'},{name:'AI',type:'ai'}];
  globalThis.fetch=async(input,init={})=>{const u=new URL(input);if(u.host.endsWith('workers.dev'))return u.pathname==='/health'?Response.json({configured:true}):u.pathname==='/'?new Response('<h1>Online Assistant</h1>'):Response.json({ok:true,response:'Verified fixture reply'});
   if(init.method&&init.method!=='GET')writes++;
   let result={};if(u.pathname.endsWith('/workers/subdomain'))result={subdomain:mode==='wrong-account'?'wrong-account':'heavenlykeyapp'};
   else if(u.pathname.endsWith('/workers/scripts'))result=mode==='missing-directory'?[]:[{id:'heavenly-key-app'},...(mode==='existing'?[{id:'heavenlykey-public-assistant'}]:[])];
   else if(u.pathname.endsWith('/settings'))result={bindings:mode==='existing'?binding:metadata.bindings};
   else if(init.method==='PUT'){metadata=JSON.parse(await init.body.get('metadata').text());assert.match(u.pathname,/heavenlykey-public-assistant$/);assert.ok((await init.body.get('assistant.mjs').text()).includes('Online Assistant'));if(mode==='existing'){assert.equal(metadata.bindings,undefined);assert.ok(metadata.keep_bindings.includes('durable_object_namespace'));}else{assert.deepEqual(metadata.migrations.new_sqlite_classes,['PublicChatLimits']);assert.ok(metadata.bindings.every(x=>x.name!=='DB'));}}
   return Response.json({success:true,result});
  };
  const run=()=>import('../scripts/deploy-account5-assistant.mjs?test='+mode);
  if(mode==='wrong-account'||mode==='missing-directory'){await assert.rejects(run(),/No upload made/);assert.equal(writes,0);}else{await run();assert.equal(writes,2);}
 }}finally{globalThis.fetch=originalFetch;if(oldAccount===undefined)delete process.env.CLOUDFLARE_ACCOUNT_ID;else process.env.CLOUDFLARE_ACCOUNT_ID=oldAccount;if(oldToken===undefined)delete process.env.CLOUDFLARE_API_TOKEN;else process.env.CLOUDFLARE_API_TOKEN=oldToken;}
});
test('Registry separates the public assistant from management and marks unmigrated tools honestly',()=>{const registry=JSON.parse(fs.readFileSync('config/platform-services.json','utf8'));assert.equal(registry.services.find(x=>x.id==='public-assistant').account,5);assert.equal(registry.services.find(x=>x.id==='control-room').account,4);assert.equal(registry.services.find(x=>x.id==='walk-with-god').account,5);const workflow=fs.readFileSync('.github/workflows/deploy-public-assistant.yml','utf8');assert.ok(!workflow.includes('deploy-public-assistant.mjs'));});

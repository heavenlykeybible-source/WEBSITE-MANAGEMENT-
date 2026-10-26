import assert from 'node:assert/strict';
const originalFetch=globalThis.fetch,originalAccount=process.env.CLOUDFLARE_ACCOUNT_ID,originalToken=process.env.CLOUDFLARE_API_TOKEN;
process.env.CLOUDFLARE_ACCOUNT_ID='a'.repeat(32);process.env.CLOUDFLARE_API_TOKEN='fixture-token';
try{
 for(const mode of ['denied','missing','existing']){
  const writes=[];let uploaded=null;
  const existingBindings=[{name:'DB',type:'d1',id:'private-original'},{name:'GEMINI_API_KEY',type:'secret_text'}];
  globalThis.fetch=async(input,init={})=>{
   const u=new URL(input),method=init.method||'GET';
   if(u.host.endsWith('workers.dev'))return Response.json(u.pathname==='/health'?{ok:true}:{ok:true,response:'Official website: https://heavenlykey.org'});
   if(method!=='GET')writes.push({path:u.pathname,method});
   if(u.pathname.endsWith('/workers/scripts'))return mode==='denied'?Response.json({success:false,errors:[{code:10000}]},{status:403}):Response.json({success:true,result:mode==='existing'?[{id:'heavenlykey-cms-public'}]:[]});
   if(u.pathname.endsWith('/d1/database')){
    if(method==='GET')return Response.json({success:true,result:[]});
    assert.deepEqual(JSON.parse(init.body),{name:'heavenlykey-public-assistant-limits'});return Response.json({success:true,result:{uuid:'public-counter-id'}});
   }
   if(u.pathname.endsWith('/settings'))return Response.json({success:true,result:{compatibility_date:'2026-10-01',bindings:mode==='existing'?existingBindings:(uploaded?.bindings||[])}});
   if(method==='PUT'){
    uploaded=JSON.parse(await init.body.get('metadata').text());
    const source=await init.body.get('assistant.mjs').text();assert.ok(source.length>10000);
    if(mode==='missing'){assert.deepEqual(uploaded.bindings,[{type:'d1',name:'LIMITS',id:'public-counter-id'},{type:'ai',name:'AI'}]);assert.ok(!source.includes('cms_publications'));}
    else{assert.ok(uploaded.keep_bindings.includes('secret_text'));assert.equal(uploaded.bindings,undefined);assert.equal(uploaded.keep_assets,true);}
   }
   return Response.json({success:true,result:u.pathname.endsWith('/workers/subdomain')?{subdomain:'fixture'}:{}});
  };
  const run=()=>import('../scripts/deploy-public-assistant.mjs?fixture='+mode);
  if(mode==='denied'){await assert.rejects(run(),/HTTP 403/);assert.equal(writes.length,0);}
  else{await run();assert.equal(writes.filter(x=>x.method==='PUT').length,1);assert.equal(writes.some(x=>x.path.includes('/d1/database')),mode==='missing');}
 }
 console.log('PASS public assistant deployment: denied reads never create resources, absent service uses isolated counters, existing bindings/secrets retained, health and inference checked. Provider calls mocked.');
}finally{globalThis.fetch=originalFetch;if(originalAccount===undefined)delete process.env.CLOUDFLARE_ACCOUNT_ID;else process.env.CLOUDFLARE_ACCOUNT_ID=originalAccount;if(originalToken===undefined)delete process.env.CLOUDFLARE_API_TOKEN;else process.env.CLOUDFLARE_API_TOKEN=originalToken;}

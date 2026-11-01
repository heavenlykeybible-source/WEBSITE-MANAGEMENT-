import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const oldFetch=globalThis.fetch,oldEnv={...process.env},oldArgv=[...process.argv];
const summary=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'account4-readonly-preflight-')),'summary.md');
let missing=false,requests=[];
process.env.CLOUDFLARE_ACCOUNT_ID='404ebf05a781fcccbbed44aeb02cb72b';
process.env.CLOUDFLARE_API_TOKEN='fixture-private-token';
process.env.GITHUB_STEP_SUMMARY=summary;
process.argv.push('--strict');
globalThis.fetch=async(url,init)=>{
 requests.push({url:String(url),init});
 assert.equal(init.headers.authorization,'Bearer fixture-private-token');
 assert.equal(init.redirect,'manual');
 assert.equal(init.method,undefined,'Read-only preflight must never write to Cloudflare');
 let result;
 if(String(url).endsWith('/workers/scripts/website-management/settings'))result={bindings:[{type:'service',name:'BROWSER_AGENT',service:'heavenlykey-browser'}]};
 else if(String(url).endsWith('/workers/scripts/heavenlykey-browser/settings')){
  if(missing)return Response.json({success:false,errors:[{code:404}]},{status:404});
  result={bindings:[{type:'browser',name:'HK_BROWSER'}]};
 }else if(String(url).endsWith('/browser-rendering/limits'))result={limit:1};
 else if(String(url).endsWith('/subscriptions'))result=[];
 else throw Error('Unexpected network request '+url);
 return Response.json({success:true,result});
};
try{
 await import('../scripts/browser/preflight.mjs?healthy=1');
 assert.match(fs.readFileSync(summary,'utf8'),/Activation preflight/);
 assert.match(fs.readFileSync(summary,'utf8'),/\| Browser Agent Worker readable \| PASS \|/);
 assert.equal(requests.length,4);
 missing=true;requests=[];
 await assert.rejects(import('../scripts/browser/preflight.mjs?unhealthy=2'),/Activation preflight blocked/);
 assert.equal(requests.length,4);
 assert.match(fs.readFileSync(summary,'utf8'),/\| Browser Agent Worker readable \| BLOCKED \|/);
 assert.ok(requests.every(r=>r.init.method===undefined));
 console.log('PASS Account 4 preflight read-only healthy and blocked scenarios');
}finally{
 globalThis.fetch=oldFetch;
 process.argv.splice(0,process.argv.length,...oldArgv);
 for(const [key,val] of Object.entries(oldEnv))process.env[key]=val;
 for(const key of Object.keys(process.env))if(!(key in oldEnv))delete process.env[key];
 fs.rmSync(path.dirname(summary),{recursive:true,force:true});
}

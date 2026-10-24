import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handleSiteSync} from '../src/site-sync.js';
const body=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
test('published website content is filtered and no credentials are forwarded',async()=>{
 const seen=[];
 const upstream=async (url,options)=>{
  seen.push({url,options});
  if(url.endsWith('/homepage'))return body({success:true,content:{mission_title:'Our Mission',mission_body:'Taking Christ to the nations',grdpc_title:'GRDPC',grdpc_solution_time:'Sunday 8pm',ignored_admin_secret:'private'}});
  return body({success:true,items:[{title:'Revival',description:'A programme',start_time:'2026-11-01',private_contact:'no'}]});
 };
 const res=await handleSiteSync(new Request('https://app.example.test/api/site-sync'),{SITE_PUBLIC_SYNC_ENABLED:'true'},upstream);
 assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'no-store');
 const j=await res.json();assert.equal(j.success,true);assert.equal(j.events.length,1);
 assert.equal(j.programme.title,'GRDPC');
 assert.ok(!JSON.stringify(j).includes('ignored_admin_secret'));assert.ok(!JSON.stringify(j).includes('private_contact'));
 for(const x of seen){
  assert.ok(x.url.startsWith('https://heavenlykey.org/api/'));
  assert.equal(x.options.credentials,'omit');assert.equal(x.options.redirect,'manual');
  assert.equal(x.options.headers.Cookie,undefined);
 }
});
test('upstream outage is not presented as a fresh event',async()=>{
 const failed=async()=>{throw Error('Unavailable');};
 const res=await handleSiteSync(new Request('https://app.example.test/api/site-sync'),{SITE_PUBLIC_SYNC_ENABLED:'true'},failed);
 assert.equal(res.status,502);assert.equal((await res.json()).success,undefined);
});
test('public sync disallows unauthorized route, query parameters and disabled mode',async()=>{
 const never=()=>{throw Error('No network should be reached');};
 assert.equal((await handleSiteSync(new Request('https://app.example.test/api/site-sync?token=bad'),{SITE_PUBLIC_SYNC_ENABLED:'true'},never)).status,400);
 assert.equal((await handleSiteSync(new Request('https://app.example.test/api/site-sync'),{SITE_PUBLIC_SYNC_ENABLED:'false'},never)).status,503);
 assert.equal((await handleSiteSync(new Request('https://app.example.test/api/site-sync',{method:'POST'}),{SITE_PUBLIC_SYNC_ENABLED:'true'},never)).status,404);
});
test('release-aware worker and foreground update UI preserve user-controlled reload',()=>{
 const sw=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
 const platform=readFileSync(new URL('../public/platform.js',import.meta.url),'utf8');
 assert.match(sw,/const RELEASE='[^']+';/);
 assert.match(sw,/heavenly-key-app-shell-v10-/);
 assert.match(platform,/registration\.update\(\)/);
 assert.match(platform,/ACTIVATE_REVIEWED_SHELL/);
 assert.match(platform,/Update app/);
 assert.doesNotMatch(platform,/setInterval\(/);
});

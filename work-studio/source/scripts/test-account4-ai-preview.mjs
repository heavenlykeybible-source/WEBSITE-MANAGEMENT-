import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// Resolve test fixtures from this file, not the runner working directory.
const repositoryRoot=new URL('../',import.meta.url);
const get=p=>readFileSync(new URL(p,repositoryRoot),'utf8');
test('shared Heavenly Key AI preserves preview isolation and uses Account 3 production resources',()=>{
 const provision=get('review/provision.mjs');
 assert.ok(provision.includes("if(a==='3')lines.push('[ai]','binding = \"AI\"')"),'Account 3 sandbox AI binding present');
 assert.ok(provision.includes("prefix='heavenlykey-review-'+a"),'Always isolate preview resource names');
 assert.ok(provision.includes("if(!['1','2','3'].includes(a))"),'Explicit account allowlist remains');
 const production=get('global-community/wrangler.toml');
 assert.match(production,/\[ai\]\s+binding = "AI"/,'Production community has its requested AI binding');
 assert.ok(production.includes('94d70dc2-91fe-4c5d-afc2-ca9ccff04f28'),'Keep the existing production database');
 assert.ok(production.includes('daf1094e23c6494fb89a6e7bd232b52b'),'Keep the existing production sessions');
 assert.ok(production.includes('bucket_name = "heavenly-key-global-community-media"'),'Keep the existing production media bucket');
 assert.ok(!get('global-community/wrangler.staging.toml').includes('[ai]'),'No unrelated staging binding modifications');
});
test('AI remains authenticated, limited and subordinate to member draft approval',()=>{
 const route=get('global-community/src/index.ts'),backend=get('global-community/src/heavenly-key-ai.ts'),frontend=get('global-community/public/app.js');
 assert.ok(route.includes('if(p==="/api/community-ai"&&m==="POST")'));
 assert.ok(route.includes('await me(request,env);'),'Session required for protected actions');
 assert.ok(route.includes('hkem-ai:'),'Limit AI requests by user identity');
 assert.ok(backend.includes('requiresReview:true'),'Generated content never automatically published');
 assert.ok(!backend.includes('env.DB.prepare'),'AI has no database write authority');
 assert.ok(frontend.includes('apply:result=>'),'Inserting a suggestion requires member interaction');
 assert.ok(frontend.includes("https://heavenlykey-cms-public.emmanuel2026miracle.workers.dev/v1/assistant"),'Search and writing share the public bounded AI service');
 const publicService=get('cms-public/worker.mjs');assert.ok(publicService.includes('client:')&&publicService.includes("30,"),'Public AI rate limits remain');assert.ok(publicService.includes('global:')&&publicService.includes('200,'),'Global inference budget remains');
});

// Read-only deployment preflight. Does not connect to Cloudflare or expose secrets.
import { readFileSync,existsSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const config=read('wrangler.toml');
// Parse the dashboard bundle without executing it; strict CSP forbids inline scripts.
new Script(read('public/app.js'),{filename:'public/app.js'});
const pkg=JSON.parse(read('package.json'));
const fail=[];
const requireMatch=(name,re)=>{if(!re.test(config))fail.push(name)};
requireMatch('Expected Worker identity',/^name\s*=\s*"heavenly-key-social-management"\s*$/m);
requireMatch('Worker entry point',/^main\s*=\s*"src\/index\.ts"/m);
requireMatch('Private Worker source-map upload',/^upload_source_maps\s*=\s*true\s*$/m);
requireMatch('Current Worker compatibility date',/^compatibility_date\s*=\s*"2026-10-31"\s*$/m);
const observabilityBlocks=[...config.matchAll(/\[observability\]([\s\S]*?)(?=\n\[|$)/g)].map(m=>m[1]);
if(observabilityBlocks.length!==1||!/^enabled\s*=\s*true\s*$/m.test(observabilityBlocks[0])||!/^head_sampling_rate\s*=\s*0\.1\s*$/m.test(observabilityBlocks[0]))fail.push('Sampled Worker observability must be enabled at 10 percent');
const issueBlocks=[...config.matchAll(/\[observability\.issues\]([\s\S]*?)(?=\n\[|$)/g)].map(m=>m[1]);
if(issueBlocks.length!==1||!/^enabled\s*=\s*true\s*$/m.test(issueBlocks[0]))fail.push('Cloudflare Worker Issues monitoring must be enabled');

requireMatch('Static assets directory',/^directory\s*=\s*"\.\/public"/m);
requireMatch('ASSETS binding',/^binding\s*=\s*"ASSETS"/m);
requireMatch('D1 binding',/^binding\s*=\s*"DB"/m);
requireMatch('R2 binding',/^binding\s*=\s*"MEDIA_BUCKET"/m);
// Verify the hostname and custom_domain flag are in the SAME route table.
// Separate regex checks could otherwise pass for two unrelated routes.
const routeBlocks=[...config.matchAll(/\[\[routes\]\]([\s\S]*?)(?=\n\[|$)/g)].map(m=>m[1]);
const socialRoutes=routeBlocks.filter(block=>/^pattern\s*=\s*"socialplus\.heavenlykey\.org"\s*$/m.test(block));
if(socialRoutes.length!==1||!/^custom_domain\s*=\s*true\s*$/m.test(socialRoutes[0]))fail.push('SocialPlus hostname must be configured exactly once as a Custom Domain');
const migrations=['0002_webhook_events.sql','0003_conversation_lookup.sql','0004_whatsapp_delivery.sql','0005_whatsapp_receipts.sql','0006_whatsapp_receipt_inbox.sql','0007_post_media.sql','0008_ai_rate_limits.sql','0009_human_contact_target.sql','0010_whatsapp_handover_dedupe.sql','0011_human_request_version.sql','0012_operator_credentials.sql','0013_auth_rate_limits.sql'];
for(const scriptName of ['db:migrate:local','db:migrate:remote','db:init:remote']){
 if(pkg.scripts[scriptName])fail.push('Unsafe bulk database command must remain disabled: '+scriptName);
}
if(!existsSync(resolve(root,'MIGRATION-SAFETY.md')))fail.push('Controlled D1 migration procedure is missing');
for(const file of ['public/index.html','public/app.js','public/editorial-studio.js','src/index.ts','schema.sql','MIGRATION-SAFETY.md',...migrations.map(name=>'migrations/'+name)]){
 if(!existsSync(resolve(root,file)))fail.push('Missing '+file);
}
for(const [name,script] of Object.entries(pkg.scripts)){
 if(name==='deploy'&&/--dry-run/.test(script))fail.push('Deploy script is unexpectedly dry-run only');
}
// A deploy from the wrong Cloudflare account can strand the hostname.
// Do not silently infer the zone account from a successful build or DNS resolution.
const assetStart=config.indexOf('[assets]');
const assetEnd=config.indexOf('\n[',assetStart+1);
const assetConfig=assetStart>=0?config.slice(assetStart,assetEnd>=0?assetEnd:undefined):'';
if((config.match(/^\\[assets\\]$/gm)||[]).length!==1)fail.push('Exactly one assets section is required');
const assetLines=assetConfig.split(/\\r?\\n/).slice(1);
const assetValue=key=>{
 const matches=assetLines.filter(line=>line.trim()&&!line.trim().startsWith('#')&&line.includes('=')&&line.split('=')[0].trim()===key);
 if(matches.length!==1)fail.push('Assets section must declare '+key+' exactly once');
 return matches[0]?.split('=').slice(1).join('=').trim();
};
if(assetValue('directory')!=='"./public"')fail.push('Assets section must specify ./public directory');
if(assetValue('binding')!=='"ASSETS"')fail.push('Assets section must declare ASSETS binding');
if(assetValue('run_worker_first')!=='true')fail.push('Static asset requests must pass through Worker security headers');
const args=process.argv.slice(2);
if(args.includes('--production'))fail.push('Production readiness cannot be certified by a static preflight: verify Cloudflare zone ownership, D1 migrations, secrets, asset upload and live integration tests manually.');
if(fail.length){for(const message of fail)console.error('FAIL:',message);process.exitCode=1;}
else console.log('PASS: source-level configuration and required files are present. NOT proof of a live deployment, secrets, database state or launch readiness.');

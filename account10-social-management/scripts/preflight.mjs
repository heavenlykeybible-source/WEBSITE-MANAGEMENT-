// Read-only deployment preflight. Does not connect to Cloudflare or expose secrets.
import { readFileSync,existsSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const config=read('wrangler.toml');
const pkg=JSON.parse(read('package.json'));
const fail=[];
const requireMatch=(name,re)=>{if(!re.test(config))fail.push(name)};
requireMatch('Expected Worker identity',/^name\s*=\s*"heavenly-key-social-management"\s*$/m);
requireMatch('Worker entry point',/^main\s*=\s*"src\/index\.ts"/m);
requireMatch('Static assets directory',/^directory\s*=\s*"\.\/public"/m);
requireMatch('ASSETS binding',/^binding\s*=\s*"ASSETS"/m);
requireMatch('D1 binding',/^binding\s*=\s*"DB"/m);
requireMatch('R2 binding',/^binding\s*=\s*"MEDIA_BUCKET"/m);
// Verify the hostname and custom_domain flag are in the SAME route table.
// Separate regex checks could otherwise pass for two unrelated routes.
const routeBlocks=[...config.matchAll(/\[\[routes\]\]([\s\S]*?)(?=\n\[|$)/g)].map(m=>m[1]);
const socialRoutes=routeBlocks.filter(block=>/^pattern\s*=\s*"socialplus\.heavenlykey\.org"\s*$/m.test(block));
if(socialRoutes.length!==1||!/^custom_domain\s*=\s*true\s*$/m.test(socialRoutes[0]))fail.push('SocialPlus hostname must be configured exactly once as a Custom Domain');
const migrations=['0002_webhook_events.sql','0003_conversation_lookup.sql','0004_whatsapp_delivery.sql','0005_whatsapp_receipts.sql','0006_whatsapp_receipt_inbox.sql','0007_post_media.sql','0008_ai_rate_limits.sql','0009_human_contact_target.sql','0010_whatsapp_handover_dedupe.sql','0011_human_request_version.sql','0012_operator_credentials.sql'];
for(const scriptName of ['db:migrate:local','db:migrate:remote']){
 const script=pkg.scripts[scriptName]||'';
 let prior=-1;
 for(const migration of migrations){const position=script.indexOf(migration);if(position<=prior)fail.push(scriptName+' missing or out of order: '+migration);prior=position;}
}
for(const file of ['public/index.html','public/editorial-studio.js','src/index.ts','schema.sql',...migrations.map(name=>'migrations/'+name)]){
 if(!existsSync(resolve(root,file)))fail.push('Missing '+file);
}
for(const [name,script] of Object.entries(pkg.scripts)){
 if(name==='deploy'&&/--dry-run/.test(script))fail.push('Deploy script is unexpectedly dry-run only');
}
// A deploy from the wrong Cloudflare account can strand the hostname.
// Do not silently infer the zone account from a successful build or DNS resolution.
const assetConfig=config.split('[assets]')[1]||'';
if(!/^run_worker_first\s*=\s*true\s*$/m.test(assetConfig))fail.push('Static asset requests must pass through Worker security headers');
const args=process.argv.slice(2);
if(args.includes('--production'))fail.push('Production readiness cannot be certified by a static preflight: verify Cloudflare zone ownership, D1 migrations, secrets, asset upload and live integration tests manually.');
if(fail.length){for(const message of fail)console.error('FAIL:',message);process.exitCode=1;}
else console.log('PASS: source-level configuration and required files are present. NOT proof of a live deployment, secrets, database state or launch readiness.');

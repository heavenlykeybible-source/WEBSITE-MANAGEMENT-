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
requireMatch('Worker entry point',/^main\s*=\s*"src\/index\.ts"/m);
requireMatch('Static assets directory',/^directory\s*=\s*"\.\/public"/m);
requireMatch('ASSETS binding',/^binding\s*=\s*"ASSETS"/m);
requireMatch('D1 binding',/^binding\s*=\s*"DB"/m);
requireMatch('R2 binding',/^binding\s*=\s*"MEDIA_BUCKET"/m);
requireMatch('Custom domain',/^pattern\s*=\s*"socialplus\.heavenlykey\.org"/m);
requireMatch('Custom domain flag',/^custom_domain\s*=\s*true/m);
for(const file of ['public/index.html','src/index.ts','schema.sql','migrations/0012_operator_credentials.sql']){
 if(!existsSync(resolve(root,file)))fail.push('Missing '+file);
}
for(const [name,script] of Object.entries(pkg.scripts)){
 if(name==='deploy'&&/--dry-run/.test(script))fail.push('Deploy script is unexpectedly dry-run only');
}
const args=process.argv.slice(2);
if(args.includes('--production'))fail.push('Production readiness cannot be certified by a static preflight: verify Cloudflare zone ownership, D1 migrations, secrets, asset upload and live integration tests manually.');
if(fail.length){for(const message of fail)console.error('FAIL:',message);process.exitCode=1;}
else console.log('PASS: source-level configuration and required files are present. NOT proof of a live deployment, secrets, database state or launch readiness.');

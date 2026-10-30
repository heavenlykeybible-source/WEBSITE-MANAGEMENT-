import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const required = ['index.html','_headers','public/index.html','public/_headers','schema.sql','wrangler.toml','functions/api/[[path]].js','tests/be.mjs'];
for (const path of required) if (!existsSync(path)) throw Error(`Missing ${path}`);
for (const path of ['functions/api/[[path]].js','scripts/provision-roles.mjs']) execFileSync(process.execPath,['--check',path],{stdio:'inherit'});
const wrangler = readFileSync('wrangler.toml','utf8');
for (const x of ['pages_build_output_dir = "public"','binding = "DB"','binding = "MEDIA"','binding = "AI"']) if (!wrangler.includes(x)) throw Error(`Missing binding ${x}`);
for (const name of ['integrations.js','ai-tools.js','gateway-ui.js','voice-enhance.js','timeline.js','voice-studio.js']) {
  for (const file of [name,'public/'+name]) { if (!existsSync(file)) throw Error('Missing '+file); execFileSync(process.execPath,['--check',file],{stdio:'inherit'}); }
  if (readFileSync(name,'utf8') !== readFileSync('public/'+name,'utf8')) throw Error('Out-of-sync browser script: '+name);
}
const timeline=readFileSync('public/timeline.js','utf8');
if ((timeline.match(/Math\.min\(end,v\.duration\)<=start/g)||[]).length!==2 || !timeline.includes('c.start>=v.duration||c.end>v.duration+.02')) throw Error('Timeline clip boundary safeguards missing');
const html=readFileSync('public/index.html','utf8');
for (const name of ['integrations.js','ai-tools.js','gateway-ui.js','voice-enhance.js','timeline.js','voice-studio.js']) if (!html.includes('src="/'+name+'"')) throw Error('Script not loaded: '+name);
if (html !== readFileSync('index.html','utf8')) throw Error('Public page not synchronized with editor source');
for (const asset of ['logo-256.png','logo-512.png','favicon.png']) if (!existsSync('public/assets/'+asset)) throw Error('Public asset missing: '+asset);
for (const x of ['id="vexp"','id="vdl"','id="autocap"']) if (!html.includes(x)) throw Error(`Missing client control ${x}`);
const api=readFileSync('functions/api/[[path]].js','utf8');
for (const x of ['const ROLES','content-security-policy','await env.MEDIA.delete(key)']) if (!api.includes(x)) throw Error(`Missing server safeguard ${x}`);
console.log('Account 9 preflight: source, route, editor controls and Cloudflare bindings present.');

import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const required = ['index.html','_headers','public/index.html','public/_headers','schema.sql','wrangler.toml','functions/api/[[path]].js','tests/be.mjs'];
for (const path of required) if (!existsSync(path)) throw Error(`Missing ${path}`);
for (const path of ['functions/api/[[path]].js','scripts/provision-roles.mjs']) execFileSync(process.execPath,['--check',path],{stdio:'inherit'});
const wrangler = readFileSync('wrangler.toml','utf8');
for (const x of ['pages_build_output_dir = "public"','binding = "DB"','binding = "MEDIA"','binding = "AI"']) if (!wrangler.includes(x)) throw Error(`Missing binding ${x}`);
for (const file of ['integrations.js','public/integrations.js']) { if (!existsSync(file)) throw Error('Missing '+file); execFileSync(process.execPath,['--check',file],{stdio:'inherit'}); }
if (readFileSync('integrations.js','utf8') !== readFileSync('public/integrations.js','utf8')) throw Error('Integration scripts are out of sync');
const html=readFileSync('public/index.html','utf8');
if (!html.includes('src="/integrations.js"')) throw Error('Integration script is not loaded');
if (html !== readFileSync('index.html','utf8')) throw Error('Public page not synchronized with editor source');
for (const asset of ['logo-256.png','logo-512.png','favicon.png']) if (!existsSync('public/assets/'+asset)) throw Error('Public asset missing: '+asset);
for (const x of ['id="vexp"','id="vdl"','id="autocap"']) if (!html.includes(x)) throw Error(`Missing client control ${x}`);
const api=readFileSync('functions/api/[[path]].js','utf8');
for (const x of ['const ROLES','content-security-policy','await env.MEDIA.delete(key)']) if (!api.includes(x)) throw Error(`Missing server safeguard ${x}`);
console.log('Account 9 preflight: source, route, editor controls and Cloudflare bindings present.');

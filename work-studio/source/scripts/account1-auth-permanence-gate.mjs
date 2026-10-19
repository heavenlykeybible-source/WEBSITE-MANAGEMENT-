/** Static Account 1 data and identity permanence checks. No database writes. */
import {readFileSync,readdirSync} from 'node:fs';
const issues=[];
const wrangler=readFileSync('wrangler.toml','utf8');
const runtime=readFileSync('scripts/configure-runtime.mjs','utf8');
for(const marker of ['binding = "DB"','database_name = "heavenlykey-db"','database_id = "8665ff03-6a2c-4852-90ab-6c74375a8c87"','binding = "SESSIONS_KV"','id = "288aa06b90984012ba88aeb4a9cef087"','binding = "RATE_LIMIT_KV"']){
 if(!wrangler.includes(marker))issues.push('Changed or missing permanent binding: '+marker);
}
for(const key of ['PASSWORD_PEPPER','SESSION_SECRET','ENCRYPTION_KEY']){
 if(!runtime.includes("'"+key+"'"))issues.push('Missing required runtime secret '+key);
}
if(!runtime.includes('ACCOUNT 1 DEPLOYMENT STOPPED')||/values\[name\]\s*=\s*randomBytes/.test(runtime))
 issues.push('Runtime must fail closed instead of silently rotating existing passwords and encryption secrets');
for(const name of readdirSync('migrations').filter(n=>/^\d{4}_.*\.sql$/.test(n))){
 if(Number(name.slice(0,4))<=39)continue; // Existing reviewed schema is retained
 const sql=readFileSync('migrations/'+name,'utf8').replace(/--[^\n]*/g,'');
 if(/\b(?:DELETE\s+FROM|DROP\s+TABLE|TRUNCATE\s+TABLE|REPLACE\s+INTO)\s+["`']?(?:users|auth|roles|permissions|role_permissions|site_cms_[a-z_]+)/i.test(sql))
  issues.push('Destructive table mutation in '+name);
 if(/\bALTER\s+TABLE\s+["`']?(?:users|auth)\b/i.test(sql))
  issues.push('Auth schema alteration requires separate owner-reviewed migration in '+name);
}
if(issues.length){console.error('ACCOUNT 1 AUTH PERMANENCE GATE FAILED');for(const e of issues)console.error('- '+e);process.exit(1);}
console.log('ACCOUNT 1 AUTH PERMANENCE GATE PASSED — existing user database, sessions and password secrets are protected.');

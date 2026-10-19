/** Fail a normal Account 4 deploy if it could reset authentication or storage.
 * This is a static defense-in-depth check; protect the default branch and Cloudflare roles separately.
 */
import {readFileSync,readdirSync} from 'node:fs';
const workflow=readFileSync('.github/workflows/cloudflare-recovery-control.yml','utf8');
const wrangler=readFileSync('recovery-control/wrangler.toml','utf8');
const issues=[];
if(!wrangler.includes('database_name = "heavenlykey-recovery-control-db"')||!wrangler.includes('binding = "DB"'))
 issues.push('Account 4 persistent D1 database binding/name is missing or changed');
if(!wrangler.includes('binding = "RECOVERY_STATE"')||!wrangler.includes('binding = "RECOVERY_VAULT"'))
 issues.push('Account 4 persistent KV/R2 bindings have changed');
if(/secret\s+put\s+(?:GITHUB_CONTROL_TOKEN|CONTROL_PASSWORD_HASH)/.test(workflow)||workflow.includes('configure-account4-login.mjs'))
 issues.push('Normal releases must never reset Account 4 login secrets');
if(!workflow.includes('account4-permanence-gate.mjs'))issues.push('Release must run Account 4 permanence gate');
if(!workflow.includes('secret list'))issues.push('Existing login secrets must be checked before code deployments');
const migrations=readdirSync('recovery-control/migrations').filter(s=>/^\d{4}_.*\.sql$/.test(s));
for(const name of migrations){
 if(Number(name.slice(0,4))<=4)continue; // historic v0004 was one-time owner-authorized emergency credential repair
 const sql=readFileSync('recovery-control/migrations/'+name,'utf8').replace(/--[^\n]*/g,'');
 if(/\b(?:DROP|TRUNCATE|DELETE|REPLACE)\b/i.test(sql)||/\bALTER\s+TABLE\s+account4_security_state\b/i.test(sql))
  issues.push('Destructive SQL is prohibited in regular Account 4 migration '+name);
 if(/\bhkem-control-password-v2\b/i.test(sql))issues.push('Credential reset prohibited in migration '+name);
}
if(issues.length){console.error('ACCOUNT 4 PERMANENCE GATE FAILED');issues.forEach(e=>console.error('- '+e));process.exit(1);}
console.log('ACCOUNT 4 PERMANENCE GATE PASSED — no password recreation and existing D1/KV/R2 preserved.');

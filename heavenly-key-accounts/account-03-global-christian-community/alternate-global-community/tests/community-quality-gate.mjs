import {spawnSync} from 'node:child_process';
const checks=['endless-feed-contract.test.mjs','endless-feed-static-audit.mjs'];
for(const check of checks){const r=spawnSync(process.execPath,[check],{cwd:new URL('.',import.meta.url),stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
console.log('Community quality gate passed.');

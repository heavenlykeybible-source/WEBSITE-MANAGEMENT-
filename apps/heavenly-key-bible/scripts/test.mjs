import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');process.chdir(root);
const files=fs.readdirSync('bible/tests').filter(f=>/\.(?:cjs|mjs)$/.test(f)).sort();
let failed=0;
for(const file of files){const r=spawnSync(process.execPath,[`bible/tests/${file}`],{encoding:'utf8',timeout:120000});if(r.status!==0){failed++;console.error(`FAIL ${file}\n${r.stdout||''}${r.stderr||''}`);}}
console.log(`Bible audit: ${files.length-failed}/${files.length} suites passed.`);
if(failed)process.exit(1);

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'reviewed-upgrade-'));
try {
 for(const directory of ['scripts','patches'])fs.mkdirSync(path.join(temp,directory));
 for(const file of ['scripts/apply-reviewed-account4-upgrade.mjs','patches/account4-reviewed-upgrade.json','control-room-worker.js'])fs.copyFileSync(file,path.join(temp,file));
 const script=path.join(temp,'scripts/apply-reviewed-account4-upgrade.mjs');
 assert.equal(spawnSync(process.execPath,[script],{encoding:'utf8'}).status,0,'The exact reviewed source/build must be accepted');
 const target=path.join(temp,'control-room-worker.js');
 const changed=fs.readFileSync(target,'utf8')+'\n// unexpected edit\n';fs.writeFileSync(target,changed);
 const rejected=spawnSync(process.execPath,[script],{encoding:'utf8'});
 assert.notEqual(rejected.status,0);assert.match(rejected.stderr,/Refusing to overwrite changed Control Room source/);
 assert.equal(fs.readFileSync(target,'utf8'),changed,'An unexpected source must not be overwritten');
 console.log('PASS reviewed source/build integrity; unexpected edits are rejected and preserved');
} finally {fs.rmSync(temp,{recursive:true,force:true});}

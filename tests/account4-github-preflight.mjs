import fs from 'node:fs';
import assert from 'node:assert/strict';
const s=fs.readFileSync(new URL('../control-room-worker.js',import.meta.url),'utf8');
const start=s.indexOf('async function githubImport('),end=s.indexOf('// Private chat attachments.',start);
assert.ok(start>=0&&end>start,'GitHub import handler unavailable');
const code=s.slice(start,end);
const guards=[
 ['reject incomplete GitHub trees', "if (treeResult.truncated)"],
 ['reject symbolic links across selected source',"scoped.some(t=>t.mode==='120000')"],
 ['reject oversized eligible assets',"t.size>MAX_FILE"],
 ['reject case-colliding paths',"names.has(relative)"],
 ['reject oversized packages',"all.reduce((n,f)=>n+(f.size||0),0)>PACKAGE_LIMIT"],
 ['reject excess files',"if (all.length > 40)"],
 ['retain owner approval upload path',"await newUpload(env, actor, s,"],
 ['reject partial imports',"await env.DB.prepare(\"UPDATE proposals SET status='rejected' WHERE id=?\")"],
];
for(const [name,fragment] of guards)assert.ok(code.includes(fragment),'Missing '+name);
assert.ok(code.indexOf("scoped.some(t=>t.mode==='120000')")<code.indexOf("const pick = all;"),'Unsafe files must be rejected before download');
assert.ok(code.indexOf('eligible.some(')<code.indexOf('const all = tree.filter('),'Oversized assets must fail before filtering the original file list');
console.log('PASS GitHub import rejects partial, unsafe or oversized website packages before approval');

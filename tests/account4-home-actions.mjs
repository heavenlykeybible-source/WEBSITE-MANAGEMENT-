import assert from 'node:assert/strict';
import fs from 'node:fs';
const home=fs.readFileSync('workspace/screens.js','utf8');
const permissions=fs.readFileSync('ai/permissions.js','utf8');
const native=fs.readFileSync('workspace/client.js','utf8');
const start=home.indexOf('async function controlHome()');
const end=home.indexOf('async function githubSourceBackup(',start);
assert.ok(start>=0&&end>start,'Control Room home must exist');
const screen=home.slice(start,end);
for(const [handler,label] of [['claude','Chat with AI'],['aiPermissions','Manage AI account permissions'],['verificationCenter','Review AI access requests'],['nativeImports','Import and preview a project'],['waiting','Review waiting work'],['releaseHistory','Release history and recovery']]){
 assert.ok(screen.includes("h('button',{onclick:"+handler+"},'"+label+"')"),'Missing home action: '+label);
}
assert.match(permissions,/async function aiPermissions\(/);
assert.match(native,/async function verificationCenter\(/);
assert.match(native,/async function nativeImports\(/);
console.log('PASS: Control Room home shortcuts and their intended handlers');

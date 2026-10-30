import assert from 'node:assert/strict';
import fs from 'node:fs';
const worker=fs.readFileSync(new URL('../control-room-worker.js',import.meta.url),'utf8');
const endpoint=worker.slice(worker.indexOf("if (m === 'POST' && (x = sub.match(/^ai\\/accounts\\/(\\d+)\\/(key|test|remove)$/)))"),worker.indexOf("if (sub === 'audit' && m === 'GET')"));
assert.ok(endpoint.includes('const started=Date.now()'),'Provider connectivity timing must start on server');
assert.ok(endpoint.includes('latency_ms:Date.now()-started'),'Provider connectivity must return server-measured duration');
assert.ok(endpoint.includes('checked_at:new Date().toISOString()'),'Health response must carry an observation timestamp');
assert.ok(endpoint.includes('key: await unseal(env, r.key_enc)'),'Health check must use previously encrypted key, not ask the browser for credentials');
assert.ok(!endpoint.includes('return json({key:'),'Never disclose API keys in health results');
const a=worker.indexOf('async function aiAccounts()'),b=worker.indexOf('function frame(html)',a);
assert.ok(a>=0&&b>a,'AI connection management screen missing');
const ui=worker.slice(a,b);
for(const [label,part] of [
 ['explicit opt-in health check',"'Test all saved AI connections'"],
 ['individual connection test',"'Test connection'"],
 ['sequential provider checks','for(var a of configured)'],
 ['no automatic all-provider tests','this.disabled=true;var configured=d.accounts.filter'],
 ['quota disclosure','Tests may consume provider quota.'],
 ['individual latency display',"' ms · '+r.reply"],
 ['aggregated failure summary',"' of '+configured.length+' connected."],
 ['live accessibility',"'aria-live':'polite'"]
])assert.ok(ui.includes(part),'Missing '+label);
assert.ok(!ui.includes("Promise.all(configured.map("),'Avoid simultaneous quota-heavy provider probes');
console.log('PASS saved AI connection diagnostics, permission boundaries, and opt-in provider tests');

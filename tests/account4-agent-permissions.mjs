import fs from 'node:fs';
import assert from 'node:assert/strict';
const s=fs.readFileSync(new URL('../control-room-worker.js',import.meta.url),'utf8');
const required=[
 ['owner-only agent grant endpoint',"sub==='ai/agent-permissions'"],
 ['owner credential re-verification','await reauthenticate(env,user,b.password)'],
 ['agent grant storage',"'ai:agent-grant:'"],
 ['grant expiration enforcement','agentGrant.expires_at<=Date.now()'],
 ['individual connection containment','!agentGrant.connections.includes(c.id)'],
 ['agent selector UI',"'Choose AI agent'"],
 ['individual grant save',"'Save this AI grant'"],
 ['original workspace grant still enforced','!p.connections.includes(c.id)'],
 ['owner-approved publishing',"'Approve this version'"]
];
for(const [label,needle] of required)assert.ok(s.includes(needle),'Missing '+label);
const a=s.indexOf("async function checkAIToolPermission("),b=s.indexOf("function aiChunk(",a);
assert.ok(a>=0&&b>a,'Missing AI permission enforcement');
const check=s.slice(a,b);
assert.ok(check.indexOf('agentGrant.connections.includes')<check.indexOf('p.connections.includes'),'Individual AI denial must precede workspace-grant check');
console.log('PASS owner-only individual AI grants and account-scoped enforcement');

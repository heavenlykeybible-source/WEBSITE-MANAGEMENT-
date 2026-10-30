import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../control-room-worker.js',import.meta.url),'utf8');
const start=source.indexOf("function nav(){");
assert.ok(start>=0,'navigation function must exist');
const end=source.indexOf("group('Administration');",start);
assert.ok(end>start,'administration navigation must exist');
const nav=source.slice(start,end);
const quick="group('Quick access');item('Home','⌂',controlHome);if(!M&&lv()>=2)item('AI Chat','✦',claude);if(!M&&lv()>=4)item('Connections','▧',projectSources);item('Waiting','◷',waiting,'wb');item('Releases','↗',releaseHistory);group('Workspace');";
assert.ok(nav.includes(quick),'quick access navigation must be present with role checks');
for(const [label,fragment] of [['Home',"item('Home'"],['AI Chat',"item('AI Chat'"],['Connections',"item('Connections'"],['Waiting',"item('Waiting'"],['Releases',"item('Releases'"]]){
 assert.equal(nav.split(fragment).length-1,1,label+' navigation item must occur exactly once');
}
assert.ok(nav.includes("if(!M&&lv()>=2)item('AI Chat'"),'AI Chat requires appropriate non-member role');
assert.ok(nav.includes("if(!M&&lv()>=4)item('Connections'"),'Connections requires privileged role');
assert.ok(nav.includes("if(own())"),'owner-only navigation entries must remain gated');
assert.ok(nav.includes("item('Identity'"),'identity access must remain available');
assert.ok(nav.includes("item('Sites'"),'site management navigation must remain available');
assert.ok(nav.includes("item('AI permissions'"),'AI permissions management must remain available');
assert.ok(nav.includes("item('Connect ChatGPT'"),'ChatGPT connection management must remain available');
assert.ok(nav.includes("item('Import and preview'"),'import and preview navigation must remain available');
assert.ok(nav.includes("item('Verification'"),'verification navigation must remain available');
console.log('PASS Account 4 quick navigation ordering, uniqueness and role checks');

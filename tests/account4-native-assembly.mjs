import assert from 'node:assert/strict';
import fs from 'node:fs';
const assembled=fs.readFileSync('control-room-worker.js','utf8');
function section(begin,end){const first=assembled.indexOf(begin),last=assembled.indexOf(end);assert.ok(first>=0&&last>first,'Missing or unordered assembly markers: '+begin);assert.equal(assembled.indexOf(begin,first+begin.length),-1,'Duplicate assembly marker: '+begin);return assembled.slice(first,last);}
const server=section('// BEGIN NATIVE WORKSPACE SERVER','// END NATIVE WORKSPACE SERVER');
const client=section('// BEGIN NATIVE WORKSPACE CLIENT','// END NATIVE WORKSPACE CLIENT');
for(const route of ['workspace/github/discover','workspace/github/bulk-connect','workspace/github/files','workspace/github/file','workspace/dns/propose-create','workspace/workers/propose-edit'])assert.ok(server.includes(route),'Missing compiled management route: '+route);
for(const title of ['GitHub source inspector','Discover my GitHub repositories','Installation review'])assert.ok(client.includes(title),'Missing compiled control: '+title);
for(const part of [server,client])for(const removed of ['workspace/tinyfish/','BROWSER_ENGINE_KEY','BROWSER_ENGINE_URL','fishPanel'])assert.equal(part.includes(removed),false,'Legacy browser automation remains in the assembled workspace');
console.log('PASS: reviewed native management code is present in assembled Account 4 Worker');

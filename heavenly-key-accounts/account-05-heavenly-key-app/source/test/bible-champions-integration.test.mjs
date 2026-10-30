import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const here=new URL('../public/',import.meta.url);
const local=n=>readFileSync(new URL(n,here),'utf8');
const social=readFileSync(new URL('../../../account-03-global-christian-community/source/public/social-bible-champions.js',import.meta.url),'utf8');
const bible=readFileSync(new URL('../../../../apps/heavenly-key-bible/heavenly-key-website/bible/social-bible-champions.js',import.meta.url),'utf8');
const bankFor=source=>{const begin=source.indexOf('const BANK=');assert.ok(begin>=0);const slice=source.slice(begin+'const BANK='.length);let quotes=false,escape=false,depth=0;for(let i=0;i<slice.length;i++){const c=slice[i];if(quotes){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quotes=false;continue;}if(c==='"'){quotes=true;continue;}if(c==='{')depth++;else if(c==='}'&&!--depth)return JSON.parse(slice.slice(0,i+1));}throw Error('Invalid BANK object');};
test('all three game surfaces share the reviewed Bible Champions question bank',()=>{
 const main=bankFor(bible),app=bankFor(local('bible-quiz.js')),community=bankFor(social);
 assert.deepEqual(app,main);assert.deepEqual(community,main);
 assert.equal(Object.keys(main).length,24);
 for(const questions of Object.values(main))for(const q of questions){
  assert.equal(q.length,4);assert.equal(q[1].length,4);
  assert.ok(Number.isInteger(q[2])&&q[2]>=0&&q[2]<4);
  assert.ok(q[3].trim());
 }
});
test('guided practice works with existing topic content; certificates stay strict',()=>{
 for(const source of [bible,social,local('bible-quiz.js')]){
  assert.match(source,/if\(unique\.size===0\)/);
  assert.doesNotMatch(source,/if\(unique\.size<30\)/);
  assert.match(source,/sessionQuestions=shuffle\(\[\.\.\.unique\.values\(\)\]\)\.slice\(0,30\)/);
  assert.match(source,/q\.length===30&&score>=27/);
 }
});
test('the real Bible Champions game is accessible from My Walk with God and cached',()=>{
 const walk=local('walk-offline.html'),sw=local('sw.js');
 assert.match(walk,/href="\/bible-quiz\.html"/);
 assert.doesNotMatch(walk,/will open here when/);
 for(const f of ['bible-quiz.html','bible-quiz.js','bible-quiz.css','walk-growth-actions.js'])assert.ok(sw.includes('/'+f));
 assert.match(walk,/Share to Bless Others/);
 assert.match(walk,/Download This App/);
 assert.match(walk,/End-time, Non-denominational, Apostolic/);
});
test('game embedding may only be same-origin, not globally enabled',()=>{
 const localHeaders=local('_headers'),socialHeaders=readFileSync(new URL('../../../account-03-global-christian-community/source/public/_headers',import.meta.url),'utf8');
 const bibleHeaders=readFileSync(new URL('../../../../apps/heavenly-key-bible/heavenly-key-website/bible/_headers',import.meta.url),'utf8');
 for(const [headers,route] of [[localHeaders,'/bible-quiz.html'],[socialHeaders,'/bible-champions-embed.html'],[bibleHeaders,'/bible-champions-embed.html']]){
  const section=headers.slice(headers.indexOf('\n'+route+'\n'));
  assert.match(section,/X-Frame-Options: SAMEORIGIN/);
  assert.match(section,/frame-ancestors 'self'/);
 }
 assert.match(localHeaders,/\*\/\n  X-Frame-Options: DENY/);
 assert.match(socialHeaders,/\*\/\n  X-Frame-Options: DENY/);
});

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
 assert.equal(Object.values(main).reduce((n,questions)=>n+questions.length,0),720);
 for(const [topic,questions] of Object.entries(main)){
  assert.equal(questions.length,30,topic+' needs 30 questions');
  assert.equal(new Set(questions.map(q=>q[0].toLowerCase().replace(/[^a-z0-9]/g,''))).size,30,topic+' repeats a question');
 }
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
 assert.match(localHeaders,/X-Frame-Options: DENY/);
 assert.match(socialHeaders,/X-Frame-Options: DENY/);
 assert.match(socialHeaders,/frame-src 'self' /,'Account 3 must permit the first-party game iframe');
});

test('all new Bible Champions memory questions match an actual KJV verse word-for-word',()=>{
 const bank=bankFor(local('bible-quiz.js'));
 const base=new URL('../../../../apps/heavenly-key-bible/heavenly-key-website/bible/data/kjv/',import.meta.url);
 const manifest=JSON.parse(readFileSync(new URL('manifest.json',base),'utf8'));
 const codes=new Map(manifest.books.map(book=>[book.name,book.code]));
 const cache=new Map();
 let verified=0;
 for(const [topic,questions] of Object.entries(bank))for(const question of questions){
  if(!question[0].startsWith('Complete the KJV Scripture ('))continue;
  const match=/^Complete the KJV Scripture \((.+) (\d+):(\d+)\): “(.+) ____ (.+)”$/s.exec(question[0]);
  assert.ok(match,'Malformed Scripture-completion prompt: '+topic);
  const [,name,chapter,verseNum,before,after]=match;
  const code=codes.get(name);assert.ok(code,'Unrecognized KJV book: '+name);
  if(!cache.has(code))cache.set(code,JSON.parse(readFileSync(new URL(code+'.json',base),'utf8')));
  const verse=cache.get(code).chapters[chapter]?.find(v=>v.number===Number(verseNum));
  assert.ok(verse,'KJV verse not found: '+name+' '+chapter+':'+verseNum);
  assert.equal(question[3],name+' '+chapter+':'+verseNum);
  const expected=(before+' '+question[1][question[2]]+' '+after).replace(/\s+/g,' ').trim();
  const original=verse.text.replace(/\s+/g,' ').trim();
  assert.ok(original.includes(expected),'Answer does not match KJV: '+name+' '+chapter+':'+verseNum);
  verified++;
 }
 assert.equal(verified,567,'Expected exactly 567 newly KJV-sourced Scripture-completion questions');
});

test('every Bible Champions surface offers the same private, user-initiated result sharing',()=>{
 for(const source of [bible,social,local('bible-quiz.js')]){
  assert.match(source,/async function shareBibleResult\(\)/);
  assert.match(source,/Share my learning result/);
  assert.match(source,/navigator\.share/);
  assert.match(source,/navigator\.clipboard\?\.writeText/);
  assert.match(source,/new URL\(location\.pathname,location\.origin\)/);
  assert.doesNotMatch(source,/location\.search\s*\+/);
 }
});

test('scoped Cloudflare frame policies detach conflicting inherited headers',()=>{
 const localHeaders=local('_headers');
 const socialHeaders=readFileSync(new URL('../../../account-03-global-christian-community/source/public/_headers',import.meta.url),'utf8');
 const bibleHeaders=readFileSync(new URL('../../../../apps/heavenly-key-bible/heavenly-key-website/bible/_headers',import.meta.url),'utf8');
 for(const [headers,route] of [[localHeaders,'/bible-quiz.html'],[socialHeaders,'/bible-champions-embed.html'],[bibleHeaders,'/bible-champions-embed.html'],[localHeaders,'/creation-to-eternity.html']]){
  const block=headers.split('\n'+route+'\n')[1]?.split(/\n\n|\n\//)[0]||'';
  assert.match(block,/! X-Frame-Options/,'Missing parent X-Frame-Options detachment: '+route);
  assert.match(block,/! Content-Security-Policy/,'Missing parent CSP detachment: '+route);
  assert.match(block,/frame-ancestors 'self'/);
 }
 const strength=socialHeaders.split('\n/strength-for-today.html\n')[1]?.split(/\n\n|\n\//)[0]||'';
 assert.match(strength,/! X-Frame-Options/);
 assert.match(strength,/frame-ancestors 'self' https:\/\/apps\.heavenlykey\.org/);
 const walk=localHeaders.split('\n/walk-offline.html\n')[1]||'';
 assert.match(walk,/frame-src 'self' https:\/\/global\.heavenlykey\.org/);
 assert.match(walk,/frame-ancestors 'none'/);
});

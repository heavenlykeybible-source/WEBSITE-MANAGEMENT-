import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {KJV_BOOKS,READING_YEAR,readingForDay} from '../public/bible-catalog.js';
import {validBibleRef,moveBibleRef,bibleFont} from '../public/bible-mobile-controls.js';
import {approvedTrack,audioCoverage,adjacentChapter} from '../public/audio-bible-catalog.js';
import {createLockScreenSession} from '../public/lock-screen-media.js';

const root=new URL('../',import.meta.url),read=path=>readFileSync(new URL(path,root),'utf8');
const json=path=>JSON.parse(read(path));
test('all 66 books preserve the original source snapshot and complete chapter/verse counts',()=>{
 const manifest=json('public/kjv-manifest.json'),ledger=json('docs/kjv-source-snapshot.json');
 assert.equal(manifest.books.length,66);assert.equal(ledger.books.length,66);let chapters=0,verses=0;
 for(const book of manifest.books){
  const path='public/'+book.path,content=read(path),data=JSON.parse(content);
  assert.equal(data.book,book.name);assert.equal(data.chapters.length,book.chapters);
  for(const chapter of data.chapters){assert.ok(chapter.length>0);for(const verse of chapter)assert.equal(typeof verse,'string');chapters++;verses+=chapter.length;}
  const hash=value=>createHash('sha1').update('blob '+Buffer.byteLength(value)+'\0').update(value).digest('hex');
  const expected=ledger.books.find(x=>x.path===path).gitBlob;
  assert.ok([content,content.replace(/\n$/,''),content.replace(/\n\n$/,'')].some(value=>hash(value)===expected),book.name+' changed from source snapshot');
 }
 assert.equal(chapters,1189);assert.equal(verses,31102);
 assert.equal(json('public/reading/kjv/john.json').chapters[2][15],'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.');
});
test('reading plan covers 365 valid chapters and reader controls respect canonical boundaries',()=>{
 assert.equal(READING_YEAR.length,365);
 for(const entry of READING_YEAR)assert.ok(KJV_BOOKS.some(b=>b.name===entry.book&&entry.chapter>=1&&entry.chapter<=b.chapters));
 const books=json('public/kjv-manifest.json').books;
 assert.equal(moveBibleRef(books,'genesis',1,-1),null);assert.equal(moveBibleRef(books,'revelation',22,1),null);
 assert.deepEqual(moveBibleRef(books,'1samuel',31,1),{book:'2samuel',chapter:1});
 assert.equal(validBibleRef(books,'john','invalid'),null);assert.equal(bibleFont(500),32);assert.equal(bibleFont(-2),16);
 assert.ok(readingForDay(0).day>=1);
});
test('recorded audio stays unavailable until the existing approval and track gates pass',()=>{
 const actual=json('public/audio-bible-manifest.json');assert.equal(audioCoverage(actual),0);assert.equal(approvedTrack(actual,'john',3),null);
 const manifest={version:1,translation:'KJV',language:'en-NG',narration:'human',publicationApproved:true,narrator:{displayName:'Test narrator'},rights:{bibleText:true,narratorConsent:true,recordingDistribution:true,streaming:true,offline:true},tracks:{john:{3:{approved:true,url:'https://audio.heavenlykey.org/bible/john/3.mp3',mimeType:'audio/mpeg',offlineApproved:true}}}};
 assert.equal(approvedTrack(manifest,'john',3).offlineApproved,true);
 assert.equal(approvedTrack({...manifest,publicationApproved:false},'john',3),null);
 manifest.tracks.john[3].url='https://evil.test/track.mp3';assert.equal(approvedTrack(manifest,'john',3),null);
 assert.deepEqual(adjacentChapter('1-samuel',31,1),{book:'2-samuel',chapter:1});
});
test('lock-screen controls support play/pause/seek and clean up supported handlers',()=>{
 const handlers={},listeners={},audio={currentTime:5,duration:120,play(){this.played=true;return Promise.resolve();},pause(){this.paused=true;},addEventListener:(n,f)=>listeners[n]=f,removeEventListener:n=>delete listeners[n]};
 const session={setActionHandler:(n,f)=>handlers[n]=f};
 const control=createLockScreenSession(audio,{}, {navigator:{mediaSession:session},MediaMetadata:class{constructor(data){Object.assign(this,data)}}});
 assert.equal(control.update({title:'John 3',artist:'Test narrator'}),true);handlers.play();handlers.pause();handlers.seekforward({seekOffset:20});assert.equal(audio.currentTime,25);handlers.seekto({seekTime:500});assert.equal(audio.currentTime,120);
 control.dispose();assert.equal(handlers.play,null);assert.equal(session.metadata,null);
});
test('offline shell contains every dependency but never automatically downloads Bible books or media',()=>{
 const listeners={},installed=[];
 vm.runInNewContext(read('public/sw.js'),{self:{location:{origin:'https://app.test'},addEventListener:(n,f)=>listeners[n]=f,clients:{claim:async()=>{}}},URL,Set,Promise,Response,caches:{open:async()=>({addAll:async list=>installed.push(...list),put:async()=>{}})},fetch:async()=>new Response('public')});
 let promise;listeners.install({waitUntil:p=>promise=p});return promise.then(()=>{
  for(const path of installed)assert.ok(existsSync(new URL('public'+(path==='/'?'/index.html':path),root)),path);
  assert.equal(installed.some(path=>path.includes('/reading/kjv/')||/\.(?:mp3|m4a|ogg)$/.test(path)),false);
  const intercepted=path=>{let called=false;listeners.fetch({request:new Request('https://app.test'+path),respondWith:()=>called=true,waitUntil(){}});return called;};
  assert.equal(intercepted('/bible.html?book=1-samuel&chapter=31'),true);
  assert.equal(intercepted('/bible.html?token=secret'),false);assert.equal(intercepted('/api/member/tracks'),false);
  assert.equal(intercepted('/audio-bible.html?chapter=NaN'),false);assert.equal(intercepted('/reading/kjv/john.json'),false);
 });
});
test('Android and Apple installation icons have correct PNG dimensions and safe viewports',()=>{
 const manifest=json('public/manifest.webmanifest');
 for(const icon of manifest.icons){const bytes=readFileSync(new URL('public'+icon.src,root)),size=Number(icon.sizes.split('x')[0]);assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);}
 for(const page of ['index.html','bible.html','devotional.html','hymns.html','audio-bible.html','audio-hymns.html'])assert.match(read('public/'+page),/viewport-fit=cover/);
 assert.match(read('public/index.html'),/apple-touch-icon.png/);
 assert.match(read('public/styles.css'),/min-height:44px/);
});

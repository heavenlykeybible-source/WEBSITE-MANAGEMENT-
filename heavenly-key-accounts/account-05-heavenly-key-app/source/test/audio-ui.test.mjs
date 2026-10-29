import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {HYMNS,FEATURED_HYMN,approvedHymn,coverage,AUDIO_CACHE} from '../public/audio-hymn-catalog.js';
import {nextApprovedHymn} from '../public/audio-playlist.js';
import {approvedBackground} from '../public/audio-background-catalog.js';
import {createLockScreenSession} from '../public/lock-screen-media.js';
const root=new URL('../public/',import.meta.url);
async function mount(manifest){
 const nodes=new Map(),fetches=[],events={};
 function node(id){return {id,value:'',checked:false,disabled:false,hidden:false,paused:true,currentTime:0,children:[],listeners:{},attributes:{},plays:0,
  append(n){this.children.push(n)},replaceChildren(...items){this.children=items},addEventListener(n,f){this.listeners[n]=f},removeEventListener(n){delete this.listeners[n]},getAttribute(n){return this.attributes[n]},removeAttribute(n){delete this.attributes[n];if(n==='src')this.src=''},
  pause(){this.paused=true;this.listeners.pause?.()},load(){},play(){this.plays++;this.paused=false;this.listeners.play?.();return Promise.resolve();}};}
 for(const [,id] of readFileSync(new URL('audio-hymns.html',root),'utf8').matchAll(/id="([^"]+)"/g))nodes.set(id,node(id));
 nodes.get('hymn-style').value='choir';nodes.get('hymn-music-volume').value='12';
 const location={href:'https://apps.heavenlykey.org/audio-hymns.html',search:'',origin:'https://apps.heavenlykey.org'};
 const context={HYMNS,FEATURED_HYMN,approvedHymn,coverage,AUDIO_CACHE,nextApprovedHymn,approvedBackground,createLockScreenSession,
  document:{getElementById:id=>nodes.get(id),createElement:tag=>node(tag)},location,URL,URLSearchParams,navigator:{},window:{addEventListener:(n,f)=>events[n]=f},history:{replaceState(){}},
  fetch:async path=>{fetches.push(path);return {ok:true,json:async()=>path==='audio-background-manifest.json'?{publicationApproved:false}:manifest};}};
 const source=readFileSync(new URL('audio-hymns.js',root),'utf8').replace(/^import .*;\n/gm,'');
 await vm.runInNewContext('(async()=>{'+source+'})()',context);
 return {nodes,fetches,events};
}
function approvedManifest(url='https://audio.heavenlykey.org/hymns/'+HYMNS[0].id+'/choir.mp3'){
 return {version:1,narration:'human',publicationApproved:true,rights:{lyrics:true,tune:true,arrangement:true,performerConsent:true,recordingDistribution:true,streaming:true,offline:false},tracks:{[HYMNS[0].id]:{choir:{approved:true,url,mimeType:'audio/mpeg',performer:'Test choir'}}}};
}
test('integrated hymns without approved recordings perform no playback or remote media fetch',async()=>{
 const manifest=JSON.parse(readFileSync(new URL('audio-hymn-manifest.json',root),'utf8')),h=await mount(manifest);
 assert.equal(h.nodes.get('hymn-player-area').hidden,true);assert.equal(h.nodes.get('hymn-player').plays,0);assert.equal(h.nodes.get('hymn-background-player').plays,0);
 assert.match(h.nodes.get('hymn-status').textContent,/No approved choir recording/);
 assert.deepEqual(h.fetches,['audio-background-manifest.json','audio-hymn-manifest.json']);
});
test('approved hymn waits for user playback and changing hymn stops the previous session',async()=>{
 const h=await mount(approvedManifest()),audio=h.nodes.get('hymn-player');
 assert.equal(h.nodes.get('hymn-player-area').hidden,false);assert.equal(audio.plays,0);assert.equal(h.nodes.get('hymn-save').disabled,true,'Streaming rights do not imply offline permission');
 await audio.play();assert.equal(audio.paused,false);h.nodes.get('hymn-next').listeners.click();assert.equal(audio.paused,true);assert.equal(audio.src,'');assert.equal(h.nodes.get('hymn-player-area').hidden,true);
 h.events.pagehide();assert.equal(audio.paused,true);
});
test('untrusted recording URLs and revoked publication never activate hymn playback',async()=>{
 for(const manifest of [approvedManifest('https://evil.test/recording.mp3'),{...approvedManifest(),publicationApproved:false}]){
  const h=await mount(manifest);assert.equal(h.nodes.get('hymn-player-area').hidden,true);assert.equal(h.nodes.get('hymn-player').plays,0);
 }
});

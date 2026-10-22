import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {KJV_BOOKS} from '../public/bible-catalog.js';
import * as catalogue from '../public/audio-bible-catalog.js';
import {nextApprovedBible} from '../public/audio-playlist.js';
import {approvedBackground} from '../public/audio-background-catalog.js';
import {createLockScreenSession} from '../public/lock-screen-media.js';

async function mount(manifest,query='?book=john&chapter=3'){
 const nodes=new Map(),fetches=[],events={};
 function node(id){return {id,value:'',checked:false,disabled:false,hidden:false,paused:true,currentTime:0,children:[],listeners:{},attributes:{},plays:0,
  append(n){this.children.push(n)},replaceChildren(...items){this.children=items},addEventListener(n,f){this.listeners[n]=f},getAttribute(n){return this.attributes[n]},removeAttribute(n){delete this.attributes[n];if(n==='src')this.src=''},
  pause(){this.paused=true;this.listeners.pause?.()},load(){},play(){this.plays++;this.paused=false;this.listeners.play?.();return Promise.resolve();}};}
 for(const id of [...readFileSync(new URL('../public/audio-bible.html',import.meta.url),'utf8').matchAll(/id="([^"]+)"/g)].map(x=>x[1]))nodes.set(id,node(id));
 nodes.get('audio-speed').value='1';nodes.get('audio-music-volume').value='12';
 const location={href:'https://app.test/audio-bible.html'+query,search:query,origin:'https://app.test'};
 const context={KJV_BOOKS,...catalogue,nextApprovedBible,approvedBackground,createLockScreenSession,
  document:{getElementById:id=>nodes.get(id),createElement:tag=>node(tag)},location,URL,URLSearchParams,navigator:{onLine:true},window:{addEventListener:(n,f)=>events[n]=f},
  history:{replaceState(){}},fetch:async path=>{fetches.push(path);return {ok:true,json:async()=>path==='audio-background-manifest.json'?{publicationApproved:false}:manifest};}};
 const source=readFileSync(new URL('../public/audio-bible.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 await vm.runInNewContext('(async()=>{'+source+'})()',context);
 return {nodes,fetches,events};
}
test('missing recordings produce clear availability and zero media playback',async()=>{
 const manifest=JSON.parse(readFileSync(new URL('../public/audio-bible-manifest.json',import.meta.url),'utf8'));
 const h=await mount(manifest);assert.equal(h.nodes.get('audio-ready').hidden,true);
 assert.match(h.nodes.get('audio-status').textContent,/has not yet been released/);
 assert.equal(h.nodes.get('audio-player').plays,0);assert.equal(h.nodes.get('audio-background-player').plays,0);
 assert.deepEqual(h.fetches,['audio-background-manifest.json','audio-bible-manifest.json']);
});
test('numbered-book links select the right book and preserve chapter without playing media',async()=>{
 const h=await mount({publicationApproved:false},'?book=1samuel&chapter=31');
 assert.equal(h.nodes.get('audio-book').value,'1-samuel');assert.equal(h.nodes.get('audio-chapter').value,'31');
 assert.equal(h.nodes.get('audio-read').href,'bible.html?book=1-samuel&chapter=31');
 assert.equal(h.nodes.get('audio-player').plays,0);
});
test('approved recordings remain preload-none and chapter changes stop old playback',async()=>{
 const manifest={version:1,translation:'KJV',language:'en-NG',narration:'human',publicationApproved:true,narrator:{displayName:'Test narrator'},rights:{bibleText:true,narratorConsent:true,recordingDistribution:true,streaming:true},tracks:{john:{3:{approved:true,url:'https://audio.heavenlykey.org/bible/john/3.mp3',mimeType:'audio/mpeg'}}}};
 const h=await mount(manifest),audio=h.nodes.get('audio-player');
 assert.equal(h.nodes.get('audio-ready').hidden,false);assert.equal(audio.preload,'none');assert.equal(audio.plays,0);
 await audio.play();assert.equal(audio.paused,false);
 h.nodes.get('audio-chapter').value='4';h.nodes.get('audio-chapter').listeners.change();
 assert.equal(audio.paused,true);assert.equal(audio.src,'');assert.equal(h.nodes.get('audio-ready').hidden,true);
 h.events.pagehide();assert.equal(audio.paused,true);
});

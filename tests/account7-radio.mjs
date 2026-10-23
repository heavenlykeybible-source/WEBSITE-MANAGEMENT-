import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
const base='heavenly-key-accounts/account-07-unverified/source/';
const worker=(await import('../'+base+'_worker.js')).default;
const originalFetch=globalThis.fetch;
try{
 let forwarded;
 globalThis.fetch=async request=>{forwarded=request;return new Response('audio bytes',{status:206,headers:{'Content-Type':'audio/mpeg','Content-Range':'bytes 0-10/99','Set-Cookie':'private=value'}})};
 const env={MEDIA_PUBLIC_ORIGIN:'https://account2.example',RADIO_PUBLIC_API_KEY:'server-only-test-key',ASSETS:{fetch:()=>new Response('asset')}};
 let r=await worker.fetch(new Request('https://radio.example/api/broadcast/programme?channel=video&admin=1'),env);
 assert.equal(forwarded.url,'https://account2.example/api/broadcast/programme?channel=radio');
 assert.equal(forwarded.headers.get('Authorization'),'Bearer server-only-test-key');assert.equal(r.headers.get('set-cookie'),null);
 r=await worker.fetch(new Request('https://radio.example/api/broadcast/media/42/object',{headers:{Range:'bytes=0-10',Cookie:'owner=secret','X-Heavenly-Key-Internal':'spoof'}}),env);
 assert.equal(r.status,206);assert.equal(forwarded.headers.get('Range'),'bytes=0-10');assert.equal(forwarded.headers.get('Cookie'),null);assert.equal(forwarded.headers.get('X-Heavenly-Key-Internal'),null);
 await worker.fetch(new Request('https://radio.example/api/broadcast/livekit/viewer-token',{method:'POST'}),env);
 assert.equal(forwarded.url,'https://account2.example/api/media-engine/livekit/viewer-token?channel=radio');
 assert.equal((await worker.fetch(new Request('https://radio.example/api/broadcast/settings',{method:'POST'}),env)).status,404);
 assert.equal((await worker.fetch(new Request('https://radio.example/api/broadcast/programme'),{})).status,503);
 globalThis.fetch=async()=>new Response(null,{status:302,headers:{Location:'https://other.example'}});
 assert.equal((await worker.fetch(new Request('https://radio.example/api/broadcast/programme'),env)).status,502);
 globalThis.fetch=async()=>{throw Error('offline')};
 assert.equal((await worker.fetch(new Request('https://radio.example/api/broadcast/programme'),env)).status,502);
}finally{globalThis.fetch=originalFetch}
const code=fs.readFileSync(base+'js/approved-widget-system.js','utf8');
let roomInstance;
class Room{constructor(){this.events={};roomInstance=this}on(event,fn){this.events[event]=fn}async connect(){this.connected=true}async startAudio(){}async disconnect(){this.connected=false}}
const sdkModule=new vm.SyntheticModule(['Room','RoomEvent'],function(){this.setExport('Room',Room);this.setExport('RoomEvent',{TrackSubscribed:'track',Reconnecting:'reconnecting',Disconnected:'disconnected'})});
await sdkModule.link(()=>{});await sdkModule.evaluate();
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function player(programme,delayed=false){
 const {window}=parseHTML('<html><head></head><body><div id="hk-radio-page-mount"></div></body></html>');
 const audios=[];const original=window.document.createElement.bind(window.document);
 function patchAudio(a){a.paused=true;a.ended=false;a.error=null;a.volume=1;a.muted=false;a.src='';a.load=()=>{};a.pause=()=>{a.paused=true;a.dispatchEvent(new window.Event('pause'))};a.play=async()=>{a.paused=false;a.dispatchEvent(new window.Event('playing'))};audios.push(a);return a}
 window.document.createElement=(tag)=>{const e=original(tag);return tag==='audio'?patchAudio(e):e};
 // innerHTML-created media elements also need browser media methods.
 const append=window.document.getElementById('hk-radio-page-mount').append.bind(window.document.getElementById('hk-radio-page-mount'));
 window.document.getElementById('hk-radio-page-mount').append=(root)=>{patchAudio(root.querySelector('audio'));append(root)};
 let current=programme,resolveFetch;const timers=new Map();let id=0;
 const fetch=async url=>{if(String(url).includes('viewer-token'))return Response.json({url:'wss://test.livekit.cloud',token:'test-viewer',title:'Live message'});if(delayed){delayed=false;await new Promise(r=>resolveFetch=r)}return Response.json(current)};
 const sandbox={window,document:window.document,location:{origin:'https://radio.example',hostname:'radio.example',pathname:'/'},navigator:{},URL,Response,AbortController,AbortSignal,MediaMetadata:undefined,fetch,console,setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id},clearTimeout:id=>timers.delete(id)};
 window.__hkApprovedPublicShell=true;
 new vm.Script(code,{importModuleDynamically:()=>sdkModule}).runInNewContext(sandbox);
 return {document:window.document,timers,setProgramme:p=>current=p,resolve:()=>resolveFetch?.(),audio:()=>audios.find(a=>a.isConnected)};
}
const playlist={mode:'playlist',items:[{url:'/api/broadcast/media/42/object',title:'Message one'},{url:'/api/broadcast/media/43/object',title:'Message two'}]};
let p=player(playlist,true);
const play=p.document.querySelector('.hkr-play');const pending=play.onclick();p.resolve();await pending;
assert.equal(p.audio().paused,false,'Play during initial programme loading must start audio');assert.match(p.audio().src,/42\/object$/);
p.document.querySelector('.hkr-next').onclick();await tick();assert.match(p.audio().src,/43\/object$/);
p.document.querySelector('.hkr-stop').onclick();assert.equal(p.audio().paused,true);assert.equal(p.timers.size,0,'Stop clears polling and reconnect timers');
p=player({mode:'live',transport:'livekit',sessionId:7,title:'Live message',items:[]});await tick();await p.document.querySelector('.hkr-play').onclick();
assert.equal(roomInstance.connected,true,'Live radio must connect to the Account 2 viewer room');
let unsubscribed=false;roomInstance.events.track({kind:'video'},{setSubscribed:value=>unsubscribed=!value});assert.equal(unsubscribed,true);
roomInstance.events.track({kind:'audio',attach:()=>{}},{});await tick();assert.equal(p.audio().paused,false);
p.document.querySelector('.hkr-stop').onclick();await tick();assert.equal(roomInstance.connected,false,'Stop disconnects live room');
for(const name of ['approved-radio-display-20261017.webp','approved-radio-transparent-original.png'])assert.ok(fs.statSync(base+'assets/ministry/'+name).size>0);
console.log('Account 7 tests passed: proxy restrictions, private key handling, media ranges, initial-load playback, track changes, live audio and stop cleanup.');

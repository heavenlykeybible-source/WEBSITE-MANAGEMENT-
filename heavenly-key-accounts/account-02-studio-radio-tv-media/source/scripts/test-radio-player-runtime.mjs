import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const root=fileURLToPath(new URL('../',import.meta.url));
const source=readFileSync(resolve(root,'src/radio-player.ts'),'utf8');
const generated=ts.transpileModule(source.replace(/^export /gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const response=runInNewContext(generated+';radioPlayerHtml()', {Response,crypto:webcrypto});
const html=await response.text();
const script=html.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'Standalone player script should exist');
const events=new Map(),elements=new Map(),mediaActions=new Map();
let holdPlay=false,resolvePendingPlay=null;
function element(id){
 const listeners=new Map(),attributes=new Map();
 return {id,textContent:'',value:'80',disabled:false,paused:true,volume:0,
  src:'',addEventListener:(name,fn)=>listeners.set(name,fn), 
  async fire(name){const fn=listeners.get(name);assert.ok(fn,id+' event '+name);return fn()},
  setAttribute:(name,v)=>attributes.set(name,v),getAttribute(name){return name==='src'?(this.src||null):attributes.get(name)||null},
  removeAttribute(name){if(name==='src')this.src='';else attributes.delete(name)},
  pause(){this.paused=true},load(){},async play(){if(holdPlay){return await new Promise(resolve=>{resolvePendingPlay=()=>{this.paused=false;resolve()}})}this.paused=false;return undefined;}
 };
}
for(const id of ['audio','play','next','retry','track','status','volume','volumeValue','output','outputHelp'])elements.set(id,element(id));
let shouldFail=false,holdFetch=false,pendingFetch=null;const pendingFetches=[],fetchSignals=[];
let fetchResult={items:[{type:'audio',title:'First',url:'/api/broadcast/media/1/object'},{type:'audio',title:'Second',url:'/api/broadcast/media/2/object'}]};
const task=runInNewContext(script,{
 document:{getElementById:id=>elements.get(id)},
 window:{addEventListener:(name,fn)=>events.set(name,fn)},
 navigator:{mediaSession:{setActionHandler:(name,fn)=>mediaActions.set(name,fn)}},
 AbortController,
 fetch:async(_url,options)=>{fetchSignals.push(options.signal);if(holdFetch)return await new Promise(resolve=>{pendingFetch=resolve;pendingFetches.push(resolve)});if(shouldFail)throw Error('Offline');return {ok:true,json:async()=>fetchResult}},
 MediaMetadata:undefined,
 console
});
await Promise.resolve();await Promise.resolve();await new Promise(resolve=>setImmediate(resolve));
const get=id=>elements.get(id),audio=get('audio');
assert.equal(get('track').textContent,'First');
await get('play').fire('click');
assert.equal(audio.src,'/api/broadcast/media/1/object');
assert.equal(audio.paused,false);
assert.equal(get('play').getAttribute('aria-label'),'Pause radio');
audio.paused=true;
await audio.fire('pause');
assert.equal(get('play').getAttribute('aria-label'),'Play radio','Native OS pause must reset button');
await get('play').fire('click');
assert.equal(get('play').getAttribute('aria-label'),'Pause radio','Native pause must remain resumable');
await audio.fire('ended');
await Promise.resolve();
assert.equal(audio.src,'/api/broadcast/media/2/object');
assert.equal(audio.paused,false);
await get('play').fire('click');
assert.equal(audio.paused,true);
assert.equal(get('play').getAttribute('aria-label'),'Play radio');
await get('next').fire('click');
assert.equal(audio.src,'/api/broadcast/media/1/object');
fetchResult={items:[{type:'audio',title:'Replacement',url:'/api/broadcast/media/3/object'}]};
await get('retry').fire('click');
assert.equal(audio.paused,true);
assert.equal(audio.getAttribute('src'),null);
assert.equal(get('track').textContent,'Replacement');
await get('play').fire('click');
assert.equal(audio.src,'/api/broadcast/media/3/object');
assert.equal(audio.paused,false);
events.get('pagehide')();
assert.equal(audio.paused,true);
assert.equal(get('play').getAttribute('aria-label'),'Play radio');
await get('play').fire('click');
assert.equal(audio.paused,false);
mediaActions.get('pause')();
assert.equal(audio.paused,true);
assert.equal(get('play').getAttribute('aria-label'),'Play radio');
shouldFail=true;
await get('retry').fire('click');
assert.equal(audio.paused,true);
assert.equal(audio.getAttribute('src'),null);
assert.equal(get('play').getAttribute('aria-label'),'Play radio');
assert.equal(get('next').disabled,true);
assert.equal(get('track').textContent,'Playlist unavailable');
shouldFail=false;holdFetch=true;
const pending=get('retry').fire('click');
assert.equal(get('play').disabled,true,'Play must be disabled during playlist loading');
assert.equal(get('next').disabled,true,'Next must be disabled during playlist loading');
assert.equal(typeof pendingFetch,'function','Network request must be pending');
fetchResult={items:[{type:'audio',title:'Recovered',url:'/api/broadcast/media/4/object'}]};
holdFetch=false;pendingFetch({ok:true,json:async()=>fetchResult});
await pending;
assert.equal(get('play').disabled,false,'Play must be enabled after playlist recovery');
assert.equal(get('next').disabled,false);
assert.equal(get('track').textContent,'Recovered');
holdFetch=true;
const first=get('retry').fire('click');
const second=get('retry').fire('click');
assert.equal(fetchSignals.at(-2).aborted,true,'Previous playlist fetch must be aborted');
assert.equal(fetchSignals.at(-1).aborted,false);
assert.equal(get('play').disabled,true);
assert.equal(pendingFetches.length,3,'Should track both overlapping requests');
const firstResult={items:[{type:'audio',title:'Outdated',url:'/api/broadcast/media/8/object'}]};
const latestResult={items:[{type:'audio',title:'Latest',url:'/api/broadcast/media/9/object'}]};
pendingFetches[2]({ok:true,json:async()=>latestResult});
await second;
assert.equal(get('track').textContent,'Latest');
pendingFetches[1]({ok:true,json:async()=>firstResult});
await first;
assert.equal(get('track').textContent,'Latest','Outdated response must never replace latest playlist');
assert.equal(get('play').disabled,false);
holdPlay=true;
const firstPlay=get('play').fire('click');
assert.equal(typeof resolvePendingPlay,'function','Audio play must be awaiting permission or buffering');
await get('play').fire('click');
assert.equal(audio.paused,true,'Second tap must cancel pending playback');
assert.equal(get('play').getAttribute('aria-label'),'Play radio');
resolvePendingPlay();await firstPlay;
assert.equal(audio.paused,true,'Late play promise must not restart audio after cancellation');
assert.equal(get('play').getAttribute('aria-label'),'Play radio','Late play promise must never restore Playing controls');
holdPlay=false;
console.log('Account 2 radio runtime play, pause, next, end, refresh, and page-exit tests passed');

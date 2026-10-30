import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
async function scenario(mode){
 const nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',disabled:false,hidden:true,textContent:'',style:{},append(){},replaceChildren(){},removeAttribute(){},addEventListener(){},removeEventListener(){}});return nodes.get(id)};
 const statuses=[];const statusNode=node('clipStatus');let statusText='';Object.defineProperty(statusNode,'textContent',{get(){return statusText},set(value){statusText=value;statuses.push(String(value))}});
 const video=node('v');Object.assign(video,{duration:2,currentTime:0,playbackRate:1,pause(){this.pauseCount=(this.pauseCount||0)+1},async play(){if(mode==='overlap'){this.playCount=(this.playCount||0)+1;if(this.playCount===1)return new Promise(resolve=>setTimeout(resolve,25));this.currentTime=0;return}if(mode==='cancel-start'||mode==='play-timeout')return new Promise(()=>{});if(mode==='late-play')return new Promise(resolve=>setTimeout(()=>{this.currentTime=1;resolve()},25));this.currentTime=mode==='cancel-play'?0:1}});
 const track={stop(){}};node('cv').captureStream=()=>({getTracks:()=>[track],getAudioTracks:()=>[],addTrack(){}});
 class Recorder{static isTypeSupported(){return true}constructor(){this.state='inactive'}start(){this.state='recording';if(mode==='error')this.onerror({error:Error('Encoder broke')});if(mode==='premature')this.state='inactive'}pause(){this.state='paused'}resume(){this.state='recording'}stop(){this.state='inactive';if(mode==='cancel-encoder')setTimeout(()=>node('clipCancel').onclick(),0);if(mode!=='timeout'&&mode!=='cancel-encoder'){this.ondataavailable({data:mode==='oversize'?{size:256*1024*1024+1}:new Blob(['video'])});this.onstop()}}}
 const window={MediaRecorder:Recorder};
 runInNewContext(readFileSync('public/timeline.js','utf8'),{window,document:{getElementById:node,createElement:()=>node(Symbol())},MediaRecorder:Recorder,Blob,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},setTimeout:(fn,ms)=>setTimeout(fn,ms===15000?5:ms),clearTimeout,setInterval,clearInterval,Date,console});
 window.hkTimeline.restoreClips([{start:0,end:1,speed:1}]);
 const originalTimeline=JSON.stringify(window.hkTimeline.getClips());
 window.hkTimeline.restoreClips([{start:0,end:1000000,speed:1}]);
 assert.equal(JSON.stringify(window.hkTimeline.getClips()),originalTimeline,'Reject excessive saved clip timestamps without changing clips');
 assert.match(node('clipStatus').textContent,/invalid clips/,'Oversized restored timeline reports validation failure');
 node('clipAddFull').onclick();
 assert.equal(window.hkTimeline.getClips().length,2,'Full-source command appends one clip');
 assert.deepEqual(JSON.parse(JSON.stringify(window.hkTimeline.getClips()[1])),{start:0,end:2,speed:1},'Full-source clip covers complete video');
 node('clipClear').onclick();
 assert.equal(window.hkTimeline.getClips().length,0,'Clear command removes all clips');
 node('clipUndo').onclick();
 assert.equal(window.hkTimeline.getClips().length,2,'Clear command is undoable');
 node('clipUndo').onclick();
 assert.equal(window.hkTimeline.getClips().length,1,'Undo restores initial timeline for existing scenarios');
 const hotkey=(key,opts={})=>node('clipList').onkeydown({key,preventDefault(){},...opts});
 hotkey('d',{ctrlKey:true});
 assert.equal(window.hkTimeline.getClips().length,2,'Ctrl+D duplicates selected clip');
 hotkey('z',{ctrlKey:true});
 assert.equal(window.hkTimeline.getClips().length,1,'Ctrl+Z undoes duplicate');
 hotkey('z',{ctrlKey:true,shiftKey:true});
 assert.equal(window.hkTimeline.getClips().length,2,'Ctrl+Shift+Z redoes duplicate');
 hotkey('Delete');
 assert.equal(window.hkTimeline.getClips().length,1,'Delete removes selected clip');
 node('clipDuplicate').onclick();
 assert.equal(window.hkTimeline.getClips().length,2,'Duplicate inserts a second clip');
 assert.deepEqual(JSON.parse(JSON.stringify(window.hkTimeline.getClips()[1])),{start:0,end:1,speed:1},'Duplicate preserves clip timing and speed');
 node('clipUndo').onclick();
 assert.equal(window.hkTimeline.getClips().length,1,'Undo restores timeline after duplication');
 video.currentTime=.4;node('clipTrimIn').onclick();
 assert.equal(window.hkTimeline.getClips()[0].start,.4,'Trim start uses the playhead');
 assert.equal(node('clipStart').value,'0.4','Trimmed start updates time input');
 node('clipUndo').onclick();
 assert.equal(window.hkTimeline.getClips()[0].start,0,'Undo restores trimmed start');
 video.currentTime=.6;node('clipTrimOut').onclick();
 assert.equal(window.hkTimeline.getClips()[0].end,.6,'Trim end uses the playhead');
 assert.equal(node('clipEnd').value,'0.6','Trimmed end updates time input');
 node('clipUndo').onclick();
 assert.equal(window.hkTimeline.getClips()[0].end,1,'Undo restores trimmed end');
 video.currentTime=mode==='cancel-seek'?.7:0;
 if(mode==='overlap'){
   await node('clipExport').onclick();
   const second=node('clipExport').onclick();
   await new Promise(resolve=>setTimeout(resolve,0));
   const pauses=video.pauseCount;
   await new Promise(resolve=>setTimeout(resolve,30));
   assert.equal(video.pauseCount,pauses,'Old export playback completion cannot pause newer export');
   node('clipCancel').onclick();
   await second;
   assert.equal(node('clipCancel').disabled,true,'Overlapping export cancellation unlocks controls');
   console.log('PASS timeline encoder '+mode);
   return;
 }
 if(mode==='cancel-seek'){const operation=node('clipExport').onclick();node('clipCancel').onclick();await operation}
 else if(mode==='cancel-play'||mode==='cancel-start'){const operation=node('clipExport').onclick();await new Promise(resolve=>setTimeout(resolve,0));node('clipCancel').onclick();await operation}
 else await node('clipExport').onclick();
 assert.equal(node('vf').disabled,false,'Source must unlock after '+mode);
 assert.equal(node('clipCancel').disabled,true,'Cancel must reset after '+mode);
 const status=node('clipStatus').textContent;
 if(mode==='timeout')assert.match(status,/did not finish within 15 seconds/);
 if(mode==='cancel-encoder')assert.match(status,/Timeline operation stopped/);
 if(mode==='error')assert.match(status,/Encoder broke/);
 if(mode==='premature')assert.match(status,/stopped before timeline finished/);
 if(mode==='oversize')assert.match(status,/exceeded the 256 MB browser memory limit/);
 if(mode==='cancel-seek'||mode==='cancel-play'||mode==='cancel-start')assert.match(status,/Timeline operation stopped/);
 if(mode==='play-timeout'||mode==='late-play')assert.match(status,/Video playback did not start within 15 seconds/);
 if(mode==='late-play'){const count=video.pauseCount;await new Promise(resolve=>setTimeout(resolve,40));assert.ok(video.pauseCount>count,'Late playback is paused after timeout')}
 if(mode==='success'){
  assert.match(status,/without audio/);
  assert.ok(statuses.some(text=>/\d+% complete\./.test(text)),'Timeline reports percent progress during export');
  assert.equal(node('clipDownload').hidden,false);
  video.play=async()=>new Promise(()=>{});
  video.currentTime=0;
  const nextExport=node('clipExport').onclick();
  assert.equal(node('clipDownload').hidden,true,'Starting a fresh export hides the previous download');
  node('clipCancel').onclick();
  await nextExport;
  assert.equal(node('clipDownload').hidden,true,'Cancellation does not restore an outdated export');
 }
 console.log('PASS timeline encoder '+mode);
}
for(const mode of ['success','timeout','error','premature','oversize','cancel-seek','cancel-play','cancel-start','play-timeout','late-play','overlap','cancel-encoder'])await scenario(mode);

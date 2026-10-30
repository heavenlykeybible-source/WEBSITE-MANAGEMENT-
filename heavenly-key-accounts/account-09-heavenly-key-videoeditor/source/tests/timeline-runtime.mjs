import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
async function scenario(mode){
 const nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',disabled:false,hidden:true,textContent:'',style:{},append(){},replaceChildren(){},removeAttribute(){},addEventListener(){},removeEventListener(){}});return nodes.get(id)};
 const video=node('v');Object.assign(video,{duration:2,currentTime:0,playbackRate:1,pause(){},async play(){this.currentTime=1}});
 const track={stop(){}};node('cv').captureStream=()=>({getTracks:()=>[track],getAudioTracks:()=>[],addTrack(){}});
 class Recorder{static isTypeSupported(){return true}constructor(){this.state='inactive'}start(){this.state='recording';if(mode==='error')this.onerror({error:Error('Encoder broke')});if(mode==='premature')this.state='inactive'}pause(){this.state='paused'}resume(){this.state='recording'}stop(){this.state='inactive';if(mode!=='timeout'){this.ondataavailable({data:new Blob(['video'])});this.onstop()}}}
 const window={MediaRecorder:Recorder};
 runInNewContext(readFileSync('public/timeline.js','utf8'),{window,document:{getElementById:node,createElement:()=>node(Symbol())},MediaRecorder:Recorder,Blob,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},setTimeout:(fn,ms)=>setTimeout(fn,ms===15000?5:ms),clearTimeout,setInterval,clearInterval,Date,console});
 window.hkTimeline.restoreClips([{start:0,end:1,speed:1}]);
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
 video.currentTime=0;
 await node('clipExport').onclick();
 assert.equal(node('vf').disabled,false,'Source must unlock after '+mode);
 assert.equal(node('clipCancel').disabled,true,'Cancel must reset after '+mode);
 const status=node('clipStatus').textContent;
 if(mode==='timeout')assert.match(status,/did not finish within 15 seconds/);
 if(mode==='error')assert.match(status,/Encoder broke/);
 if(mode==='premature')assert.match(status,/stopped before timeline finished/);
 if(mode==='success'){assert.match(status,/without audio/);assert.equal(node('clipDownload').hidden,false)}
 console.log('PASS timeline encoder '+mode);
}
for(const mode of ['success','timeout','error','premature'])await scenario(mode);

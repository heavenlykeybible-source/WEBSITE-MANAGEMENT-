(()=>{'use strict';
const $=id=>document.getElementById(id),v=$('v'),canvas=$('cv'),host=$('video');if(!v||!canvas||!host)return;
const wrap=document.createElement('section');wrap.className='panel';wrap.style.marginTop='16px';
wrap.innerHTML='<h2>Multi-Clip Timeline</h2><p class="muted">Edit clips from the loaded video. Export renders the timeline in real time as WebM or native MP4 where supported by your browser.</p><div class="tools"><div><label for="clipStart">Start (seconds)</label><input id="clipStart" type="number" min="0" step=".1" value="0"></div><div><label for="clipEnd">End (seconds)</label><input id="clipEnd" type="number" min="0" step=".1" value="0"></div><div><label for="clipSpeed">Speed</label><select id="clipSpeed"><option value=".5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></div></div><div class="actions"><button id="clipAdd">Add clip</button><button id="clipSplit">Split at playhead</button><button id="clipUpdate">Update selected clip</button><button id="clipUndo">Undo</button><button id="clipRedo">Redo</button><button id="clipRemove">Remove</button><button id="clipUp">Move up</button><button id="clipDown">Move down</button><button id="clipPlay">Preview timeline</button></div><label for="clipList">Timeline clips</label><select id="clipList" size="5" aria-label="Timeline clips"></select><div class="actions"><button id="clipExport">Export timeline (MP4 / WebM)</button><button id="clipCancel" disabled>Stop preview/export</button><a id="clipDownload" download="heavenly-key-timeline.webm" hidden>Download timeline</a></div><div id="clipStatus" class="status" role="status">Load a video to begin.</div>';host.append(wrap);
let clips=[],undo=[],redo=[],session=null,exportUrl=null;
const info=t=>$('clipStatus').textContent=t;
const invalidateExport=()=>{if(exportUrl){URL.revokeObjectURL(exportUrl);exportUrl=null;}$('clipDownload').removeAttribute('href');$('clipDownload').hidden=true};
const save=()=>{invalidateExport();undo.push(JSON.stringify(clips));if(undo.length>40)undo.shift();redo=[]};
const chosen=()=>{const i=Number($('clipList').value);return $('clipList').value===''?-1:i};
function paint(selected=0){const list=$('clipList');list.replaceChildren();clips.forEach((c,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=(i+1)+'. '+c.start.toFixed(2)+'–'+c.end.toFixed(2)+'s / '+c.speed+'×';list.append(o)});if(clips.length)list.value=String(Math.min(clips.length-1,Math.max(0,selected)));else list.value='';info(clips.length+' clip(s) ready.');}
const ready=()=>Number.isFinite(v.duration)&&v.duration>0;
const seek=t=>new Promise((resolve,reject)=>{if(!ready())return reject(Error('Load a video first.'));t=Math.min(v.duration,Math.max(0,t));if(Math.abs(v.currentTime-t)<.02)return resolve();let timer;const done=()=>{clearTimeout(timer);v.removeEventListener('seeked',done);resolve()};timer=setTimeout(()=>{v.removeEventListener('seeked',done);reject(Error('Video seeking timed out.'))},10000);v.addEventListener('seeked',done);v.currentTime=t});
function setBusy(b){for(const id of ['vf','vexp','clipExport','clipPlay','clipAdd','clipSplit','clipUpdate','clipRemove','clipUp','clipDown','clipUndo','clipRedo','clipList','clipStart','clipEnd','clipSpeed'])$(id).disabled=b;$('clipCancel').disabled=!b}
v.addEventListener('loadedmetadata',()=>{invalidateExport();$('clipEnd').value=v.duration.toFixed(2);info('Video ready. Add a clip.')});
$('clipAdd').onclick=()=>{const start=Number($('clipStart').value),end=Number($('clipEnd').value);if(clips.length>=200)return info('Timeline limit is 200 clips.');if(!ready()||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>v.duration+.02)return info('Choose valid start and end times.');save();clips.push({start,end:Math.min(end,v.duration),speed:Number($('clipSpeed').value)});paint(clips.length-1)};
$('clipUpdate').onclick=()=>{const i=chosen(),current=clips[i];if(!current)return info('Select a clip to update.');const start=Number($('clipStart').value),end=Number($('clipEnd').value),speed=Number($('clipSpeed').value);if(!ready()||!Number.isFinite(start)||!Number.isFinite(end)||!Number.isFinite(speed)||start<0||end<=start||end>v.duration+.02||speed<.25||speed>4)return info('Enter a valid clip start, end and playback speed.');save();clips[i]={start,end:Math.min(end,v.duration),speed};paint(i)};
$('clipList').onchange=()=>{const c=clips[chosen()];if(c){$('clipStart').value=c.start;$('clipEnd').value=c.end;$('clipSpeed').value=String(c.speed);v.currentTime=c.start}};
$('clipSplit').onclick=()=>{const i=chosen(),c=clips[i],t=v.currentTime;if(clips.length>=200)return info('Timeline limit is 200 clips.');if(!c||t<=c.start+.05||t>=c.end-.05)return info('Select a clip and seek inside it.');save();clips.splice(i,1,{...c,end:t},{...c,start:t});paint(i)};
$('clipRemove').onclick=()=>{const i=chosen();if(i<0)return;save();clips.splice(i,1);paint(Math.max(0,i-1))};
function move(dir){const i=chosen(),j=i+dir;if(i<0||j<0||j>=clips.length)return;save();[clips[i],clips[j]]=[clips[j],clips[i]];paint(j)}
$('clipUp').onclick=()=>move(-1);$('clipDown').onclick=()=>move(1);
$('clipUndo').onclick=()=>{if(!undo.length)return;invalidateExport();redo.push(JSON.stringify(clips));clips=JSON.parse(undo.pop());paint()};
$('clipRedo').onclick=()=>{if(!redo.length)return;invalidateExport();undo.push(JSON.stringify(clips));clips=JSON.parse(redo.pop());paint()};
$('clipCancel').onclick=()=>{if(session)session.cancelled=true;v.pause()};
async function runTimeline(record){
 if(session)return info('A preview or export is already running.');
 if($('vexp').disabled)return info('Another video export or media change is in progress.');
 if(!ready()||!clips.length)return info('Load a video and add timeline clips.');
 if(clips.some(c=>c.end>v.duration+.02))return info('A clip exceeds the current video duration. Reload the original source or correct the clips.');
 const totalSeconds=clips.reduce((n,c)=>n+(c.end-c.start)/c.speed,0);
 if(record&&totalSeconds>600)return info('Browser export is limited to ten minutes. Shorten the timeline.');
 if(record&&(!canvas.captureStream||!window.MediaRecorder))return info('WebM export is unavailable in this browser.');
 const mime=record?['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t)):null;
 if(record&&!mime)return info('Browser does not support WebM or MP4 encoding.');
 const state={cancelled:false};session=state;setBusy(true);
 const before=v.currentTime,rate=v.playbackRate;let rec=null,stream=null;
 try{
  const fragments=[];let finished;
  if(record){
   stream=canvas.captureStream(30);
   try{if(v.captureStream){const source=v.captureStream();for(const track of source.getAudioTracks())stream.addTrack(track)}}catch{}
   rec=new MediaRecorder(stream,{mimeType:mime});
   finished=new Promise((resolve,reject)=>{rec.onstop=resolve;rec.onerror=e=>reject(e.error||Error('Encoder failed'))});
   rec.ondataavailable=e=>{if(e.data.size)fragments.push(e.data)};
   $('clipDownload').hidden=true;
  }
  for(let i=0;i<clips.length;i++){
   if(state.cancelled)break;
   const c=clips[i];v.pause();if(rec&&rec.state==='recording')rec.pause();await seek(c.start);v.playbackRate=c.speed;
   if(state.cancelled)break;
   if(rec&&rec.state==='inactive')rec.start(250);
   info((record?'Exporting':'Previewing')+' clip '+(i+1)+' of '+clips.length);
   await v.play();
   if(state.cancelled){v.pause();break;}
   if(rec&&rec.state==='paused')rec.resume();
   await new Promise((resolve,reject)=>{
    let completed=false,timer;const finish=(err)=>{if(completed)return;completed=true;clearInterval(timer);v.removeEventListener('ended',end);v.removeEventListener('error',error);err?reject(err):resolve()};
    const end=()=>finish(),error=()=>finish(Error('Video playback failed'));
    v.addEventListener('ended',end);v.addEventListener('error',error);
    const started=Date.now(),maxMs=Math.max(15000,((c.end-c.start)/c.speed+12)*1000);
    timer=setInterval(()=>{if(state.cancelled||v.currentTime>=c.end-.03||v.ended)return finish();if(Date.now()-started>maxMs||v.error)return finish(Error('Video playback stalled or timed out'))},40);
   });
  }
  v.pause();
  if(rec&&rec.state!=='inactive'){rec.stop();await finished}
  if(state.cancelled)return info('Timeline operation stopped.');
  if(record){
   const blob=new Blob(fragments,{type:mime});if(!blob.size)throw Error('Encoder generated an empty video.');
   if(exportUrl)URL.revokeObjectURL(exportUrl);exportUrl=URL.createObjectURL(blob);
   $('clipDownload').href=exportUrl;$('clipDownload').download='heavenly-key-timeline.'+(mime.startsWith('video/mp4')?'mp4':'webm');$('clipDownload').hidden=false;
   info('Timeline export ready ('+(blob.size/1048576).toFixed(1)+' MB). Download the '+(mime.startsWith('video/mp4')?'MP4':'WebM')+' file.');
  }else info('Timeline preview complete.');
 }catch(e){if(rec&&rec.state!=='inactive')try{rec.stop()}catch{}info('Timeline failed: '+e.message)}
 finally{v.pause();v.playbackRate=rate;if(ready())v.currentTime=Math.min(before,v.duration);if(stream)stream.getTracks().forEach(t=>t.stop());session=null;setBusy(false)}
}
window.hkTimeline={
 getClips:()=>clips.map(c=>({...c})),
 restoreClips:(data)=>{
  if(session)return info('Stop preview or export before restoring a timeline.');
  if(!Array.isArray(data)||data.length>200)return info('Saved timeline is invalid or too long.');
  const valid=data.every(c=>c&&Number.isFinite(c.start)&&Number.isFinite(c.end)&&
    Number.isFinite(c.speed)&&c.start>=0&&c.end>c.start&&c.speed>=.25&&c.speed<=4);
  if(!valid)return info('Saved timeline contains invalid clips.');
  invalidateExport();clips=data.map(c=>({start:c.start,end:c.end,speed:c.speed}));
  undo=[];redo=[];paint();info('Timeline restored. Reload the original video to preview or export.');
 }
};
$('clipPlay').onclick=()=>runTimeline(false);$('clipExport').onclick=()=>runTimeline(true);
})();
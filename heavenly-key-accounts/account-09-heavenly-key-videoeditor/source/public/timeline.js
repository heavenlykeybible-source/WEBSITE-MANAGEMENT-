(()=>{'use strict';
const $=id=>document.getElementById(id),v=$('v'),canvas=$('cv'),host=$('video');if(!v||!canvas||!host)return;
const wrap=document.createElement('section');wrap.className='panel';wrap.style.marginTop='16px';
wrap.innerHTML='<h2>Multi-Clip Timeline</h2><div id="clipDropZone" tabindex="0" role="region" aria-label="Video import drop zone" style="border:2px dashed #7778;padding:12px;border-radius:8px;margin-bottom:12px">Drop a video file here to load it into the editor, or use the video file picker above.</div><p class="muted">Edit clips from the loaded video. Export renders the timeline in real time as WebM or native MP4 where supported by your browser. Keyboard shortcuts (outside text fields): Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z redo, Shift+D duplicate, Delete remove.</p><div class="tools"><div><label for="clipStart">Start (seconds)</label><input id="clipStart" type="number" min="0" step=".1" value="0"></div><div><label for="clipEnd">End (seconds)</label><input id="clipEnd" type="number" min="0" step=".1" value="0"></div><div><label for="clipSpeed">Speed</label><select id="clipSpeed"><option value=".25">0.25×</option><option value=".5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option><option value="2">2×</option><option value="3">3×</option><option value="4">4×</option></select></div><div><label for="clipFade">Fade at clip edges</label><select id="clipFade"><option value="0">None</option><option value=".2">0.2 seconds</option><option value=".5">0.5 seconds</option><option value="1">1 second</option></select></div></div><div class="actions"><button id="clipAdd">Add clip</button><button id="clipSplit">Split at playhead</button><button id="clipUpdate">Update selected clip</button><button id="clipUndo">Undo</button><button id="clipRedo">Redo</button><button id="clipDuplicate">Duplicate clip</button><button id="clipRemove">Remove</button><button id="clipUp">Move up</button><button id="clipDown">Move down</button><button id="clipPlay">Preview timeline</button></div><p class="muted">Drag a clip to reorder it, or select a clip to edit it.</p><div id="clipTrack" role="list" aria-label="Visual timeline" style="display:flex;gap:6px;overflow-x:auto;padding:8px 0"></div><div class="tools"><div><label for="clipAudio">Optional soundtrack (audio file)</label><input id="clipAudio" type="file" accept="audio/*"></div><div><label for="clipAudioGain">Soundtrack volume</label><input id="clipAudioGain" type="range" min="0" max="100" value="70"></div><div><label for="clipVideoGain">Original video sound in mix</label><input id="clipVideoGain" type="range" min="0" max="100" value="100"></div><div><label for="clipAudioLoop"><input id="clipAudioLoop" type="checkbox"> Repeat soundtrack until timeline ends</label></div><div><label for="clipAudioFadeIn">Soundtrack fade in</label><select id="clipAudioFadeIn"><option value="0">None</option><option value="1">1 second</option><option value="2">2 seconds</option><option value="4">4 seconds</option></select></div><div><label for="clipAudioFadeOut">Soundtrack fade out</label><select id="clipAudioFadeOut"><option value="0">None</option><option value="1">1 second</option><option value="2">2 seconds</option><option value="4">4 seconds</option></select></div><div><label for="clipAudioOffset">Soundtrack placement on timeline (seconds)</label><input id="clipAudioOffset" type="number" min="0" max="600" step=".1" value="0"></div><div><label for="clipAudioStart">Soundtrack start position (seconds)</label><input id="clipAudioStart" type="number" min="0" max="600" step=".1" value="0"></div></div><p id="clipAudioStatus" class="muted">No separate soundtrack loaded. The audio file stays on this device and must be reselected after reopening.</p><div id="clipAudioTrack" role="status" aria-label="Soundtrack timeline lane" style="padding:8px;border:1px solid #7775;border-radius:8px;margin:8px 0">Audio lane: no soundtrack selected</div><div class="tools"><div><label for="clipPipFile">Picture-in-picture video (optional)</label><input id="clipPipFile" type="file" accept="video/*"></div><div><label for="clipPipSize">Overlay size</label><select id="clipPipSize"><option value=".25">Small</option><option value=".35" selected>Medium</option><option value=".5">Large</option></select></div><div><label for="clipPipPosition">Overlay position</label><select id="clipPipPosition"><option value="tr" selected>Top right</option><option value="tl">Top left</option><option value="br">Bottom right</option><option value="bl">Bottom left</option></select></div><div><label for="clipPipOffset">Overlay starts at (timeline seconds)</label><input id="clipPipOffset" type="number" min="0" max="600" step=".1" value="0"></div></div><p id="clipPipStatus" class="muted">No second video loaded. Picture-in-picture stays on this device; overlay audio is muted.</p><label for="clipList">Timeline clips</label><select id="clipList" size="5" aria-label="Timeline clips"></select><div class="tools"><div><label for="clipExportFps">Export frame rate</label><select id="clipExportFps"><option value="24">24 FPS</option><option value="30" selected>30 FPS</option><option value="60">60 FPS</option></select></div><div><label for="clipExportBitrate">Export video quality</label><select id="clipExportBitrate"><option value="2500000">Standard · 2.5 Mbps</option><option value="5000000" selected>High · 5 Mbps</option><option value="10000000">Very high · 10 Mbps</option></select></div></div><div class="actions"><button id="clipExport">Export timeline (MP4 / WebM)</button><button id="clipCancel" disabled>Stop preview/export</button><a id="clipDownload" download="heavenly-key-timeline.webm" hidden>Download timeline</a></div><div id="clipStatus" class="status" role="status">Load a video to begin.</div>';host.append(wrap);
let clips=[],undo=[],redo=[],session=null,exportUrl=null,activeClip=null,soundtrackUrl=null,pipUrl=null;
const pip=document.createElement('video');pip.muted=true;pip.playsInline=true;pip.preload='auto';
$('clipPipFile').addEventListener('change',()=>{if(session)return;pip.pause();pip.removeAttribute('src');pip.load();if(pipUrl)URL.revokeObjectURL(pipUrl);pipUrl=null;invalidateExport();const file=$('clipPipFile').files?.[0];if(!file){$('clipPipStatus').textContent='No second video loaded.';return;}if(!file.type.startsWith('video/')||file.size>150*1024*1024){$('clipPipFile').value='';$('clipPipStatus').textContent='Select a video under 150 MB.';return;}pipUrl=URL.createObjectURL(file);pip.src=pipUrl;$('clipPipStatus').textContent='Overlay loaded: '+file.name+' (muted)';});
for(const id of ['clipPipSize','clipPipPosition','clipPipOffset'])$(id).addEventListener('change',()=>{if(!session)invalidateExport()});
function syncPip(progress){if(!pipUrl||!Number.isFinite(pip.duration)||pip.duration<=0)return;const offset=Number($('clipPipOffset').value),t=progress-offset;if(t<0||t>=pip.duration){pip.pause();return;}if(Math.abs(pip.currentTime-t)>.45)pip.currentTime=t;if(pip.paused)pip.play().catch(()=>{if(session)session.cancelled=true});}

const dropZone=$('clipDropZone');
dropZone.addEventListener('dragover',e=>{if(session)return;e.preventDefault();e.dataTransfer.dropEffect='copy'});
dropZone.addEventListener('drop',e=>{
 e.preventDefault();
 if(session)return info('Stop preview or export before importing another video.');
 const file=[...(e.dataTransfer?.files||[])].find(f=>f.type.startsWith('video/')||/\.(mp4|webm|mov|m4v)$/i.test(f.name));
 if(!file)return info('Drop a supported video file such as MP4 or WebM.');
 $('vf').dispatchEvent(new CustomEvent('change',{detail:{file}}));
 info('Importing '+file.name+'…');
});

let soundtrack=document.createElement("audio");soundtrack.preload="auto";
const soundtrackStatus=$("clipAudioStatus");
function paintSoundtrack(){
 const lane=$('clipAudioTrack');lane.replaceChildren();
 if(!soundtrackUrl){lane.textContent='Audio lane: no soundtrack selected';return;}
 const start=Number($('clipAudioStart').value),offset=Number($('clipAudioOffset').value),vol=Number($('clipAudioGain').value),loop=$('clipAudioLoop').checked;
 const duration=Number.isFinite(soundtrack.duration)?soundtrack.duration:0;
 const span=document.createElement('div');
 span.textContent='Audio lane · '+(duration?duration.toFixed(2)+'s':'loading')+' · audio in-point '+(Number.isFinite(start)?start.toFixed(2):'invalid')+'s · timeline '+(Number.isFinite(offset)?offset.toFixed(2):'invalid')+'s · '+vol+'% soundtrack volume · '+$('clipVideoGain').value+'% original audio'+(loop?' · looping':'');
 span.style.overflowWrap='anywhere';lane.append(span);
 const bar=document.createElement('div');bar.style.height='8px';bar.style.borderRadius='5px';bar.style.marginTop='6px';bar.style.background='linear-gradient(90deg,#396bd5,#a6479b)';lane.append(bar);
}
soundtrack.addEventListener('loadedmetadata',paintSoundtrack);
for(const id of ["clipAudioGain","clipVideoGain","clipAudioLoop","clipAudioStart","clipAudioOffset","clipAudioFadeIn","clipAudioFadeOut"])$(id).addEventListener("change",()=>{if(!session){invalidateExport();paintSoundtrack()}});
function loadSoundtrack(file){
 if(session)return info('Stop preview or export before changing the soundtrack.');
 soundtrack.pause();soundtrack.removeAttribute("src");soundtrack.load();
 if(soundtrackUrl)URL.revokeObjectURL(soundtrackUrl);soundtrackUrl=null;invalidateExport();
 if(!file){soundtrackStatus.textContent="No separate soundtrack loaded.";paintSoundtrack();return;}
 if(!file.type.startsWith("audio/")||file.size>100*1024*1024){$("clipAudio").value="";soundtrackStatus.textContent="Choose an audio file smaller than 100 MB.";paintSoundtrack();return;}
 soundtrackUrl=URL.createObjectURL(file);soundtrack.src=soundtrackUrl;soundtrackStatus.textContent="Loaded: "+file.name+" (separate soundtrack)";paintSoundtrack();
}
$("clipAudio").addEventListener("change",()=>loadSoundtrack($("clipAudio").files?.[0]));
const audioLane=$("clipAudioTrack");
audioLane.setAttribute("tabindex","0");
audioLane.setAttribute("aria-label","Soundtrack timeline lane. Drop an audio file here.");
audioLane.addEventListener("dragover",event=>{if(session)return;event.preventDefault();event.dataTransfer.dropEffect="copy";});
audioLane.addEventListener("drop",event=>{event.preventDefault();if(session)return info('Stop preview or export before changing the soundtrack.');const file=[...(event.dataTransfer?.files||[])].find(f=>f.type.startsWith("audio/"));if(!file)return info('Drop a supported audio file.');loadSoundtrack(file);});
const info=t=>$('clipStatus').textContent=t;
const invalidateExport=()=>{if(exportUrl){URL.revokeObjectURL(exportUrl);exportUrl=null;}$('clipDownload').removeAttribute('href');$('clipDownload').hidden=true};
for(const id of ["clipExportFps","clipExportBitrate"])$(id).addEventListener("change",()=>{if(!session)invalidateExport()});
const save=()=>{invalidateExport();undo.push(JSON.stringify(clips));if(undo.length>40)undo.shift();redo=[]};
const chosen=()=>{const i=Number($('clipList').value);return $('clipList').value===''?-1:i};
function paint(selected=0){
 const list=$('clipList'),track=$('clipTrack');list.replaceChildren();track.replaceChildren();
 const total=clips.reduce((n,c)=>n+(c.end-c.start)/c.speed,0);
 clips.forEach((c,i)=>{
  const o=document.createElement('option');o.value=String(i);o.textContent=(i+1)+'. '+c.start.toFixed(2)+'–'+c.end.toFixed(2)+'s / '+c.speed+'×'+(c.fade?' / '+c.fade+'s fade':'');list.append(o);
  const tile=document.createElement('button');tile.type='button';tile.draggable=true;tile.dataset.index=String(i);
  tile.textContent=(i+1)+' · '+((c.end-c.start)/c.speed).toFixed(2)+'s';
  tile.title='Clip '+(i+1)+': '+c.start.toFixed(2)+' to '+c.end.toFixed(2)+' seconds. Drag to move.';
  tile.setAttribute('aria-label',tile.title);tile.style.flex='0 0 auto';tile.style.minWidth=Math.max(70,Math.min(220,70+((c.end-c.start)/c.speed)*12))+'px';track.append(tile);
 });
 if(clips.length)list.value=String(Math.min(clips.length-1,Math.max(0,selected)));else list.value='';
 [...track.children].forEach((tile,i)=>tile.setAttribute('aria-pressed',String(i===chosen())));
 info(clips.length+' clip(s), '+total.toFixed(2)+'s total.');
}
const track=$('clipTrack');let draggedIndex=-1;
track.addEventListener('click',event=>{const tile=event.target.closest('button[data-index]');if(!tile||session)return;$('clipList').value=tile.dataset.index;$('clipList').dispatchEvent(new Event('change'));[...track.children].forEach((t,i)=>t.setAttribute('aria-pressed',String(i===Number(tile.dataset.index))))});
track.addEventListener('dragstart',event=>{const tile=event.target.closest('button[data-index]');if(!tile||session){event.preventDefault();return;}draggedIndex=Number(tile.dataset.index);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(draggedIndex))});
track.addEventListener('dragover',event=>{if(!session&&draggedIndex>=0&&event.target.closest('button[data-index]'))event.preventDefault()});
track.addEventListener('drop',event=>{const tile=event.target.closest('button[data-index]');if(!tile||session||draggedIndex<0)return;event.preventDefault();const from=draggedIndex,to=Number(tile.dataset.index);draggedIndex=-1;if(from===to||!clips[from]||!clips[to])return;save();const [moved]=clips.splice(from,1);clips.splice(to,0,moved);paint(to)});
track.addEventListener('dragend',()=>{draggedIndex=-1});
track.addEventListener('keydown',event=>{
 const tile=event.target.closest('button[data-index]');
 if(!tile||session||!event.altKey||!['ArrowLeft','ArrowRight'].includes(event.key))return;
 event.preventDefault();
 const from=Number(tile.dataset.index),to=from+(event.key==='ArrowLeft'?-1:1);
 if(to<0||to>=clips.length)return;
 save();const [moved]=clips.splice(from,1);clips.splice(to,0,moved);paint(to);
 track.children[to]?.focus();
});

const ready=()=>Number.isFinite(v.duration)&&v.duration>0;
const seek=t=>new Promise((resolve,reject)=>{if(!ready())return reject(Error('Load a video first.'));t=Math.min(v.duration,Math.max(0,t));if(Math.abs(v.currentTime-t)<.02)return resolve();let timer;const done=()=>{clearTimeout(timer);v.removeEventListener('seeked',done);resolve()};timer=setTimeout(()=>{v.removeEventListener('seeked',done);reject(Error('Video seeking timed out.'))},10000);v.addEventListener('seeked',done);v.currentTime=t});
function setBusy(b){for(const id of ['vf','vexp','clipExport','clipPlay','clipAdd','clipSplit','clipUpdate','clipDuplicate','clipRemove','clipUp','clipDown','clipUndo','clipRedo','clipList','clipStart','clipEnd','clipSpeed','clipFade','clipAudio','clipAudioGain','clipVideoGain','clipAudioLoop','clipAudioStart','clipAudioOffset','clipAudioFadeIn','clipAudioFadeOut','clipExportFps','clipExportBitrate','clipPipFile','clipPipSize','clipPipPosition','clipPipOffset'])$(id).disabled=b;$('clipCancel').disabled=!b}
v.addEventListener('loadstart',()=>{if(session){session.cancelled=true;v.pause();}invalidateExport();clips=[];undo=[];redo=[];paint();info('Loading video. Previous timeline cleared to prevent editing the wrong file.');});
v.addEventListener('loadedmetadata',()=>{invalidateExport();$('clipStart').value='0';$('clipEnd').value=v.duration.toFixed(2);info('Video ready. Add a clip.')});
$('clipAdd').onclick=()=>{const start=Number($('clipStart').value),end=Number($('clipEnd').value),speed=Number($('clipSpeed').value),fade=Number($('clipFade').value);if(clips.length>=200)return info('Timeline limit is 200 clips.');if(!ready()||!Number.isFinite(start)||!Number.isFinite(end)||!Number.isFinite(speed)||!Number.isFinite(fade)||start<0||end<=start||end>v.duration+.02||speed<.25||speed>4||fade<0||fade>1)return info('Choose valid start, end, speed and fade settings.');save();clips.push({start,end:Math.min(end,v.duration),speed,fade});paint(clips.length-1)};
$('clipUpdate').onclick=()=>{const i=chosen(),current=clips[i];if(!current)return info('Select a clip to update.');const start=Number($('clipStart').value),end=Number($('clipEnd').value),speed=Number($('clipSpeed').value),fade=Number($('clipFade').value);if(!ready()||!Number.isFinite(start)||!Number.isFinite(end)||!Number.isFinite(speed)||start<0||end<=start||end>v.duration+.02||speed<.25||speed>4||!Number.isFinite(fade)||fade<0||fade>1)return info('Enter a valid clip start, end and playback speed.');save();clips[i]={start,end:Math.min(end,v.duration),speed,fade};paint(i)};
$('clipList').onchange=()=>{const c=clips[chosen()];if(c){$('clipStart').value=c.start;$('clipEnd').value=c.end;$('clipSpeed').value=String(c.speed);$('clipFade').value=String(c.fade||0);v.currentTime=c.start}};
$('clipSplit').onclick=()=>{const i=chosen(),c=clips[i],t=v.currentTime;if(clips.length>=200)return info('Timeline limit is 200 clips.');if(!c||t<=c.start+.05||t>=c.end-.05)return info('Select a clip and seek inside it.');save();clips.splice(i,1,{...c,end:t},{...c,start:t});paint(i)};
$('clipDuplicate').onclick=()=>{const i=chosen();if(i<0||clips.length>=200)return info('Select a clip; timeline limit is 200.');save();clips.splice(i+1,0,{...clips[i]});paint(i+1)};
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
 const offset=Number($('clipPipOffset').value);if(pipUrl&&(!Number.isFinite(offset)||offset<0||offset>600))return info('Overlay timeline offset must be between 0 and 600 seconds.');
 const state={cancelled:false};session=state;setBusy(true);
 const before=v.currentTime,rate=v.playbackRate,volume=v.volume;let rec=null,stream=null,audioContext=null,soundtrackNode=null,soundtrackGain=null;let elapsed=0;const audioStart=Number($('clipAudioStart').value),audioOffset=Number($('clipAudioOffset').value);
 try{
  const fragments=[];let finished;
  if(soundtrackUrl){
   const AudioContextClass=window.AudioContext||window.webkitAudioContext;
   if(!AudioContextClass)throw Error('Soundtrack mixing requires Web Audio support.');
   if(soundtrack.readyState<1){
    await new Promise((resolve,reject)=>{
     let timer;const cleanup=()=>{clearTimeout(timer);soundtrack.removeEventListener('loadedmetadata',loaded);soundtrack.removeEventListener('error',failed)};
     const loaded=()=>{cleanup();resolve()};const failed=()=>{cleanup();reject(Error('Cannot decode the selected soundtrack.'))};
     timer=setTimeout(()=>{cleanup();reject(Error('Soundtrack metadata timed out. Try another audio format.'))},10000);
     soundtrack.addEventListener('loadedmetadata',loaded);soundtrack.addEventListener('error',failed);
     soundtrack.load();
    });
   }
   if(!Number.isFinite(soundtrack.duration)||soundtrack.duration<=0)throw Error('Selected soundtrack has an invalid duration.');
   audioContext=new AudioContextClass();await audioContext.resume();
   const destination=audioContext.createMediaStreamDestination();
   if(!Number.isFinite(audioOffset)||audioOffset<0||audioOffset>600)throw Error('Soundtrack placement must be between 0 and 600 seconds.');
   if(!Number.isFinite(audioStart)||audioStart<0||audioStart>600||audioStart>=soundtrack.duration)throw Error('Soundtrack start must be within the audio duration (up to 600 seconds).');
   soundtrack.loop=$('clipAudioLoop').checked;
   const soundtrackSource=audioContext.createMediaElementSource(soundtrack);
   const fadeIn=Number($('clipAudioFadeIn').value),fadeOut=Number($('clipAudioFadeOut').value);
   if(![0,1,2,4].includes(fadeIn)||![0,1,2,4].includes(fadeOut))throw Error('Invalid soundtrack fades.');
   const gain=audioContext.createGain();soundtrackGain=gain;gain.gain.value=Number($('clipAudioGain').value)/100;
   soundtrackSource.connect(gain);gain.connect(destination);
   if(!record)gain.connect(audioContext.destination);
   soundtrackNode=destination;
  }
  if(record){
   const fps=Number($('clipExportFps').value),videoBitsPerSecond=Number($('clipExportBitrate').value);
   if(![24,30,60].includes(fps)||![2500000,5000000,10000000].includes(videoBitsPerSecond))throw Error('Choose a valid export frame rate and quality.');
   stream=canvas.captureStream(fps);
   if(soundtrackNode){
    try{if(v.captureStream){const original=v.captureStream();if(original.getAudioTracks().length){const source=audioContext.createMediaStreamSource(original);const originalGain=audioContext.createGain();originalGain.gain.value=Number($('clipVideoGain').value)/100;source.connect(originalGain);originalGain.connect(soundtrackNode)}}}catch{}
    for(const track of soundtrackNode.stream.getAudioTracks())stream.addTrack(track);
   }else{
    try{
     if(v.captureStream){
      const source=v.captureStream();
      const audioTracks=source.getAudioTracks();
      const videoGain=Number($('clipVideoGain').value)/100;
      if(audioTracks.length&&videoGain!==1){
       const AudioContextClass=window.AudioContext||window.webkitAudioContext;
       if(!AudioContextClass)throw Error('Original audio volume adjustment requires Web Audio support.');
       audioContext=new AudioContextClass();await audioContext.resume();
       const destination=audioContext.createMediaStreamDestination();
       const sourceNode=audioContext.createMediaStreamSource(source);
       const gainNode=audioContext.createGain();gainNode.gain.value=videoGain;
       sourceNode.connect(gainNode);gainNode.connect(destination);
       for(const track of destination.stream.getAudioTracks())stream.addTrack(track);
      }else for(const track of audioTracks)stream.addTrack(track);
     }
    }catch(error){throw Error('Unable to prepare original audio mix: '+error.message)}
   }
   rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond});
   finished=new Promise((resolve,reject)=>{rec.onstop=resolve;rec.onerror=e=>reject(e.error||Error('Encoder failed'))});
   rec.ondataavailable=e=>{if(e.data.size)fragments.push(e.data)};
   $('clipDownload').hidden=true;
  }
  for(let i=0;i<clips.length;i++){
   if(state.cancelled)break;
   const c=clips[i];v.pause();soundtrack.pause();pip.pause();activeClip=null;if(rec&&rec.state==='recording')rec.pause();await seek(c.start);v.playbackRate=c.speed;activeClip=c;
   if(state.cancelled)break;
   if(rec&&rec.state==='inactive')rec.start(250);
   info((record?'Exporting':'Previewing')+' clip '+(i+1)+' of '+clips.length);
   if(!record)v.volume=Number($('clipVideoGain').value)/100;
   await v.play();
   if(pipUrl)syncPip(elapsed);
   if(soundtrackUrl&&elapsed>=audioOffset&&Number.isFinite(soundtrack.duration)&&soundtrack.duration>0&&(soundtrack.loop||audioStart+elapsed-audioOffset<soundtrack.duration)){soundtrack.currentTime=soundtrack.loop?(audioStart+elapsed-audioOffset)%soundtrack.duration:audioStart+elapsed-audioOffset;await soundtrack.play();}
   if(state.cancelled){v.pause();break;}
   if(rec&&rec.state==='paused')rec.resume();
   await new Promise((resolve,reject)=>{
    let completed=false,timer;const finish=(err)=>{if(completed)return;completed=true;clearInterval(timer);v.removeEventListener('ended',end);v.removeEventListener('error',error);err?reject(err):resolve()};
    const end=()=>finish(),error=()=>finish(Error('Video playback failed'));
    v.addEventListener('ended',end);v.addEventListener('error',error);
    const started=Date.now(),maxMs=Math.max(15000,((c.end-c.start)/c.speed+12)*1000);
    timer=setInterval(()=>{const progress=elapsed+Math.max(0,(v.currentTime-c.start)/c.speed);if(pipUrl)syncPip(progress);if(soundtrackGain&&progress>=audioOffset&&soundtrack.paused&&(soundtrack.loop||audioStart+progress-audioOffset<soundtrack.duration)){soundtrack.currentTime=soundtrack.loop?(audioStart+progress-audioOffset)%soundtrack.duration:audioStart+progress-audioOffset;soundtrack.play().catch(()=>{state.cancelled=true;info('Soundtrack playback failed.');});}if(soundtrackGain){const fadeIn=Number($('clipAudioFadeIn').value),fadeOut=Number($('clipAudioFadeOut').value);const envelope=Math.max(0,Math.min(1,fadeIn?(progress-audioOffset)/fadeIn:1,fadeOut?(totalSeconds-progress)/fadeOut:1));soundtrackGain.gain.value=Number($('clipAudioGain').value)/100*(progress<audioOffset?0:envelope);}if(state.cancelled||v.currentTime>=c.end-.03||v.ended)return finish();if(Date.now()-started>maxMs||v.error)return finish(Error('Video playback stalled or timed out'))},40);
   });
   soundtrack.pause();pip.pause();elapsed+=(c.end-c.start)/c.speed;
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
 finally{activeClip=null;v.pause();soundtrack.pause();pip.pause();if(audioContext){await audioContext.close();soundtrack=document.createElement("audio");soundtrack.preload="auto";if(soundtrackUrl)soundtrack.src=soundtrackUrl;soundtrack.addEventListener("loadedmetadata",paintSoundtrack);paintSoundtrack();}v.playbackRate=rate;v.volume=volume;if(ready())v.currentTime=Math.min(before,v.duration);if(stream)stream.getTracks().forEach(t=>t.stop());session=null;setBusy(false)}
}
window.hkTimeline={
 drawOverlay:ctx=>{if(!session||!pipUrl||pip.readyState<2||pip.paused||!pip.videoWidth)return;const w=ctx.canvas.width,h=ctx.canvas.height,sz=Number($('clipPipSize').value),pos=$('clipPipPosition').value;if(![.25,.35,.5].includes(sz))return;const pw=w*sz,ph=pw*pip.videoHeight/pip.videoWidth,margin=w*.025,x=pos.endsWith('r')?w-pw-margin:margin,y=pos.startsWith('b')?h-ph-margin:margin;ctx.save();ctx.drawImage(pip,x,y,pw,ph);ctx.restore();},
 fadeOpacity:()=>{
  if(!session||!activeClip||!activeClip.fade)return 0;
  const c=activeClip,span=Math.min((c.end-c.start)/2,c.fade*c.speed);
  if(span<=0)return 0;
  return Math.max(0,Math.min(1,1-Math.min((v.currentTime-c.start)/span,(c.end-v.currentTime)/span)));
 },
 getSettings:()=>({
  audioGain:Number($('clipAudioGain').value),videoGain:Number($('clipVideoGain').value),
  audioLoop:$('clipAudioLoop').checked,audioStart:Number($('clipAudioStart').value),
  audioOffset:Number($('clipAudioOffset').value),fadeIn:Number($('clipAudioFadeIn').value),
  fadeOut:Number($('clipAudioFadeOut').value),fps:Number($('clipExportFps').value),
  bitrate:Number($('clipExportBitrate').value)
 }),
 restoreSettings:(data)=>{
  if(session)return info('Stop preview or export before restoring settings.');
  if(!data||typeof data!=='object'||Array.isArray(data))return;
  const numeric=[['audioGain','clipAudioGain',0,100],['videoGain','clipVideoGain',0,100],
   ['audioStart','clipAudioStart',0,600],['audioOffset','clipAudioOffset',0,600]];
  for(const [key,id,min,max] of numeric)if(Number.isFinite(data[key])&&data[key]>=min&&data[key]<=max)$(id).value=String(data[key]);
  for(const [key,id,allowed] of [['fadeIn','clipAudioFadeIn',[0,1,2,4]],['fadeOut','clipAudioFadeOut',[0,1,2,4]],
   ['fps','clipExportFps',[24,30,60]],['bitrate','clipExportBitrate',[2500000,5000000,10000000]]])
    if(allowed.includes(data[key]))$(id).value=String(data[key]);
  if(typeof data.audioLoop==='boolean')$('clipAudioLoop').checked=data.audioLoop;
  invalidateExport();paintSoundtrack();
 },
 getClips:()=>clips.map(c=>({...c})),
 restoreClips:(data)=>{
  if(session)return info('Stop preview or export before restoring a timeline.');
  if(!Array.isArray(data)||data.length>200)return info('Saved timeline is invalid or too long.');
  const valid=data.every(c=>c&&Number.isFinite(c.start)&&Number.isFinite(c.end)&&
    Number.isFinite(c.speed)&&c.start>=0&&c.end>c.start&&c.speed>=.25&&c.speed<=4&&
    (c.fade===undefined||(Number.isFinite(c.fade)&&c.fade>=0&&c.fade<=1)));
  if(!valid)return info('Saved timeline contains invalid clips.');
  invalidateExport();clips=data.map(c=>({start:c.start,end:c.end,speed:c.speed,fade:c.fade||0}));
  undo=[];redo=[];paint();info('Timeline restored. Reload the original video to preview or export.');
 }
};
document.addEventListener('keydown',event=>{
 if(host.hidden||session||$('vexp').disabled||event.altKey)return;
 const target=event.target;
 if(target?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target?.tagName))return;
 const mod=event.ctrlKey||event.metaKey;
 const key=event.key.toLowerCase();
 let action=null;
 if(mod&&key==='z')action=event.shiftKey?'clipRedo':'clipUndo';
 else if(mod&&key==='y')action='clipRedo';
 else if(!mod&&event.shiftKey&&key==='d')action='clipDuplicate';
 else if(!mod&&!event.shiftKey&&(key==='delete'||key==='backspace'))action='clipRemove';
 if(!action||$(action).disabled)return;
 event.preventDefault();$(action).click();
});
$('clipPlay').onclick=()=>runTimeline(false);$('clipExport').onclick=()=>runTimeline(true);
})();
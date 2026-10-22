/* Public broadcast viewer only. Runs inside the ministry-owned player frame. */
(function(){
'use strict';
const egressMode=false;
const $=(s,r=document)=>r.querySelector(s);
const text=(tag,value,cls)=>{const n=document.createElement(tag);n.textContent=value??'';if(cls)n.className=cls;return n;};
async function api(path){const r=await fetch(path,{headers:{Accept:'application/json'}});const d=await r.json();if(!r.ok)throw Error(d?.error?.message||'Broadcast unavailable.');return d;}
const button=(label,fn)=>{const b=text('button',label,'btn');b.type='button';b.addEventListener('click',async()=>{b.disabled=true;try{await fn();}catch(e){document.querySelector('[data-player-status]').textContent=e.message;}finally{b.disabled=false;}});return b;};
function player(panel){
 const channel=panel.dataset.broadcastPlayer,title=$('[data-programme-title]',panel),status=$('[data-player-status]',panel),list=$('[data-playlist]',panel),simple=panel.hasAttribute('data-simple-player'),audioVisual=$('[data-audio-visual]',panel),audioVisualTitle=$('[data-audio-visual-title]',panel);
 let el=$('audio,video',panel),items=[],index=0,signature='',mode='offline',liveKitRoom=null,liveAudioEl=null,youtubeId=null,youtubeFrame=null,userPlaying=false,retryTimer=null,audioVisualMode=false;
 const simpleSlot=$('[data-simple-play-control]',panel);
 const playback=text('div','','broadcast-playback-controls');
 const toggle=button('▶ PLAY WITH SOUND',async()=>{
  if(!items.length&&!liveKitRoom&&!youtubeId)await refresh();
  if(youtubeId){
   if(youtubeFrame){youtubeFrame.remove();youtubeFrame=null;userPlaying=false;syncToggle();status.textContent='Paused';return;}
   if(!youtubeFrame){youtubeFrame=document.createElement('iframe');youtubeFrame.className='ministry-youtube-player';youtubeFrame.title='Ministry broadcast';youtubeFrame.allow='autoplay; encrypted-media; fullscreen; picture-in-picture';youtubeFrame.allowFullscreen=true;youtubeFrame.referrerPolicy='strict-origin-when-cross-origin';youtubeFrame.src='https://www.youtube-nocookie.com/embed/'+youtubeId+'?autoplay=1&playsinline=1&origin='+encodeURIComponent(location.origin);el.hidden=true;panel.insertBefore(youtubeFrame,status);}
   userPlaying=true;syncToggle();status.textContent='Playing';return;
  }
  if(el.paused){
   el.muted=false;el.volume=1;if(liveKitRoom)await liveKitRoom.startAudio();
   try{await el.play();userPlaying=true;status.textContent='Playing';}catch{status.textContent='Tap PLAY again to start.';}
  }else{el.pause();userPlaying=false;status.textContent='Paused';}
  syncToggle();
 });
 toggle.className='broadcast-toggle-button';
 function syncToggle(){toggle.textContent=userPlaying&&(youtubeFrame||!el.paused)?'❚❚ PAUSE':'▶ PLAY WITH SOUND';toggle.setAttribute('aria-pressed',String(Boolean(userPlaying&&(youtubeFrame||!el.paused))));}
 if(simpleSlot)simpleSlot.append(playback);else panel.insertBefore(playback,list);playback.append(toggle);playback.hidden=egressMode;
 function scheduleReconnect(){clearTimeout(retryTimer);if(userPlaying&&!egressMode)retryTimer=setTimeout(async()=>{signature='';await refresh();if(!el.paused)syncToggle();},2500);}
 function bindMediaEvents(){
  el.addEventListener('ended',()=>{if(items.length&&mode==='playlist'&&userPlaying)select((index+1)%items.length,true);});
  el.addEventListener('play',()=>{userPlaying=true;syncToggle();status.textContent='Playing';});
  el.addEventListener('pause',()=>{if(!el.ended&&!el.error){userPlaying=false;syncToggle();}});
  el.addEventListener('waiting',()=>{status.textContent='Connecting…';});
  el.addEventListener('playing',()=>{userPlaying=true;syncToggle();status.textContent='Playing';});
  el.addEventListener('error',()=>{status.textContent='Connection interrupted. Reconnecting automatically…';scheduleReconnect();});
 }
 function setAudioVisual(active,programmeTitle=''){
  audioVisualMode=!!active;
  if(audioVisual){audioVisual.hidden=!audioVisualMode;audioVisual.setAttribute('aria-hidden',String(!audioVisualMode));}
  if(audioVisualTitle&&programmeTitle)audioVisualTitle.textContent=programmeTitle;
  if(el)el.classList.toggle('broadcast-audio-only-element',audioVisualMode);
 }
 function ensureMediaElement(kind){
  const wanted=kind==='video'?'video':'audio';
  if(el.tagName.toLowerCase()===wanted)return el;
  const next=document.createElement(wanted);
  next.controls=false;next.preload=egressMode?'auto':'none';next.autoplay=egressMode;next.muted=false;next.volume=1;
  if(wanted==='video'){next.playsInline=true;next.setAttribute('playsinline','');}
  el.pause();el.removeAttribute('src');el.srcObject=null;el.replaceWith(next);el=next;bindMediaEvents();return el;
 }
 ensureMediaElement(channel==='video'?'video':'audio');
 el.controls=false;el.muted=false;el.volume=1;el.preload=egressMode?'auto':'none';el.autoplay=egressMode;
 async function disconnectLiveKit(){if(liveKitRoom){try{await liveKitRoom.disconnect();}catch{}liveKitRoom=null;}if(liveAudioEl){try{liveAudioEl.pause();}catch{}liveAudioEl.remove();liveAudioEl=null;}el.srcObject=null;}
 async function connectLiveKit(r){
   await disconnectLiveKit();ensureMediaElement(channel==='video'?'video':'audio');status.textContent='Connecting…';
   const tokenResponse=await fetch('/api/broadcast/livekit/viewer-token',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});const token=await tokenResponse.json();
   if(!tokenResponse.ok)throw new Error(token?.error?.message||token?.error||'Live broadcast is unavailable.');
   const mod=await import('https://cdn.jsdelivr.net/npm/livekit-client@2.22.3/+esm');
   liveKitRoom=new mod.Room({adaptiveStream:true,dynacast:true});
   liveKitRoom.on(mod.RoomEvent.TrackSubscribed,(track)=>{if(track.kind==='audio'){if(channel==='radio'){track.attach(el);el.hidden=false;}else{if(!liveAudioEl){liveAudioEl=document.createElement('audio');liveAudioEl.autoplay=false;liveAudioEl.controls=false;liveAudioEl.hidden=true;panel.append(liveAudioEl);}track.attach(liveAudioEl);}}else if(channel==='video'&&track.kind==='video'){track.attach(el);el.hidden=false;}});
   liveKitRoom.on(mod.RoomEvent.Disconnected,()=>{if(userPlaying){status.textContent='Connection interrupted. Reconnecting automatically…';scheduleReconnect();}});
   await liveKitRoom.connect(token.url,token.token);title.textContent=token.title||r.title;status.textContent='Ready — tap PLAY WITH SOUND';
   if(egressMode){try{await liveKitRoom.startAudio();await el.play();status.textContent='LIVE';}catch{status.textContent='Connecting…';}}
 }
 function select(i,play=false){
  index=i;const item=items[i];if(!item)return;
  const kind=item.type==='video'?'video':'audio';ensureMediaElement(kind);
  setAudioVisual(channel==='video'&&kind==='audio',item.title);
  let url;try{url=new URL(item.url,location.origin);}catch{return;}if(url.protocol!=='https:'&&url.origin!==location.origin)return;
  el.srcObject=null;el.muted=false;el.volume=1;el.src=url.href;el.load();el.loop=mode==='scheduled'||mode==='live'||mode==='reconnecting';
  title.textContent=item.title;status.textContent='Ready — tap PLAY WITH SOUND';
  if(play||egressMode)el.play().then(()=>{userPlaying=true;syncToggle();status.textContent=egressMode?'ON AIR':'Playing';}).catch(()=>{status.textContent=egressMode?'Connecting…':'Tap PLAY to begin.';if(egressMode)setTimeout(()=>el.play().catch(()=>{}),1200);});
 }
 async function refresh(){
  try{
   let r=await api('/api/broadcast/programme?channel='+channel);
   if(channel==='video'&&!r.transport&&!(r.items||[]).length){
    const radioFallback=await api('/api/broadcast/programme?channel=radio');
    const audioOnly=(radioFallback.items||[]).filter(item=>item.type==='audio');
    if(audioOnly.length)r={...radioFallback,items:audioOnly,audio_visual:true,title:radioFallback.title||'ONLINE REVIVAL RADIO'};
   }
   const next=JSON.stringify(r.items||[])+r.mode+(r.transport||'')+(r.sessionId||'')+(r.title||'')+(r.videoId||'')+(r.audio_visual?'audio-visual':'');
   if(next===signature)return;signature=next;mode=r.mode;const wasPlaying=userPlaying&&!el.paused;items=r.items||[];list?.replaceChildren();youtubeFrame?.remove();youtubeFrame=null;youtubeId=null;
   if(r.transport==='youtube'){
    await disconnectLiveKit();ensureMediaElement(channel==='video'?'video':'audio');setAudioVisual(false);el.pause();el.removeAttribute('src');el.load();el.hidden=true;
    if(!/^[a-zA-Z0-9_-]{11}$/.test(r.videoId))throw Error('Invalid YouTube programme');youtubeId=r.videoId;title.textContent=r.title;status.textContent='Ready — tap PLAY WITH SOUND';syncToggle();return;
   }
   if(r.transport==='livekit'){setAudioVisual(false);await connectLiveKit(r);if(wasPlaying&&!egressMode){try{await liveKitRoom.startAudio();if(liveAudioEl)await liveAudioEl.play();await el.play();userPlaying=true;syncToggle();}catch{}}return;}
   await disconnectLiveKit();el.hidden=false;
   if(!items.length){setAudioVisual(false);el.hidden=true;el.pause();el.removeAttribute('src');el.load();userPlaying=false;syncToggle();title.textContent=channel==='radio'?'ONLINE REVIVAL RADIO':'Faith of Our Fathers TV';status.textContent='No programme is available right now.';return;}
   select(0,wasPlaying||egressMode);
  }catch(e){signature='';status.textContent=userPlaying?'Connection interrupted. Reconnecting automatically…':(e.message||'Broadcast unavailable.');scheduleReconnect();}
 }
 bindMediaEvents();document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});window.addEventListener('online',()=>{signature='';refresh();});refresh();setInterval(()=>{if(!document.hidden)refresh();},15000);
 }

player(document.querySelector('[data-broadcast-player]'));
})();

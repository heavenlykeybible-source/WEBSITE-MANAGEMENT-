import {HYMNS,FEATURED_HYMN,approvedHymn,coverage,AUDIO_CACHE} from './audio-hymn-catalog.js';
import {nextApprovedHymn} from './audio-playlist.js';
import {approvedBackground} from './audio-background-catalog.js';
import {createLockScreenSession} from './lock-screen-media.js';
const el=id=>document.getElementById(id),pick=el('hymn-select'),style=el('hymn-style'),audio=el('hymn-player');
const urlParams=new URLSearchParams(location.search);
const chooseFeatureStyle=()=>{if(HYMNS[idx]?.id===FEATURED_HYMN.id)style.value='featured';};
const music=el('hymn-background-player'),musicEnabled=el('hymn-with-music'),musicStart=el('hymn-music-start');
let idx=Math.max(0,HYMNS.findIndex(h=>h.id===urlParams.get('hymn'))),manifest=null,selected=null,stamp=0,blobUrl=null;
let playlistMode='off',backgroundTrack=null;
function musicStatus(value){el('hymn-music-status').textContent=value;}
function pauseMusic(){music.pause();}
function syncMusic(){
 if(!musicEnabled.checked||!backgroundTrack||audio.paused||style.value==='instrumental'){pauseMusic();return;}
 music.volume=Number(el('hymn-music-volume').value)/100;
 music.play().catch(()=>musicStatus('Use Start instrumental manually if your phone blocks automatic background music.'));
}
for(const h of HYMNS){const op=document.createElement('option');op.value=h.id;op.textContent=h.id===FEATURED_HYMN.id?'★ '+h.title+' · Heavenly Key AI Hymn':h.title;pick.append(op);}
chooseFeatureStyle();
function clearAudio(){audio.pause();pauseMusic();audio.removeAttribute('src');audio.load();if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl=null;}
function render(){
 stamp++;clearAudio();const h=HYMNS[idx];pick.value=h.id;
 el('hymn-title').textContent=h.title;el('hymn-info').textContent=h.author+' · '+h.theme+' · '+h.scripture;
 el('hymn-verse').textContent=h.stanza;el('hymn-original').href=h.textSource;
 selected=approvedHymn(manifest,h.id,style.value);
 lockScreen.update(selected?{title:h.title,artist:selected.performer,album:'Heavenly Key Audio Hymnal',artwork:new URL('icons/icon-192.png',location.href).href}:null);
 if(style.value==='instrumental'){musicEnabled.checked=false;pauseMusic();}
 musicEnabled.disabled=!backgroundTrack||style.value==='instrumental';
 musicStart.disabled=musicEnabled.disabled;
 el('hymn-player-area').hidden=!selected;
 if(selected){audio.src=selected.url;el('hymn-performer').textContent='Performance by '+selected.performer;el('hymn-status').textContent='Approved audio ready. Press Play.';el('hymn-save').disabled=!selected.offlineApproved;el('hymn-save').title=selected.offlineApproved?'Save an approved offline recording':'Streaming only: offline recording permission not granted';}
 else el('hymn-status').textContent='No approved '+style.value+' recording is hosted yet. Visit the free hymn collections above or read the text.';
 const locationUrl=new URL(location.href);locationUrl.searchParams.set('hymn',h.id);
 history.replaceState(null,'',locationUrl.pathname+locationUrl.search);
}
pick.addEventListener('change',()=>{const selectedIndex=HYMNS.findIndex(h=>h.id===pick.value);if(selectedIndex>=0){idx=selectedIndex;chooseFeatureStyle();render();}});
style.addEventListener('change',render);
function remoteSkip(direction){
 let n=idx;
 for(let offset=0;offset<HYMNS.length;offset++){
  n+=direction;
  if(n<0||n>=HYMNS.length)return;
  if(!approvedHymn(manifest,HYMNS[n].id,style.value))continue;
  idx=n;chooseFeatureStyle();render();
  audio.play().catch(()=>{el('hymn-status').textContent='Unlock your phone and press Play if the browser blocked the next hymn.';});
  return;
 }
}
const lockScreen=createLockScreenSession(audio,{
 onPrevious:()=>remoteSkip(-1),onNext:()=>remoteSkip(1)
});
el('hymn-playlist').addEventListener('change',event=>{
 playlistMode=['off','next','repeat'].includes(event.target.value)?event.target.value:'off';
});
el('hymn-voice-volume').addEventListener('input',event=>{
 const value=Number(event.target.value);audio.volume=value/100;el('hymn-voice-level').textContent=value+'%';
});
el('hymn-music-volume').addEventListener('input',event=>{
 const value=Number(event.target.value);music.volume=value/100;el('hymn-music-level').textContent=value+'%';
});
musicEnabled.addEventListener('change',()=>{
 if(!musicEnabled.checked){pauseMusic();musicStatus('Instrumental background switched off.');return;}
 syncMusic();
});
musicStart.addEventListener('click',()=>{
 if(!backgroundTrack||!selected||audio.paused){musicStatus('Start an approved singing recording first.');return;}
 musicEnabled.checked=true;syncMusic();
});
music.addEventListener('error',()=>{musicEnabled.checked=false;pauseMusic();musicStatus('Instrumental cannot be loaded. The hymn will play without background.');});
audio.addEventListener('play',syncMusic);
audio.addEventListener('pause',pauseMusic);
audio.addEventListener('ended',async()=>{
 pauseMusic();
 if(playlistMode==='off')return;
 const next=nextApprovedHymn(manifest,idx,style.value,playlistMode);
 if(!next){el('hymn-status').textContent='The approved hymn playlist has finished.';return;}
 idx=next.index;chooseFeatureStyle();render();
 try{await audio.play();}catch{el('hymn-status').textContent='Next approved hymn is ready. Press Play if your browser paused continuous playback.';}
});
for(const [id,delta] of [['hymn-prev',-1],['hymn-next',1]])el(id).addEventListener('click',()=>{idx=(idx+delta+HYMNS.length)%HYMNS.length;chooseFeatureStyle();render();});
audio.addEventListener('error',async()=>{
 const current=selected,id=stamp;if(!current||blobUrl)return;
 if(!current.offlineApproved||!('caches' in window)){
  el('hymn-status').textContent='Streaming failed. No authorized offline copy is available for this hymn.';return;
 }
 try{const cached=await(await caches.open(AUDIO_CACHE)).match(current.url);
 if(!cached||id!==stamp||selected?.url!==current.url)return;
 const blob=await cached.blob();if(!blob.size||id!==stamp||selected?.url!==current.url)return;
 blobUrl=URL.createObjectURL(blob);audio.src=blobUrl;audio.load();el('hymn-status').textContent='Offline hymn ready. Press Play.';
 }catch{if(id===stamp)el('hymn-status').textContent='Unable to stream this hymn.';}
});
el('hymn-save').addEventListener('click',async e=>{
 const track=selected,id=stamp;if(!track||!track.offlineApproved||!('caches' in window))return;const btn=e.currentTarget;btn.disabled=true;
 try{const response=await fetch(track.url,{mode:'cors',credentials:'omit',cache:'no-store'});
 if(!response.ok||response.type==='opaque'||!['audio/mpeg','audio/mp4','audio/x-m4a'].includes(response.headers.get('content-type')?.split(';')[0].trim()))throw Error('Unavailable');
 await(await caches.open(AUDIO_CACHE)).put(track.url,response);if(id===stamp)el('hymn-status').textContent='Hymn saved on this device.';
 }catch{if(id===stamp)el('hymn-status').textContent='Download failed. Check connection and media permissions.';}finally{btn.disabled=false;}
});
el('hymn-remove').addEventListener('click',async e=>{
 const track=selected,id=stamp;if(!track||!('caches' in window))return;const btn=e.currentTarget;btn.disabled=true;
 try{await(await caches.open(AUDIO_CACHE)).delete(track.url);if(id===stamp){clearAudio();audio.src=track.url;el('hymn-status').textContent='Offline recording removed.';}}
 catch{if(id===stamp)el('hymn-status').textContent='Offline removal failed.';}finally{btn.disabled=false;}
});
// Screen lock is not a pause event: preserve the user-started audio session.
window.addEventListener('pagehide',()=>{lockScreen.dispose();clearAudio();pauseMusic();});
async function loadInstrumental(){
 try{
  const res=await fetch('audio-background-manifest.json',{cache:'no-cache'});
  if(!res.ok)throw Error('No catalogue');
  backgroundTrack=approvedBackground(await res.json());
  if(!backgroundTrack){musicStatus('The Faith of Our Fathers instrumental recording is awaiting approval. Background stays off.');return;}
  music.src=backgroundTrack.url;music.preload='none';music.loop=true;music.volume=Number(el('hymn-music-volume').value)/100;
  musicEnabled.disabled=style.value==='instrumental';musicStart.disabled=musicEnabled.disabled;
  musicStatus('Instrumental by '+backgroundTrack.performer+' approved; optional background is ready.');
 }catch{musicStatus('Approved instrumental is unavailable. Choir and solo recordings can still play.');}
}
loadInstrumental();
try{const response=await fetch('audio-hymn-manifest.json',{cache:'no-cache'});if(!response.ok)throw Error('Unavailable');
 manifest=await response.json();el('hymn-count').textContent=coverage(manifest)+' approved Heavenly Key recordings · free external hymn collections above.';
}catch{el('hymn-count').textContent='Internal audio catalogue unavailable · free collections above remain accessible.';}
render();


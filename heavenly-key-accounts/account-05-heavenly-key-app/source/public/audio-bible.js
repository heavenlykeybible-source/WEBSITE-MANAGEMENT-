/* Rights-gated human or owner-authorized AI voice narration; never downloads audio automatically. */
import {KJV_BOOKS} from './bible-catalog.js';
import {AUDIO_CACHE,AUDIO_CHAPTER_TOTAL,bookId,approvedTrack,audioCoverage,adjacentChapter} from './audio-bible-catalog.js';
import {nextApprovedBible} from './audio-playlist.js';
import {approvedBackground} from './audio-background-catalog.js';
import {createLockScreenSession} from './lock-screen-media.js';
const byId=id=>document.getElementById(id);
const book=byId('audio-book'),chapter=byId('audio-chapter'),audio=byId('audio-player');
const ready=byId('audio-ready'),status=byId('audio-status'),coverage=byId('audio-coverage'),title=byId('audio-title'),narrator=byId('audio-narrator'),read=byId('audio-read');
const select=(value,label)=>{const opt=document.createElement('option');opt.value=value;opt.textContent=label;return opt;};
for(const b of KJV_BOOKS)book.append(select(bookId(b),b.name));
const params=new URLSearchParams(location.search);
const requested=params.get('book')?.toLowerCase().replaceAll(' ','-');
book.value=bookId(KJV_BOOKS.find(b=>bookId(b).replaceAll('-','')===String(requested||'').replaceAll('-',''))||KJV_BOOKS.find(b=>bookId(b)==='john'));
const musicPlayer=byId('audio-background-player');
const musicEnabled=byId('audio-with-music');
const manualMusic=byId('audio-music-start');
let manifest=null,selectedTrack=null,blobUrl=null,playlistMode='off',loadSerial=0,backgroundTrack=null;
function pauseBackground(){musicPlayer.pause();}
function musicStatus(msg){byId('audio-music-status').textContent=msg;}
function syncMusic(){
 if(!musicEnabled.checked||!backgroundTrack||audio.paused){pauseBackground();return;}
 musicPlayer.volume=Number(byId('audio-music-volume').value)/100;
 musicPlayer.play().catch(()=>musicStatus('Instrumental available, but your browser needs a tap on Start instrumental manually.'));
}
function setStatus(message){status.textContent=message;}
function releaseBlob(){if(blobUrl){URL.revokeObjectURL(blobUrl);blobUrl=null;}}
function stopAudio(){
 audio.pause();pauseBackground();
 audio.removeAttribute('src');audio.load();releaseBlob();
}
function resetChapters(chosen=1){
 const b=KJV_BOOKS.find(x=>bookId(x)===book.value);
 chapter.replaceChildren(...Array.from({length:b.chapters},(_,i)=>select(String(i+1),'Chapter '+(i+1))));
 chapter.value=String(Math.max(1,Math.min(b.chapters,Number(chosen)||1)));
}
resetChapters(Number(params.get('chapter')||1));
function currentKey(){return {book:book.value,chapter:Number(chapter.value)};}
function updateChapter(){
 loadSerial++;
 stopAudio();
 const ref=currentKey(),b=KJV_BOOKS.find(x=>bookId(x)===ref.book);
 title.textContent=b.name+' '+ref.chapter+' · KJV';
 read.href='bible.html?book='+encodeURIComponent(ref.book)+'&chapter='+ref.chapter;
 const u=new URL(location.href);u.searchParams.set('book',ref.book);u.searchParams.set('chapter',String(ref.chapter));history.replaceState(null,'',u.pathname+u.search);
 selectedTrack=approvedTrack(manifest,ref.book,ref.chapter,location.origin);
 ready.hidden=!selectedTrack;
 byId('audio-save').disabled=!selectedTrack?.offlineApproved;
 byId('audio-remove').disabled=!selectedTrack?.offlineApproved;
 narrator.textContent=selectedTrack?(selectedTrack.narration==='authorized_voice_clone'?'AI-generated narration in the authorized voice of ':'Natural human narration by ')+selectedTrack.narrator:'';
 lockScreen.update(selectedTrack?{
  title:b.name+' '+ref.chapter+' · KJV',artist:selectedTrack.narrator,
  album:'Heavenly Key Audio Bible',artwork:new URL('icons/icon-192.png',location.href).href
 }:null);
 if(!selectedTrack){
  setStatus('Narration of this chapter has not yet been released. You can read the KJV text now. No recordings are published without review and voice/Scripture rights clearance.');
  return;
 }
 audio.src=selectedTrack.url;audio.playbackRate=Number(byId('audio-speed').value);audio.preload='none';
 setStatus('Approved chapter ready. Press Play to listen; no audio starts automatically.');
}
function changeRef(ref){book.value=ref.book;resetChapters(ref.chapter);updateChapter();}
function remoteSkip(direction){
 let next=currentKey();
 for(let i=0;i<AUDIO_CHAPTER_TOTAL;i++){
  next=adjacentChapter(next.book,next.chapter,direction);
  if(!next)return;
  if(!approvedTrack(manifest,next.book,next.chapter,location.origin))continue;
  changeRef(next);
  audio.play().catch(()=>setStatus('Unlock your phone and press Play if your browser blocked the new chapter.'));
  return;
 }
}
const lockScreen=createLockScreenSession(audio,{
 onPrevious:()=>remoteSkip(-1),onNext:()=>remoteSkip(1)
});
book.addEventListener('change',()=>{resetChapters(1);updateChapter();});
chapter.addEventListener('change',updateChapter);
byId('audio-prev').addEventListener('click',()=>{const current=currentKey(),prev=adjacentChapter(current.book,current.chapter,-1);if(prev)changeRef(prev);});
byId('audio-next').addEventListener('click',()=>{const current=currentKey(),next=adjacentChapter(current.book,current.chapter,1);if(next)changeRef(next);});
byId('audio-speed').addEventListener('change',e=>{audio.playbackRate=Number(e.target.value);});
byId('audio-playlist').addEventListener('change',e=>{
 playlistMode=['off','next','repeat'].includes(e.target.value)?e.target.value:'off';
 if(playlistMode==='off')setStatus('Continuous playlist disabled. Choose Play on any released chapter.');
 else setStatus('Playlist enabled. Press Play on a released chapter to begin.');
});
byId('audio-voice-volume').addEventListener('input',e=>{
 const level=Number(e.target.value);
 audio.volume=level/100;byId('audio-voice-level').textContent=level+'%';
});
byId('audio-music-volume').addEventListener('input',e=>{
 const level=Number(e.target.value);
 musicPlayer.volume=level/100;byId('audio-music-level').textContent=level+'%';
});
musicEnabled.addEventListener('change',()=>{
 if(!musicEnabled.checked){pauseBackground();musicStatus('Instrumental background switched off.');return;}
 syncMusic();
});
manualMusic.addEventListener('click',()=>{
 if(!backgroundTrack||!selectedTrack||audio.paused){musicStatus('Start the approved Bible recording first.');return;}
 musicEnabled.checked=true;syncMusic();
});
musicPlayer.addEventListener('error',()=>{pauseBackground();musicEnabled.checked=false;musicStatus('Instrumental file cannot be loaded. Music is off.');});
audio.addEventListener('pause',pauseBackground);
byId('audio-stop').addEventListener('click',()=>{
 stopAudio();
 if(selectedTrack)audio.src=selectedTrack.url; // reset to start; preload stays none
 setStatus('Playback stopped. Press Play to listen again.');
});
async function findOffline(track){
 if(!('caches' in window))return null;
 try{return await (await caches.open(AUDIO_CACHE)).match(track.url);}catch{return null;}
}
async function useOfflineTrack(track,serial=loadSerial){
 const saved=await findOffline(track);
 if(!saved||serial!==loadSerial||selectedTrack?.url!==track.url)return false;
 const file=await saved.blob();
 if(!file.size||serial!==loadSerial||selectedTrack?.url!==track.url)return false;
 releaseBlob();blobUrl=URL.createObjectURL(file);
 audio.pause();audio.src=blobUrl;audio.load();audio.playbackRate=Number(byId('audio-speed').value);
 return true;
}
audio.addEventListener('error',async()=>{
 const track=selectedTrack,serial=loadSerial;
 if(!track||blobUrl||!audio.getAttribute('src')||serial!==loadSerial)return;
 if(!track.offlineApproved){setStatus('Streaming failed. Offline recovery is not permitted for this recording.');return;}
 const found=await useOfflineTrack(track,serial);
 if(serial!==loadSerial||selectedTrack?.url!==track.url)return;
 if(found)setStatus('Streaming unavailable; saved offline audio is ready. Press Play again.');
 else setStatus('Unable to stream this chapter. Check internet access or save it while online.');
});
audio.addEventListener('play',()=>{setStatus('Playing '+title.textContent+'.');syncMusic();});
audio.addEventListener('ended',async()=>{
 pauseBackground();
 if(playlistMode==='off')return;
 const ref=currentKey(),next=nextApprovedBible(manifest,ref,playlistMode,location.origin);
 if(!next){setStatus('Playlist finished. No more approved Bible recordings are available.');return;}
 changeRef(next);
 const nextTrack=selectedTrack,serial=loadSerial;
 if(!nextTrack)return;
 if(!navigator.onLine&&nextTrack.offlineApproved)await useOfflineTrack(nextTrack,serial);
 if(serial!==loadSerial||selectedTrack?.url!==nextTrack.url)return;
 try{await audio.play();}catch{
  if(serial===loadSerial)setStatus('Next approved chapter is ready. Press Play to continue; your browser blocked automatic playback.');
 }
});
byId('audio-save').addEventListener('click',async e=>{
 const track=selectedTrack,serial=loadSerial,button=e.currentTarget;
 if(!track?.offlineApproved){setStatus('Offline download is not permitted for this recording. Streaming remains available.');return;}
 if(!('caches' in window)){setStatus('Offline audio is not supported by this browser.');return;}
 button.disabled=true;setStatus('Saving this chapter on your device… This uses mobile data and storage.');
 try{
  const res=await fetch(track.url,{mode:'cors',credentials:'omit',cache:'no-store'});
  if(!res.ok||res.type==='opaque'||!(res.headers.get('content-type')||'').toLowerCase().includes('audio/'))throw Error('Audio host must provide a permitted audio file with CORS enabled.');
  const cache=await caches.open(AUDIO_CACHE);await cache.put(track.url,res);
  if(serial===loadSerial)setStatus('Audio chapter saved for offline listening on this device. Browser storage may be cleared automatically.');
 }catch(e){if(serial===loadSerial)setStatus('Unable to save audio. Check space, network access and audio-host CORS permissions.');}
 finally{button.disabled=false;}
});
byId('audio-remove').addEventListener('click',async e=>{
 if(!selectedTrack?.offlineApproved||!('caches' in window))return;
 const track=selectedTrack,serial=loadSerial,button=e.currentTarget;button.disabled=true;
 try{
  await(await caches.open(AUDIO_CACHE)).delete(track.url);
  if(serial===loadSerial&&selectedTrack?.url===track.url){stopAudio();audio.src=track.url;setStatus('Downloaded audio for this chapter removed from this device.');}
 }
 catch{setStatus('Unable to remove saved audio at present.');}
 finally{button.disabled=false;}
});
// Never deliberately pause the active recording simply because a phone screen locks.
window.addEventListener('pagehide',()=>{lockScreen.dispose();stopAudio();pauseBackground();});
async function loadInstrumental(){
 try{
  const res=await fetch('audio-background-manifest.json',{cache:'no-cache'});
  if(!res.ok)throw Error('Instrumental catalogue unavailable');
  backgroundTrack=approvedBackground(await res.json());
  if(!backgroundTrack){musicStatus('Faith of Our Fathers instrumental is awaiting approved recording rights. Music is off.');return;}
  musicPlayer.src=backgroundTrack.url;
  musicPlayer.preload='none';musicPlayer.loop=true;musicPlayer.volume=Number(byId('audio-music-volume').value)/100;
  musicEnabled.disabled=false;manualMusic.disabled=false;
  musicStatus('Approved instrumental available: '+backgroundTrack.performer+'. Music is optional.');
 }catch{musicStatus('Background music catalogue unavailable. Playback remains voice-only.');}
}
loadInstrumental();
try{
 const response=await fetch('audio-bible-manifest.json',{cache:'no-cache'});
 if(!response.ok)throw Error('Catalogue unavailable');
 manifest=await response.json();
 coverage.textContent=audioCoverage(manifest,location.origin)+' / '+AUDIO_CHAPTER_TOTAL+' chapters currently approved for playback';
 updateChapter();
}catch{
 coverage.textContent='Narrated audio catalogue temporarily unavailable.';
 updateChapter();
 setStatus('Audio catalogue unavailable. You can still read the selected KJV chapter.');
}


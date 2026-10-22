/* Lock-screen media controls for user-started HTML audio, with no auto-downloads. */
export function createLockScreenSession(audio,handlers={},deps={}){
 const nav=deps.navigator ?? (typeof navigator!=='undefined'?navigator:null);
 const session=nav?.mediaSession;
 const Metadata=deps.MediaMetadata ?? (typeof MediaMetadata!=='undefined'?MediaMetadata:null);
 if(!session||!audio)return {update:()=>false,dispose:()=>{}};
 const registered=[];
 function action(name,fn){
  if(typeof session.setActionHandler!=='function')return;
  try{session.setActionHandler(name,fn);registered.push(name);}
  catch{ /* the browser may not support this media action */ }
 }
 const state=value=>{try{session.playbackState=value;}catch{}};
 action('play',()=>{const p=audio.play();if(p&&typeof p.catch==='function')p.catch(()=>{});});
 action('pause',()=>audio.pause());
 action('stop',()=>{audio.pause();try{audio.currentTime=0;}catch{}});
 action('previoustrack',()=>handlers.onPrevious?.());
 action('nexttrack',()=>handlers.onNext?.());
 action('seekbackward',e=>{const step=Number.isFinite(e?.seekOffset)?e.seekOffset:15;
  try{audio.currentTime=Math.max(0,audio.currentTime-step);}catch{}});
 action('seekforward',e=>{const step=Number.isFinite(e?.seekOffset)?e.seekOffset:15;
  try{audio.currentTime=Math.min(Number.isFinite(audio.duration)?audio.duration:Infinity,audio.currentTime+step);}catch{}});
 action('seekto',e=>{if(!Number.isFinite(e?.seekTime))return;
  try{audio.currentTime=Math.max(0,Math.min(Number.isFinite(audio.duration)?audio.duration:Infinity,e.seekTime));}catch{}});
 const playing=()=>state('playing'),pause=()=>state('paused');
 audio.addEventListener('playing',playing);
 audio.addEventListener('pause',pause);
 audio.addEventListener('ended',pause);
 function update(info){
  if(!info){try{session.metadata=null;}catch{}return false;}
  if(!Metadata||!String(info.title||'').trim())return false;
  const artwork=typeof info.artwork==='string'&&/^https?:\/\//.test(info.artwork)
   ?[{src:info.artwork,sizes:'192x192',type:'image/png'}]:[];
  try{session.metadata=new Metadata({
   title:String(info.title),artist:String(info.artist||''),
   album:String(info.album||'Heavenly Key Evangelistic Movement'),artwork
  });return true;}catch{return false;}
 }
 function dispose(){
  audio.removeEventListener('playing',playing);
  audio.removeEventListener('pause',pause);
  audio.removeEventListener('ended',pause);
  for(const name of registered)try{session.setActionHandler(name,null);}catch{}
  try{session.metadata=null;}catch{}
  state('none');
 }
 return {update,dispose};
}

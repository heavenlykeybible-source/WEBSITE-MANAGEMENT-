/** Standalone Account 2 radio player. No autoplay or external audio engine. */
export function radioPlayerHtml():Response {
 const nonce=Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
 const html=`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#10264b"><title>Heavenly Key — Online Revival Radio</title>
<style nonce="${nonce}">
:root{color-scheme:dark;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:linear-gradient(145deg,#0b162e,#12386b 58%,#102545);color:#fff;display:grid;place-items:center;padding:24px}
main{width:min(100%,560px);background:#08172bbd;border:1px solid #ffffff29;border-radius:26px;padding:clamp(20px,5vw,36px);box-shadow:0 25px 90px #0006}
h1{font-size:clamp(25px,5vw,36px);line-height:1.15;margin:8px 0 4px}p{line-height:1.5;color:#d5e4ff}
small,.hint{color:#bdcfe7}.tag{color:#f5cb64;text-transform:uppercase;letter-spacing:.13em;font-weight:800;font-size:12px}
.track{font-weight:700;font-size:21px;margin:24px 0 12px;overflow-wrap:anywhere}
button{border:0;border-radius:100px;background:#f3c957;color:#172644;padding:14px 20px;font:inherit;font-weight:800;cursor:pointer;min-height:48px}
button.secondary{background:#dce7f5;color:#183356}button:disabled{opacity:.55;cursor:not-allowed}
.controls{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0}label{display:flex;align-items:center;gap:12px;margin:18px 0}
input[type=range]{accent-color:#f3c957;flex:1;min-width:60px}
#status{min-height:48px}#devices{margin-top:12px}#devices[hidden]{display:none}
#output{margin-top:10px}a{color:#ffe5a0}
</style></head>
<body><main>
<div class="tag">Heavenly Key Evangelistic Movement</div><h1>Online Revival Radio</h1>
<p>Revival • Holiness • Power</p>
<div class="track" id="track">Ready to listen</div>
<p id="status" role="status" aria-live="polite">Press Play to begin. The radio uses no continuously running playout server.</p>
<div class="controls">
<button id="play" type="button" aria-label="Play radio">▶ Play Radio</button>
<button id="next" type="button" class="secondary" disabled>Next track</button>
<button id="retry" type="button" class="secondary">Refresh playlist</button>
</div>
<label for="volume">Volume <input id="volume" type="range" min="0" max="100" value="80"><output id="volumeValue">80%</output></label>
<div id="devices"><button class="secondary" id="output" type="button">🔊 Bluetooth / audio output</button>
<p class="hint" id="outputHelp">Connect your Bluetooth speaker or headphones in your device settings. Audio follows the selected system output.</p></div>
<p class="hint">Television is locked. Audio plays only when you press Play; playback stops when you pause or leave this page.</p>
<audio id="audio" preload="none" playsinline></audio>
</main>
<script nonce="${nonce}">
(()=>{'use strict';
const audio=document.getElementById('audio'),play=document.getElementById('play'),next=document.getElementById('next'),retry=document.getElementById('retry'),title=document.getElementById('track'),status=document.getElementById('status'),volume=document.getElementById('volume'),volumeValue=document.getElementById('volumeValue'),output=document.getElementById('output'),outputHelp=document.getElementById('outputHelp');
let playlist=[],position=0,playing=false,loadGeneration=0,playGeneration=0;
const setPaused=message=>{++playGeneration;playing=false;play.textContent='▶ Play Radio';play.setAttribute('aria-label','Play radio');if(message)say(message)};
const say=message=>{status.textContent=message};
const validItem=item=>item&&item.type==='audio'&&typeof item.url==='string'&&/^\\/api\\/broadcast\\/media\\/\\d+\\/object$/.test(item.url);
async function refresh(){
 const generation=++loadGeneration;
 say('Loading approved radio recordings…');
 try{
 const response=await fetch('/api/broadcast/programme?channel=radio&delivery=on-demand',{headers:{'X-Heavenly-Key-Internal':'media-engine-public-v1'},cache:'no-store'});
 if(!response.ok)throw Error('Radio playlist is unavailable ('+response.status+').');
 const result=await response.json();
 if(generation!==loadGeneration)return;
 const items=Array.isArray(result.items)?result.items.filter(validItem):[];
 ++playGeneration;audio.pause();audio.removeAttribute('src');audio.load();playing=false;play.textContent='▶ Play Radio';play.setAttribute('aria-label','Play radio');
 playlist=items;position=0;next.disabled=!items.length;
 if(!items.length){title.textContent='No radio recordings available';say('The radio playlist is currently empty.');return;}
 title.textContent=items[0].title||'Radio programme';
 say('Playlist ready. Press Play to listen.');
 }catch(error){if(generation!==loadGeneration)return;++playGeneration;audio.pause();audio.removeAttribute('src');audio.load();playing=false;play.textContent='▶ Play Radio';play.setAttribute('aria-label','Play radio');playlist=[];next.disabled=true;title.textContent='Playlist unavailable';say('Could not load radio: '+(error instanceof Error?error.message:'Try again.'));}
}
function select(index){
 if(!playlist.length)return false;
 ++playGeneration;position=(index+playlist.length)%playlist.length;
 const item=playlist[position];audio.src=item.url;title.textContent=item.title||'Radio programme';if('mediaSession' in navigator&&typeof MediaMetadata==='function')navigator.mediaSession.metadata=new MediaMetadata({title:item.title||'Radio programme',artist:'Heavenly Key Evangelistic Movement'});return true;
}
async function start(){
 let generation=0;
 try{if(!playlist.length){say('No radio recordings are available.');return;}
 if(!audio.getAttribute('src'))select(position);
 generation=++playGeneration;await audio.play();if(generation!==playGeneration)return;playing=true;play.textContent='⏸ Pause';play.setAttribute('aria-label','Pause radio');say('Playing • '+(position+1)+' of '+playlist.length);}
 catch{if(generation===playGeneration)setPaused('Audio could not play. Check your connection, audio output, or try the next recording.');}
}
play.addEventListener('click',async()=>{if(!playlist.length){say('Playlist not ready. Press Refresh playlist, then Play.');return;}if(!audio.paused){audio.pause();setPaused('Paused.');return;}await start()});
next.addEventListener('click',async()=>{if(!select(position+1))return;if(playing)await start();else say('Next recording ready. Press Play.')});
retry.addEventListener('click',async()=>{const resume=playing;++playGeneration;audio.pause();audio.removeAttribute('src');audio.load();playing=false;play.textContent='▶ Play Radio';await refresh();if(resume&&playlist.length)say('Playlist refreshed. Press Play to resume.')});
audio.addEventListener('ended',()=>{if(!playlist.length)return;const continuePlaying=playing;select(position+1);if(continuePlaying)void start()});
audio.addEventListener('pause',()=>{if(playing&&audio.paused&&!audio.ended)setPaused('Paused.');});
window.addEventListener('pagehide',()=>{audio.pause();setPaused();});
audio.addEventListener('error',()=>{if(audio.getAttribute('src'))setPaused('This recording cannot be loaded. Try Next or Refresh playlist.')});
audio.addEventListener('waiting',()=>{if(playing)say('Buffering radio audio…')});
audio.addEventListener('playing',()=>{if(playing)say('Playing • '+(position+1)+' of '+playlist.length)});
window.addEventListener('offline',()=>{if(playing)say('Network connection lost. Audio will resume if the browser can reconnect.')});
window.addEventListener('online',()=>{if(playing)say('Connection restored. If audio does not resume, press Pause then Play.')});
volume.addEventListener('input',()=>{audio.volume=Number(volume.value)/100;volumeValue.textContent=volume.value+'%'});
audio.volume=.8;
output.addEventListener('click',async()=>{
 if(typeof navigator.mediaDevices?.selectAudioOutput!=='function'||typeof audio.setSinkId!=='function'){
 outputHelp.textContent='Use your phone or computer Bluetooth settings to connect a speaker or headset. The radio follows the system audio output.';return;
 }
 try{const device=await navigator.mediaDevices.selectAudioOutput();await audio.setSinkId(device.deviceId);outputHelp.textContent='Audio output selected. Your device controls Bluetooth pairing.';}
 catch{outputHelp.textContent='Audio output was not changed. You can choose a device in your system settings.';}
});
if(typeof navigator.mediaDevices?.selectAudioOutput!=='function'||typeof audio.setSinkId!=='function')output.textContent='🔊 Bluetooth setup help';
if('mediaSession' in navigator){if(typeof MediaMetadata==='function')navigator.mediaSession.metadata=new MediaMetadata({title:'Online Revival Radio',artist:'Heavenly Key Evangelistic Movement'});try{navigator.mediaSession.setActionHandler('play',()=>{void start()});navigator.mediaSession.setActionHandler('pause',()=>{audio.pause();setPaused('Paused.')});navigator.mediaSession.setActionHandler('nexttrack',()=>next.click())}catch{}}
void refresh();
})();
</script></body></html>`;
 return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'speaker-selection=(self)','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; media-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`}});
}

/* Exact approved artwork; one audio connection per player, never autoplay. */
(function(){
'use strict';if(!window.__hkApprovedPublicShell)return;if(/^(?:bible|global|community|radio|studio|control|app)\./.test(location.hostname)||/^\/(?:pages\/)?radio(?:\.html)?\/?$/.test(location.pathname)||/^\/(?:bible|community)(?:\/|$)/.test(location.pathname))return;
if(document.getElementById('hk-floating-radio'))return;
const mount=document.getElementById('hk-radio-page-mount');
if(!document.querySelector('link[href*="radio-approved-number-one.css"]')){const css=document.createElement('link');css.rel='stylesheet';css.href='/css/radio-approved-number-one.css?v=20261020f';document.head.append(css)}
const root=document.createElement('aside');root.id='hk-floating-radio';root.dataset.hkApprovedWidget='radio';root.className=mount?'hkr-page':'hkr-mini';root.setAttribute('aria-label','Heavenly Key Radio');
root.innerHTML=`<button class="hkr-bubble" type="button" aria-label="Open Heavenly Key Radio" aria-expanded="false"><img src="/assets/ministry/approved-radio-transparent-original.png" alt="Heavenly Key Radio — Listen Now"><span class="hk-launcher-title">HEAVENLY KEY RADIO</span><span class="hk-launcher-tagline">Taking Christ to the Nations of the World.</span><span class="hkr-launch-mode" aria-hidden="true">RADIO</span><span class="hk-launch-signal" aria-hidden="true"></span></button><section class="hkr-art-player" aria-label="Heavenly Key Radio player"><img class="hkr-artwork" src="/assets/ministry/approved-radio-display-20261017.webp" alt="Heavenly Key Evangelistic Movement — Heavenly Key Radio. Jesus only is our message."><div class="hkr-art-tools"><button type="button" class="hkr-popout" aria-label="Open a separate radio player to keep listening while browsing">↗</button><button type="button" class="hkr-min" aria-label="Minimise radio">−</button><button type="button" class="hkr-close" aria-label="Close and stop radio">×</button></div><span class="hkr-fire-glow" aria-hidden="true"></span><div class="hkr-art-name"><span>HEAVENLY KEY RADIO</span></div><div class="hkr-art-transport"><p class="hkr-program">Checking programme…</p><div class="hkr-art-controls"><button type="button" class="hkr-mute" aria-label="Mute radio">🔊</button><button type="button" class="hkr-prev" aria-label="Previous track">◀</button><button type="button" class="hkr-play" aria-label="Play radio">▶</button><button type="button" class="hkr-next" aria-label="Next track">▶</button><button type="button" class="hkr-stop" aria-label="Stop radio">■</button></div><label class="hkr-volume-label">Volume <input type="range" min="0" max="1" step="0.05" value="1" aria-label="Radio volume"></label><p class="hkr-status" role="status" aria-live="polite">Tap Play to listen.</p></div><div class="hkr-art-eq" aria-hidden="true"></div></section><audio preload="none"></audio>`;
(mount||document.getElementById('hk-approved-launcher-stack')||document.body).append(root);
const $=s=>root.querySelector(s);let audio=$('audio');const button=$('.hkr-play'),notice=$('.hkr-status'),programme=$('.hkr-program'),eq=$('.hkr-art-eq');
for(let i=0;i<35;i++){const bar=document.createElement('i');bar.style.setProperty('--duration',(.4+(i%7)/10)+'s');bar.style.setProperty('--delay',-(i%9)/10+'s');bar.style.setProperty('--level',(25+(i*23)%75)+'%');eq.append(bar)}
let items=[],index=0,desired=false,fetching=null,poll=null,retry=null,retries=0,generation=0;
const volumeInput=$('input'),volumeLabel=$('.hkr-volume-label');let volumeLevel=1,audioContext,gainNode,volumeSource;const volumeProbe=document.createElement('audio');let nativeVolume=false;try{volumeProbe.volume=.5;nativeVolume=Math.abs(volumeProbe.volume-.5)<.01}catch{}
function volumeUI(adjustable){volumeInput.hidden=!adjustable;volumeInput.disabled=!adjustable;volumeLabel.firstChild.textContent=adjustable?'Volume ':'Volume: use phone buttons';volumeInput.setAttribute('aria-valuetext',Math.round(volumeLevel*100)+'%')}
function primeVolume(){if(nativeVolume)return;try{const Context=window.AudioContext||window.webkitAudioContext;if(Context){audioContext=audioContext||new Context();audioContext.resume().catch(()=>{})}}catch{}}
function resetAudio(){const muted=audio.muted,next=document.createElement('audio');audio.pause();audio.removeAttribute('src');audio.load();audio.replaceWith(next);audio=next;audio.preload='none';audio.muted=muted;attachPlayback();volumeSource?.disconnect();gainNode?.disconnect();volumeSource=null;gainNode=null}
async function prepareVolume(url){if(nativeVolume){audio.volume=volumeLevel;volumeUI(true);return}const sameOrigin=new URL(url,location.origin).origin===location.origin;if(!sameOrigin){if(volumeSource)resetAudio();volumeUI(false);return}primeVolume();if(!audioContext){volumeUI(false);return}try{await audioContext.resume();if(!volumeSource){gainNode=audioContext.createGain();volumeSource=audioContext.createMediaElementSource(audio);volumeSource.connect(gainNode);gainNode.connect(audioContext.destination)}gainNode.gain.setValueAtTime(volumeLevel,audioContext.currentTime);volumeUI(true)}catch{if(volumeSource)resetAudio();volumeUI(false)}}
function syncMediaSession(playing){
 if(!('mediaSession' in navigator))return;
 try{
  if(typeof MediaMetadata==='function')navigator.mediaSession.metadata=new MediaMetadata({title:programme.textContent||'Heavenly Key Radio',artist:'Heavenly Key Evangelistic Movement',album:'Heavenly Key Radio'});
  navigator.mediaSession.playbackState=playing?'playing':'paused';
 }catch{}
}
function display(playing){$('.hkr-launch-mode').textContent=playing?'PLAYING':'RADIO';root.classList.toggle('hkr-playing',playing);button.textContent=playing?'❚❚':'▶';button.setAttribute('aria-label',playing?'Pause radio':'Play radio');syncMediaSession(playing);if(playing){notice.textContent='Playing';retries=0;clearTimeout(retry)}}
const bind=window.HKRadioPlayback||function(audio,render){let playing=false;const sync=()=>render(playing&&!audio.paused&&!audio.ended&&!audio.error);audio.addEventListener('playing',()=>{playing=true;sync()});['pause','ended','waiting','stalled','seeking','emptied','error','abort','loadstart'].forEach(e=>audio.addEventListener(e,()=>{playing=false;sync()}));sync()};
function safeUrl(item){const u=new URL(item.url,location.origin);if(u.protocol!=='https:'&&u.origin!==location.origin)throw Error('Radio source is unavailable.');return u.href}
function release(){audio.pause();audio.removeAttribute('src');audio.load();display(false)}
function stop(){desired=false;generation++;clearTimeout(poll);clearTimeout(retry);release();notice.textContent='Stopped. Tap Play to listen.'}
function schedule(){clearTimeout(poll);if(desired)poll=setTimeout(()=>refresh(true).catch(()=>{}),30000)}
function reconnect(){clearTimeout(retry);if(!desired||retries>=4){if(desired){desired=false;notice.textContent='Connection unavailable. Tap Play to retry.'}return}notice.textContent='Connection interrupted. Reconnecting…';const turn=generation;retry=setTimeout(()=>{if(desired&&turn===generation)startTrack(index).catch(reconnect)},Math.min(16000,2000*2**retries++))}
async function startTrack(next){if(!items.length)throw Error('No playable programme is available.');index=(next+items.length)%items.length;const turn=generation,url=safeUrl(items[index]);await prepareVolume(url);if(audio.src!==url){audio.src=url;audio.load()}programme.textContent=items[index].title||'Heavenly Key Radio';syncMediaSession(false);notice.textContent='Connecting…';await audio.play();if(!desired||turn!==generation){release();return}schedule()}
async function refresh(allowSwitch=false){if(fetching)return fetching;const turn=generation;fetching=(async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const r=await fetch('/api/broadcast/programme?channel=radio',{headers:{Accept:'application/json'},signal:controller.signal,cache:'no-store'});if(!r.ok)throw Error('Radio programme is temporarily unavailable.');const data=await r.json();if(turn!==generation)return;
if(['livekit','youtube'].includes(data.transport)){items=[];release();programme.textContent=data.title||'Live programme';notice.replaceChildren();const link=document.createElement('a');link.href='/pages/radio.html';link.target='_blank';link.rel='noopener';link.textContent='Open live radio player';notice.append(link);desired=false;clearTimeout(poll);return}
const next=Array.isArray(data.items)?data.items.filter(x=>x&&typeof x.url==='string'):[];const previous=audio.src;items=next;index=Math.max(0,items.findIndex(x=>{try{return safeUrl(x)===previous}catch{return false}}));
if(!items.length){release();desired=false;clearTimeout(poll);programme.textContent=data.title||'Heavenly Key Radio';notice.textContent='No playable programme is available right now.';return}
programme.textContent=items[index].title||data.title||'Heavenly Key Radio';if(allowSwitch&&desired&&safeUrl(items[index])!==previous)await startTrack(index);schedule();
}finally{clearTimeout(timer);fetching=null}})();return fetching}
button.onclick=async()=>{primeVolume();if(desired){stop();return}desired=true;generation++;retries=0;button.disabled=true;try{if(!items.length)await refresh();if(desired&&items.length)await startTrack(index)}catch(e){desired=false;release();notice.textContent=e.name==='NotAllowedError'?'Tap Play again to allow audio.':e.message||'Radio is unavailable.'}finally{button.disabled=false}};
$('.hkr-stop').onclick=stop;
$('.hkr-mute').onclick=()=>{audio.muted=!audio.muted;$('.hkr-mute').textContent=audio.muted?'🔇':'🔊';$('.hkr-mute').setAttribute('aria-label',audio.muted?'Unmute radio':'Mute radio')};
volumeInput.oninput=e=>{volumeLevel=Math.max(0,Math.min(1,Number(e.target.value)));if(gainNode)gainNode.gain.setValueAtTime(volumeLevel,audioContext.currentTime);else if(nativeVolume)audio.volume=volumeLevel;volumeInput.setAttribute('aria-valuetext',Math.round(volumeLevel*100)+'%')};
for(const [selector,delta] of [['.hkr-prev',-1],['.hkr-next',1]])$(selector).onclick=async()=>{if(!items.length)return;desired=true;generation++;try{await startTrack(index+delta)}catch{reconnect()}};
function attachPlayback(){bind(audio,display);audio.addEventListener('ended',()=>{if(desired&&items.length)startTrack(index+1).catch(reconnect)});
audio.addEventListener('error',()=>{display(false);reconnect()});audio.addEventListener('waiting',()=>{if(desired)notice.textContent='Buffering…'});}
attachPlayback();
if('mediaSession' in navigator){
 const actions={play:()=>{if(!desired)button.click()},pause:()=>{if(desired)stop()},stop:()=>stop(),nexttrack:()=>$('.hkr-next').click(),previoustrack:()=>$('.hkr-prev').click()};
 for(const [action,handler] of Object.entries(actions)){try{navigator.mediaSession.setActionHandler(action,handler)}catch{}}
}
let anchor;function returnToAnchor(){if(anchor?.isConnected){anchor.replaceWith(root);anchor=null}}
$('.hkr-bubble').onclick=()=>{if(!mount){anchor=document.createComment('radio launcher position');root.before(anchor);document.body.append(root)}root.classList.remove('hkr-mini','hkr-tiny');$('.hkr-bubble').setAttribute('aria-expanded','true');button.focus()};
$('.hkr-min').onclick=()=>{if(mount)return;returnToAnchor();root.classList.add('hkr-mini','hkr-tiny');$('.hkr-bubble').setAttribute('aria-expanded','false');$('.hkr-bubble').setAttribute('aria-label',desired?'Restore Heavenly Key Radio — audio continues':'Open Heavenly Key Radio');$('.hkr-bubble').focus()};
$('.hkr-close').onclick=()=>{stop();if(!mount){returnToAnchor();root.classList.add('hkr-mini');$('.hkr-bubble').setAttribute('aria-expanded','false');$('.hkr-bubble').focus()}};
$('.hkr-popout').onclick=()=>{
 const popup=window.open('/pages/radio.html?hk-player-window=1','hkHeavenlyKeyRadioPlayer','popup=yes,width=420,height=760,resizable=yes,scrollbars=yes');
 if(popup){try{popup.focus()}catch{}notice.textContent='Separate player opened. Tap Play in that window, then minimise it and browse the website.'}
 else notice.textContent='Your browser blocked the player window. Allow pop-ups for heavenlykey.org and try again.';
};
root.addEventListener('keydown',e=>{if(e.key==='Escape')$('.hkr-close').click()});
window.addEventListener('pagehide',stop);
refresh().catch(e=>{notice.textContent=e.message||'Radio is unavailable.'});
})();


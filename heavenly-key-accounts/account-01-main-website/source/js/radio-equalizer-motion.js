/* Decorative broadcasting equalizer; playback-driven, not a microphone/audio analyzer. */
(function(){
'use strict';
const css=document.createElement('style');
css.textContent=`
.hk-radio-eq,.hkr-eq{display:flex!important;align-items:flex-end;justify-content:space-evenly;gap:3px;overflow:hidden;padding:6px 8px;background:#850b24;border-radius:8px;min-height:42px}
.hk-radio-eq span,.hkr-eq span{display:block;flex:1;max-width:9px;height:100%;border-radius:3px 3px 0 0;background:linear-gradient(0deg,#f4b72c 0 35%,#23a15d 35% 65%,#ffe258 65% 85%,#ef6335 85%);transform-origin:bottom;transform:scaleY(.18)}
.hk-radio-eq.hk-eq-playing span,.hkr-eq.hk-eq-playing span{animation:hk-eq-pulse var(--eq-duration,.8s) ease-in-out infinite alternate;animation-delay:var(--eq-delay,0s)}
@keyframes hk-eq-pulse{0%{transform:scaleY(.12)}35%{transform:scaleY(.85)}65%{transform:scaleY(.36)}100%{transform:scaleY(1)}}
@media(prefers-reduced-motion:reduce){.hk-radio-eq span,.hkr-eq span{animation:none!important;transform:scaleY(.4)}}
`;
document.head.appendChild(css);
function install(eq,audio){
 if(!eq||eq.dataset.hkEqReady)return;
 eq.dataset.hkEqReady='true';eq.setAttribute('aria-hidden','true');
 eq.replaceChildren();
 for(let i=0;i<27;i++){
  const bar=document.createElement('span');
  bar.style.setProperty('--eq-duration',(0.45+((i*7)%13)/18).toFixed(2)+'s');
  bar.style.setProperty('--eq-delay',(-((i*11)%19)/17).toFixed(2)+'s');
  eq.appendChild(bar);
 }
 let buffering=false;
 const sync=()=>eq.classList.toggle('hk-eq-playing',!!audio&&!audio.paused&&!audio.ended&&audio.readyState>=HTMLMediaElement.HAVE_CURRENT_DATA&&!buffering&&audio.error===null);
 const setBuffering=()=>{buffering=true;sync()};
 const setPlaying=()=>{buffering=false;sync()};
 if(audio){
  ['waiting','stalled','seeking','loadstart','emptied','error','abort','suspend'].forEach(e=>audio.addEventListener(e,setBuffering));
  ['playing','canplay','seeked'].forEach(e=>audio.addEventListener(e,setPlaying));
  ['pause','ended','volumechange'].forEach(e=>audio.addEventListener(e,sync));
 }
 sync();
}
function mount(){
 const floating=document.getElementById('hk-floating-radio');
 if(floating){
  const body=floating.querySelector('.hkr-body');
  if(body){
   let eq=body.querySelector('.hkr-eq');
   if(!eq){eq=document.createElement('div');eq.className='hkr-eq';body.appendChild(eq);}
   install(eq,floating.querySelector('audio'));
  }
 }
 document.querySelectorAll('.hk-radio-eq').forEach(eq=>install(eq,eq.closest('.broadcast-radio-card')?.querySelector('audio')));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
const observer=new MutationObserver(()=>mount());
observer.observe(document.documentElement,{subtree:true,childList:true});
})();

/* Dedicated Radio page only; retain its existing programme and live broadcast engine. */
(()=>{'use strict';if(!/^\/pages\/radio(?:\.html)?\/?$/.test(location.pathname))return;
const panel=document.querySelector('[data-broadcast-player="radio"]'),input=panel?.querySelector('.hk-radio-page-volume input');if(!input)return;
const label=input.closest('label'),probe=document.createElement('audio');let adjustable=false,level=Number(input.value);try{probe.volume=.5;adjustable=Math.abs(probe.volume-.5)<.01}catch{}
if(!adjustable){input.hidden=true;input.disabled=true;label.firstChild.textContent='Volume: use your phone volume buttons';return}
function apply(){panel.querySelectorAll('audio,video').forEach(media=>{if(Math.abs(media.volume-level)>.001)media.volume=level});input.setAttribute('aria-valuetext',Math.round(level*100)+'%')}
input.addEventListener('input',()=>{level=Math.max(0,Math.min(1,Number(input.value)));apply()});
panel.addEventListener('play',apply,true);panel.addEventListener('volumechange',apply,true);apply();
})();

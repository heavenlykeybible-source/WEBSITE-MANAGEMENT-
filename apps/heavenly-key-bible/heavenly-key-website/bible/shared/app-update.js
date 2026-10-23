/* Heavenly Key shared, non-disruptive PWA update notice. No automatic reload or data clearing. */
(()=>{'use strict';if(!('serviceWorker'in navigator))return;
let refreshing=false,shown=false,approved=false;
function notice(reg){if(shown||!navigator.serviceWorker.controller)return;shown=true;
 const banner=document.createElement('aside');banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');banner.style.cssText='position:fixed;bottom:16px;left:16px;right:16px;max-width:540px;margin:auto;z-index:2147483640;padding:16px;border:1px solid #f2cb74;border-radius:14px;background:#0b2b70;color:white;box-shadow:0 8px 35px #0006;font:14px/1.5 system-ui,sans-serif';
 const label=document.createElement('strong');label.textContent='Heavenly Key update available';const detail=document.createElement('p');detail.textContent='A newer version is ready. Save any work before updating.';detail.style.margin='8px 0';
 const action=document.createElement('button');action.textContent='Update now';action.type='button';action.style.cssText='padding:10px 16px;border:0;border-radius:9px;background:#f2c566;color:#171407;font-weight:800;cursor:pointer';action.addEventListener('click',()=>{if(!reg.waiting)return;action.disabled=true;action.textContent='Updating…';approved=true;reg.waiting.postMessage({type:'SKIP_WAITING'});setTimeout(()=>{if(!refreshing){action.disabled=false;action.textContent='Update available — reopen app if needed'}},3500)});
 const later=document.createElement('button');later.type='button';later.textContent='Later';later.style.cssText='margin-left:10px;padding:10px;background:transparent;border:1px solid white;border-radius:9px;color:white;cursor:pointer';later.addEventListener('click',()=>banner.remove());banner.append(label,detail,action,later);document.body.append(banner);
}
navigator.serviceWorker.addEventListener('controllerchange',()=>{if(refreshing||!approved)return;refreshing=true;window.location.reload()});
window.addEventListener('load',async()=>{try{const reg=await navigator.serviceWorker.ready;if(reg.waiting)notice(reg);reg.addEventListener('updatefound',()=>{const worker=reg.installing;if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)notice(reg)})});
 const check=()=>{if(navigator.onLine)reg.update().catch(()=>{})};document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});setInterval(()=>{if(!document.hidden)check()},6*60*60*1000);
}catch(e){/* Unavailable or unregistered worker: no UI disruption */}});
})();
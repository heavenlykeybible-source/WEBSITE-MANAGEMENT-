/* Account 1 public pages: silent offline updates, no automatic install/update popups. */
(()=>{'use strict';
if(!['heavenlykey.org','www.heavenlykey.org','localhost','127.0.0.1'].includes(location.hostname)&&!/^(?:[a-z0-9-]+-)?heavenlykey\.alldaywow247\.workers\.dev$/.test(location.hostname))return;
if(/^\/(?:bible|community|admin|studio|control)(?:\/|$)/i.test(location.pathname)||/\/pages\/admin\.html$/i.test(location.pathname)||window.__hkSilentPublicUpdates)return;
window.__hkSilentPublicUpdates=true;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();event.stopImmediatePropagation()},true);
/* Retire the exact obsolete update banner if an older loader inserts it later. */
function clean(){document.querySelectorAll('aside[role="status"]').forEach(el=>{if(el.querySelector('strong')?.textContent==='Heavenly Key update available'&&el.querySelector('p')?.textContent==='A newer version is ready. Save any work before updating.')el.remove()})}
function start(){clean();const observer=new MutationObserver(clean);observer.observe(document.body,{childList:true,subtree:true});window.addEventListener('pagehide',()=>observer.disconnect(),{once:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
if('serviceWorker'in navigator)window.addEventListener('load',async()=>{try{const reg=await navigator.serviceWorker.ready;const check=()=>{if(navigator.onLine)reg.update().catch(()=>{})};document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});setInterval(()=>{if(!document.hidden)check()},6*60*60*1000)}catch{}},{once:true});
})();

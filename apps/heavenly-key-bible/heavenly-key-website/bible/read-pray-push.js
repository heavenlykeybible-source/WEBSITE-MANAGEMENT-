/* READ & PRAY: optional server-backed push. No login, no hidden subscription. */
(()=>{'use strict';
 const $=id=>document.getElementById(id),KEY='hk-read-pray-push-v1';
 const setStatus=s=>{const n=$('push-status');if(n)n.textContent=s;};
 const encode=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const decode=s=>{const r=atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4));return Uint8Array.from(r,c=>c.charCodeAt(0));};
 const supported=()=>('serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window&&isSecureContext);
 async function serverConfig(){const r=await fetch('/api/read-pray/config',{cache:'no-store'});if(!r.ok)throw Error('Background reminder service not configured');const data=await r.json();if(!data.enabled||!data.publicKey)throw Error('Background reminder service not configured');return data;}
 async function enable(){if(!supported()){setStatus('Background push is not available on this browser. The Bible can still remind you while open. On iPhone, install the Bible to your Home Screen and enable notifications in device settings.');return;}
  let newSubscription=null;try{if(!JSON.parse(localStorage.getItem('hk-read-pray-v2')||'null')?.enabled)throw Error('Save your Read & Pray preferences before enabling push');const {publicKey}=await serverConfig();const permission=await Notification.requestPermission();if(permission!=='granted'){setStatus('Notifications were not approved.');return;}
   const worker=await navigator.serviceWorker.ready;let sub=await worker.pushManager.getSubscription();if(!sub){sub=await worker.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decode(publicKey)});newSubscription=sub;}
   const saved=JSON.parse(localStorage.getItem('hk-read-pray-v2')||'null');const time=saved?.time,zone=Intl.DateTimeFormat().resolvedOptions().timeZone;if(!saved?.enabled)throw Error('Save your Read & Pray preferences before enabling push');
   if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||!zone)throw Error('Select a valid time and device timezone');
   const response=await fetch('/api/read-pray/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:sub.toJSON(),time,zone})});if(!response.ok)throw Error('Server could not save this subscription');
   localStorage.setItem(KEY,JSON.stringify({endpoint:sub.endpoint,time,zone}));setStatus(`Background notification subscribed: ${time} (${zone}). Allow notifications in device settings.`);
  }catch(e){if(newSubscription){try{await newSubscription.unsubscribe();}catch{setStatus('Server registration failed. Check notification settings and retry.');}}setStatus('Background subscription unavailable: '+e.message);}
 }
 async function disable(){
  // First invalidate the subscription at the source. Never silently leave server push enabled.
  try{
   if(!('serviceWorker'in navigator))throw Error('Service workers are not available');
   const worker=await navigator.serviceWorker.ready;
   const sub=await worker.pushManager.getSubscription();
   if(sub){
    const response=await fetch('/api/read-pray/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,auth:sub.toJSON().keys.auth})});
    if(!response.ok)throw Error('Remote unsubscribe failed; try again when online');
    const success=await sub.unsubscribe();
    if(!success)throw Error('Device unsubscribe was not confirmed; try again');
   }
   localStorage.removeItem(KEY);
   setStatus('Background push unsubscribed on this device.');
   return true;
  }catch(e){setStatus('Could not confirm unsubscribe: '+e.message);return false;}
 }
 async function syncTime(){
  if(!supported()||!localStorage.getItem(KEY))return;
  let settings;try{settings=JSON.parse(localStorage.getItem('hk-read-pray-v2')||'null');}catch{return;}
  if(!settings?.enabled)return;
  try{const worker=await navigator.serviceWorker.ready,sub=await worker.pushManager.getSubscription();if(!sub)return;
   const time=settings.time,zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
   if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||!zone)return;
   const response=await fetch('/api/read-pray/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:sub.toJSON(),time,zone})});
   if(!response.ok)throw Error('Push settings were not updated');
   localStorage.setItem(KEY,JSON.stringify({endpoint:sub.endpoint,time,zone}));
   setStatus('Background reminder time updated to '+time+' ('+zone+').');
  }catch(e){setStatus('Local reminder saved, but push timing update failed: '+e.message);}
 }
 window.hkReadPrayStopPush=disable;
 const on=()=>{const el=$('enable-push');if(el)el.addEventListener('click',enable);const save=$('save');if(save)save.addEventListener('click',()=>{if(localStorage.getItem('hk-read-pray-v2'))syncTime();});};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',on);else on();
})();

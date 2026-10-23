(()=>{
 const banner=document.getElementById('offline-status');if(!banner)return;
 const worker=document.currentScript?.dataset.worker;let ready=false;
 function show(){banner.textContent=navigator.onLine===false?(ready?'Offline · saved lessons and the device notebook are available.':'Offline · you can use this open page; reopen access has not been confirmed.'):(ready?'Ready offline · lessons and notebook tools are saved on this device.':'Online · preparing offline lessons and notebook tools…');}
 window.addEventListener('online',show);window.addEventListener('offline',show);
 document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(!link||navigator.onLine!==false)return;const url=new URL(link.href,location.href);if(link.hasAttribute('data-online-only')||url.origin!==location.origin){event.preventDefault();banner.textContent='This link needs internet. Your saved lessons and notebook remain available.';}});
 show();if(!('serviceWorker' in navigator)||location.protocol!=='https:'){banner.textContent=location.protocol==='file:'?'Downloaded copy · lesson text works offline. Encrypted notebook saving requires the installed HTTPS app.':'This browser cannot prepare offline reopening; keep this page open while studying.';return;}
 async function verify(){try{const files=['walk-offline.html','walk-offline.js','walk-offline-content.js','walk-offline.css','offline-vault.js','offline-status.js','creation-to-eternity.html','creation-to-eternity.js','creation-to-eternity.css'];ready=(await Promise.all(files.map(file=>caches.match(new URL(file,location.href).href)))).every(Boolean);show();}catch{ready=false;show();}}
 navigator.serviceWorker.addEventListener('controllerchange',verify);
 navigator.serviceWorker.register(worker).then(reg=>{
  function track(worker){if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)banner.textContent='App update ready. Save your work, then open Home to choose Update app.';if(worker.state==='activated')void verify();});}
  track(reg.installing);reg.addEventListener('updatefound',()=>track(reg.installing));
  if(reg.waiting&&navigator.serviceWorker.controller)banner.textContent='App update ready. Save your work, then open Home to choose Update app.';
  return navigator.serviceWorker.ready;
 }).then(verify).catch(()=>{banner.textContent='Offline download could not finish. Reconnect and reload to try again.'});
})();

(()=>{'use strict';
const header=document.querySelector('header');if(!header)return;
const banner=document.createElement('div');
banner.className='offline-banner';
banner.setAttribute('role','status');
banner.setAttribute('aria-live','polite');
banner.textContent='You appear to be offline. Local video, audio and subtitle editing remains available; cloud libraries and AI require internet access.';
header.insertAdjacentElement('afterend',banner);
let lastOnline=null;
const sync=()=>{
  const offline=navigator.onLine===false;
  banner.hidden=!offline;
  // Announce connectivity transitions without repeating the message on every event.
  if(lastOnline!==null&&lastOnline!==!offline&& !offline){
    banner.textContent='Connection restored. Cloud features are available again.';
    banner.hidden=false;
    clearTimeout(sync.restoreTimer);
    sync.restoreTimer=setTimeout(()=>{
      if(navigator.onLine!==false)banner.hidden=true;
    },3500);
  }else if(offline){
    clearTimeout(sync.restoreTimer);
    banner.textContent='You appear to be offline. Local video, audio and subtitle editing remains available; cloud libraries and AI require internet access.';
  }
  lastOnline=!offline;
};
window.addEventListener('online',sync);
window.addEventListener('offline',sync);
sync();
})();
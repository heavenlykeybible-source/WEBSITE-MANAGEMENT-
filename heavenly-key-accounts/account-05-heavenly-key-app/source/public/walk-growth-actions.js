/* My Walk with God — user-initiated sharing, no account or analytics required. */
(()=>{'use strict';
 const button=document.getElementById('walk-share');
 const status=document.getElementById('walk-share-status');
 if(!button||!status)return;
 button.addEventListener('click',async()=>{
  const url=new URL('/walk-offline.html',location.origin).href;
  const title='My Walk with God — Complete Spiritual Growth Application';
  const text='Together we take Christ to the nations of the world.';
  try{
   if(navigator.share){await navigator.share({title,text,url});status.textContent='';return;}
   if(navigator.clipboard?.writeText&&window.isSecureContext){await navigator.clipboard.writeText(url);status.textContent='App link copied. Share it to bless others.';return;}
   status.replaceChildren();const link=document.createElement('a');link.href=url;link.textContent='Open shareable app link';status.append(link);
  }catch(error){if(error?.name!=='AbortError')status.textContent='Sharing is unavailable on this device. Use your browser Share menu.';}
 });
})();
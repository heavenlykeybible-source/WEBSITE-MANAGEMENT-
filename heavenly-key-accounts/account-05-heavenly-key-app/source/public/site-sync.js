/* Loads published website information when the app opens or returns online.
   Server controls the fixed upstream origin; this UI renders text only. */
(()=>{
 const panel=document.getElementById('site-sync-panel');
 const status=document.getElementById('site-sync-status');
 const list=document.getElementById('site-sync-events');
 const programme=document.getElementById('site-sync-programme');
 const mission=document.getElementById('site-sync-mission');
 const button=document.getElementById('site-sync-refresh');
 if(!panel||!status||!list||!programme||!mission||!button)return;
 let checked=0,busy=false;const interval=5*60*1000;
 const el=(tag,value)=>{const node=document.createElement(tag);node.textContent=value;return node;};
 async function refresh(force=false){
  if(busy||navigator.onLine===false)return;
  if(!force&&Date.now()-checked<interval)return;
  checked=Date.now();busy=true;button.disabled=true;
  status.textContent='Checking latest ministry programmes…';
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),9000);
  try{
   const result=await fetch('/api/site-sync',{method:'GET',credentials:'omit',cache:'no-store',signal:controller.signal});
   if(!result.ok)throw Error('Live updates are unavailable. Visit the ministry website for current information.');
   const data=await result.json();if(data.success!==true)throw Error('Latest information is unavailable.');
   mission.replaceChildren();
   if(data.synced?.homepage){
    if(data.mission?.title)mission.append(el('h3',String(data.mission.title).slice(0,240)));
    if(data.mission?.body)mission.append(el('p',String(data.mission.body).slice(0,700)));
    programme.replaceChildren();
    if(data.programme?.title)programme.append(el('h3',String(data.programme.title).slice(0,240)));
    for(const [title,time] of [[data.programme?.solutionTitle,data.programme?.solutionTime],
       [data.programme?.midnightTitle,data.programme?.midnightTime]]){
      if(title||time)programme.append(el('p',[title,time].filter(Boolean).join(' · ').slice(0,350)));
    }
   }
   if(data.synced?.events){
    list.replaceChildren();
    for(const entry of Array.isArray(data.events)?data.events.slice(0,10):[]){
     const item=el('li','');item.append(el('strong',String(entry.title||'').slice(0,160)));
     if(entry.startTime)item.append(el('span',' · '+String(entry.startTime).slice(0,80)));
     if(entry.description)item.append(el('p',String(entry.description).slice(0,600)));
     list.append(item);
    }
    if(!list.childElementCount)list.append(el('li','No upcoming scheduled programmes are published yet.'));
   }
   status.textContent=(data.synced?.homepage&&data.synced?.events)?'Latest published website information loaded.':'Partial update loaded. Other information remains available on the ministry website.';
  }catch(error){status.textContent=error.name==='AbortError'?'Checking updates timed out. Please try again.':error.message;}
  finally{clearTimeout(timeout);button.disabled=false;busy=false;}
 }
 button.addEventListener('click',()=>refresh(true));
 const onReturn=()=>{if(!document.hidden)void refresh();};
 window.addEventListener('online',onReturn);
 window.addEventListener('pageshow',onReturn);
 document.addEventListener('visibilitychange',onReturn);
 if(navigator.onLine===false)status.textContent='Offline. Reconnect to check new ministry programmes.';
 else void refresh();
 // Foreground only: lightweight periodic check without background data or battery use.
 setInterval(()=>{if(!document.hidden&&navigator.onLine!==false)void refresh();},15*60*1000);
})();

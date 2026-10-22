(function(){
 "use strict";
 const root=document.getElementById("system-update-centre");if(!root)return;
 const status=root.querySelector("[data-update-status]"),list=root.querySelector("[data-update-components]"),history=root.querySelector("[data-update-history]"),refresh=root.querySelector("[data-update-refresh]");
 const centre="https://heavenlykey-recovery-control.emmanuel2026miracle.workers.dev/";
 const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 const open=(text)=>{const a=node('a',text);a.className='btn btn-primary';a.href=centre;a.target='_blank';a.rel='noopener noreferrer';return a};
 const portal=node('div');portal.className='portal-card';portal.id='website-waiting-room';
 portal.append(node('h3','🔔 Website Update Centre — Account 4'),
  node('p','New updates appear in the protected Account 4 dashboard after its separate preview tests pass. Open the temporary review link, inspect the site, and approve each live update yourself.'),
  open('Open Account 4 Website Update Centre'));
 root.insertBefore(portal,list);
 const short=s=>s?String(s).slice(0,12):'Not recorded';
 async function load(){
  if(refresh)refresh.disabled=true;
  status.textContent='Checking website version information…';
  try{
   const r=await fetch('/api/admin/system-updates',{headers:{Accept:'application/json'},credentials:'same-origin'});
   if(!r.ok)throw Error('The version service is unavailable.');
   const data=await r.json();list.replaceChildren();history.replaceChildren();
   const components=data.components||[];
   let newer=0;
   for(const c of components){
    const item=node('div');item.className='portal-card';
    item.append(node('h3',c.label||'Website component'),
      node('p','Currently installed: '+short(c.installedRef)+' · Available source: '+short(c.availableRef)));
    if(c.updateAvailable){newer++;item.append(node('strong','New source version detected. Review in Account 4 before publishing.'));}
    item.append(node('div'));item.lastElementChild.append(open('Review in Account 4'));list.append(item);
   }
   if(!components.length)list.append(node('p','Release information is available in the Account 4 Update Centre.'));
   for(const item of (data.history||[]).slice(0,12)){
    history.append(node('p',(item.component||'Site')+' · '+(item.action||'')+' · '+(item.status||'')+' · '+short(item.target_ref)));
   }
   status.textContent=newer?newer+' source component(s) have new versions. Review availability and tests inside Account 4.':'Open Account 4 to check for newly staged updates and temporary previews.';
  }catch(e){status.textContent=e.message+' Use the Account 4 Website Update Centre for current update notifications.';}
  finally{if(refresh)refresh.disabled=false;}
 }
 if(refresh)refresh.addEventListener('click',load);
 document.addEventListener('hk-admin-session',e=>{
  const role=e.detail?.profile?.roleName||'';
  if(['Administrator','Deputy Super Administrator','Super Administrator'].includes(role))load();
 });
})();

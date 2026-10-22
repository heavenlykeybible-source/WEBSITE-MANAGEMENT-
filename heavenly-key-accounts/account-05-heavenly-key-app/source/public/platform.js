import {mountInstallGuide} from './install-app.js';
const make=(tag,value,cls)=>{const n=document.createElement(tag);if(value)n.textContent=value;if(cls)n.className=cls;return n;};
const status=make('div',null,'app-platform-status');status.id='app-connection';
const message=make('span'),update=make('button','Update app','btn secondary');
message.setAttribute('role','status');message.setAttribute('aria-live','polite');update.type='button';update.hidden=true;
status.append(message,update);
const header=document.querySelector('.topbar,.study-header');if(header)header.insertAdjacentElement('afterend',status);
function connection(){if(!update.hidden)return;message.textContent=navigator.onLine===false?'Offline. Saved Bible books remain available; member services require a connection.':'Connected. Published website information refreshes automatically when available.';}
connection();window.addEventListener('online',connection);window.addEventListener('offline',connection);
const host=document.getElementById('install-guide');if(host)mountInstallGuide(host,make);
const clear=document.getElementById('clear-public-downloads');
clear?.addEventListener('click',async()=>{
 const notice=document.getElementById('storage-status');if(!confirm('Remove downloaded Bible books and audio from this device?'))return;clear.disabled=true;
 try{if(!('caches' in window))throw Error('Offline storage is unavailable.');
  const names=await caches.keys();await Promise.all(names.filter(name=>name==='hk-kjv-opt-in-books-v1'||name==='hk-approved-audio-bible-v1'||name==='hk-audio-hymnal-v1').map(name=>caches.delete(name)));
  notice.textContent='Downloaded Bible books and audio removed. Bookmarks and account information were not changed.';
 }catch{notice.textContent='Downloads could not be removed. Please use your browser storage settings.';}finally{clear.disabled=false;}
});
if('serviceWorker' in navigator&&location.protocol==='https:'){
 navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(registration=>{
  let checked=0,checking=false;const minimumGap=30*60*1000;
  const offer=()=>{
   if(registration.waiting&&navigator.serviceWorker.controller){
    update.hidden=false;message.textContent='A new app version is ready. Save private notes and finish active playback before updating.';
   }
  };
  offer();
  registration.addEventListener('updatefound',()=>{
    const installing=registration.installing;if(!installing)return;
    installing.addEventListener('statechange',offer);
  });
  async function check(){
   if(checking||navigator.onLine===false||document.hidden||Date.now()-checked<minimumGap)return;
   checked=Date.now();checking=true;
   try{await registration.update();offer();}catch{/* Keep current working app available offline. */}
   finally{checking=false;}
  }
  window.addEventListener('pageshow',()=>{void check();});
  window.addEventListener('online',()=>{connection();void check();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void check();});
  void check();
  update.addEventListener('click',()=>{
   if(!registration.waiting||!confirm('Install the new app and reload now? Unsaved reflections or active playback can be interrupted.'))return;
   update.disabled=true;
   // Only a real user action replaces the controlling worker.
   navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});
   registration.waiting.postMessage({type:'ACTIVATE_REVIEWED_SHELL'});
  });
 }).catch(()=>{message.textContent='Offline installation is unavailable here. You can continue using the app online.';});
}

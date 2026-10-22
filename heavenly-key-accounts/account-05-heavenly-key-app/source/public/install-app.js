// Quiet, user-triggered PWA install controls below the five app navigation links.
// The browser is never prompted automatically. Apple uses Add to Home Screen.
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredPrompt=event;});
window.addEventListener('appinstalled',()=>{deferredPrompt=null;});
function deviceKind(){
 const ua=navigator.userAgent||'';
 if(/iPhone|iPad|iPod/i.test(ua)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)return'apple';
 if(/Android/i.test(ua))return'android';
 return'computer';
}
function installed(){return window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true;}
export function mountInstallGuide(host,el){
 const actions=el('div',null,'discipleship-install-actions'),feedback=el('p','','discipleship-install-feedback'),
  tips=el('div',null,'discipleship-install-tips');
 feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
 tips.hidden=true;
 const instructions={
  android:'On Android, open this page in Chrome or Samsung Internet; choose Install app or Add to Home screen in the browser menu.',
  iphone:'On iPhone, open in Safari, tap Share, choose Add to Home Screen, enable Open as Web App if offered, then tap Add.',
  ipad:'On iPad, open in Safari, tap Share, choose Add to Home Screen, enable Open as Web App if offered, then tap Add.',
  computer:'On laptop or desktop: in Chrome or Edge choose Install from the browser address bar/menu. On Mac Safari use File → Add to Dock.'
 };
 const options=[['android','Install on Android'],['iphone','Install on Apple iPhone'],['ipad','Install on Apple iPad'],['computer','Install on Computer / Laptop']];
 for(const [platform,label] of options){
  const button=el('button',label,'discipleship-install-choice');
  button.type='button';
  button.addEventListener('click',async()=>{
   tips.hidden=false;tips.replaceChildren(el('p',instructions[platform]));
   if(installed()){feedback.textContent='This app is already installed on the current device.';return;}
   const target=(platform==='iphone'||platform==='ipad')?'apple':platform;
   if(target!==deviceKind()){feedback.textContent='Open the app on that device and follow the instructions below.';return;}
   const available=deferredPrompt||window.__hkDiscipleshipInstallPrompt;
   if(available&&target!=='apple'){
    try{
     deferredPrompt=null;window.__hkDiscipleshipInstallPrompt=null;
     await available.prompt();
     const outcome=await available.userChoice;
     feedback.textContent=outcome?.outcome==='accepted'?'Your browser accepted the installation. Find the app icon on your device.':'Installation was not accepted; use your browser menu whenever you are ready.';
    }catch{feedback.textContent='The browser did not open an install prompt. Use the menu instructions below.';}
   }else feedback.textContent='Follow these instructions to install when you are ready.';
  });
  actions.append(button);
 }
 host.append(actions,feedback,tips);
 if(installed())feedback.textContent='You are using the installed Heavenly Key App.';
}

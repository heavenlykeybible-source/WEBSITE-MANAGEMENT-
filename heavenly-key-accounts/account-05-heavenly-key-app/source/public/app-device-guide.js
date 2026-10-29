/* Native releases only. Browser shortcuts are never presented as downloads. */
(() => {
 'use strict';
 const params=new URLSearchParams(location.search),appId=params.get('app')||'all-in-one';
 const platform=location.pathname.split('/')[2];
 const open=document.getElementById('open'),info=document.querySelector('.small'),heading=document.querySelector('h1');
 const details=document.getElementById('release-details');
 const status=message=>{if(info){info.textContent=message;info.setAttribute('role','status');info.setAttribute('aria-live','polite');}};
 const textLine=(label,value)=>{const p=document.createElement('p');p.textContent=label+': '+value;details?.append(p);};
 async function initialize(){
  try{
   if(params.getAll('app').length>1||!/^[a-z0-9-]{1,64}$/.test(appId))throw Error('Invalid app selection');
   const response=await fetch('/app-downloads.json',{cache:'no-store'});
   if(!response.ok)throw Error('Catalogue unavailable');
   const apps=await response.json();
   if(!Object.prototype.hasOwnProperty.call(apps,appId))throw Error('Unknown app');
   const app=apps[appId],destination=new URL(app.url,location.origin);
   if(destination.protocol !== 'https:' && !(destination.protocol === 'http:' && destination.hostname === 'localhost'))throw Error('Invalid app URL');
   if(!['heavenlykey.org','localhost'].includes(destination.hostname)&&!destination.hostname.endsWith('.heavenlykey.org'))throw Error('Untrusted app host');
   if(open){open.href=destination.href;open.textContent='Use '+app.name+' online';}
   if(heading)heading.textContent=app.name+' for '+platform;
   document.title=app.name+' — Native Downloads';
   let nativeAvailable=false;
   if(/^(android|windows|mac)$/.test(platform)){
    const nativeLink=document.createElement('a');nativeLink.className='button';nativeLink.hidden=true;
    nativeLink.href='/api/native-download/'+encodeURIComponent(appId)+'/'+platform;
    nativeLink.textContent=platform==='android'?'Download Android APK':'Download native installer';
    nativeLink.setAttribute('download','');nativeLink.setAttribute('rel','noopener noreferrer');
    open?.insertAdjacentElement('beforebegin',nativeLink);
    const available=await fetch(nativeLink.href,{method:'HEAD',cache:'no-store',redirect:'error'});
    const expectedTypes={android:'application/vnd.android.package-archive',windows:'application/vnd.microsoft.portable-executable',mac:'application/x-apple-diskimage'};
    const size=Number(available.headers.get('content-length')),digest=available.headers.get('x-release-sha256')||'';
    nativeAvailable = available.ok && (available.headers.get('content-type')||'').includes(expectedTypes[platform]) && Number.isSafeInteger(size) && size > 0 && /^[a-f0-9]{64}$/i.test(digest);
    const version=available.headers.get('x-release-version')||'',releasedAt=available.headers.get('x-release-date')||'',minOs=available.headers.get('x-release-min-os')||'',architecture=available.headers.get('x-release-architecture')||'';
    nativeAvailable = nativeAvailable && /^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(version) && Number.isFinite(Date.parse(releasedAt)) && /^[a-zA-Z0-9 .()-]{1,64}$/.test(minOs) && ['universal','x64','arm64','x64-arm64','x86-arm64','armv7-arm64'].includes(architecture);
    nativeLink.hidden = !nativeAvailable;
    if(nativeAvailable){
     textLine('Version',available.headers.get('x-release-version'));
     textLine('Released',available.headers.get('x-release-date'));
     textLine('Minimum system',available.headers.get('x-release-min-os'));
     textLine('Processor',available.headers.get('x-release-architecture'));
     textLine('Download size',(size/1048576).toFixed(1)+' MB');
     textLine('SHA-256',digest);
     if(platform==='android')textLine('Installation','Open the APK after downloading. Android may request permission to install from this website.');
    }
   }
   if(platform==='iphone'||platform==='ipad'){
    // A listing is never guessed from an app name. It must be configured after approval.
    const url=app.stores?.apple;
    if(url){const store=new URL(url);if(store.protocol!=='https:'||store.hostname!=='apps.apple.com'||!/^\/[a-z]{2}\/app\/.+\/id\d+$/.test(store.pathname)||store.username||store.password||store.search||store.hash)throw Error('Invalid official store listing');
     const link=document.createElement('a');link.className='button';link.href=store.href;link.textContent='Download on the Apple App Store';link.rel='noopener noreferrer';open?.insertAdjacentElement('beforebegin',link);
     status('Install through the Apple App Store. The store checks device compatibility and supplies app updates.');
    }else status('The native Apple App Store release is not published yet. No iPhone or iPad installer is available here.');
   }else if(nativeAvailable){status('A signed native installer is available. Check its system requirements before downloading.');}
   else status('A verified native installer is not published for this app and device yet. Online access is available separately.');
  }catch{status('Release availability could not be verified. No installer is offered. Please try again later.');}
 }
 return initialize();
})();

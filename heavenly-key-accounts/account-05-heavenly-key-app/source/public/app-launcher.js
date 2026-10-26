/* Heavenly Key Account 5: user-invoked launcher. Never frame third-party apps or bypass their security headers. */
(() => {
  'use strict';
  const apps = [
    ['✦','Online Assistant','/assistant.html','Scripture and ministry assistance'],
    ['📱','Heavenly Key All-in-One','/experience.html','Account 5'],
    ['📖','Full KJV Bible','/bible.html','Read and search Scripture'],
    ['🔊','Audio Bible','/audio-bible.html','Listen when approved audio is available'],
    ['📅','365-Day Reading Plan','/devotional.html','Daily discipleship'],
    ['🎵','Hymn Library','/hymns.html','Hymn texts'],
    ['🎧','Audio Hymnal','/audio-hymns.html','Approved hymn recordings'],
    ['🧮','My Walk With God','/walk-offline.html','Private offline notebook'],
    ['🎓','From Creation to Eternity','/creation-to-eternity.html','35 Bible lessons'],
    ['📻','Heavenly Key Radio','https://radio.heavenlykey.org/','Dedicated radio website'],
    ['🌍','Global Christian Community','https://global.heavenlykey.org/','Dedicated social network'],
    ['📚','Heavenly Key Bible Portal','https://onlinebible.heavenlykey.org/','Dedicated Bible website']
  ];
  const dialog = document.createElement('dialog');
  dialog.className = 'hk-app-launcher';
  dialog.setAttribute('aria-label','Open a Heavenly Key app');
  const header = document.createElement('div'); header.className='hk-app-launcher-head';
  const heading = document.createElement('h2');heading.textContent='Choose an app to open';
  const close = document.createElement('button');close.type='button';close.className='hk-app-launcher-close';close.textContent='Close ×';close.setAttribute('aria-label','Close app launcher');
  header.append(heading,close);
  const intro=document.createElement('p');intro.className='hk-app-launcher-help';intro.textContent='Every app has its own direct URL. Select an app to open it in a separate window or tab; this page stays available.';
  const grid=document.createElement('div');grid.className='hk-app-launcher-grid';
  for(const [symbol,name,href,description] of apps){
    const link=document.createElement('a');link.className='hk-app-launcher-card';
    link.href=href;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label','Open '+name+' in a new window');
    const icon=document.createElement('span');icon.className='hk-app-launcher-icon';icon.textContent=symbol;
    const body=document.createElement('span');const strong=document.createElement('strong');strong.textContent=name;
    const small=document.createElement('small');small.textContent=description;
    body.append(strong,small);link.append(icon,body);grid.append(link);
  }
  const foot=document.createElement('p');foot.className='hk-app-launcher-help';foot.textContent='Note: Some audio and member features are still pending publication or integration.';
  dialog.append(header,intro,grid,foot);document.body.append(dialog);
  const open=()=>{if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');};
  const dismiss=()=>{if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');};
  document.querySelectorAll('[data-app-launcher]').forEach(btn=>btn.addEventListener('click',open));
  close.addEventListener('click',dismiss);
  dialog.addEventListener('click',event=>{if(event.target===dialog)dismiss();});
  document.querySelectorAll('[data-app-popout]').forEach(link=>link.addEventListener('click',event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const href=link.getAttribute('href');if(!href)return;
    const target=new URL(href,location.href);
    if(target.origin!==location.origin)return; // external platforms keep normal links
    event.preventDefault();
    const popup=window.open(target.href,'_blank','noopener,noreferrer,width=1080,height=780,scrollbars=yes,resizable=yes');
    if(!popup){const fallback=document.createElement('a');fallback.href=target.href;fallback.target='_blank';fallback.rel='noopener noreferrer';fallback.textContent='Open '+(link.textContent||'app');fallback.className='hk-app-popup-fallback';link.after(fallback);}
  }));
})();

/* Approved footer behavior: sharing and gallery; no floating app advertising. */
(function(){
'use strict';
function init(){
  const share=document.getElementById('hk-footer-share');
  if(share)share.addEventListener('click',async function(){
    const data={title:document.title,url:location.href};
    if(navigator.share){try{await navigator.share(data);return}catch(e){if(e.name==='AbortError')return}}
    try{await navigator.clipboard.writeText(data.url);const old=share.textContent;share.textContent='Link Copied ✓';setTimeout(()=>{share.textContent=old},2500)}
    catch(e){window.prompt('Copy this page link:',data.url)}
  });
  const gallery=document.querySelector('.site-footer .hk-footer-gallery');
  if(!gallery)return;
  const frames=Array.from(gallery.querySelectorAll('a:has(img)'));
  if(!frames.length)return;
  gallery.classList.add('hk-gallery-slideshow');
  gallery.setAttribute('aria-label','Ministry picture gallery slideshow');
  let current=0;
  const count=document.createElement('p');count.className='hk-gallery-count';count.setAttribute('aria-live','off');gallery.after(count);
  function show(index){
    current=index;
    frames.forEach((frame,i)=>{const active=i===current;frame.classList.toggle('hk-gallery-active',active);frame.tabIndex=active?0:-1;frame.setAttribute('aria-hidden',String(!active))});
    count.textContent='Ministry Gallery · '+(current+1)+' / '+frames.length;
  }
  show(0);
  if(frames.length<2||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  let interval;
  function stop(){clearInterval(interval);interval=null}
  function start(){if(interval||document.hidden)return;interval=setInterval(()=>show((current+1)%frames.length),4000)}
  gallery.addEventListener('mouseenter',stop);gallery.addEventListener('mouseleave',start);
  gallery.addEventListener('focusin',stop);gallery.addEventListener('focusout',e=>{if(!gallery.contains(e.relatedTarget))start()});
  document.addEventListener('visibilitychange',()=>document.hidden?stop():start());
  start();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

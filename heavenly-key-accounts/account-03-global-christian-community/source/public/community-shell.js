/* Keep one page scroll for posts; rails scroll only inside their own boundaries. */
(()=>{'use strict';
 let release=()=>{};
 function mount(){
  release();release=()=>{};
  const layout=document.querySelector('.social-layout'),stream=layout?.querySelector('.social-stream'),aside=document.querySelector('.social-sidebar'),header=document.querySelector('.top');
  if(document.body.dataset.page!=='home'||!layout||!stream||!aside)return;
  const compact=matchMedia('(max-width:1199px)');let drawer=null;
  function arrange(){
   if(!layout.isConnected)return;
   if(compact.matches){
    if(!drawer){drawer=document.createElement('details');drawer.className='gc-discovery-drawer';const summary=document.createElement('summary');summary.textContent='Discover believers & community guide';drawer.append(summary);const anchor=stream.querySelector('.feed-tabs');if(anchor)anchor.before(drawer);else stream.prepend(drawer);}
    drawer.append(aside);
   }else{layout.append(aside);drawer?.remove();drawer=null;}
   // The old floating radio pill covered navigation and posts at the bottom.
   const radio=document.getElementById('hk-radio-compact');if(radio)aside.append(radio);
  }
  const size=()=>document.body.style.setProperty('--community-header-height',Math.ceil(header?.getBoundingClientRect().height||90)+'px');
  arrange();size();compact.addEventListener('change',arrange);
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(size):null;if(header)observer?.observe(header);
  release=()=>{compact.removeEventListener('change',arrange);observer?.disconnect();if(drawer){if(layout.isConnected)layout.append(aside);drawer.remove();drawer=null;}};
 }
 window.addEventListener('hk-community-view-ready',mount);
 window.addEventListener('hk-care-session',()=>{release();release=()=>{};});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

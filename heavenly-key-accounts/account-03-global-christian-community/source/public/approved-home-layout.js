/* Approved home visual integration. Existing community app owns sessions, feeds and ACTIVE API. */
(()=>{'use strict';
function setMemberState(session){
  const signedIn=Boolean(session?.user?.userId);
  document.body.classList.toggle('gc-approved-member',signedIn);
  document.body.classList.toggle('gc-approved-guest',!signedIn);
  return signedIn;
}
function update(e){
  if(e.detail?.page!=='home'){
    document.body.classList.remove('gc-approved-member','gc-approved-guest');
    return;
  }
  const signedIn=setMemberState(e.detail.session);
  const stream=document.querySelector('.social-stream');
  if(!stream)return;
  const banner=stream.querySelector('.gc-visitor-banner');
  const heading=stream.querySelector('.stream-heading');
  if(!signedIn&&banner){
    if(heading)heading.after(banner);
    // app.js owns the complete welcome content and account destinations.
    // This layer only positions it and synchronizes member visibility.
  }
  if(signedIn&&banner)banner.remove();
  // The guest banner and ACTIVE are mutually exclusive; keep both under the stream heading.
  const nav=document.querySelector('.top .nav');
  if(nav){
    nav.classList.add('gc-premium-header');
    const links=nav.querySelector('.navlinks');
    if(links)links.setAttribute('aria-label','Community navigation');
  }
  const rail=document.querySelector('.social-rail');
  if(rail){
    rail.setAttribute('aria-label','Community menu');
    const activeLink=rail.querySelector('.rail-link[aria-current="page"]');
    if(activeLink)activeLink.classList.add('gc-current-section');
  }
  const sidebar=document.querySelector('.social-sidebar');
  if(sidebar)sidebar.setAttribute('aria-label','Community information');
  const active=stream.querySelector('.gc-active-section');
  if(signedIn&&active&&heading)heading.after(active);
}
window.addEventListener('hk-community-view-ready',update);
window.addEventListener('hk-care-session',e=>{
  if(document.body.dataset.page==='home')setMemberState(e.detail);
});
})();

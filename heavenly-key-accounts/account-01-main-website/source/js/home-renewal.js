/* Homepage-only presentation. No audio, chat, sign-in or publishing side effects. */
(() => {
  'use strict';
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const motion=document.querySelector('.motion-toggle');
  let userPaused=false;
  const slides=[...document.querySelectorAll('.tv-slide')];
  const dots=[...document.querySelectorAll('.tv-controls .dot')];
  const tv=document.querySelector('.television');
  const pause=document.querySelector('[data-tv-pause]');
  let current=0,timer=null,tvPaused=false,hovered=false,focused=false;
  function show(index){current=(index+slides.length)%slides.length;slides.forEach((slide,i)=>{slide.classList.toggle('is-active',i===current);slide.setAttribute('aria-hidden',String(i!==current));});dots.forEach((dot,i)=>dot.setAttribute('aria-pressed',String(i===current)));}
  function schedule(){clearInterval(timer);timer=null;if(!slides.length||tvPaused||userPaused||reduced.matches||document.hidden||hovered||focused)return;timer=setInterval(()=>show(current+1),5500);}
  function syncMotion(){document.documentElement.classList.toggle('motion-paused',userPaused||reduced.matches);motion?.setAttribute('aria-pressed',String(userPaused));if(motion){motion.textContent=userPaused?'▶':'Ⅱ';motion.setAttribute('aria-label',userPaused?'Resume animation':'Pause animation');}schedule();}
  motion?.addEventListener('click',()=>{userPaused=!userPaused;syncMotion();});
  document.querySelector('[data-tv-prev]')?.addEventListener('click',()=>{show(current-1);schedule();});
  document.querySelector('[data-tv-next]')?.addEventListener('click',()=>{show(current+1);schedule();});
  dots.forEach((dot,i)=>dot.addEventListener('click',()=>{show(i);schedule();}));
  pause?.addEventListener('click',()=>{tvPaused=!tvPaused;pause.setAttribute('aria-pressed',String(tvPaused));pause.textContent=tvPaused?'▶':'Ⅱ';pause.setAttribute('aria-label',tvPaused?'Resume picture slideshow':'Pause picture slideshow');schedule();});
  tv?.addEventListener('mouseenter',()=>{hovered=true;schedule();});tv?.addEventListener('mouseleave',()=>{hovered=false;schedule();});
  tv?.addEventListener('focusin',()=>{focused=true;schedule();});tv?.addEventListener('focusout',event=>{if(!tv.contains(event.relatedTarget)){focused=false;schedule();}});
  document.addEventListener('visibilitychange',schedule);reduced.addEventListener('change',syncMotion);if(slides.length)show(0);syncMotion();
  const toggle=document.querySelector('.nav-toggle'),nav=document.querySelector('.main-nav');
  toggle?.addEventListener('click',()=>{const open=nav.dataset.open!=='true';nav.dataset.open=String(open);toggle.setAttribute('aria-expanded',String(open));});
  const menus=[...document.querySelectorAll('.main-nav details')];
  menus.forEach(menu=>menu.addEventListener('toggle',()=>{if(menu.open)menus.filter(other=>other!==menu).forEach(other=>other.open=false);}));
  document.addEventListener('click',event=>{if(!event.target.closest('.main-nav'))menus.forEach(menu=>menu.open=false);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){const open=menus.find(menu=>menu.open);menus.forEach(menu=>menu.open=false);if(open)open.querySelector('summary').focus();else if(nav?.dataset.open==='true'){nav.dataset.open='false';toggle.setAttribute('aria-expanded','false');toggle.focus();}}});
  if('IntersectionObserver' in window&&!reduced.matches){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{threshold:.08});document.querySelectorAll('.reveal').forEach(node=>{node.classList.add('is-observed');observer.observe(node);});}
})();

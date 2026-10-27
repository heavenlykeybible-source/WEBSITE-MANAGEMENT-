/* Browse real groups in the navigation rail. The server enforces group visibility. */
(()=>{'use strict';let revision=0,controller,observer;
 const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
 function clear(){revision++;controller?.abort();observer?.disconnect();document.querySelector('.gc-group-browser')?.remove();document.querySelector('.gc-local-timezone')?.remove();}
 function mount(e){clear();if(e.detail?.page!=='home')return;const rail=document.querySelector('.social-rail'),aside=document.querySelector('.social-sidebar');if(!rail||!aside)return;
  const turn=revision;controller=new AbortController();const section=node('section','gc-group-browser');section.append(node('h2','','Discover Groups'));const list=node('div','gc-group-browser-list'),message=node('p','gc-group-browser-status','Loading groups…'),more=node('button','gc-group-browser-more','Load more groups');more.type='button';more.hidden=true;message.setAttribute('role','status');section.append(list,message,more);rail.append(section);
  const timezone=node('p','gc-local-timezone');try{const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;if(zone)timezone.textContent='Times shown in your local time · '+zone;}catch{}if(timezone.textContent)aside.append(timezone);
  let cursor=null,busy=false;const seen=new Set();
  async function load(){if(busy||turn!==revision)return;busy=true;more.disabled=true;message.textContent='Loading groups…';let ok=false;
   try{const res=await fetch('/api/groups'+(cursor?'?before='+encodeURIComponent(cursor):''),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'},signal:controller.signal});if(!res.ok)throw Error();const data=await res.json();if(turn!==revision||!section.isConnected)return;
    for(const g of Array.isArray(data.items)?data.items:[]){const id=Number(g.group_id);if(!Number.isSafeInteger(id)||id<1||seen.has(id)||typeof g.name!=='string')continue;seen.add(id);const a=node('a','gc-group-browser-link',g.name);a.href='groups.html?id='+id;list.append(a);}
    cursor=data.nextBefore||null;more.hidden=!cursor;message.textContent=seen.size?(cursor?'Scroll for more groups.':'All available groups shown.'):'No groups available yet.';ok=true;
   }catch{if(turn===revision&&section.isConnected){message.textContent='Could not load groups. Please try again.';more.hidden=false;}}
   finally{busy=false;more.disabled=false;if(ok&&cursor&&observer)observer.observe(more);}
  }
  more.onclick=()=>void load();if('IntersectionObserver'in window){observer=new IntersectionObserver(entries=>{if(entries.some(x=>x.isIntersecting)){observer.unobserve(more);void load();}},{root:matchMedia('(min-width:901px)').matches?rail:null,rootMargin:'0px 0px 150px'});}
  void load();
 }
 window.addEventListener('hk-community-view-ready',mount);window.addEventListener('hk-care-session',clear);
})();

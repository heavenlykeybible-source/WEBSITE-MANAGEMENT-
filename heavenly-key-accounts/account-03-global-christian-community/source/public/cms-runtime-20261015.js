/* Central published content and visual editing. No administrator credentials live in this script. */
(()=>{'use strict';
 if(window.__hkemCentralCms)return;window.__hkemCentralCms=true;
 const PUBLIC='https://heavenlykey-cms-public.emmanuel2026miracle.workers.dev';
 const CONTROL_DEFAULT='https://heavenlykey-control-room.emmanuel2026miracle.workers.dev';
 const CONTROLS=new Set([CONTROL_DEFAULT,'https://heavenlykey-owner-dashboard.emmanuel2026miracle.workers.dev']);
 const requestedControl=new URL(location.href).searchParams.get('hkem-control');
 const CONTROL=CONTROLS.has(requestedControl)?requestedControl:CONTROL_DEFAULT;
 const host=location.hostname,path=location.pathname;
 const site=/global|heavenly-key-global-community/.test(host)?'account3':/onlinebible|^bible\./.test(host)||/^\/bible(?:\/|$)/.test(path)?'account6':/heavenly-key-app|^app\./.test(host)?'account5':/control-room|owner-dashboard/.test(host)?'account4':'account1';
 const page=path.replace(/^\/+|\/+$/g,'').replace(/\.html$/i,'').replace(/\/index$/,'')||'home';
 const key=page==='index'?'home':page;
 const params=new URL(location.href).searchParams,nonce=params.get('hkem-session');
 const editing=params.get('hkem-cms')==='edit'&&nonce&&window.opener;
 const skip='[data-cms-ignore],script,style,template,noscript,svg,form,input,textarea,select,option,#page-root,#authbar,#verses,#bible-verses,#chapter-text,#reader-content,#scripture-text,#scripture-results,#selected-text,#study-note,#saved-verses,#tracks,#lyrics,.social-stream,.message-list,.post-card,.feed-post';
 const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(36).padStart(7,'0')};
 function selector(n){const parts=[];while(n&&n!==document.body){if(n.id&&/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(n.id)){parts.unshift('#'+n.id);break}const parent=n.parentElement;if(!parent)break;const tag=n.tagName.toLowerCase();const siblings=[...parent.children].filter(x=>x.tagName===n.tagName);parts.unshift(tag+':nth-of-type('+(siblings.indexOf(n)+1)+')');n=parent}return parts.join('>')}
 function safe(v,empty=false){if(typeof v!=='string'||v.length>1000||(!v&&!empty)||/[\u0000-\u0020<>"'\\]/.test(v)||v.startsWith('//'))return false;if(!v)return empty;if(v.split(/[?#]/)[0].split('/').includes('..'))return false;if(/^https:\/\//i.test(v)){try{const u=new URL(v);return !u.username&&!u.password}catch{return false}}if(/^mailto:/i.test(v))return /^mailto:[A-Za-z0-9._+%-]+@[A-Za-z0-9.-]+$/.test(v);if(/^tel:/i.test(v))return /^tel:\+?[0-9-]{5,25}$/.test(v);return /^[A-Za-z0-9_./#?%&=+~-]+$/.test(v)&&!v.includes(':')}
 const descriptors=new Map();
 function collect(){
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
  while((node=walker.nextNode())){const el=node.parentElement;if(!el||el.closest(skip)||!node.nodeValue.trim()||node.nodeValue.length>5000)continue;const p=selector(el),i=[...el.childNodes].indexOf(node),id='t_'+hash(p+'|text:'+i);descriptors.set(id,{key:id,type:'text',value:node.nodeValue,node,element:el,label:node.nodeValue.trim().slice(0,90)})}
  for(const el of document.querySelectorAll('img,a[href],main,main section,[data-cms-section]')){if(el.closest(skip))continue;const p=selector(el);
   const add=(prefix,type,value)=>{const id=prefix+'_'+hash(p+'|'+type);descriptors.set(id,{key:id,type,value,element:el,label:(el.getAttribute('alt')||el.textContent||el.getAttribute('aria-label')||el.tagName).trim().slice(0,90)})};
   if(el.tagName==='IMG'){add('i','image',el.getAttribute('src')||'');add('a','alt',el.getAttribute('alt')||'')}
   if(el.tagName==='A')add('l','link',el.getAttribute('href')||'');
   if(el.matches('main,main section,[data-cms-section]')){if(el.tagName!=='MAIN')add('v','visible',!el.hidden);add('b','background','');add('s','layout','original');add('c','tone','original')}
  }
 }
 function apply(fields){for(const f of fields||[]){const d=descriptors.get(f.key);if(!d||d.type!==f.type)continue;const el=d.element;
  if(f.type==='text'&&typeof f.value==='string')d.node.nodeValue=f.value;
  if(f.type==='alt'&&typeof f.value==='string')el.alt=f.value;
  if(f.type==='image'&&safe(f.value,true)){if(f.value){el.src=f.value;el.hidden=false}else{el.removeAttribute('src');el.hidden=true}}
  if(f.type==='link'&&safe(f.value))el.setAttribute('href',f.value);
  if(f.type==='visible'&&typeof f.value==='boolean')el.hidden=!f.value;
  if(f.type==='background'&&safe(f.value,true))el.style.backgroundImage=f.value?'url('+JSON.stringify(f.value)+')':'';
  if(f.type==='layout'&&['original','contained','wide','full'].includes(f.value)){for(const v of ['contained','wide','full'])el.classList.remove('hkem-layout-'+v);if(f.value!=='original')el.classList.add('hkem-layout-'+f.value)}
  if(f.type==='tone'&&['original','royal','wine','gold','light','dark'].includes(f.value)){for(const v of ['royal','wine','gold','light','dark'])el.classList.remove('hkem-tone-'+v);if(f.value!=='original')el.classList.add('hkem-tone-'+f.value)}
  d.value=f.value;
 }}
 function menuTarget(){return document.querySelector('.nav:not(.hk-family-nav),.navlinks,nav[aria-label="Main navigation"],header nav')}
 function menuItems(){const nav=menuTarget();if(!nav)return [];return [...descriptors.values()].filter(d=>d.type==='link'&&nav.contains(d.element)).map(d=>({key:d.key,label:d.element.textContent.trim(),href:new URL(d.value,location.href).href,newTab:d.element.target==='_blank',visible:!d.element.hidden}))}
 function applyMenu(menu){const nav=menuTarget();if(!nav||!Array.isArray(menu?.items))return;for(const item of menu.items){if(!safe(item.href))continue;let el=item.key?descriptors.get(item.key)?.element:null;if(!el){el=nav.querySelector('[data-hkem-menu="'+String(item.key||'').replace(/[^A-Za-z0-9_-]/g,'')+'"]');if(!el){el=document.createElement('a');el.dataset.hkemMenu=item.key||hash(item.href+item.label);nav.append(el)}}el.textContent=item.label;el.href=item.href;el.hidden=!item.visible;el.style.display=item.visible?'':'none';if(item.newTab){el.target='_blank';el.rel='noopener noreferrer'}else{el.removeAttribute('target');el.removeAttribute('rel')}}}
 const defaultFooter={schema:1,copyright:'Copyright © Heavenly Key Evangelistic Movement 2012-2026.',designer:{label:'TALKMONEY Ecosystem',href:'https://talkmoney.uk'}};
 function applyFooter(value){if(!value||typeof value.copyright!=='string'||!safe(value.designer?.href))return;let block=document.getElementById('hk-footer-credit');if(!block){const footer=document.querySelector('footer');if(!footer)return;block=document.createElement('div');block.id='hk-footer-credit';footer.append(block)}const line=document.createElement('p');line.textContent=value.copyright;const designed=document.createElement('p');designed.append(document.createTextNode('Designed by '));const a=document.createElement('a');a.textContent=value.designer.label;a.href=value.designer.href;a.target='_blank';a.rel='noopener noreferrer';designed.append(a);block.replaceChildren(line,designed)}
 function send(type,data={}){if(editing)window.opener.postMessage({type,nonce,site,page:key,...data},CONTROL)}
 function editor(){
  const bar=document.createElement('section');bar.dataset.cmsIgnore='';bar.classList.add('hkem-ui-0');
  const status=document.createElement('span');status.textContent='Visual CMS: click text, links, pictures or a section to edit. Changes stay private until Publish.';status.classList.add('hkem-ui-status');bar.append(status);
  function button(label,action){const b=document.createElement('button');b.type='button';b.textContent=label;b.classList.add('hkem-ui-1');b.onclick=action;bar.append(b)}
  const changed=new Map();
  const snapshot=()=>[...changed.values()];
  button('Save draft',()=>send('hkem-save',{content:{schema:1,fields:snapshot()}}));
  button('Publish',()=>send('hkem-publish',{content:{schema:1,fields:snapshot()}}));
  button('Control Room',()=>window.opener.focus());
  button('Exit',()=>{const url=new URL(location.href);url.searchParams.delete('hkem-cms');url.searchParams.delete('hkem-session');location.href=url});
  document.body.append(bar);
  window.addEventListener('message',event=>{if(event.origin!==CONTROL||event.source!==window.opener||event.data?.nonce!==nonce)return;const data=event.data;
   if(data.type==='hkem-apply'){for(const f of data.content?.fields||[])changed.set(f.key,f);apply(data.content?.fields);status.textContent='Draft loaded from the Control Room.'}
   if(data.type==='hkem-status')status.textContent=data.message;
  });
  document.addEventListener('click',event=>{if(event.target.closest('[data-cms-ignore]'))return;const matches=[...descriptors.values()].filter(d=>d.element===event.target||d.element.contains(event.target)).sort((a,b)=>(a.element===event.target?-1:1)-(b.element===event.target?-1:1));
   let d=matches.find(x=>x.type==='image')||matches.find(x=>x.type==='text'&&x.element===event.target)||matches.find(x=>x.type==='link');
   if(!d)d=matches.find(x=>x.type==='visible');if(!d)return;
   event.preventDefault();event.stopImmediatePropagation();
   if(d.type==='link'&&confirm('Edit this link destination? Press Cancel to edit its visible text.')){const value=prompt('Link destination',String(d.value));if(value!==null&&safe(value)){const f={key:d.key,type:d.type,value};changed.set(f.key,f);apply([f]);send('hkem-change',{field:f})}return}
   let value;if(d.type==='visible')value=confirm('Keep this section visible?');else value=prompt(d.type==='image'?'Picture URL (upload a new picture in the Control Room)':d.label,String(d.value));
   if(value===null)return;
   const field={key:d.key,type:d.type,value};changed.set(field.key,field);apply([field]);send('hkem-change',{field});status.textContent='Edit ready. Save draft or Publish.';
  },true);
  const fields=[...descriptors.values()].map(({key,type,value,label})=>({key,type,value,label}));
  send('hkem-ready',{fields,menu:{schema:1,items:menuItems()},footer:defaultFooter});
 }
 function sharing(){if(!document.querySelector('main')||site==='account4')return;const container=document.createElement('div');container.className='hkem-share-tools';container.dataset.cmsIgnore='';const b=document.createElement('button');b.type='button';b.textContent=site==='account3'?'Share & invite to the community':'Share this app or page';const status=document.createElement('span');status.setAttribute('role','status');b.onclick=async()=>{const u=new URL(location.href);for(const key of ['hkem-cms','hkem-session','hkem-control'])u.searchParams.delete(key);const data={title:document.title,url:u.href};try{if(navigator.share){await navigator.share(data);status.textContent=''}else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(u.href);status.textContent='Link copied. Share it with your family and friends.'}else{prompt('Copy this link to share',u.href)}}catch(e){if(e.name!=='AbortError')status.textContent='Sharing could not open. Please copy the page link.'}};container.append(b,status);const footer=document.querySelector('footer');if(footer)footer.prepend(container);else document.querySelector('main').append(container)}
 async function start(){collect();sharing();try{const response=await fetch(PUBLIC+'/v1/content?site='+site+'&page='+encodeURIComponent(key),{credentials:'omit',cache:'no-store'});if(response.ok){const data=await response.json();apply(data.content?.fields);applyMenu(data.menu);applyFooter(data.footer)}}catch{}
  if(editing)editor();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(start,450),{once:true});else setTimeout(start,450);
})();


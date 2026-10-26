/* Owner-approved president app pole. Single expanded panel; retained radio frame while minimized. */
(()=>{'use strict';
const apps=[
{id:'radio',name:'Revival Radio',icon:'📻',url:'https://radio.heavenlykey.org/'},
{id:'assistant',name:'Online Assistant',icon:'🤖',url:'/',native:true},
{id:'bible',name:'Online Bible',icon:'📖',url:'https://bible.heavenlykey.org/'},
{id:'social',name:'Social Network',icon:'👥',url:'https://global.heavenlykey.org/'},
{id:'walk',name:'My Walk with God Calculator',icon:'▦',url:'https://app.heavenlykey.org/'},
{id:'study',name:'Bible Study Portal',icon:'📚',url:'https://bible.heavenlykey.org/study-extensions.html'},
{id:'eternity',name:'Eternity in View',icon:'✦',url:'/eternity-in-view/'}
];
function init(){
 const grid=document.querySelector('.president-section .president-grid');if(!grid||document.querySelector('.hk-app-dock'))return;
 const dock=document.createElement('aside');dock.className='hk-app-dock';dock.setAttribute('aria-label','Heavenly Key ministry apps');
 const list=document.createElement('div');list.className='hk-dock-list';
 const pole=document.createElement('div');pole.className='hk-dock-pole';pole.setAttribute('aria-hidden','true');
 const win=document.createElement('section');win.className='hk-app-window';win.dataset.open='false';win.id='hk-app-window';win.setAttribute('role','region');win.setAttribute('aria-label','Selected ministry application');
 win.innerHTML='<div class="hk-app-window-bar"><span class="hk-app-window-title" id="hk-app-window-title"></span><button type="button" data-action="minimize" aria-label="Minimize app">−</button><button type="button" data-action="close" aria-label="Close app">×</button></div><div class="hk-app-window-help">Use this app here when embedding is supported. If its provider blocks embedded access, select Visit App Page.</div><div class="hk-app-window-actions"><button type="button" data-action="share">Share This to Bless Others</button><a id="hk-dock-app-page" target="_blank" rel="noopener noreferrer">Visit App Page ↗</a></div>';
 const bar=win.querySelector('.hk-app-window-bar');const title=win.querySelector('.hk-app-window-title');
 const pageLink=win.querySelector('#hk-dock-app-page');
 const mini=document.createElement('button');mini.className='hk-app-minimized';mini.type='button';mini.hidden=true;mini.textContent='Restore App';mini.setAttribute('aria-label','Restore minimized app');mini.setAttribute('aria-controls','hk-app-window');
 let active=null,drag=null;const frames=new Map();
 function select(app){
  if(active?.id===app.id&&win.dataset.open==='true'){minimize();return;}
  if(app.id==='assistant'){
   const launcher=document.querySelector('#hkem-assistant .hkem-launcher');
   if(launcher){if(active)minimize();launcher.click();return;}
  }
  active=app;title.textContent=app.name;pageLink.href=new URL(app.url,location.href).href;mini.textContent='Restore '+app.name;
  // Keep only Revival Radio alive while another app is selected; unload other inactive apps.
  for(const [id,frame] of frames){if(id!==app.id&&id!=='radio'){frame.remove();frames.delete(id);}else frame.hidden=id!==app.id;}
  if(app.native&&!frames.has(app.id)){const placeholder=document.createElement('div');placeholder.className='hk-app-window-native';placeholder.setAttribute('role','status');placeholder.textContent=app.id==='assistant'?'The Online Assistant is not ready inside this window. Use Visit App Page to return to the homepage and open its assistant launcher.':app.name+' can be opened using Visit App Page. In-page integration is not yet available.';win.insertBefore(placeholder,win.querySelector('.hk-app-window-actions'));frames.set(app.id,placeholder);} else if(!app.native&&!frames.has(app.id)){
   const frame=document.createElement('iframe');frame.className='hk-app-window-frame';frame.title=app.name;frame.loading='lazy';frame.referrerPolicy='strict-origin-when-cross-origin';frame.allow='autoplay; clipboard-write';frame.src=app.url;frame.hidden=false;
   win.insertBefore(frame,win.querySelector('.hk-app-window-actions'));frames.set(app.id,frame);
  }else if(frames.has(app.id))frames.get(app.id).hidden=false;
  list.querySelectorAll('.hk-dock-tab').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.app===app.id)));
  win.style.removeProperty('left');win.style.removeProperty('top');win.style.removeProperty('right');win.style.removeProperty('position');win.dataset.open='true';mini.hidden=true;
 }
 function minimize(){if(!active)return;win.dataset.open='false';mini.hidden=false;list.querySelectorAll('.hk-dock-tab').forEach(b=>b.setAttribute('aria-pressed','false'));}
 function close(){if(active){const frame=frames.get(active.id);if(frame){frame.remove();frames.delete(active.id)}}active=null;win.dataset.open='false';mini.hidden=true;list.querySelectorAll('.hk-dock-tab').forEach(b=>b.setAttribute('aria-pressed','false'));}
 for(const app of apps){const btn=document.createElement('button');btn.type='button';btn.className='hk-dock-tab';btn.dataset.app=app.id;btn.setAttribute('aria-pressed','false');btn.setAttribute('aria-controls','hk-app-window');const icon=document.createElement('span');icon.className='hk-dock-icon';icon.setAttribute('aria-hidden','true');icon.textContent=app.icon;const name=document.createElement('span');name.textContent=app.name;btn.append(icon,name);btn.addEventListener('click',()=>select(app));list.appendChild(btn);}
 win.addEventListener('click',async e=>{
 const action=e.target.closest('[data-action]')?.dataset.action;if(!action)return;
 if(action==='minimize')minimize();else if(action==='close')close();
 else if(action==='share'&&active){const data={title:'Heavenly Key — '+active.name,text:'Share this ministry resource to bless others',url:new URL(active.url,location.href).href};try{if(navigator.share)await navigator.share(data);else if(navigator.clipboard){await navigator.clipboard.writeText(data.url);e.target.textContent='Link Copied';setTimeout(()=>{e.target.textContent='Share This to Bless Others'},1800)}else window.open('https://wa.me/?text='+encodeURIComponent(data.text+' '+data.url),'_blank','noopener,noreferrer')}catch(err){if(err.name!=='AbortError')console.warn('Share was not completed');}}
 });
 mini.addEventListener('click',()=>{if(active)select(active)});
 bar.addEventListener('pointerdown',e=>{if(e.target.closest('button')||matchMedia('(max-width:720px)').matches||e.button!==0)return;const box=win.getBoundingClientRect();drag={x:e.clientX,y:e.clientY,left:box.left,top:box.top};win.style.position='fixed';win.style.left=box.left+'px';win.style.top=box.top+'px';win.style.right='auto';bar.setPointerCapture(e.pointerId)});
 bar.addEventListener('pointermove',e=>{if(!drag)return;const rect=win.getBoundingClientRect();win.style.left=Math.max(8,Math.min(Math.max(8,window.innerWidth-rect.width-8),drag.left+e.clientX-drag.x))+'px';win.style.top=Math.max(8,Math.min(Math.max(8,window.innerHeight-80),drag.top+e.clientY-drag.y))+'px';win.style.right='auto';});
 bar.addEventListener('pointerup',()=>drag=null);bar.addEventListener('pointercancel',()=>drag=null);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&win.dataset.open==='true')minimize()});
 dock.append(win,list,pole);grid.appendChild(dock);document.body.appendChild(mini);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

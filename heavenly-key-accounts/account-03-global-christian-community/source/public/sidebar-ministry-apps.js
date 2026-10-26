/* Premium Global Christian Community sidebar — official approved AI image, one app window. */
(()=>{'use strict';
const apps=[
{id:'study',name:'Bible Study',icon:'📖',url:'https://bible.heavenlykey.org/study-extensions.html'},
{id:'assistant',name:'Online Assistant',icon:'',url:'https://heavenlykey.org/',native:true},
{id:'eternity',name:'Eternity in View',icon:'✦',url:'https://heavenlykey.org/eternity-in-view/'},
{id:'community',name:'Christian Network',icon:'👥',url:'https://global.heavenlykey.org/',native:true},
{id:'radio',name:'Revival Radio',icon:'📻',url:'https://radio.heavenlykey.org/'},
{id:'editor',name:'Video Editor',icon:'🎬',url:'https://editor.heavenlykey.org/'},
{id:'calculator',name:'Calculator',icon:'▦',url:'https://app.heavenlykey.org/'}
];
const officialPortrait='https://heavenlykey.org/assets/ministry/approved-ai-transparent-original.png';
let active=null,drag=null;const frames=new Map();
const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text)el.textContent=text;return el;};
const panel=make('section','hk-community-app-panel');panel.id='hk-community-app-panel';panel.dataset.open='false';panel.setAttribute('aria-label','Heavenly Key selected application');panel.setAttribute('role','region');
const head=make('div','hk-community-app-head'),name=make('strong',null,'Heavenly Key App'),min=make('button',null,'−'),close=make('button',null,'×');
min.type=close.type='button';min.setAttribute('aria-label','Minimize application');close.setAttribute('aria-label','Close application');head.append(name,min,close);
const bottom=make('div','hk-community-app-bottom'),share=make('button',null,'Share to Bless Others'),visit=make('a',null,'Visit App Page ↗');
share.type='button';visit.target='_blank';visit.rel='noopener noreferrer';bottom.append(share,visit);const feedback=make('p','hk-community-app-feedback','Choose a ministry application to get started.');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');panel.append(head,feedback,bottom);
const restore=make('button','hk-community-app-restore','Restore App');restore.type='button';restore.hidden=true;restore.setAttribute('aria-controls',panel.id);
const allButtons=new Set();
function minimize(){if(active)feedback.textContent=active.name+' minimized. Select Restore App to continue.';panel.dataset.open='false';restore.hidden=!active;allButtons.forEach(b=>b.setAttribute('aria-pressed','false'))}
function closeApp(){active=null;panel.dataset.open='false';restore.hidden=true;for(const frame of frames.values())frame.remove();frames.clear();feedback.textContent='Application closed.';allButtons.forEach(b=>b.setAttribute('aria-pressed','false'))}
function open(app, restoring=false){
 if(app.id==='assistant'&&!restoring){
  const official=document.querySelector('.hk-ai-small-icon');
  if(official){closeApp();official.click();return;}
 }
 if(!restoring&&active?.id===app.id&&panel.dataset.open==='true'){minimize();return}
 active=app;feedback.textContent=app.name+' opened. Use Visit App Page if the embedded application is unavailable.';name.textContent=app.name;visit.href=app.url;restore.textContent='Restore '+app.name;
 for(const [id,el] of frames){if(id!==app.id&&id!=='radio'){el.remove();frames.delete(id)}else el.hidden=id!==app.id}
 if(!frames.has(app.id)){
  let body;
  if(app.native){body=make('div','hk-community-app-fallback',app.id==='assistant'?'Open the ministry homepage to use the original official Online Assistant.':'You are already in the Global Christian Community.');body.setAttribute('role','status')}
  else{body=make('iframe','hk-community-app-frame');body.title=app.name;body.loading='lazy';body.referrerPolicy='strict-origin-when-cross-origin';body.allow='autoplay; clipboard-write';body.src=app.url}
  panel.insertBefore(body,bottom);frames.set(app.id,body)
 }else frames.get(app.id).hidden=false;
 allButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.app===app.id)));
 panel.style.removeProperty('position');panel.style.removeProperty('left');panel.style.removeProperty('top');panel.style.removeProperty('right');
 panel.dataset.open='true';restore.hidden=true;min.focus({preventScroll:true})
}
function build(aside){
 const existing=aside.querySelector('.hk-community-apps');if(existing){
  // Rebind controls when a client-side navigation system clones the sidebar markup.
  for(const button of existing.querySelectorAll('.hk-community-app-btn')){
   if(button.dataset.hkBound==='true')continue;
   const app=apps.find(item=>item.id===button.dataset.app);
   if(!app)continue;
   button.dataset.hkBound='true';button.addEventListener('click',()=>open(app));allButtons.add(button);
  }
  if(existing!==aside.lastElementChild)aside.append(existing);return;
 }
 const section=make('section','hk-community-apps');section.setAttribute('aria-label','Heavenly Key ministry application launcher');
 const title=make('h2',null,'✦ Heavenly Key Apps');const grid=make('div','hk-community-app-grid');section.append(title,grid);
 for(const app of apps){const button=make('button','hk-community-app-btn');button.type='button';button.dataset.app=app.id;button.setAttribute('aria-pressed','false');button.setAttribute('aria-controls',panel.id);button.setAttribute('aria-label','Open '+app.name);const orb=make('span','hk-community-app-orb');if(app.id==='assistant'){const img=document.createElement('img');img.src=officialPortrait;img.alt='Official Heavenly Key Online Assistant portrait';img.loading='lazy';orb.append(img)}else orb.textContent=app.icon;const label=make('span',null,app.name);button.append(orb,label);button.dataset.hkBound='true';button.addEventListener('click',()=>open(app));allButtons.add(button);grid.append(button)}
 const action=make('div','hk-community-app-actions'),trigger=make('button',null,'Explore Ministry Apps');trigger.type='button';trigger.addEventListener('click',()=>open(apps[0]));action.append(trigger);section.append(action);
 aside.append(section);
}
min.addEventListener('click',minimize);close.addEventListener('click',closeApp);restore.addEventListener('click',()=>{if(active)open(active,true)});
share.addEventListener('click',async()=>{if(!active)return;const data={title:'Heavenly Key — '+active.name,text:'Share this ministry resource to bless others',url:active.url};try{if(navigator.share)await navigator.share(data);else if(navigator.clipboard){await navigator.clipboard.writeText(data.url);share.textContent='Link Copied';setTimeout(()=>share.textContent='Share to Bless Others',1800)}else window.open('https://wa.me/?text='+encodeURIComponent(data.text+' '+data.url),'_blank','noopener,noreferrer')}catch(err){if(err.name!=='AbortError')console.warn('App sharing unavailable')}});
head.addEventListener('pointerdown',e=>{if(e.target.closest('button')||e.button!==0||matchMedia('(max-width:750px)').matches)return;const box=panel.getBoundingClientRect();drag={x:e.clientX,y:e.clientY,left:box.left,top:box.top};panel.style.position='fixed';panel.style.left=box.left+'px';panel.style.top=box.top+'px';panel.style.right='auto';head.setPointerCapture(e.pointerId)});
head.addEventListener('pointermove',e=>{if(!drag)return;const b=panel.getBoundingClientRect();panel.style.left=Math.max(8,Math.min(Math.max(8,window.innerWidth-b.width-8),drag.left+e.clientX-drag.x))+'px';panel.style.top=Math.max(8,Math.min(Math.max(8,window.innerHeight-65),drag.top+e.clientY-drag.y))+'px'});
head.addEventListener('pointerup',()=>drag=null);head.addEventListener('pointercancel',()=>drag=null);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.dataset.open==='true')minimize()});
function boot(){document.body.append(panel,restore);let last=null;function scan(){const aside=document.querySelector('.social-sidebar');if(!aside)return;if(aside!==last){last=aside;allButtons.clear()}build(aside)}
 scan();const observer=new MutationObserver(()=>scan());observer.observe(document.querySelector('#page-root')||document.body,{childList:true,subtree:true});window.addEventListener('pagehide',()=>observer.disconnect(),{once:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

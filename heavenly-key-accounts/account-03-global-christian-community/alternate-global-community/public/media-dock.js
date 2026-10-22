/* One public player frame lives outside the changing social page. */
export function mountMediaDock({onOpen=()=>{}}={}){
 const origin='https://heavenlykey.alldaywow247.workers.dev';
 const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 const launch=make('nav',null,'faith-media-launch');launch.setAttribute('aria-label','Faith of Our Fathers Radio and TV');
 launch.append(make('strong','Faith of Our Fathers'),make('small','Listen while you browse'));
 const dock=make('section',null,'faith-media-dock');dock.hidden=true;dock.setAttribute('aria-label','Faith of Our Fathers player');
 const head=make('div',null,'faith-media-dock-head'),label=make('strong','Radio'),minimize=make('button','Minimize','btn secondary'),stop=make('button','Stop ✕','btn secondary'),body=make('div',null,'faith-media-dock-body');
 minimize.type=stop.type='button';minimize.setAttribute('aria-expanded','true');head.append(label,minimize,stop);dock.append(head,body);
 let frame=null,channel=null;
 function open(next){
  if(!['radio','video'].includes(next))return;
  onOpen();dock.hidden=false;body.hidden=false;minimize.textContent='Minimize';minimize.setAttribute('aria-expanded','true');
  if(channel!==next||!frame){
   frame?.remove();frame=make('iframe');frame.title='Faith of Our Fathers '+(next==='radio'?'Radio':'TV')+' player';
   frame.allow='autoplay; fullscreen; picture-in-picture';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
   frame.src=origin+'/api/broadcast/community-player?channel='+next;body.replaceChildren(frame);channel=next;
  }
  label.textContent='Faith of Our Fathers · '+(next==='radio'?'Radio':'TV');dock.dataset.channel=next;
  document.body.classList.add('faith-media-open');
 }
 for(const [key,text] of [['radio','▶ Radio'],['video','▣ TV']]){const b=make('button',text,'btn secondary');b.type='button';b.addEventListener('click',()=>open(key));launch.append(b);}
 minimize.addEventListener('click',()=>{body.hidden=!body.hidden;minimize.textContent=body.hidden?'Show player':'Minimize';minimize.setAttribute('aria-expanded',String(!body.hidden));});
 stop.addEventListener('click',()=>{frame?.remove();frame=null;channel=null;body.replaceChildren();dock.hidden=true;document.body.classList.remove('faith-media-open');});
 document.addEventListener('hk-play-broadcast',e=>open(e.detail?.channel));
 document.querySelector('.nav').append(launch);document.body.append(dock);
 return {open,active:()=>!!frame};
}

/* Reference composition; existing app modules continue to own authentication,
   posts, notifications, ACTIVE, Design Cards and navigation. */
(()=>{'use strict';
let revision=0,controller=null;
const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
function icon(name){const n=document.createElementNS('http://www.w3.org/2000/svg','svg');n.setAttribute('viewBox','0 0 24 24');n.setAttribute('aria-hidden','true');const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href','assets/premium-icons.svg#'+name);n.append(use);return n;}
function link(label,href,cls){const a=make('a',cls,label);a.href=href;return a;}
function panel(title,cls){const n=make('section','hk-ref-panel '+cls);n.append(make('h2',null,title));return n;}
function clear(){revision++;controller?.abort();controller=null;document.querySelector('.gc-header-shortcuts')?.remove();}
async function spaces(host,turn,request){
 const notice=make('p','gc-panel-status','Finding community Spaces…');notice.setAttribute('role','status');host.append(notice);
 const timer=setTimeout(()=>request.abort(),10000);
 try{
  const response=await fetch('/api/spaces',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'},signal:request.signal});
  if(!response.ok)throw Error();const data=await response.json();
  if(turn!==revision||!host.isConnected)return;
  const items=(Array.isArray(data.items)?data.items:[]).filter(s=>Number.isSafeInteger(s.space_id)&&s.space_id>0&&typeof s.slug==='string'&&s.slug&&typeof s.name==='string').slice(0,4);
  notice.remove();
  if(!items.length){host.append(make('p','gc-panel-status','A place for faith and fellowship. Explore Spaces or create one for your community.'));return;}
  const list=make('div','gc-space-list');
  for(const space of items){
   const row=link('', 'spaces.html?slug='+encodeURIComponent(space.slug),'gc-space-row');
   const mark=make('span','gc-space-mark');mark.append(icon('grid'));
   const copy=make('span','gc-space-copy');copy.append(make('strong',null,space.name),make('small',null,space.category||'Community Space'));
   row.append(mark,copy,make('span','gc-space-open','View'));list.append(row);
  }
  host.append(list);
 }catch{if(turn===revision&&host.isConnected)notice.textContent='Spaces could not be loaded. Open the directory to try again.';}
 finally{clearTimeout(timer);}
}
function mount(e){
 clear();if(e.detail?.page!=='home')return;
 const layout=document.querySelector('.social-layout'),rail=layout?.querySelector('.social-rail'),aside=layout?.querySelector('.social-sidebar'),header=document.querySelector('.top .nav');
 if(!layout||!rail||!aside||!header)return;
 const turn=revision;
 document.body.classList.add('gc-composed-dashboard');
 rail.querySelector('.gc-rail-brand')?.remove();
 const brand=document.querySelector('.top .brand');
 if(brand){const identity=brand.cloneNode(true);identity.className='gc-rail-brand';rail.prepend(identity);}
 const shortcuts=make('nav','gc-header-shortcuts');shortcuts.setAttribute('aria-label','Community shortcuts');
 for(const [label,href,symbol]of [['Bible','https://app.heavenlykey.org/bible.html','book'],['Prayer','prayer.html','hands'],['Groups','groups.html','users'],['Spaces','spaces.html','grid'],['Messages','messages.html','message']]){
  const a=link('',href);a.append(icon(symbol),make('span',null,label));shortcuts.append(a);
 }
 const auth=header.querySelector('#authbar');if(auth)auth.before(shortcuts);else header.append(shortcuts);
 const search=header.querySelector('.reference-search input');if(search)search.placeholder='Search believers, names and ministry callings…';
 aside.querySelector('.gc-suggested-spaces')?.remove();aside.querySelector('.gc-faith-topics')?.remove();aside.querySelector('.gc-world-invitation')?.remove();
 const suggestions=panel('Discover Spaces','gc-suggested-spaces');suggestions.append(link('Explore all Spaces →','spaces.html','gc-panel-more'));aside.append(suggestions);
 const topics=panel('Grow in faith','gc-faith-topics');
 for(const [label,copy,href]of [['Prayer','Stand with one another','prayer.html'],['Bible & discipleship','Build a life in the Word','grow.html'],['Fellowship','Encourage the family of faith','fellowship.html'],['Missions','Take Christ to the nations','missions.html']]){
  const a=link('',href,'gc-topic-row');a.append(make('strong',null,label),make('small',null,copy));topics.append(a);
 }aside.append(topics);
 const invitation=panel('A global family. United in Christ.','gc-world-invitation');
 invitation.append(make('p',null,'Together we take Christ to the nations of the world.'),link(e.detail.session?.user?.userId?'Discover believers':'Join the Community',e.detail.session?.user?.userId?'index.html#discover':'account.html#register','btn primary'));
 aside.append(invitation);
 const broadcast=aside.querySelector('.gc-broadcast-feature');
 const presence=aside.querySelector('.gc-presence-panel p');if(presence)presence.textContent='Online status is unavailable. Browse your connections below.';
 if(broadcast){
  // Live status is never inferred from a link to the ministry broadcaster.
  const title=broadcast.querySelector('h2');if(title)title.textContent='Word, worship & prayer';
  const button=broadcast.querySelector('.hk-live-button');if(button)button.textContent='Open ministry broadcasts →';
 }
 const composer=document.querySelector('.composer-card');
 if(composer&&!composer.querySelector('.gc-composer-submit')){
  const top=composer.querySelector('.composer-top');if(top){const post=make('button','gc-composer-submit','Create post');post.type='button';post.onclick=()=>composer.querySelector('.composer-prompt')?.click();top.append(post);}
 }
 controller=new AbortController();void spaces(suggestions,turn,controller);
}
window.addEventListener('hk-community-view-ready',mount);
window.addEventListener('hk-care-session',()=>{clear();document.body.classList.remove('gc-composed-dashboard');});
})();

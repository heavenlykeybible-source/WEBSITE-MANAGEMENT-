/* Shared visual shell. The existing application owns accounts, content and permissions. */
(()=>{'use strict';
let revision=0,lastSearch='',openedComposer='';const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
const icon=name=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');if(name==='globe'){const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');circle.setAttribute('cx','12');circle.setAttribute('cy','12');circle.setAttribute('r','9');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M3 12h18M12 3c-5 5-5 13 0 18m0-18c5 5 5 13 0 18');for(const n of [circle,path]){n.setAttribute('fill','none');n.setAttribute('stroke','currentColor');n.setAttribute('stroke-width','1.3');svg.append(n);}}else if(name==='search'||name==='plus'){const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',name==='search'?'M10 3a7 7 0 1 0 4.9 12l5 5 1.4-1.4-5-5A7 7 0 0 0 10 3Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z':'M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7Z');svg.append(path);}else{const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href','/assets/premium-icons.svg#'+name);svg.append(use);}return svg;};
const link=(label,href,cls)=>{const a=make('a',cls,label);a.href=href.startsWith('/')||/^https?:/.test(href)?href:'/'+href;return a;};
function follow(href){const a=link('',href);a.hidden=true;document.body.append(a);a.click();a.remove();}
function createPost(){const prompt=document.querySelector('.composer-prompt');if(prompt)prompt.click();else follow('index.html?compose=1');}
function avatar(session){const n=make('span','member-avatar'),image=make('img');image.alt='';image.width=44;image.height=44;const path=session?.profile?.profilePhotoKey||session?.profile?.profilePhotoUrl;image.src=typeof path==='string'&&/^\/(?!\/)/.test(path)&&!/[\\<>]/.test(path)?path:'/assets/default-human-avatar.svg';image.addEventListener('error',()=>{image.src='/assets/default-human-avatar.svg';},{once:true});n.append(image);return n;}
function header(session){
 const nav=document.querySelector('.top .nav');if(!nav)return;
 nav.querySelector('.reference-search')?.remove();nav.querySelector('.network-search')?.remove();
 const search=make('form','network-search');search.setAttribute('role','search');search.setAttribute('aria-label','Find believers');
 const input=make('input');input.type='search';input.name='people';input.maxLength=120;input.placeholder='Find believers, fellowship and purpose…';input.value=new URLSearchParams(location.search).get('people')||'';input.setAttribute('aria-label','Search believers by name or calling');
 const button=make('button');button.type='submit';button.setAttribute('aria-label','Search the community');button.append(icon('search'));search.append(button,input);
 search.addEventListener('submit',event=>{event.preventDefault();const query=input.value.trim();if(!query){input.focus();return;}follow('index.html?people='+encodeURIComponent(query)+'#discover');});
 nav.querySelector('.brand')?.after(search);
 nav.querySelector('.network-header-create')?.remove();
 const create=session?.user?.userId?make('button','network-header-create','Create post'):link('Join the community','account.html#register','network-header-create');
 if(create.tagName==='BUTTON'){create.type='button';create.addEventListener('click',createPost);}create.prepend(icon('plus'));nav.append(create);
}
function rail(nav,session){
 if(!nav.querySelector('.reference-member')){const profile=make('section','reference-member');profile.append(avatar(session),make('strong',null,session?.profile?.displayName||'A global family of faith'),link(session?.user?.userId?'View your profile':'Sign in or create an account',session?.user?.userId?'profile.html':'account.html#register'));nav.prepend(profile);}
 nav.querySelector('.network-rail-mission')?.remove();const mission=make('section','network-rail-mission');mission.append(icon('globe'),make('p','network-kicker','ONE FAITH. EVERY NATION.'),make('h2',null,'A world of connection. A life of purpose.'),make('p',null,'Encourage a believer. Share your testimony. Take Christ to the nations.'),link('Explore our mission','missions.html','network-rail-action'));nav.append(mission);
}
function memberWelcome(layout,session){
 const welcome=make('section','network-member-welcome');welcome.setAttribute('aria-labelledby','network-member-heading');const copy=make('div','network-member-copy'),heading=make('h1',null,'Connected in Christ. United in purpose.');heading.id='network-member-heading';
 copy.append(make('p','network-kicker','YOUR GLOBAL FAMILY OF FAITH'),heading,make('p',null,'Welcome back, '+(session.profile?.displayName||'believer')+'. Share hope, find fellowship and grow together.'));
 const actions=make('div','network-hero-actions'),create=make('button','network-hero-create','Share something meaningful');create.type='button';create.addEventListener('click',createPost);create.prepend(icon('plus'));actions.append(create,link('Discover Groups','groups.html','network-hero-link'));copy.append(actions);
 const art=make('div','network-world');art.setAttribute('aria-hidden','true');art.append(make('span','network-orbit orbit-one'),make('span','network-orbit orbit-two'),icon('globe'),make('span','network-world-note','FAITH WITHOUT BORDERS'));welcome.append(copy,art);layout.append(welcome);
}
function animateBanner(banner){
 if(banner.querySelector('.network-banner-art'))return;
 const image=banner.querySelector('img');if(!image)return;
 const art=make('div','network-banner-art'),sphere=make('span','network-banner-globe');sphere.setAttribute('aria-hidden','true');
 image.before(art);art.append(image,sphere);
 const control=make('button','network-globe-toggle','Pause globe');control.type='button';control.setAttribute('aria-pressed','false');control.setAttribute('aria-label','Pause the rotating centre globe');
 control.addEventListener('click',()=>{const paused=art.classList.toggle('network-globe-paused');control.textContent=paused?'Resume globe':'Pause globe';control.setAttribute('aria-pressed',String(paused));control.setAttribute('aria-label',(paused?'Resume':'Pause')+' the rotating centre globe');});
 control.hidden=reducedMotion.matches;
 (banner.querySelector('.gc-visitor-actions')||banner).append(control);
}
function guestWelcome(banner,layout){
 banner.classList.add('network-guest-banner');const features=banner.querySelector('.gc-welcome-features');
 if(features&&!banner.querySelector('.network-welcome-details')){const details=make('details','network-welcome-details');details.append(make('summary',null,'Discover what you can do here'));features.before(details);details.append(features);}
 layout.append(banner);
}
function sidePanels(aside){
 aside.querySelector('.network-explore-panel')?.remove();
 if(aside.querySelector('.gc-faith-topics'))return;
 const panel=make('section','card network-explore-panel');panel.append(make('p','network-kicker','GROW WITH PURPOSE'),make('h2',null,'Your next step in faith'));
 for(const [name,description,href,symbol] of [['Find fellowship','Meet believers with shared purpose','groups.html','users'],['Create a Space','Bring your ministry together','spaces.html','grid'],['Pray together','Encourage and stand with others','prayer.html','hands'],['Grow in the Word','Bible study and discipleship','grow.html','book']]){const a=link('',href,'network-explore-link'),copy=make('span');copy.append(make('strong',null,name),make('small',null,description));a.append(icon(symbol),copy,make('span','network-link-arrow','›'));panel.append(a);}aside.prepend(panel);
}
function footer(){
 const footer=document.querySelector('.community-footer');if(!footer||footer.querySelector('.network-footer-top'))return;
 const top=make('div','network-footer-top'),identity=make('div','network-footer-identity'),mark=make('img');mark.src='/assets/community-mark.svg';mark.alt='';mark.width=48;mark.height=48;identity.append(mark,make('strong',null,'Global Christian Social Network'),make('p',null,'Connecting believers. Building faith. Growing in Christ.'));
 const connect=make('div','network-footer-links');connect.append(make('h2',null,'Find your community'));for(const [title,href] of [['Home feed','index.html'],['Groups','groups.html'],['Spaces','spaces.html'],['Messages','messages.html']])connect.append(link(title,href));
 const grow=make('div','network-footer-links');grow.append(make('h2',null,'Live with purpose'));for(const [title,href] of [['Prayer','prayer.html'],['Grow in Christ','grow.html'],['Missions','missions.html'],['Safety & privacy','safety.html']])grow.append(link(title,href));
 top.append(identity,connect,grow);const invitation=footer.querySelector('[data-hk-eternity],[aria-label="Eternity in View"]');footer.replaceChildren(top);if(invitation)footer.append(invitation);footer.append(make('p','network-footer-motto','Together we take Christ to the nations of the world.'));
}
function apply(detail){
 const session=detail.session,home=detail.page==='home',layout=document.querySelector('.social-layout'),stream=layout?.querySelector('.social-stream'),nav=layout?.querySelector('.social-rail'),aside=layout?.querySelector('.social-sidebar');
 document.body.classList.add('network-design');document.body.classList.toggle('network-home',home);document.body.classList.toggle('network-member',!!session?.user?.userId);document.body.classList.toggle('network-guest',!session?.user?.userId);
 header(session);footer();if(!layout||!stream||!nav||!aside)return;
 rail(nav,session);sidePanels(aside);if(!session?.user?.userId){const banner=layout.querySelector('.gc-visitor-banner');if(banner)animateBanner(banner);}
 layout.querySelector('.network-member-welcome')?.remove();
 if(home){const banner=layout.querySelector('.gc-visitor-banner');if(!session?.user?.userId&&banner)guestWelcome(banner,layout);if(session?.user?.userId)memberWelcome(layout,session);const active=stream.querySelector('.gc-active-section');if(active){active.classList.add('network-wide-active');layout.append(active);}}
 const params=new URLSearchParams(location.search),query=params.get('people');
 if(home&&query&&lastSearch!==location.href){const form=document.querySelector('#discover form'),input=form?.querySelector('input');if(input){lastSearch=location.href;input.value=query;form.requestSubmit();document.querySelector('#discover')?.scrollIntoView({block:'start'});}}
 if(params.get('compose')==='1'&&openedComposer!==location.href){openedComposer=location.href;createPost();}
}
function standalone(){
 if(document.getElementById('page-root'))return;
 document.body.classList.add('network-standalone');
 if(!document.querySelector('.top .nav')){const top=make('header','top'),nav=make('nav','nav'),brand=link('','index.html','brand'),mark=make('img'),words=make('span','brand-words'),name=make('span','brand-name');mark.src='/assets/community-mark.svg';mark.alt='';name.append(make('span',null,'Global Christian'),make('span','brand-global','Social Network'));words.append(name,make('small',null,'FAITH · FELLOWSHIP · PURPOSE'));brand.append(mark,words);nav.append(brand);top.append(nav);document.body.prepend(top);}
 header(null);if(!document.querySelector('.community-footer'))document.body.append(make('footer','community-footer'));footer();
}
window.addEventListener('DOMContentLoaded',()=>queueMicrotask(standalone));
document.body.dataset.networkTheme='royal';document.body.classList.add('network-design');
window.addEventListener('hk-community-view-ready',event=>{const turn=++revision;queueMicrotask(()=>{if(turn===revision)apply(event.detail);});});
window.addEventListener('hk-care-session',()=>{revision++;});
document.addEventListener('visibilitychange',()=>document.body.classList.toggle('network-page-hidden',document.hidden));
reducedMotion.addEventListener?.('change',()=>{for(const control of document.querySelectorAll('.network-globe-toggle'))control.hidden=reducedMotion.matches;});
})();

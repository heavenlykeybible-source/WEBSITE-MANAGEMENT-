/* Heavenly Key Ministry Care Center — public, self-contained, non-CMS assistant.
 * A respectful automated navigation guide, not a human pastor or a paid AI service.
 * No private conversations, passwords or form values are transmitted or saved.
 */
(function(){
  'use strict';
  if(document.getElementById('hk-ministry-care'))return;
  const script=document.currentScript;
  const base=new URL('.',script?.src||location.href);
  const site=(document.body.dataset.hkCareSite==='community'||(document.body.hasAttribute('data-page')&&!!document.getElementById('authbar')))?'community':'ministry';
  const community='https://heavenly-key-global-community.heavenlykeyglobal-cd095c09.workers.dev/';
  const ministry='https://heavenlykey.org/';
  const paths={
    join:site==='community'?'account.html':community+'account.html',
    prayer:site==='community'?'prayer.html':ministry+'pages/community.html#prayer',
    grdpc:ministry+'pages/grdpc.html',
    radio:ministry+'pages/radio.html',
    about:ministry+'pages/the-ministry.html',
    evangelist:ministry+'pages/contact.html?subject=inquiry',
    faith:ministry+'pages/what-we-believe.html',
    salvation:site==='community'?'salvation.html':ministry+'pages/i-said-yes.html',
    help:site==='community'?'safety.html':ministry+'pages/contact.html',
    space:site==='community'?'spaces.html':'',
    groups:site==='community'?'groups.html':community+'groups.html',
    profile:site==='community'?'profile.html':'',
    account:site==='community'?'account.html':community+'account.html'
  };
  const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('ministry-care.css',base).href;style.dataset.hkCareStyle='1';document.head.append(style);
  const avatar=site==='community'?new URL('assets/community-network.svg',base).href:new URL('ministry-care-lady.webp',base).href;
  const logo=site==='community'?new URL('assets/community-mark.svg',base).href:new URL('../assets/ministry/logo.png',base).href;
  const mk=(tag,cls,txt)=>{
    const el=document.createElement(tag);if(cls)el.className='hkc-'+cls;if(txt!==undefined)el.textContent=txt;return el;
  };
  const root=mk('aside','root');root.id='hk-ministry-care';root.dataset.site=site;
  root.setAttribute('aria-label','Heavenly Key Evangelistic Movement Ministry Care Center');
  root.dataset.member='false';
  const collapsed=mk('button','launcher');collapsed.type='button';collapsed.setAttribute('aria-expanded','false');collapsed.setAttribute('aria-controls','hkc-panel');
  collapsed.setAttribute('aria-label','Open Ministry Care Center');
  const smallImg=mk('img','mini-face');smallImg.src=avatar;smallImg.alt='';smallImg.width=45;smallImg.height=45;smallImg.loading='lazy';
  const launcherText=mk('span','launcher-text','Ministry Care');
  const teaser=mk('span','teaser','How may we be of help to you today?');
  const mark=mk('span','launcher-mark','⌃');mark.setAttribute('aria-hidden','true');
  collapsed.append(smallImg,launcherText,teaser,mark);
  const panel=mk('section','panel');panel.id='hkc-panel';panel.hidden=true;panel.setAttribute('aria-label','Ministry care conversation');
  const head=mk('header','head');
  const crest=mk('img','logo');crest.src=logo;crest.alt='Heavenly Key Evangelistic Movement official logo';crest.width=52;crest.height=58;crest.loading='lazy';
  const heading=mk('div','heading');heading.append(mk('strong','ministry-name','Heavenly Key Evangelistic Movement'),mk('span','care-name','Ministry Care Center'));
  const controls=mk('div','header-buttons');
  const minimize=mk('button','head-button','−');minimize.type='button';minimize.setAttribute('aria-label','Minimize care center');
  const close=mk('button','head-button','×');close.type='button';close.setAttribute('aria-label','Dismiss care center for this visit');
  controls.append(minimize,close);head.append(crest,heading,controls);
  const flags=mk('div','flags');flags.setAttribute('aria-label','Global ministry across nations');
  for(const value of ['🇩🇪','🇬🇧','🇺🇸','🇨🇦','🇬🇭','🇳🇬','🇺🇬','🇵🇰','🇮🇳','🇫🇷']){const f=mk('span','flag',value);f.setAttribute('aria-hidden','true');flags.append(f);}
  const hero=mk('div','hero');
  const portrait=mk('img','portrait');portrait.src=avatar;portrait.alt='Illustrated ministry care guide';portrait.width=94;portrait.height=94;portrait.loading='lazy';
  const typed=mk('p','welcome');typed.setAttribute('aria-live','off');typed.textContent='How may we be of help to you today?';
  hero.append(portrait,typed);
  const feed=mk('div','messages');feed.setAttribute('role','log');feed.setAttribute('aria-label','Assistant conversation');feed.setAttribute('aria-live','polite');
  const actions=mk('nav','actions');actions.setAttribute('aria-label','Ministry help shortcuts');
  const options=[
    ['join','Join Community','♙'],
    ['prayer','Prayer Request','🙏'],
    ['grdpc','GRDPC','🌐'],
    ['radio','Listen to Radio','◉'],
    ['about','Learn More About the Ministry','▤'],
    ['evangelist','Speak with Evangelist Emmanuel','♡']
  ];
  for(const [key,label,symbol] of options){
    const b=mk('button','action');b.type='button';b.dataset.intent=key;
    if(['about','evangelist'].includes(key))b.classList.add('hkc-wide');
    const icon=mk('span','action-icon',symbol);icon.setAttribute('aria-hidden','true');
    b.append(icon,mk('span','action-label',label),mk('span','action-arrow','›'));actions.append(b);
  }
  const compose=mk('form','compose');compose.setAttribute('aria-label','Ask the ministry guide');
  const field=mk('input','input');field.type='text';field.name='message';field.maxLength=350;field.autocomplete='off';
  field.placeholder='Type your message here…';field.setAttribute('aria-label','Message for the automated ministry guide');
  const send=mk('button','send','➤');send.type='submit';send.setAttribute('aria-label','Send question to the guide');
  compose.append(field,send);
  const note=mk('p','disclosure','Automated guide • No messages are sent to a human. For personal assistance, use Contact Us.');
  panel.append(head,flags,hero,feed,actions,compose,note);
  root.append(collapsed,panel);document.body.append(root);
  let open=false,member=false,dismissed=false,typedTimer=0,quietTimer=0,acknowledged=false;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
  const visited=(()=>{try{return sessionStorage.getItem('hk-care-seen')==='1'}catch{return false}})();
  root.classList.toggle('hkc-returning',visited);
  function keepSeen(){try{sessionStorage.setItem('hk-care-seen','1')}catch{}}
  function message(role,text){
    const b=mk('p','message',text);b.classList.add('hkc-'+role);
    feed.append(b);while(feed.children.length>8)feed.firstChild.remove();
    feed.scrollTop=feed.scrollHeight;
  }
  function typeWelcome(){
    clearInterval(typedTimer);
    const full='How may we be of help to you today?';
    if(reduced||document.hidden){typed.textContent=full;return;}
    let position=0;typed.textContent='';
    typedTimer=setInterval(()=>{
      position=Math.min(full.length,position+1);typed.textContent=full.slice(0,position)+(position<full.length?'▏':'');
      if(position===full.length)clearInterval(typedTimer);
    },48);
  }
  function setOpen(value,byUser=false){
    if(dismissed)return;
    open=Boolean(value);panel.hidden=!open;collapsed.hidden=open;
    collapsed.setAttribute('aria-expanded',String(open));root.classList.toggle('hkc-expanded',open);
    clearInterval(typedTimer);
    if(open){
      root.classList.remove('hkc-attention');typeWelcome();if(!acknowledged){
        message('assistant',member?(root.dataset.greeting||'Welcome back.')+' I can guide you through fellowship, prayer, Groups and Spaces.':'Welcome to our community of believers. I am an automated ministry guide. How may I help you?');
        acknowledged=true;
      }
      if(byUser)field.focus({preventScroll:true});
    }else if(byUser)collapsed.focus({preventScroll:true});
    if(byUser)keepSeen();
    reposition();
  }
  function applyMember(detail){
    member=Boolean(detail?.user?.status==='active');
    root.dataset.member=String(member);
    if(member){
      root.classList.add('hkc-returning');root.classList.remove('hkc-attention');
      teaser.textContent='Ministry Care';
      const preferred=detail?.addressing?.greeting;
      const display=typeof detail?.profile?.displayName==='string'?detail.profile.displayName.trim():''; 
      const first=display.split(/\s+/)[0].replace(/[^\p{L}\p{M}'-]/gu,'').slice(0,32);
      const greet=typeof preferred==='string'&&preferred.length<120?preferred:(first?'Welcome, '+first+'.':'Welcome back.');
      root.dataset.greeting=greet;
    }else{
      root.dataset.greeting='';
      teaser.textContent='How may we be of help to you today?';
    }
    if(open&&member&&!acknowledged)message('assistant',root.dataset.greeting||'Welcome back to the community of believers.');
    reposition();
  }
  window.addEventListener('hk-care-session',e=>applyMember(e.detail));
  document.addEventListener('hk-care-session',e=>applyMember(e.detail));
  collapsed.addEventListener('click',()=>setOpen(true,true));
  minimize.addEventListener('click',()=>setOpen(false,true));
  close.addEventListener('click',()=>{
    setOpen(false);dismissed=true;root.hidden=true;try{sessionStorage.setItem('hk-care-dismissed','1')}catch{}
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&open)setOpen(false,true);});
  function guide(text){
    const value=String(text||'').trim().toLowerCase();
    if(!value)return null;
    const has=(re)=>re.test(value);
    if(has(/password|forgot|reset|sign.?in|login|log in|register|sign.?up|account/))return ['account',"I can guide you to the Community Account page for sign-in and account help. Please do not share your password here."];
    if(has(/pastor|evangelist|emmanuel|speak|human|leader|contact|call/))return ['evangelist','You can request to speak with Evangelist Emmanuel through the ministry contact form. A reply is subject to availability.'];
    if(has(/prayer request|pray for me|need prayer|prayer point|burden|anxious|feeling alone/))return ['prayer','You are welcome to share a prayer request through the ministry prayer page. Please do not include sensitive personal details in this chat.'];
    if(has(/grdpc|global prayer|midnight cry|solution hour|prayer meeting/))return ['grdpc','GRDPC is the Global Revival & Destiny Prayer Cry. Open the programme page for current prayer sessions and reminders.'];
    if(has(/radio|listen|broadcast|revival radio|audio/))return ['radio','You can listen to Online Revival Radio while exploring the ministry website.'];
    if(has(/space|create space|organization|group|fellowship|community feature/))return [has(/group|fellowship/)?'groups':'space','Community Spaces and Groups help believers fellowship, learn and serve together. Sign in to participate.'];
    if(has(/join|member|community|connect|register/))return ['join','You are warmly invited to join our Global Christian Community and grow in fellowship, prayer and sound biblical teaching.'];
    if(has(/salvation|saved|repent|born again|jesus|christ|gospel/))return ['salvation','Jesus Christ is central to our message. You can read the salvation page or speak with a minister for personal guidance.'];
    if(has(/belief|doctrine|faith|holiness|scripture|bible/))return ['faith','Our ministry holds to the Holy Bible and the published Statement of Faith. You can read What We Believe for our doctrinal convictions.'];
    if(has(/about|vision|ministry|movement|history|mission/))return ['about','Heavenly Key Evangelistic Movement is committed to taking Christ to the nations, discipleship and preparing believers for His coming.'];
    if(has(/hello|hi|good morning|good evening|how are you|thanks|thank you/))return [null,'Welcome to our community of believers. It is a joy to help you find fellowship, prayer and spiritual-growth resources.'];
    return ['help','I can guide you to prayer, GRDPC, Revival Radio, community registration, biblical teaching or a human ministry contact. What would you like help with?'];
  }
  function handleIntent(key){
    const item=options.find(x=>x[0]===key);
    if(item)message('user',item[1]);
    const responses={
      join:'You are warmly welcome. Open the community account page to join fellow believers.',
      prayer:'You can submit your prayer request through the prayer page.',
      grdpc:'Open GRDPC for the Global Revival & Destiny Prayer Cry programme.',
      radio:'Listen to Online Revival Radio on the ministry website.',
      about:'Learn about Heavenly Key Evangelistic Movement and our calling to take Christ to the nations.',
      evangelist:'For a personal request to speak with Evangelist Emmanuel, use the ministry contact form. He is not personally present in this automated chat.'
    };
    message('assistant',(responses[key]||'I can guide you to the right ministry page.')+' Select the link below to continue.');
    if(paths[key]){
      const previous=feed.querySelector('.hkc-follow-link');if(previous)previous.remove();
      const a=mk('a','follow-link','Open '+(item?item[1]:'help page')+' ↗');
      a.href=paths[key];a.target='_blank';a.rel='noopener noreferrer';feed.append(a);feed.scrollTop=feed.scrollHeight;
    }
  }
  actions.addEventListener('click',e=>{const item=e.target.closest('[data-intent]');if(item)handleIntent(item.dataset.intent);});
  compose.addEventListener('submit',e=>{
    e.preventDefault();const q=field.value.trim();if(!q)return;
    message('user',q.slice(0,350));field.value='';
    const response=guide(q);if(!response)return;
    message('assistant',response[1]);
    const previous=feed.querySelector('.hkc-follow-link');if(previous)previous.remove();
    if(response[0]&&paths[response[0]]){
      const a=mk('a','follow-link','Open the relevant page ↗');a.href=paths[response[0]];a.target='_blank';a.rel='noopener noreferrer';feed.append(a);
    }
    feed.scrollTop=feed.scrollHeight;
  });
  function reposition(){
    if(site==='community'){
      root.style.setProperty('--hkc-bottom',window.innerWidth<=720?'84px':'20px');
      return;
    }
    const radio=document.getElementById('hk-floating-radio');
    if(!radio||radio.classList.contains('hkr-closed')||getComputedStyle(radio).display==='none'){
      root.style.setProperty('--hkc-bottom','16px');return;
    }
    const dimensions=radio.getBoundingClientRect();const height=Math.max(0,Math.ceil(dimensions.height));
    root.style.setProperty('--hkc-bottom',Math.min(height+18,Math.max(90,innerHeight-180))+'px');
  }
  if(site==='ministry'){
    const observer=new MutationObserver(reposition);observer.observe(document.body,{childList:true,subtree:false,attributes:false});
    setTimeout(()=>{const radio=document.getElementById('hk-floating-radio');if(radio)observer.observe(radio,{attributes:true,attributeFilter:['class','style']});reposition();},1200);
  }
  window.addEventListener('resize',reposition,{passive:true});reposition();
  // Quietly acknowledge site exploration; persistent across pages for this browsing session.
  const explored=()=>{
    if(open||member||dismissed)return;
    root.classList.add('hkc-returning');root.classList.remove('hkc-attention');
    keepSeen();window.removeEventListener('scroll',onExplore);
  };
  const onExplore=()=>{if(window.scrollY>160)explored();};
  window.addEventListener('scroll',onExplore,{passive:true});
  try{dismissed=sessionStorage.getItem('hk-care-dismissed')==='1'}catch{}
  if(dismissed){root.hidden=true;return;}
  // Never auto-open the full conversation. First-time visitors get one soft, time-limited cue.
  if(!visited&&site==='ministry'&&!reduced){
    quietTimer=setTimeout(()=>{if(!open&&!document.hidden&&!member){root.classList.add('hkc-attention');setTimeout(()=>root.classList.remove('hkc-attention'),7200);}},2000);
  }else if(!visited&&!reduced){
    quietTimer=setTimeout(()=>{if(!open&&!member&&!document.hidden){root.classList.add('hkc-attention');setTimeout(()=>root.classList.remove('hkc-attention'),6400);}},2500);
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInterval(typedTimer);clearTimeout(quietTimer);root.classList.remove('hkc-attention');}});
  window.addEventListener('pagehide',()=>{clearInterval(typedTimer);clearTimeout(quietTimer);});
  // Kept separate from CMS, live messages, accounts, and broadcast audio.
})();
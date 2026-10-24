/* Publications belong inside the centre stream, including after async sign-in. */
(()=>{'use strict';
 let generation=0,controller=null;
 function mount(event){
  if(event?.detail?.page&&event.detail.page!=='home')return;
  const stream=document.querySelector('.social-stream');if(!stream||document.body.dataset.page!=='home')return;
  if(stream.querySelector('.hk-official-feed'))return;
  const turn=++generation;controller?.abort();controller=new AbortController();
  const root=document.createElement('section');root.className='hk-official-feed';root.dataset.cmsIgnore='';root.setAttribute('aria-label','Official ministry publications');
  const heading=document.createElement('h2');heading.textContent='Community publications';
  const note=document.createElement('p');note.textContent='Encouragement and conversations from our official community profiles.';
  const list=document.createElement('div');list.className='hk-official-posts';const status=document.createElement('p');status.setAttribute('role','status');
  const more=document.createElement('button');more.type='button';more.textContent='Load more publications';
  const archive=document.createElement('a');archive.href='/heavenly-key';archive.textContent='More community publications →';
  root.append(heading,note,list,status,more,archive);stream.append(root);let before=0,profiles=[],loading=false;const seen=new Set();
  async function load(){
   if(loading)return;loading=true;more.disabled=true;status.textContent='Loading publications…';const signal=controller.signal;
   try{
    if(!profiles.length){const r=await fetch('/api/ministry/profiles',{signal});if(!r.ok)throw Error();const data=await r.json();profiles=data.items||data.profiles||[];}
    const response=await fetch('/api/ministry/posts'+(before?'?before='+before:''),{signal});if(!response.ok)throw Error();const data=await response.json();
    if(turn!==generation||!root.isConnected)return;
    const posts=data.items||[];
    for(const post of posts){
     if(seen.has(post.post_id))continue;seen.add(post.post_id);
     const article=document.createElement('article'),author=document.createElement('a'),title=document.createElement('h3'),body=document.createElement('p'),profile=profiles.find(p=>p.id===post.profile_id);
     author.href='/heavenly-key';author.textContent=profile?.name||'Heavenly Key ministry';title.textContent=post.title;
     const full=String(post.body||''),excerpt=full.length>360?full.slice(0,360).trimEnd()+'…':full;body.textContent=excerpt;article.append(author,title,body);
     if(full.length>360){const expand=document.createElement('button');expand.type='button';expand.textContent='Read more';expand.setAttribute('aria-expanded','false');expand.onclick=()=>{const open=expand.getAttribute('aria-expanded')==='true';body.textContent=open?excerpt:full;expand.textContent=open?'Read more':'Show less';expand.setAttribute('aria-expanded',String(!open));};article.append(expand);}
     list.append(article);before=post.post_id;
    }
    more.hidden=posts.length<40;status.textContent=posts.length?'':'You have reached the last published ministry post.';
   }catch(e){if(turn===generation&&root.isConnected&&e.name!=='AbortError')status.textContent='Publications could not load. Please try again.';}
   finally{loading=false;more.disabled=false;}
  }
  more.onclick=load;void load();
 }
 window.addEventListener('hk-community-view-ready',mount);
 window.addEventListener('hk-care-session',()=>{generation++;controller?.abort();});
 // Never fall back to main: the app creates its stream asynchronously.
 if(document.querySelector('.social-stream'))mount();
})();

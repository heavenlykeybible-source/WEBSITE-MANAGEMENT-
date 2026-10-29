/* Full Bible Dictionary sidebar: shared canonical dictionary data, not a shortened duplicate. */
const SOURCE="https://raw.githubusercontent.com/heavenlykeybible-source/WEBSITE-MANAGEMENT-/main/apps/heavenly-key-bible/heavenly-key-website/bible/";
const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el};
export function mountFullDictionary(host){
 if(!host?.isConnected)return;
 host.replaceChildren();host.setAttribute('aria-label','Full Bible Dictionary');
 const title=make('h2','','BIBLE DICTIONARY'),intro=make('p','','Complete English dictionary with Hebrew and Greek word studies.');
 const search=make('input'),letters=make('select'),count=make('p'),results=make('div'),pager=make('div'),previous=make('button','','Previous'),next=make('button','','Next');
 search.type='search';search.placeholder='Search definitions, Hebrew, Greek or Strong’s numbers';search.setAttribute('aria-label','Search full Bible dictionary');
 for(const letter of ['All',...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']){const o=make('option','',letter);o.value=letter==='All'?'':letter;letters.append(o)}letters.setAttribute('aria-label','Choose first letter');
 previous.type=next.type='button';pager.append(previous,next);
 host.append(title,intro,search,letters,count,results,pager);
 host.style.cssText='background:#f1e9ff;color:#382057;border:2px solid #7742a7;border-radius:14px;padding:12px;margin:12px 0;font-size:14px;overflow-wrap:anywhere';
 title.style.cssText='font-size:18px;color:#5b2387;margin:4px 0';
 search.style.cssText='width:100%;box-sizing:border-box;border:2px solid #7742a7;background:white;color:#241334;padding:10px;border-radius:8px;font-size:14px';
 letters.style.cssText='width:100%;margin:8px 0;padding:8px;border:1px solid #7742a7;background:white;color:#241334';
 let dictionary=[],guide=[],page=0;const PAGE=12;
 const render=()=>{
  if(!host.isConnected)return;
  const q=search.value.trim().toLocaleLowerCase(),letter=letters.value;
  const filtered=dictionary.filter(e=>(!letter||e.term.toUpperCase().startsWith(letter))&&(!q||[e.term,e.meaning,e.explanation,...guide.filter(w=>w.english.toLocaleLowerCase()===e.term.toLocaleLowerCase()).flatMap(w=>[w.original,w.transliteration,w.strong,w.meaning])].some(x=>String(x||'').toLocaleLowerCase().includes(q))));
  page=Math.max(0,Math.min(page,Math.max(0,Math.ceil(filtered.length/PAGE)-1)));
  count.textContent=filtered.length+' of '+dictionary.length+' English entries · page '+(page+1);
  results.replaceChildren();
  for(const e of filtered.slice(page*PAGE,(page+1)*PAGE)){
   const card=make('article');card.style.cssText='border-top:1px solid #b9a2d3;padding:12px 0';
   const heading=make('h3','',e.term);heading.style.cssText='font-size:16px;color:#5b2387;margin:0 0 6px';
   card.append(heading,make('p','',e.meaning));
   if(e.explanation)card.append(make('p','',e.explanation));
   card.append(make('p','','Scripture: '+e.reference+' (KJV)'));
   const copy=make('button','','Copy definition');copy.type='button';copy.onclick=async()=>{try{await navigator.clipboard.writeText([e.term,e.meaning,e.explanation,e.reference].filter(Boolean).join('\n'));copy.textContent='Copied'}catch{copy.textContent='Copy unavailable'}};card.append(copy);
   const actions=make('div'),share=make('button','','Other Networks'),post=make('button','','Post to Community'),member=make('button','','Send to Member'),memberPanel=make('div'),memberSearch=make('input'),find=make('button','','Find Members'),memberResults=make('div'),feedback=make('p');
   const message=[e.term,e.meaning,e.explanation,'Scripture: '+e.reference+' (KJV)'].filter(Boolean).join('\\n');
   const api=async(path,method='GET',body)=>{const res=await fetch(path,{method,credentials:'same-origin',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data?.error?.message||'Request failed ('+res.status+')');return data};
   for(const b of [share,post,member,find])b.type='button';
   feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
   share.onclick=async()=>{try{if(navigator.share)await navigator.share({title:e.term+' — Bible Dictionary',text:message,url:location.href});else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(message+'\\n'+location.href);feedback.textContent='Dictionary entry copied for sharing.'}else feedback.textContent='Sharing is unavailable on this device.'}catch(err){if(err.name!=='AbortError')feedback.textContent='Sharing unavailable.'}};
   post.onclick=async()=>{if(!confirm('Publish '+e.term+' to the Global Christian Social Network?'))return;post.disabled=true;try{const me=await api('/api/me');if(me?.user?.status!=='active')throw Error('Please sign in before publishing.');await api('/api/posts','POST',{postFormat:'design_card',designCategory:'faith',title:e.term+' — Bible Dictionary',body:message,scripture:e.reference,postType:'post',visibility:'public',design:{templateId:'card-0',alignment:'center',fontSize:'standard',size:'portrait',decoration:'subtle'}});feedback.textContent='Dictionary entry submitted. Check its publishing or review status.'}catch(err){feedback.textContent=err.message}finally{post.disabled=false}};
   memberSearch.type='search';memberSearch.placeholder='Search member name';memberSearch.maxLength=80;memberSearch.setAttribute('aria-label','Find member to send dictionary entry');memberPanel.hidden=true;memberPanel.append(memberSearch,find,memberResults);
   member.onclick=()=>{memberPanel.hidden=!memberPanel.hidden;if(!memberPanel.hidden)memberSearch.focus()};
   find.onclick=async()=>{const q=memberSearch.value.trim();if(q.length<2){feedback.textContent='Enter at least two characters.';return}find.disabled=true;memberResults.replaceChildren();try{const me=await api('/api/me');if(me?.user?.status!=='active')throw Error('Sign in to send messages.');const data=await api('/api/discover?q='+encodeURIComponent(q));for(const person of (data.items||[]).slice(0,20)){const id=Number(person.user_id);if(!Number.isSafeInteger(id)||id<1||id===Number(me.user.userId))continue;const send=make('button','','Send to '+(person.display_name||'Member'));send.type='button';send.onclick=async()=>{if(!confirm('Send '+e.term+' to '+(person.display_name||'this member')+'?'))return;send.disabled=true;try{const convo=await api('/api/messages/requests','POST',{recipientUserId:id});if(convo.status==='accepted'&&convo.conversation_id){await api('/api/messages/'+encodeURIComponent(convo.conversation_id),'POST',{body:message,clientRequestId:crypto.randomUUID()});feedback.textContent='Dictionary entry delivered.'}else if(convo.status==='requested'){feedback.textContent='Message request sent. Delivery awaits acceptance.'}else feedback.textContent='Member cannot receive this message right now.'}catch(err){feedback.textContent=err.message}finally{send.disabled=false}};memberResults.append(send)}feedback.textContent=memberResults.children.length?'Choose a member to send the entry.':'No matching members found.'}catch(err){feedback.textContent=err.message}finally{find.disabled=false}};
   actions.append(share,post,member);card.append(actions,memberPanel,feedback);
   const groups=make('div');
   for(const language of ['Hebrew','Greek']){
    const button=make('button','',language+' ▾'),panel=make('div');button.type='button';button.setAttribute('aria-expanded','false');panel.hidden=true;panel.style.cssText='padding:8px;background:#fff;border:1px solid #b9a2d3;border-radius:6px';
    const matches=guide.filter(w=>w.english.toLocaleLowerCase()===e.term.toLocaleLowerCase()&&w.language===language);
    if(!matches.length)panel.append(make('p','','No reviewed direct '+language+' equivalent is included for this English term.'));
    for(const w of matches){panel.append(make('strong','',w.original+' — '+w.transliteration),make('p','','Strong’s: '+w.strong),make('p','','Meaning: '+w.meaning),make('p','','Scripture: '+w.reference));if(w.reviewStatus&&/requires independent/i.test(w.reviewStatus))panel.append(make('p','','Editorial entry: independent lexicon review pending.'));if(w.caution)panel.append(make('p','',w.caution))}
    button.onclick=()=>{const show=panel.hidden;for(const other of groups.querySelectorAll('div[data-language-panel]'))other.hidden=true;for(const other of groups.querySelectorAll('button')){other.setAttribute('aria-expanded','false');other.textContent=other.dataset.language+' ▾'}panel.hidden=!show;button.setAttribute('aria-expanded',String(show));button.textContent=language+(show?' ▴':' ▾')};
    button.dataset.language=language;panel.dataset.languagePanel='true';groups.append(button,panel);
   }
   card.append(groups);results.append(card);
  }
  if(!filtered.length)results.append(make('p','','No matching dictionary entry.'));
  previous.disabled=page===0;next.disabled=(page+1)*PAGE>=filtered.length;
 };
 search.oninput=()=>{page=0;render()};letters.onchange=()=>{page=0;render()};previous.onclick=()=>{page--;render()};next.onclick=()=>{page++;render()};
 count.textContent='Loading complete dictionary…';
 Promise.all([fetch(SOURCE+'dictionary.json').then(r=>{if(!r.ok)throw Error('Dictionary unavailable');return r.json()}),fetch(SOURCE+'original-language-guide.json').then(r=>r.ok?r.json():[]).catch(()=>[])]).then(([d,g])=>{if(!Array.isArray(d)||!d.every(x=>x.term&&x.meaning&&x.reference))throw Error('Invalid dictionary');dictionary=d;guide=Array.isArray(g)?g:[];render()}).catch(()=>{if(host.isConnected)count.textContent='Dictionary could not load. Please try again later.'});
}

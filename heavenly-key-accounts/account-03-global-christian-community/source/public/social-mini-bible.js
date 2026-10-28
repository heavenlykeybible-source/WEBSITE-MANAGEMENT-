const SAMPLE=[['Genesis',1,1,'In the beginning God created the heaven and the earth.'],['Psalms',23,1,'The LORD is my shepherd; I shall not want.'],['John',3,16,'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.']];
const WEB='https://global.heavenlykey.org';
const tag=(name,cls,text)=>{const e=document.createElement(name);if(cls)e.className=cls;if(text)e.textContent=text;return e};
export function mountMiniBible(host){
 if(!host?.isConnected)return;
 const title=tag('div','gc-bible-title'),icon=tag('span','','✦'),heading=tag('div');heading.append(tag('strong','','THE HOLY BIBLE'),tag('small','','Authorised King James Version'));title.append(icon,heading);
 const content=tag('div','gc-bible-content'),select=tag('select','gc-bible-select'),verse=tag('blockquote','gc-bible-verse'),reference=tag('strong','gc-bible-reference'),status=tag('p','gc-bible-status'),controls=tag('div','gc-bible-controls'),tools=tag('div','gc-bible-tools');
 select.setAttribute('aria-label','Choose a Bible passage');SAMPLE.forEach((p,i)=>{const o=tag('option','',p[0]+' '+p[1]+':'+p[2]);o.value=String(i);select.append(o)});select.value='1';
 const prev=tag('button','','‹ Previous'),next=tag('button','','Next ›');prev.type=next.type='button';
 const dictionary=tag('a','','Bible Dictionary'),concordance=tag('a','','Concordance');
 dictionary.href='https://onlinebible.heavenlykey.org/study-extensions.html#dictionary';concordance.href='https://onlinebible.heavenlykey.org/study-extensions.html#concordance';
 for(const a of [dictionary,concordance]){a.target='_blank';a.rel='noopener noreferrer'}
 const copy=tag('button','','Copy Verse'),share=tag('button','','Other Networks'),post=tag('button','','Post to Network'),member=tag('button','','Send to Member');for(const b of [copy,share,post,member])b.type='button';
 const full=tag('a','gc-bible-full','Read the Complete Bible · 66 Books ↗');full.href='https://onlinebible.heavenlykey.org/';full.target='_blank';full.rel='noopener noreferrer';
 const foot=tag('small','gc-bible-foot','Together we take Christ to the Nations of the World');
 const passage=()=>SAMPLE[Number(select.value)]||SAMPLE[1];
 const payload=()=>{const p=passage();return p[3]+' — '+p[0]+' '+p[1]+':'+p[2]+' (Authorised King James Version)\nJoin the Global Christian Social Network '+WEB};
 const render=()=>{const p=passage();reference.textContent=p[0]+' '+p[1]+':'+p[2];verse.textContent=p[3];prev.disabled=select.selectedIndex===0;next.disabled=select.selectedIndex===SAMPLE.length-1;status.textContent=''};
 select.onchange=render;prev.onclick=()=>{select.selectedIndex=Math.max(0,select.selectedIndex-1);render()};next.onclick=()=>{select.selectedIndex=Math.min(SAMPLE.length-1,select.selectedIndex+1);render()};
 copy.onclick=async()=>{try{await navigator.clipboard.writeText(payload());status.textContent='Verse copied.'}catch{status.textContent='Copy unavailable on this device.'}};
 share.onclick=async()=>{try{if(navigator.share)await navigator.share({title:reference.textContent,text:payload(),url:WEB});else{await navigator.clipboard.writeText(payload());status.textContent='Copied for sharing.'}}catch(e){if(e?.name!=='AbortError')status.textContent='Sharing unavailable.'}};
 post.onclick=async()=>{if(!confirm('Publish '+reference.textContent+' on the Global Christian Social Network?'))return;post.disabled=true;try{const me=await fetch('/api/me',{credentials:'same-origin'});if(!me.ok)throw Error('Please sign in before publishing.');const data=await me.json();if(data?.user?.status!=='active')throw Error('Please sign in before publishing.');const r=await fetch('/api/posts',{method:'POST',credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({postFormat:'design_card',designCategory:'faith',title:reference.textContent+' — Authorised King James Version',body:passage()[3]+'\\n\\nTogether we take Christ to the Nations of the World',scripture:reference.textContent,postType:'post',visibility:'public',design:{templateId:'card-0',alignment:'center',fontSize:'standard',size:'portrait',decoration:'subtle'}})});if(!r.ok)throw Error('Post could not be submitted ('+r.status+').');status.textContent='Scripture submitted to the social feed. Check its publishing or review status.'}catch(e){status.textContent=e.message}finally{post.disabled=false}};
 member.onclick=async()=>{try{await navigator.clipboard.writeText(payload());status.textContent='Verse copied for messaging. Opening member messages…';location.href='messages.html'}catch{status.textContent='Copy this scripture before opening Messages.'}};
 const note=tag('small','gc-bible-note','Quick passage reader. For chapter-by-chapter navigation, use the complete 66-book Bible. Posts are submitted only when you confirm. For member messages, the scripture is copied so you can paste it in the selected conversation.');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 controls.append(prev,next);tools.append(dictionary,concordance,copy,share,post,member);
 content.append(select,reference,verse,controls,tools,full,status,note,foot);host.replaceChildren(title,content);render();
}

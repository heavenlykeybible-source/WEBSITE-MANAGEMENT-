const BOOKS=[["Genesis","GEN"],["Exodus","EXO"],["Leviticus","LEV"],["Numbers","NUM"],["Deuteronomy","DEU"],["Joshua","JOS"],["Judges","JDG"],["Ruth","RUT"],["1 Samuel","1SA"],["2 Samuel","2SA"],["1 Kings","1KI"],["2 Kings","2KI"],["1 Chronicles","1CH"],["2 Chronicles","2CH"],["Ezra","EZR"],["Nehemiah","NEH"],["Esther","EST"],["Job","JOB"],["Psalms","PSA"],["Proverbs","PRO"],["Ecclesiastes","ECC"],["Song of Solomon","SNG"],["Isaiah","ISA"],["Jeremiah","JER"],["Lamentations","LAM"],["Ezekiel","EZE"],["Daniel","DAN"],["Hosea","HOS"],["Joel","JOL"],["Amos","AMO"],["Obadiah","OBA"],["Jonah","JON"],["Micah","MIC"],["Nahum","NAM"],["Habakkuk","HAB"],["Zephaniah","ZEP"],["Haggai","HAG"],["Zechariah","ZEC"],["Malachi","MAL"],["Matthew","MAT"],["Mark","MRK"],["Luke","LUK"],["John","JHN"],["Acts","ACT"],["Romans","ROM"],["1 Corinthians","1CO"],["2 Corinthians","2CO"],["Galatians","GAL"],["Ephesians","EPH"],["Philippians","PHP"],["Colossians","COL"],["1 Thessalonians","1TH"],["2 Thessalonians","2TH"],["1 Timothy","1TI"],["2 Timothy","2TI"],["Titus","TIT"],["Philemon","PHM"],["Hebrews","HEB"],["James","JAS"],["1 Peter","1PE"],["2 Peter","2PE"],["1 John","1JO"],["2 John","2JO"],["3 John","3JO"],["Jude","JUD"],["Revelation","REV"]];
const SOURCE='https://raw.githubusercontent.com/heavenlykeybible-source/WEBSITE-MANAGEMENT-/main/apps/heavenly-key-bible/heavenly-key-website/bible/data/kjv/';
const WEB='https://global.heavenlykey.org';
const tag=(name,cls,text)=>{const e=document.createElement(name);if(cls)e.className=cls;if(text)e.textContent=text;return e};
export function mountMiniBible(host){
 if(!host?.isConnected)return;
 const title=tag('div','gc-bible-title'),icon=tag('span','','✦'),heading=tag('div');heading.append(tag('strong','','THE HOLY BIBLE'),tag('small','','Authorised King James Version'));title.append(icon,heading);
 const content=tag('div','gc-bible-content'),book=tag('select','gc-bible-select'),chapter=tag('select','gc-bible-select'),select=tag('select','gc-bible-select'),verse=tag('blockquote','gc-bible-verse'),reference=tag('strong','gc-bible-reference'),status=tag('p','gc-bible-status'),controls=tag('div','gc-bible-controls'),tools=tag('div','gc-bible-tools');
 let loaded=null,loading=0;
 book.setAttribute('aria-label','Choose Bible book');chapter.setAttribute('aria-label','Choose chapter');select.setAttribute('aria-label','Choose verse');
 BOOKS.forEach(([name,code])=>{const o=tag('option','',name);o.value=code;book.append(o)});
 book.value='PSA';
 const current=()=>({book:loaded?.book||BOOKS.find(b=>b[1]===book.value)?.[0]||'',chapter:Number(chapter.value)||1,verse:Number(select.value)||1,text:loaded?.chapters?.[chapter.value]?.find(v=>v.number===Number(select.value))?.text||''});
 async function loadBook(preferredChapter=1,preferredVerse=1){
  const generation=++loading;status.textContent='Loading Bible text…';book.disabled=chapter.disabled=select.disabled=true;
  try{
   if(!/^[A-Z0-9]{3}$/.test(book.value))throw Error('Invalid Bible book');
   const response=await fetch(SOURCE+book.value+'.json',{cache:'force-cache'});
   if(!response.ok)throw Error('Bible text not available');
   const data=await response.json();
   if(generation!==loading)return;
   if(!data?.chapters||typeof data.book!=='string')throw Error('Bible data could not be verified');
   loaded=data;chapter.replaceChildren();
   Object.keys(data.chapters).sort((a,b)=>Number(a)-Number(b)).forEach(n=>{const o=tag('option','', 'Chapter '+n);o.value=n;chapter.append(o)});
   chapter.value=String(preferredChapter);if(!chapter.value)chapter.selectedIndex=0;
   fillVerses(preferredVerse);status.textContent='';
  }catch(e){if(generation===loading){loaded=null;chapter.replaceChildren();select.replaceChildren();verse.textContent='Please try another book or open the complete Bible.';reference.textContent='Bible unavailable';status.textContent='Bible text could not load. '+e.message}}
  finally{if(generation===loading){book.disabled=chapter.disabled=select.disabled=false}}
 }
 function fillVerses(preferred=1){select.replaceChildren();for(const v of loaded?.chapters?.[chapter.value]||[]){if(v.isPlaceholder)continue;const o=tag('option','','Verse '+v.number);o.value=String(v.number);select.append(o)}select.value=String(preferred);if(!select.value)select.selectedIndex=0;render()}
 book.onchange=()=>void loadBook();chapter.onchange=()=>fillVerses();select.onchange=render;
 const prev=tag('button','','‹ Previous'),next=tag('button','','Next ›');prev.type=next.type='button';
 const dictionary=tag('a','','Bible Dictionary'),concordance=tag('a','','Concordance');
 dictionary.href='https://onlinebible.heavenlykey.org/study-extensions.html#dictionary';concordance.href='https://onlinebible.heavenlykey.org/study-extensions.html#concordance';
 for(const a of [dictionary,concordance]){a.target='_blank';a.rel='noopener noreferrer'}
 const copy=tag('button','','Copy Verse'),share=tag('button','','Other Networks'),post=tag('button','','Post to Network'),member=tag('button','','Send to Member');for(const b of [copy,share,post,member])b.type='button';
 const full=tag('a','gc-bible-full','Read the Complete Bible · 66 Books ↗');full.href='https://onlinebible.heavenlykey.org/';full.target='_blank';full.rel='noopener noreferrer';
 const foot=tag('small','gc-bible-foot','Together we take Christ to the Nations of the World');
 const payload=()=>{const p=current();return p.text+' — '+p.book+' '+p.chapter+':'+p.verse+' (Authorised King James Version)\\nJoin the Global Christian Social Network '+WEB};
 const render=()=>{const p=current();reference.textContent=p.book+' '+p.chapter+':'+p.verse;verse.textContent=p.text||'Choose a verse';prev.disabled=!loaded||(Number(select.value)<=1&&Number(chapter.value)<=1);next.disabled=!loaded||(!loaded.chapters[chapter.value]?.some(v=>v.number>Number(select.value))&&Number(chapter.value)>=Object.keys(loaded.chapters).length);};
 prev.onclick=()=>{const n=Number(select.value);if(n>1){select.value=String(n-1);render()}else if(Number(chapter.value)>1){chapter.value=String(Number(chapter.value)-1);fillVerses(Number(loaded.chapters[chapter.value].at(-1)?.number||1))}};
 next.onclick=()=>{const n=Number(select.value);if(loaded?.chapters?.[chapter.value]?.some(v=>v.number===n+1)){select.value=String(n+1);render()}else if(Number(chapter.value)<Object.keys(loaded.chapters).length){chapter.value=String(Number(chapter.value)+1);fillVerses()}};
 copy.onclick=async()=>{try{await navigator.clipboard.writeText(payload());status.textContent='Verse copied.'}catch{status.textContent='Copy unavailable on this device.'}};
 share.onclick=async()=>{try{if(navigator.share)await navigator.share({title:reference.textContent,text:payload(),url:WEB});else{await navigator.clipboard.writeText(payload());status.textContent='Copied for sharing.'}}catch(e){if(e?.name!=='AbortError')status.textContent='Sharing unavailable.'}};
 post.onclick=async()=>{if(!confirm('Publish '+reference.textContent+' on the Global Christian Social Network?'))return;post.disabled=true;try{const me=await fetch('/api/me',{credentials:'same-origin'});if(!me.ok)throw Error('Please sign in before publishing.');const data=await me.json();if(data?.user?.status!=='active')throw Error('Please sign in before publishing.');const r=await fetch('/api/posts',{method:'POST',credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({postFormat:'design_card',designCategory:'faith',title:reference.textContent+' — Authorised King James Version',body:current().text+'\n\nTogether we take Christ to the Nations of the World',scripture:reference.textContent,postType:'post',visibility:'public',design:{templateId:'card-0',alignment:'center',fontSize:'standard',size:'portrait',decoration:'subtle'}})});if(!r.ok)throw Error('Post could not be submitted ('+r.status+').');status.textContent='Scripture submitted to the social feed. Check its publishing or review status.'}catch(e){status.textContent=e.message}finally{post.disabled=false}};
 member.onclick=async()=>{try{await navigator.clipboard.writeText(payload());status.textContent='Verse copied for messaging. Opening member messages…';location.href='messages.html'}catch{status.textContent='Copy this scripture before opening Messages.'}};
 const note=tag('small','gc-bible-note','Choose any of the 66 books, chapters and verses. Bible text loads on demand. Posts are submitted only when you confirm. For member messages, the scripture is copied so you can paste it in the selected conversation.');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 controls.append(prev,next);tools.append(dictionary,concordance,copy,share,post,member);
 content.append(book,chapter,select,reference,verse,controls,tools,full,status,note,foot);host.replaceChildren(title,content);void loadBook(23,1);
}

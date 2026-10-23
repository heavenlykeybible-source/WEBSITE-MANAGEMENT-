/* Heavenly Key Discipleship Center · lightweight, on-demand, KJV study library.
 * Public text only. No member data, passwords or social API responses stored offline. */
import {VERIFIED_HYMNS,hymnForDay} from './faith-content.js';
import {READING_YEAR,readingForDay,TODAY_REFLECTIONS} from './bible-catalog.js';
import {bibleFont,validBibleRef,moveBibleRef} from './bible-mobile-controls.js';
const root=document.getElementById('study-root');
const mode=document.body.dataset.study;
const CACHE='hk-kjv-opt-in-books-v1';
const make=(tag,value,cls)=>{const el=document.createElement(tag);if(value!==undefined&&value!==null)el.textContent=value;if(cls)el.className=cls;return el;};
const notice=(value)=>{const n=document.getElementById('study-status');if(n)n.textContent=value||'';};
function savePref(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}
function readPref(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
async function loadJSON(path){const r=await fetch(path);if(!r.ok)throw Error('Unable to load '+path+'.');return r.json();}
const manifest=await loadJSON('kjv-manifest.json').catch(e=>{root.append(make('p','The Bible catalogue is temporarily unavailable. Reconnect and reload.'));throw e;});
const books=manifest.books;
const byId=Object.fromEntries(books.map(b=>[b.id,b]));
const resolveBook=value=>books.find(b=>[b.id,b.name,b.path.split('/').pop().replace('.json','')].some(alias=>alias.toLowerCase()===String(value||'').toLowerCase()));
function validData(data,book){return data?.book===book.name&&Array.isArray(data.chapters)&&data.chapters.length===book.chapters&&data.chapters.every(chapter=>Array.isArray(chapter)&&chapter.length>0&&chapter.every(verse=>typeof verse==='string'&&verse.trim()));}
let currentBook=books.find(b=>b.id==='john')||books[0],currentChapter=1,loaded=null;
const recentlyRead=new Map();
const params=new URLSearchParams(location.search);
if(resolveBook(params.get('book')))currentBook=resolveBook(params.get('book'));
function pickChapter(n){return Number.isSafeInteger(n)?Math.max(1,Math.min(n,currentBook.chapters)):1;}
currentChapter=pickChapter(Number(params.get('chapter')||1));
async function getBook(book){
 if(recentlyRead.has(book.id))return recentlyRead.get(book.id);
 const url=new URL(book.path,location.href);
 let r;
 try{r=await fetch(url.href,{credentials:'same-origin'});if(!r.ok)throw Error('Bible book unavailable');}
 catch(e){if('caches' in window)r=await caches.open(CACHE).then(c=>c.match(url.href));if(!r)throw Error('Connect to the internet, or save this book for offline reading first.');}
 const json=await r.json();
 if(!validData(json,book))throw Error('Bible book failed its integrity check.');
 if(recentlyRead.size>=2)recentlyRead.delete(recentlyRead.keys().next().value);
 recentlyRead.set(book.id,json);
 return json;
}
function action(label,fn,cls='btn secondary'){const b=make('button',label,cls);b.type='button';b.addEventListener('click',fn);return b;}
function link(label,href,cls='btn secondary'){const a=make('a',label,cls);a.href=href;return a;}
const heading=(title,text)=>{root.append(make('h2',title));if(text)root.append(make('p',text,'study-subtitle'));};
function scriptureLines(host,verses){host.replaceChildren();verses.forEach((v,i)=>{const p=make('p',null,'kjv-verse');p.append(make('sup',String(i+1)),document.createTextNode(' '+v));host.append(p);});}
function bookSelect(){
 const select=make('select');select.setAttribute('aria-label','Choose KJV Bible book');
 for(const b of books){const op=make('option',b.name);op.value=b.id;select.append(op);}
 select.value=currentBook.id;return select;
}
function chapterSelect(){
 const select=make('select');select.setAttribute('aria-label','Choose chapter');
 for(let i=1;i<=currentBook.chapters;i++){const op=make('option','Chapter '+i);op.value=String(i);select.append(op);}
 select.value=String(currentChapter);return select;
}
async function bible(){
 // Keep the reading controls light. Never download the entire Bible automatically.
 const last=readPref('hk-kjv-last-ref-v1',null);
 if(!params.has('book')&&last){
  const ref=validBibleRef(books,last.book,last.chapter);
  if(ref){currentBook=byId[ref.book];currentChapter=ref.chapter;}
 }
 const storedSettings=readPref('hk-kjv-reader-settings-v1',{font:20,serif:false});
 let font=bibleFont(storedSettings.font),serif=storedSettings.serif===true,loadSerial=0;
 const area=make('section',null,'study-card mobile-kjv');
 const toolbar=make('div',null,'mobile-kjv-toolbar');
 const bookLabel=make('label','Book'),chapterLabel=make('label','Chapter');
 const book=bookSelect(),chapter=chapterSelect();
 book.id='kjv-book-picker';chapter.id='kjv-chapter-picker';
 bookLabel.htmlFor=book.id;chapterLabel.htmlFor=chapter.id;
 const bookCell=make('div',null,'mobile-kjv-picker'),chapterCell=make('div',null,'mobile-kjv-picker');
 bookCell.append(bookLabel,book);chapterCell.append(chapterLabel,chapter);
 const typography=make('div',null,'mobile-kjv-size');
 const smaller=action('A−',()=>changeFont(-2),'mobile-kjv-size-button');
 const larger=action('A+',()=>changeFont(2),'mobile-kjv-size-button');
 smaller.setAttribute('aria-label','Decrease Bible font size');
 larger.setAttribute('aria-label','Increase Bible font size');
 const size=make('output',String(font)+'px','mobile-kjv-size-label');
 size.setAttribute('aria-live','polite');
 typography.append(smaller,size,larger);
 toolbar.append(bookCell,chapterCell,typography);
 const intro=make('div',null,'mobile-kjv-intro');
 const label=make('p','KING JAMES VERSION · HOLY SCRIPTURE','mobile-kjv-eyebrow');
 const title=make('h2',null,'mobile-kjv-title');
 intro.append(label,title);
 const status=make('p',null,'mobile-kjv-status');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const verses=make('article',null,'kjv-reader mobile-kjv-verses');
 verses.setAttribute('aria-label','Chapter verses');
 const extras=make('details',null,'mobile-kjv-extras');
 extras.append(make('summary','Search, bookmarks and other tools'));
 const search=make('input'),results=make('div',null,'study-results');
 search.id='kjv-search';search.type='search';search.placeholder='Search this Bible book';
 search.autocomplete='off';search.setAttribute('aria-label','Search within current KJV Bible book');
 const searchLabel=make('label','Find a word in this book');searchLabel.htmlFor=search.id;
 const savedLabel=make('label','Open a saved chapter');
 const savedChapters=make('select');savedChapters.id='kjv-saved-chapters';savedLabel.htmlFor=savedChapters.id;
 const optionBar=make('div',null,'mobile-kjv-option-actions');
 const bookmark=action('☆ Bookmark chapter',saveBookmark);
 const copy=action('Copy chapter',copyChapter);
 const offline=action('Save this book offline',()=>setOffline(true));
 const remove=action('Remove offline copy',()=>setOffline(false));
 const fontStyle=action('Use classic font',toggleTypeface);
 const audio=link('Listen to this chapter →','audio-bible.html','btn secondary');
 optionBar.append(bookmark,copy,offline,remove,fontStyle,audio);
 extras.append(searchLabel,search,results,savedLabel,savedChapters,optionBar);
 const nav=make('nav',null,'mobile-kjv-nav');
 nav.setAttribute('aria-label','Previous and next Bible chapters');
 const prev=action('← Previous',()=>turn(-1),'mobile-kjv-nav-button');
 const next=action('Next →',()=>turn(1),'mobile-kjv-nav-button');
 const counter=make('span',null,'mobile-kjv-ref');
 nav.append(prev,counter,next);
 area.append(toolbar,intro,status,verses,extras,nav);
 root.append(area);
 document.body.classList.add('mobile-kjv-page');
 function applyFont(){
  font=bibleFont(font);
  verses.style.setProperty('--kjv-reader-font',font+'px');
  verses.classList.toggle('mobile-kjv-serif',serif);
  size.textContent=font+'px';
  smaller.disabled=font<=16;larger.disabled=font>=32;
  fontStyle.textContent=serif?'Use simple font':'Use classic font';
  savePref('hk-kjv-reader-settings-v1',{font,serif});
 }
 function changeFont(step){font+=step;applyFont();}
 function toggleTypeface(){serif=!serif;applyFont();}
 function showBookmarks(){
  savedChapters.replaceChildren();
  const hint=make('option','Choose a saved chapter');hint.value='';savedChapters.append(hint);
  const entries=readPref('hk-study-chapter-bookmarks-v1',[]);
  if(!Array.isArray(entries))return;
  for(const record of entries.slice().reverse()){
   const [id,ch]=String(record).split(':');
   const ref=validBibleRef(books,id,ch);
   if(!ref)continue;
   const opt=make('option',byId[id].name+' '+ref.chapter);
   opt.value=id+':'+ref.chapter;savedChapters.append(opt);
  }
 }
 function saveBookmark(){
  const key=currentBook.id+':'+currentChapter;
  const old=readPref('hk-study-chapter-bookmarks-v1',[]);
  const entries=Array.isArray(old)?old.filter(entry=>typeof entry==='string'):[];
  if(!entries.includes(key))entries.push(key);
  savePref('hk-study-chapter-bookmarks-v1',entries.slice(-100));
  showBookmarks();notice('Chapter saved on this phone.');
 }
 async function copyChapter(){
  if(!loaded)return;
  const content=loaded.chapters[currentChapter-1].map((v,i)=>(i+1)+'. '+v).join('\n');
  try{
   await navigator.clipboard.writeText(currentBook.name+' '+currentChapter+' (KJV)\n'+content);
   notice('Chapter copied.');
  }catch{notice('Copy is not available in this browser.');}
 }
 function refreshChapters(){
  chapter.replaceChildren();
  for(let n=1;n<=currentBook.chapters;n++){
   const option=make('option','Chapter '+n);option.value=String(n);chapter.append(option);
  }
  chapter.value=String(currentChapter);
 }
 function openRef(ref,scroll=true){
  const valid=validBibleRef(books,ref.book,ref.chapter);
  if(!valid)return;
  currentBook=byId[valid.book];currentChapter=valid.chapter;
  book.value=currentBook.id;refreshChapters();
  loadChapter();
  if(scroll)intro.scrollIntoView({block:'start',behavior:'auto'});
 }
 function turn(step){
  const ref=moveBibleRef(books,currentBook.id,currentChapter,step);
  if(ref)openRef(ref);
 }
 function searchBook(){
  results.replaceChildren();
  if(!loaded)return;
  const query=search.value.trim().toLowerCase();
  if(query.length<2)return;
  let count=0;
  for(let chapterNum=0;chapterNum<loaded.chapters.length;chapterNum++){
   for(let verseNum=0;verseNum<loaded.chapters[chapterNum].length;verseNum++){
    const text=loaded.chapters[chapterNum][verseNum];
    if(!text.toLowerCase().includes(query))continue;
    const jump=action(currentBook.name+' '+(chapterNum+1)+':'+(verseNum+1)+' — '+text.slice(0,155),()=>{
     extras.open=false;openRef({book:currentBook.id,chapter:chapterNum+1});
    },'study-result');
    results.append(jump);
    if(++count>=50)break;
   }
   if(count>=50)break;
  }
  if(count===0)results.append(make('p','No matching verses in this book.'));
  if(count>=50)results.append(make('small','Showing 50 matches. Narrow your search to see more.'));
 }
 async function loadChapter(){
  const id=++loadSerial,selectedBook=currentBook,selectedChapter=currentChapter;
  loaded=null;
  title.textContent=selectedBook.name+' '+selectedChapter;
  counter.textContent=selectedBook.name+' '+selectedChapter;
  status.textContent='Opening chapter…';
  chapter.value=String(selectedChapter);
  verses.replaceChildren();search.value='';results.replaceChildren();
  audio.href='audio-bible.html?book='+encodeURIComponent(selectedBook.id)+'&chapter='+selectedChapter;
  prev.disabled=!moveBibleRef(books,selectedBook.id,selectedChapter,-1);
  next.disabled=!moveBibleRef(books,selectedBook.id,selectedChapter,1);
  const url=new URL(location.href);
  url.searchParams.set('book',selectedBook.id);url.searchParams.set('chapter',String(selectedChapter));
  history.replaceState(null,'',url.pathname+url.search);
  savePref('hk-kjv-last-ref-v1',{book:selectedBook.id,chapter:selectedChapter});
  try{
   const data=await getBook(selectedBook);
   if(id!==loadSerial)return;
   loaded=data;
   scriptureLines(verses,data.chapters[selectedChapter-1]);
   status.textContent='';
   notice('KJV — '+selectedBook.name+' '+selectedChapter);
  }catch(error){
   if(id!==loadSerial)return;
   status.textContent=error.message||'This chapter could not load; reconnect and try again.';
   verses.replaceChildren(action('Retry loading this chapter',()=>loadChapter(),'btn secondary'));
   notice(status.textContent);
  }
 }
 async function setOffline(save){
  if(!('caches' in window)){notice('Offline storage is unavailable on this device.');return;}
  const selected=currentBook,url=new URL(selected.path,location.href).href;
  try{
   const cache=await caches.open(CACHE);
   if(!save){
    await cache.delete(url);notice('Offline copy of '+selected.name+' removed.');return;
   }
   const response=await fetch(url,{credentials:'same-origin'});
   if(!response.ok)throw Error('Cannot load book');
   if(!validData(await response.clone().json(),selected))throw Error('Book integrity check failed');
   await cache.put(url,response.clone());
   notice(selected.name+' saved for offline reading.');
  }catch{notice('Offline storage failed. Check your internet connection and free space.');}
 }
 book.addEventListener('change',()=>openRef({book:book.value,chapter:1},false));
 chapter.addEventListener('change',()=>openRef({book:currentBook.id,chapter:Number(chapter.value)},false));
 savedChapters.addEventListener('change',()=>{
  const [id,ch]=savedChapters.value.split(':');
  openRef({book:id,chapter:Number(ch)});
  savedChapters.value='';
 });
 search.addEventListener('input',searchBook);
 // Swipe along the Scripture only; vertical scrolling or selection remains native.
 let start=null;
 verses.addEventListener('touchstart',event=>{
  if(event.touches.length===1)start={x:event.touches[0].clientX,y:event.touches[0].clientY};
 },{passive:true});
 verses.addEventListener('touchend',event=>{
  if(!start||event.changedTouches.length!==1)return;
  const dx=event.changedTouches[0].clientX-start.x;
  const dy=event.changedTouches[0].clientY-start.y;
  start=null;
  if(Math.abs(dx)>110&&Math.abs(dx)>Math.abs(dy)*2&&!window.getSelection()?.toString())turn(dx<0?1:-1);
 },{passive:true});
 applyFont();showBookmarks();await loadChapter();
}
export function readingPlan(){return READING_YEAR;}
async function devotional(){
 heading('Daily KJV Discipleship Plan','A complete 365-day KJV reading journey with morning and evening Scripture. Daily excerpts are loaded from a small reviewed index without downloading entire Bible books.');
 const dates=readingPlan(),day=readingForDay().day-1;
 const excerpts=await loadJSON('daily-reading-excerpts.json').catch(()=>null);
 const c=make('section',null,'study-grid');

 for(const [n,slot,index] of [[0,'Morning devotion',day],[1,'Evening devotion',(day+181)%365]]){
  const reading=dates[index],card=make('article',null,'study-card'),title=make('h3',slot),ref=make('strong',reading.book+' '+reading.chapter),preview=make('blockquote');
  const book=books.find(x=>x.name===reading.book),item=excerpts?.readings?.[index];
  if(item&&item.book===reading.book&&item.chapter===reading.chapter&&item.verse){
   preview.textContent=item.verse+' — '+reading.book+' '+reading.chapter+':1 (KJV)';
  }else{preview.textContent='Read the full KJV chapter when connected to the internet.';}
  const open=link('Read full chapter →','bible.html?book='+encodeURIComponent(book.id)+'&chapter='+reading.chapter);
  card.append(title,ref,preview,make('p',TODAY_REFLECTIONS[(index+n)%TODAY_REFLECTIONS.length]),open);c.append(card);
 }
 root.append(make('p','Day '+(day+1)+' of 365 · Reflections are devotional commentary, not Bible quotations.'),c);
 root.append(make('p','Only short daily excerpts are loaded here. The full KJV chapter opens on request; opt-in reminders are separate from background push, which is not yet enabled.','study-fine'));
}
function hymns(){
 heading('Christian Hymn Library','Classical, rights-reviewed hymn texts; search by title, author or theme. Modern recordings and uncleared arrangements are not included.');
 const c=make('section',null,'study-grid'),list=make('div',null,'study-card'),viewer=make('article',null,'study-card'),search=make('input'),results=make('div',null,'hymn-items');
 search.type='search';search.placeholder='Search hymns';search.setAttribute('aria-label','Search approved hymn texts');
 list.append(search,results);c.append(list,viewer);root.append(c);
 const show=(h)=>{viewer.replaceChildren(make('h3',h.title),make('p','By '+h.author+' · '+h.theme),make('pre',h.stanza,'hymn-full-text'),make('p','Scripture connection: '+(h.scripture||'See the Bible reader')));viewer.append(link('View historical source ↗',h.textSource));viewer.querySelector('a').target='_blank';viewer.querySelector('a').rel='noopener noreferrer';};
 const render=()=>{results.replaceChildren();const v=search.value.toLocaleLowerCase().trim();let count=0;for(const h of VERIFIED_HYMNS){if(![h.title,h.author,h.theme,h.scripture].join(' ').toLocaleLowerCase().includes(v))continue;results.append(action(h.title,()=>show(h),'hymn-choice'));count++;}if(!count)results.append(make('p','No approved hymns match this search.'));};
 search.addEventListener('input',render);render();show(hymnForDay());root.append(make('p','Nine additional historic hymns are held for doctrinal and rights review before appearing in this public library.','study-fine'));
}
if(!root)throw Error('Study container unavailable.');
if(mode==='bible')await bible();
else if(mode==='hymns')hymns();
else if(mode==='devotional')await devotional();
else root.replaceChildren(make('p','Unknown study page.'));


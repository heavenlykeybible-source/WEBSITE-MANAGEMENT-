(()=>{'use strict';
const $=id=>document.getElementById(id),escape=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const KEY='hk-read-pray-v2',DONE='hk-read-pray-completion-v2',LEGACY='hk-read-pray';
const localDay=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const hash=s=>{let n=2166136261;for(const c of s){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;};
const safeSettings=()=>{try{const s=JSON.parse(localStorage.getItem(KEY)||localStorage.getItem(LEGACY)||'null');return s&&typeof s==='object'?s:null;}catch{return null;}};
const textIndex=new Map(),state={};let booksLoaded=false,loading=null,lastChecked='';let dictionaryPage=0;
let readingSequence=0;let concordanceSequence=0;let notificationPending=false;
const chapterCache=new Map();
async function showDailyScripture(reference){
 const target=$('daily-scripture');if(!target)return;
 const sequence=++readingSequence;
 target.textContent='Loading today’s KJV reading…';
 const match=/^(.+?) (\d+):(\d+)$/.exec(String(reference||'').trim());
 const book=match&&state.manifest?.books?.find(b=>String(b.name||'').toLocaleLowerCase()===match[1].toLocaleLowerCase());
 if(!book){target.textContent='Reading reference unavailable; open the Bible reader to search manually.';return;}
 const chapter=Number(match[2]),verse=Number(match[3]);
 try{
  const key=book.code;
  if(!chapterCache.has(key))chapterCache.set(key,fetch('./data/kjv/'+encodeURIComponent(book.code)+'.json').then(r=>{if(!r.ok)throw Error('Bible text unavailable');return r.json();}).catch(e=>{chapterCache.delete(key);throw e;}));
  const data=await chapterCache.get(key);
  if(sequence!==readingSequence)return;
  const chapterData=data.chapters?.[String(chapter)];const verses=Array.isArray(chapterData)?chapterData:(Array.isArray(chapterData?.verses)?chapterData.verses:[]);const entry=verses.find(v=>Number(v.number)===verse);
  if(!entry)throw Error('Verse not found');
  target.replaceChildren();
  const title=document.createElement('strong');title.textContent=reference+' (KJV)';
  const verseText=document.createElement('p');verseText.textContent=entry.text;
  target.append(title,verseText);
 }catch(e){if(sequence===readingSequence)target.textContent='Could not load this passage. Try again with an internet connection or open the offline Bible.';}
}

function allBooks(){return state.manifest?.books||[];}
function loadBooks(){if(booksLoaded)return Promise.resolve();if(loading)return loading;loading=(async()=>{let errors=[];for(const b of allBooks()){try{const r=await fetch('./data/kjv/'+encodeURIComponent(b.code)+'.json');if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();for(const [ch,chapterData] of Object.entries(data.chapters||{})){const verses=Array.isArray(chapterData)?chapterData:(Array.isArray(chapterData?.verses)?chapterData.verses:[]);for(const v of verses){const ref=`${b.name} ${ch}:${v.number}`,t=v.text||'';const words=t.toLowerCase().match(/[a-z]+(?:['’][a-z]+)*/g)||[];const counts=new Map();for(const word of words)counts.set(word,(counts.get(word)||0)+1);for(const [word,n] of counts){if(!textIndex.has(word))textIndex.set(word,[]);textIndex.get(word).push({ref,text:t,n,book:b.code,chapter:ch});}}}}catch(e){errors.push(b.name);}}state.failed=errors;if(errors.length){textIndex.clear();throw new Error('Concordance incomplete: unable to load '+errors.length+' Bible book(s): '+errors.join(', ')+'. Check your connection and search again.');}booksLoaded=true;})();return loading.finally(()=>{if(!booksLoaded)loading=null;});}
function setupDictionaryLetters(){
 const nav=$('dict-letters');if(!nav)return;
 for(const letter of ['All',...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']){
  const button=document.createElement('button');button.type='button';button.className='dict-letter';button.textContent=letter;button.setAttribute('aria-pressed',String(letter==='All'));
  button.addEventListener('click',()=>{$('letter').value=letter==='All'?'':letter;dictionaryPage=0;for(const b of nav.children)b.setAttribute('aria-pressed',String(b===button));renderDictionary();});nav.append(button);
 }
 $('letter').addEventListener('change',()=>{for(const b of nav.children)b.setAttribute('aria-pressed',String(b.textContent===($('letter').value||'All')));});
}
setupDictionaryLetters();
function renderDictionary(){
 if(!state.dictionary)return;
 const query=$('dict').value.trim().toLocaleLowerCase(),letter=$('letter').value;
 const languageIndex=new Map();for(const item of state.originalGuide||[]){const key=String(item.english||'').trim().toLocaleLowerCase();if(!languageIndex.has(key))languageIndex.set(key,[]);languageIndex.get(key).push(item);}
 const matches=state.dictionary.filter(e=>(!letter||e.term[0].toUpperCase()===letter)&&(!query||[e.term,e.meaning,e.explanation,...(languageIndex.get(e.term.trim().toLocaleLowerCase())||[]).flatMap(w=>[w.original,w.transliteration,w.strong,w.meaning])].some(v=>String(v||'').toLocaleLowerCase().includes(query))));
 const pageSize=25,totalPages=Math.max(1,Math.ceil(matches.length/pageSize));dictionaryPage=Math.max(0,Math.min(dictionaryPage,totalPages-1));
 const start=dictionaryPage*pageSize;
 $('dict-count').textContent=`${matches.length} matching entries · page ${dictionaryPage+1} of ${totalPages}`;
 $('dict-results').replaceChildren();
 for(const e of matches.slice(start,start+pageSize)){
   const card=document.createElement('article');card.className='result';card.setAttribute('aria-label',e.term+' dictionary definition');
   const title=document.createElement('h3');title.className='dict-entry-title';title.textContent=e.term;card.append(title);
   const meaning=document.createElement('div');meaning.textContent=e.meaning;card.append(meaning);
   if(e.explanation){const explanation=document.createElement('p');explanation.textContent=e.explanation;card.append(explanation);}
   const actions=document.createElement('div');actions.className='dict-actions';
   const copy=document.createElement('button');copy.type='button';copy.textContent='Copy';copy.setAttribute('aria-label','Copy '+e.term+' definition');
   copy.addEventListener('click',async()=>{const value=[e.term,e.meaning,e.explanation,e.reference].filter(Boolean).join('\n');try{await navigator.clipboard.writeText(value);copy.textContent='Copied';}catch{const area=document.createElement('textarea');area.value=value;area.style.position='fixed';area.style.left='-9999px';document.body.append(area);area.select();let ok=false;try{ok=document.execCommand('copy');}catch{}finally{area.remove();}copy.textContent=ok?'Copied':'Copy unavailable';}});
   actions.append(copy);
   const share=document.createElement('button');share.type='button';share.textContent='Share to other networks';share.setAttribute('aria-label','Share '+e.term+' Bible dictionary definition');
   share.addEventListener('click',async()=>{
    const message=[e.term,e.meaning,e.explanation,'Scripture: '+e.reference+' (KJV)'].filter(Boolean).join('\\n');
    const url=new URL('./dictionary',location.href).href;
    try{if(navigator.share){await navigator.share({title:e.term+' — Bible Dictionary',text:message,url});return;}}catch(error){if(error?.name==='AbortError')return;}
    try{await navigator.clipboard.writeText(message+'\\n'+url);share.textContent='Copied for sharing';}
    catch{window.prompt('Copy dictionary definition to share:',message+'\\n'+url);}
   });actions.append(share);
   const ref=document.createElement('button');ref.type='button';ref.className='dict-verse-button';ref.textContent='Read KJV: '+e.reference;ref.setAttribute('aria-label','Show KJV verse '+e.reference);ref.addEventListener('click',async()=>{
  let passage=card.querySelector('.dict-verse-text');
  if(passage){passage.remove();return;}
  passage=document.createElement('p');passage.className='dict-verse-text';passage.textContent='Loading KJV verse…';card.append(passage);
  const match=/^(.+?) (\d+):(\d+)$/.exec(String(e.reference||'').trim());
  const book=match&&allBooks().find(book=>String(book.name||'').toLocaleLowerCase()===match[1].toLocaleLowerCase());
  if(!book){passage.textContent='Reference unavailable in the included KJV.';return;}
  try{
    let promise=chapterCache.get(book.code);
    if(!promise){promise=fetch('./data/kjv/'+encodeURIComponent(book.code)+'.json').then(r=>{if(!r.ok)throw Error('KJV text unavailable');return r.json();}).catch(error=>{chapterCache.delete(book.code);throw error;});chapterCache.set(book.code,promise);}
    const data=await promise;
    if(!passage.isConnected)return;
    const chapter=data.chapters?.[match[2]];const verses=Array.isArray(chapter)?chapter:(Array.isArray(chapter?.verses)?chapter.verses:[]);const verse=verses.find(v=>String(v.number)===match[3]);
    passage.textContent=verse?.text||'Verse unavailable.';
  }catch{if(passage.isConnected)passage.textContent='Unable to open KJV verse. Check offline downloads or reconnect.';}
 });actions.append(ref);
   // Let readers continue a dictionary study into an actual whole-Bible word search.
   // Only use a single-word entry; multiword dictionary titles might contain punctuation.
   if(/^[A-Za-z]+(?:['’][A-Za-z]+)*$/.test(e.term)){
    const concordanceButton=document.createElement('button');
    concordanceButton.type='button';
    concordanceButton.textContent='Find in KJV concordance';
    concordanceButton.setAttribute('aria-label','Search KJV concordance for '+e.term);
    concordanceButton.addEventListener('click',()=>{
     $('word').value=e.term;
     $('concordance-form').requestSubmit();
     $('concordance-form').scrollIntoView({behavior:'smooth',block:'start'});
    });
    actions.append(concordanceButton);
   }
   const languageEntries=languageIndex.get(e.term.trim().toLocaleLowerCase())||[];
   const languageButtons=document.createElement('div');languageButtons.className='dict-language-buttons';languageButtons.setAttribute('aria-label','Original-language meanings for '+e.term);
   for(const language of ['Hebrew','Greek']){
    const button=document.createElement('button');button.type='button';button.className='dict-language-button';button.textContent=language+' ▾';button.setAttribute('aria-expanded','false');
    const panel=document.createElement('div');panel.className='dict-language-panel';panel.hidden=true;panel.id='dict-'+String(e.term).toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-'+language.toLowerCase();button.setAttribute('aria-controls',panel.id);
    const words=languageEntries.filter(item=>item.language===language);
    if(!words.length){const note=document.createElement('p');note.textContent=!state.originalGuideLoaded?'Original-language data is unavailable or still loading. Please try again later.':'A verified '+language+' equivalent has not yet been established for this English entry. Some English Bible terms do not have a direct one-word equivalent in both original languages. No translation is supplied rather than displaying an inaccurate one.';panel.append(note);}
    else for(const item of words){
     const heading=document.createElement('h4');heading.textContent=item.original+' — '+item.transliteration;
     const strong=document.createElement('p');strong.textContent='Strong’s number: '+item.strong;
     const meaning=document.createElement('p');meaning.textContent='Meaning: '+item.meaning;
     const reference=document.createElement('p');reference.textContent='Scripture: '+item.reference+' (KJV)';
     const caution=document.createElement('p');caution.textContent=(item.reviewStatus&&item.reviewStatus.includes('requires independent')?'Editorial draft — pending lexicon review. ':'')+(item.caution||'Meanings depend on biblical context.');
     panel.append(heading,strong,meaning,reference,caution);
    }
    button.addEventListener('click',()=>{const show=panel.hidden;for(const other of languageButtons.querySelectorAll('.dict-language-panel'))other.hidden=true;for(const other of languageButtons.querySelectorAll('.dict-language-button')){other.setAttribute('aria-expanded','false');other.textContent=other.dataset.language+' ▾';}panel.hidden=!show;button.setAttribute('aria-expanded',String(show));button.textContent=language+(show?' ▴':' ▾');});button.dataset.language=language;
    const group=document.createElement('div');group.className='dict-language-group';group.append(button,panel);languageButtons.append(group);
   }
   card.append(languageButtons);
   card.append(actions);$('dict-results').append(card);
 }
 if(!matches.length){const empty=document.createElement('p');empty.textContent='No entry found yet. This does not mean the word is absent from Scripture.';$('dict-results').append(empty);}
 $('dict-prev').disabled=dictionaryPage===0;$('dict-next').disabled=dictionaryPage>=totalPages-1;
}

function renderOriginalLanguageGuide(){
 const panel=$('original-results'),status=$('original-count'),input=$('original-query');
 if(!panel||!status||!input)return;
 const query=input.value.trim().toLocaleLowerCase();
 const matches=(state.originalGuide||[]).filter(e=>[e.english,e.language,e.strong,e.original,e.transliteration,e.meaning].some(v=>String(v||'').toLocaleLowerCase().includes(query)));
 panel.replaceChildren();status.textContent=`${matches.length} matching original-language word entries · ${(state.originalGuide||[]).length} educational entries`;
 for(const e of matches.slice(0,40)){
  const card=document.createElement('article');card.className='result';
  const header=document.createElement('strong');header.textContent=`${e.english} — ${e.strong} (${e.language})`;
  const original=document.createElement('p');original.textContent=`${e.original} · ${e.transliteration}`;
  const meaning=document.createElement('p');meaning.textContent='Simple meaning: '+e.meaning;
  const context=document.createElement('p');context.textContent='Study carefully: '+e.caution;
  const reference=document.createElement('p');reference.textContent='Read in context: '+e.reference;
  card.append(header,original,meaning,context,reference);
  // These are independent English KJV searches, not verse-level Strong's mappings.
  const actions=document.createElement('div');actions.className='actions';
  const english=String(e.english||'').trim();
  if(/^[a-z]+(?:['’][a-z]+)*$/i.test(english)){
   const find=document.createElement('button');find.type='button';
   find.textContent='Find English word in KJV';
   find.setAttribute('aria-label','Search every KJV occurrence of the English word '+english);
   find.addEventListener('click',()=>{
    $('word').value=english;$('concordance-form').requestSubmit();
    $('concordance-form').scrollIntoView({behavior:'smooth',block:'start'});
   });actions.append(find);
  }
  const match=/^(.+?) (\d+):(\d+)$/.exec(e.reference||'');
  const book=allBooks().find(book=>book.name===match?.[1]);
  if(book){
   const read=document.createElement('button');read.type='button';read.textContent='Read example KJV verse';
   read.addEventListener('click',async()=>{
    let verseNode=card.querySelector('.original-verse');
    if(verseNode){verseNode.remove();return;}
    verseNode=document.createElement('p');verseNode.className='original-verse';verseNode.textContent='Loading KJV…';card.append(verseNode);
    try{
     let promise=chapterCache.get(book.code);
     if(!promise){promise=fetch('./data/kjv/'+encodeURIComponent(book.code)+'.json').then(r=>{if(!r.ok)throw Error('KJV text unavailable');return r.json();}).catch(error=>{chapterCache.delete(book.code);throw error;});chapterCache.set(book.code,promise);}
     const data=await promise;
     const verse=(data.chapters?.[match[2]]||[]).find(v=>String(v.number)===match[3]);
     if(verseNode.isConnected)verseNode.textContent=verse?.text||'KJV verse unavailable.';
    }catch{if(verseNode.isConnected)verseNode.textContent='Unable to load KJV verse. Check offline downloads or reconnect.';}
   });actions.append(read);
  }
  card.append(actions);panel.append(card);
 }
 if(!matches.length)panel.textContent='No original-language guide entry yet. Try the KJV concordance for full English Scripture searches.';
}
function setMessage(id,message){$(id).textContent=message;}
function renderRoutine(){if(!state.topics)return;const topic=$('topic').value||Object.keys(state.topics)[0];const settings=safeSettings();const entries=Object.keys(state.topics);if(!entries.length)return;const [year,month,day]=localDay().split('-').map(Number);const index=Math.floor(Date.UTC(year,month-1,day)/86400000);const rotation=$('rotation').value||settings?.rotation||'chosen';const selected=rotation==='all'?entries[(index+hash(settings?.seed||'default'))%entries.length]:topic;const content=state.topics[selected]||state.topics[entries[0]];if(!content)return;
const studyAngles=[
 {question:'What does this passage reveal about God’s character?',action:'Write one truth about God that this Scripture teaches.'},
 {question:'What does this passage ask me to believe or trust?',action:'Write one promise or truth you will remember today.'},
 {question:'Is there an instruction in this passage I should obey?',action:'Choose one practical step of obedience for today.'},
 {question:'How does the passage challenge my attitude or conduct?',action:'Identify one attitude that needs to change.'},
 {question:'How can the truth in this passage shape my relationships?',action:'Encourage or help someone in a way consistent with the reading.'},
 {question:'What example of faithfulness can I learn from this passage?',action:'Write one example worth following and why.'},
 {question:'How does this passage prepare me to live faithfully today?',action:'Spend a few minutes praying over the lesson and record one takeaway.'}
];
const angle=studyAngles[((Math.floor(index/Math.max(1,entries.length)))%studyAngles.length+studyAngles.length)%studyAngles.length];
$('devotional').replaceChildren();
const heading=document.createElement('h3');heading.textContent=selected;
const para=(label,value)=>{const p=document.createElement('p'),strong=document.createElement('strong');strong.textContent=label;p.append(strong,document.createTextNode(' '+value));return p;};
$('devotional').append(heading,
 para('Today’s Scripture:',content[0]),
 para('Plain-English lesson:',state.lessons?.[selected]?.explanation||'Read the passage in its Bible context.'),
 para('Reflection:',angle.question),
 para('Prayer focus:',content[1]),
 para('Today’s action:',angle.action),
 para('Personal response:','After reading, record your answer in a notebook or journal.'),
 para('Study note:','The routine cycles through Scripture topics and seven different reflection approaches without a fixed end date. Passages and prompts will eventually repeat.'));
showDailyScripture(content[0]);
$('routine-status').textContent=settings?.enabled?`Subscribed · ${settings.time} every day · ${settings.place||'Your chosen reading place'} · no login required`:'No active reminder subscription.';
let done={};try{done=JSON.parse(localStorage.getItem(DONE)||'{}')||{};}catch{}const days=Object.keys(done).filter(k=>{
 if(!done[k]||!/^\d{4}-\d{2}-\d{2}$/.test(k)||k>localDay())return false;
 const [year,month,day]=k.split('-').map(Number);
 const dt=new Date(Date.UTC(year,month-1,day));
 return dt.getUTCFullYear()===year&&dt.getUTCMonth()===month-1&&dt.getUTCDate()===day;
});let streak=0;const cursor=new Date();const completedDays=new Set(days);if(!completedDays.has(localDay(cursor)))cursor.setDate(cursor.getDate()-1);for(let i=0;i<days.length+1;i++){const day=localDay(cursor);if(!completedDays.has(day))break;streak++;cursor.setDate(cursor.getDate()-1);} $('complete').textContent=`${done[localDay()]?'Completed today':'Not completed today'} · ${days.length} completed days · ${streak}-day current streak`;}
async function checkReminder(){if(notificationPending)return;const s=safeSettings();if(!s?.enabled||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time))return;const now=new Date(),today=localDay(now),current=now.toTimeString().slice(0,5),lastKey='hk-read-pray-last-v2';if(current<s.time||localStorage.getItem(lastKey)===today)return;const title='READ & PRAY DAILY ROUTINE',body='Have you prayed today? It’s time to read God’s Word and pray.';setMessage('routine-status',body);notificationPending=true;try{if(localStorage.getItem(lastKey)===today)return;if('Notification'in window&&Notification.permission==='granted'){if('serviceWorker'in navigator){const registration=await navigator.serviceWorker.ready;await registration.showNotification(title,{body,tag:'hk-read-pray-daily',icon:'./icon-192.png',data:{url:'./study-extensions.html'}});localStorage.setItem(lastKey,today);}else {new Notification(title,{body});localStorage.setItem(lastKey,today);}}}catch(e){setMessage('notify-status','Reminder due, but device notification could not be shown: '+e.message);}finally{notificationPending=false;}}
const loadJson=async path=>{const response=await fetch(path);if(!response.ok)throw Error(path+' HTTP '+response.status);return response.json();};
loadJson('./dictionary.json').then(dict=>{if(!Array.isArray(dict))throw Error('Invalid dictionary data');state.dictionary=dict;renderDictionary();}).catch(e=>{$('dict-count').textContent='Dictionary unavailable: '+e.message;});
loadJson('./original-language-guide.json').then(guide=>{if(!Array.isArray(guide)||guide.some(entry=>!entry||!['Hebrew','Greek'].includes(entry.language)||!entry.english||!entry.original||!entry.meaning||!entry.strong))throw Error('Invalid original-language data');state.originalGuide=guide;state.originalGuideLoaded=true;renderOriginalLanguageGuide();renderDictionary();}).catch(e=>{$('original-count').textContent='Original-language guide unavailable: '+e.message;state.originalGuide=[];state.originalGuideLoaded=false;renderDictionary();});
Promise.all([loadJson('./daily-topics.json'),loadJson('./daily-lessons.json'),loadJson('./data/kjv/manifest.json')]).then(([topics,lessons,manifest])=>{state.topics=topics;state.lessons=lessons;state.manifest=manifest;for(const topic of Object.keys(topics))$('topic').add(new Option(topic,topic));const saved=safeSettings();if(saved){$('topic').value=saved.topic||'Faith';$('time').value=saved.time||'06:00';$('place').value=saved.place||'';$('rotation').value=saved.rotation||'chosen';}renderRoutine();checkReminder();}).catch(e=>setMessage('routine-status','Daily reading resources unavailable: '+e.message));
$('dict').addEventListener('input',()=>{dictionaryPage=0;renderDictionary();});$('letter').addEventListener('change',()=>{dictionaryPage=0;renderDictionary();});$('dict-prev').addEventListener('click',()=>{dictionaryPage--;renderDictionary();});$('dict-next').addEventListener('click',()=>{dictionaryPage++;renderDictionary();});
function resetConcordanceResults(){
 $('concordance-results').replaceChildren();
 $('concordance-breakdown').replaceChildren();
 $('word-explanation').textContent='';
 if($('concordance-language-note'))$('concordance-language-note').replaceChildren();
 $('prev-page').disabled=true;
 $('next-page').disabled=true;
 $('prev-page').onclick=null;
 $('next-page').onclick=null;
}
$('concordance-form').addEventListener('submit',async event=>{event.preventDefault();const searchSequence=++concordanceSequence;const word=$('word').value.trim().toLowerCase().replace(/\s+/g,' ');if(!/^[a-z]+(?:['’][a-z]+)*(?: [a-z]+(?:['’][a-z]+)*){0,5}$/.test(word)){resetConcordanceResults();setMessage('concordance-status','Enter one English word or a phrase of up to six words, such as holy ghost.');return;}resetConcordanceResults();setMessage('concordance-status','Indexing 66 KJV books (first search may take some time)…');try{await loadBooks();if(searchSequence!==concordanceSequence)return;}catch(e){if(searchSequence!==concordanceSequence)return;resetConcordanceResults();setMessage('concordance-status',e.message);return;}const phrase=word.includes(' '),candidate=textIndex.get(word.split(' ')[0])||[];
const phraseRegex=phrase?new RegExp('\\b'+word.split(' ').join('\\s+')+'\\b','gi'):null;
const rows=phrase?candidate.map(r=>{const matches=[...r.text.matchAll(phraseRegex)];return matches.length?{...r,n:matches.length}:null;}).filter(Boolean):(textIndex.get(word)||[]);
const total=rows.reduce((n,r)=>n+r.n,0);
$('word-explanation').textContent='Search results below show KJV occurrences, verse references and frequency by Bible book. Use the separate Bible Dictionary for definitions.';
const languagePanel=$('concordance-language-note');if(languagePanel)languagePanel.replaceChildren();
const bookSummary=new Map();for(const row of rows){const existing=bookSummary.get(row.book)||{name:row.ref.replace(/\s+\d+:\d+$/, ''),occurrences:0,verses:0};existing.occurrences+=row.n;existing.verses++;bookSummary.set(row.book,existing);}const ranked=[...bookSummary.values()].sort((a,b)=>b.occurrences-a.occurrences);$('concordance-breakdown').replaceChildren();if(ranked.length){const heading=document.createElement('h3');heading.textContent='Where this word occurs most often';$('concordance-breakdown').append(heading);for(const b of ranked.slice(0,12)){const item=document.createElement('p');item.textContent=`${b.name}: ${b.occurrences} occurrences in ${b.verses} verses`;$('concordance-breakdown').append(item);}}const pageSize=100;let currentPage=0;function draw(){const start=currentPage*pageSize;$('concordance-results').replaceChildren();for(const r of rows.slice(start,start+pageSize)){const e=document.createElement('article');e.className='result';const strong=document.createElement('strong');strong.textContent=r.ref;const p=document.createElement('p');p.textContent=r.text;e.append(strong,p);
// Read the verse in its chapter without confusing English-word hits with Strong's word alignment.
const contextButton=document.createElement('button');contextButton.type='button';
contextButton.textContent='Read chapter context';contextButton.setAttribute('aria-label','Read KJV chapter containing '+r.ref);
contextButton.addEventListener('click',async()=>{
 let section=e.querySelector('.chapter-context');if(section){section.remove();return;}
 section=document.createElement('div');section.className='chapter-context';section.setAttribute('aria-live','polite');section.textContent='Loading KJV chapter…';e.append(section);
 try{
  let promise=chapterCache.get(r.book);
  if(!promise){promise=fetch('./data/kjv/'+encodeURIComponent(r.book)+'.json').then(response=>{if(!response.ok)throw Error('KJV unavailable');return response.json();}).catch(error=>{chapterCache.delete(r.book);throw error;});chapterCache.set(r.book,promise);}
  const data=await promise;if(!section.isConnected)return;
  const chapterData=data.chapters?.[String(r.chapter)];const chapter=Array.isArray(chapterData)?chapterData:(Array.isArray(chapterData?.verses)?chapterData.verses:[]);
  if(!chapter.length)throw Error('Chapter unavailable');
  const verses=chapter.map(v=>`${v.number}. ${v.text}`).join('\n');
  section.textContent=verses;section.style.whiteSpace='pre-wrap';
 }catch{if(section.isConnected)section.textContent='Could not load KJV chapter. Try reconnecting or downloading the Bible for offline use.';}
});e.append(contextButton);$('concordance-results').append(e);}setMessage('concordance-status',`${total.toLocaleString()} word occurrences in ${rows.length.toLocaleString()} verses · showing ${rows.length?start+1:0}–${Math.min(start+pageSize,rows.length)} of ${rows.length} verses${state.failed.length?' · failed books: '+state.failed.join(', '):''}. Counts are from available English KJV text, not Strong’s original-language indexing. Phrase matches require adjacent words with whitespace.`);$('prev-page').disabled=currentPage===0;$('next-page').disabled=start+pageSize>=rows.length;}$('prev-page').onclick=()=>{currentPage--;draw();};$('next-page').onclick=()=>{currentPage++;draw();};draw();});
$('original-query').addEventListener('input',renderOriginalLanguageGuide);
$('topic').addEventListener('change',renderRoutine);$('rotation').addEventListener('change',renderRoutine);
// Refresh the routine automatically when the device's calendar day changes.
// Keeping the Bible App open across midnight must not leave yesterday's reading visible.
let displayedDay=localDay();
function refreshDailyRoutineIfNeeded(){
 const day=localDay();
 if(day!==displayedDay){
  displayedDay=day;
  if(state.topics)renderRoutine();
  checkReminder();
 }
}
setInterval(refreshDailyRoutineIfNeeded,60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDailyRoutineIfNeeded();});
window.addEventListener('focus',refreshDailyRoutineIfNeeded);

$('save').addEventListener('click',()=>{const topic=$('topic').value,time=$('time').value,place=$('place').value.trim(),rotation=$('rotation').value;if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)){setMessage('routine-status','Choose a valid local time.');return;}const old=safeSettings();localStorage.setItem(KEY,JSON.stringify({enabled:true,topic,time,place,rotation,seed:old?.seed||String(Date.now())}));localStorage.removeItem(LEGACY);// Editing an existing subscription must not resend a reminder already delivered today.
if(!old?.enabled)localStorage.removeItem('hk-read-pray-last-v2');
renderRoutine();checkReminder();});
$('stop').addEventListener('click',async()=>{
  // Do not discard the user's local subscription state until remote cancellation is confirmed.
  // Otherwise a disconnected device could keep receiving reminders with no visible way to stop them.
  const hasPush=Boolean(localStorage.getItem('hk-read-pray-push-v1'));
  if(hasPush){
   setMessage('notify-status','Cancelling background reminders…');
   if(typeof window.hkReadPrayStopPush!=='function'){
    setMessage('notify-status','Background subscription is active, but cancellation is unavailable. Reconnect and try again.');return;
   }
   const cancelled=await window.hkReadPrayStopPush();
   if(!cancelled){setMessage('notify-status','Could not verify background cancellation. Your subscription is still shown so you can retry.');return;}
  }
  localStorage.removeItem(KEY);localStorage.removeItem(LEGACY);
  localStorage.removeItem('hk-read-pray-last-v2');renderRoutine();
  setMessage('notify-status','Read & Pray reminders stopped on this device.');
 });
$('export-progress').addEventListener('click',()=>{const data={format:'hk-read-pray-progress-v1',exportedAt:new Date().toISOString(),settings:safeSettings(),completion:JSON.parse(localStorage.getItem(DONE)||'{}')};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='heavenly-key-read-pray-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);});
$('reset-progress').addEventListener('click',()=>{if(!window.confirm('Clear your local completed-day history? Your reminder settings will remain.'))return;localStorage.removeItem(DONE);renderRoutine();});
$('notify').addEventListener('click',async()=>{setMessage('notify-status','Checking notification support…');if(!('Notification'in window)){setMessage('notify-status','This device or browser does not support notifications.');return;}try{const p=await Notification.requestPermission();setMessage('notify-status',p==='granted'?'Notifications allowed. Reminders are checked while the Bible app/page is active. Background push still requires server setup.':'Notification permission: '+p);}catch(e){setMessage('notify-status',e.message);}});
$('done').addEventListener('click',()=>{const done=JSON.parse(localStorage.getItem(DONE)||'{}');done[localDay()]=true;localStorage.setItem(DONE,JSON.stringify(done));renderRoutine();});
setInterval(checkReminder,20000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkReminder();});window.addEventListener('focus',checkReminder);
})();
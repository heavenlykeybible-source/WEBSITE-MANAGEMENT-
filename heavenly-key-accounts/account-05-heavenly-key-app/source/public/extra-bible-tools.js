/* Browser-only Bible tools. No AI image generation or remote user-data upload. */
const extraOutput=document.getElementById('extra-bible-output');
const extraPanel=document.getElementById('chapter-study-tools');
const chapterOutput=document.getElementById('chapter-study-output');
let activeToolRequest=0;
extraPanel?.addEventListener('click',event=>{if(event.target.closest('[data-study-tool]')){activeToolRequest++;extraOutput?.replaceChildren();}},true);
const node=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=value;return n;};
const dataSets={
 timeline:[['Creation','Genesis 1–2 · Biblical beginning; no historical date assigned.'],['Patriarchs','Genesis 12–50 · Abraham, Isaac, Jacob and Joseph.'],['Exodus','Exodus · Deliverance from Egypt and covenant at Sinai.'],['Kingdom','1–2 Samuel and 1–2 Kings · Israel’s monarchy.'],['Exile and return','2 Kings, Ezra and Nehemiah · Exile and restoration.'],['Life of Jesus','Matthew, Mark, Luke and John · Gospel accounts.'],['Early church','Acts · Spread of the gospel.']],
 topical:[['Faith','Hebrews 11:1'],['Love','1 Corinthians 13:4'],['Prayer','Philippians 4:6'],['Hope','Romans 15:13'],['Forgiveness','Ephesians 4:32'],['Salvation','John 3:16']],
 promises:[['God’s presence','Hebrews 13:5'],['Wisdom when asked','James 1:5'],['Peace in Christ','John 14:27'],['Rest for the weary','Matthew 11:28'],['Strength','Isaiah 40:31'],['Eternal life through Christ','John 3:16']]
};
const refLink=ref=>{const m=/^(1 Corinthians|Philippians|Ephesians|Hebrews|Romans|James|John|Isaiah|Matthew) (\d+):(\d+)/.exec(ref);const ids={'1 Corinthians':'1corinthians',Philippians:'philippians',Ephesians:'ephesians',Hebrews:'hebrews',Romans:'romans',James:'james',John:'john',Isaiah:'isaiah',Matthew:'matthew'};const a=node('a',ref);a.href=m?'/bible.html?book='+ids[m[1]]+'&chapter='+m[2]+'#study-root':'#study-root';return a;};
const current=()=>{const b=document.getElementById('kjv-book-picker'),c=document.getElementById('kjv-chapter-picker');return b&&c?{id:b.value,chapter:c.value,name:b.selectedOptions[0]?.text||b.value}:null;};
function safeRead(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
function safeWrite(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
function line(title,description){const p=node('p');const strong=node('strong',title+' — ');p.append(strong,document.createTextNode(description));return p;}
extraPanel?.addEventListener('click',async event=>{
 const button=event.target.closest('button[data-extra-tool]');if(!button||!extraOutput)return;
 const request=++activeToolRequest;
 const type=button.dataset.extraTool,ref=current();
 chapterOutput?.replaceChildren();
 extraOutput.replaceChildren(node('h3',button.textContent));
 if(dataSets[type]){
  const intro=type==='timeline'?'Scripture sequence, not disputed calendar dates.':'Select a reference to open the KJV chapter.';
  extraOutput.append(node('p',intro));
  for(const [label,detail] of dataSets[type]){
   if(type==='topical'||type==='promises'){const p=node('p');p.append(node('strong',label+' — '),refLink(detail));extraOutput.append(p);}
   else extraOutput.append(line(label,detail));
  }
  return;
 }
 if(type==='search'){
  const field=node('input');field.type='search';field.placeholder='Search KJV words or phrases';field.setAttribute('aria-label','Search Bible text');field.style.width='100%';field.maxLength=120;
  const scope=node('select');scope.setAttribute('aria-label','Search scope');for(const [value,label] of [['chapter','Current chapter'],['book','Current book'],['all','All 66 books']]){const o=node('option',label);o.value=value;scope.append(o);}
  const go=node('button','Search KJV');go.type='button';go.className='btn secondary';const results=node('div');results.setAttribute('aria-live','polite');let serial=0;
  const run=async()=>{
   const token=++serial,term=field.value.trim().toLowerCase();results.replaceChildren();if(term.length<2){results.append(node('p','Enter at least two characters.'));return;}
   const selected=current();if(!selected){results.append(node('p','Wait for the Bible reader to load.'));return;}
   results.append(node('p','Searching Scripture…'));
   try{
    const response=await fetch('/kjv-manifest.json');if(!response.ok)throw Error('Bible catalogue unavailable');const manifest=await response.json();
    if(!Array.isArray(manifest.books)||manifest.books.length!==66)throw Error('Incomplete Bible catalogue');
    const entries=scope.value==='all'?manifest.books:manifest.books.filter(b=>b.id===selected.id);
    if(!entries.length)throw Error('Bible book unavailable');
    const found=[];let total=0;
    for(const entry of entries){if(token!==serial||request!==activeToolRequest)return;const r=await fetch('/'+entry.path);if(!r.ok)throw Error('Bible text unavailable');const data=await r.json();if(data.book!==entry.name||!Array.isArray(data.chapters)||data.chapters.length!==entry.chapters)throw Error('Invalid Bible data');
     for(let ci=0;ci<data.chapters.length;ci++){if(scope.value==='chapter'&&ci+1!==Number(selected.chapter))continue;
      const verses=data.chapters[ci];if(!Array.isArray(verses)||!verses.every(v=>typeof v==='string'))throw Error('Invalid chapter verses');
      for(let vi=0;vi<verses.length;vi++){const verse=verses[vi];if(typeof verse!=='string'||!verse.toLowerCase().includes(term))continue;total++;if(found.length<100)found.push([entry,ci+1,vi+1,verse]);}
     }
    }
    if(token!==serial||request!==activeToolRequest||current()?.id!==selected.id||(scope.value==='chapter'&&current()?.chapter!==selected.chapter))return;results.replaceChildren(node('p',total+' matching verses'+(total>100?' · first 100 shown':'')));
    for(const [entry,chapter,verse,text] of found){const p=node('p');const link=node('a',entry.name+' '+chapter+':'+verse);link.href='/bible.html?book='+encodeURIComponent(entry.id)+'&chapter='+chapter+'#study-root';p.append(link,document.createTextNode(' — '+text));results.append(p);}
   }catch{if(token===serial&&request===activeToolRequest&&current()?.id===selected.id)results.replaceChildren(node('p','Search could not finish. Check your connection and try again.'));}
  };
  go.addEventListener('click',run);field.addEventListener('keydown',e=>{if(e.key==='Enter')run();});scope.addEventListener('change',()=>{serial++;results.replaceChildren();});
  extraOutput.append(node('p','Search the Authorised King James Version by word or phrase.'),field,scope,go,results);return;
 }
 if(!ref){extraOutput.append(node('p','Wait for the Bible reader to load, then choose a chapter.'));return;}
 const key='hk-bible-'+type+'-'+ref.id+'-'+ref.chapter;
 if(type==='notes'){
  const field=node('textarea');field.rows=5;field.maxLength=5000;field.style.width='100%';field.setAttribute('aria-label','Personal notes for '+ref.name+' '+ref.chapter);field.value=safeRead(key)||'';
  const save=node('button','Save notes on this device');save.type='button';save.className='btn secondary';
  const status=node('p','Notes are private to this browser. They do not sync across devices.');
  save.addEventListener('click',()=>{status.textContent=safeWrite(key,field.value)?'Notes saved on this device.':'Unable to save notes. Check browser storage settings.';});
  extraOutput.append(node('p',ref.name+' '+ref.chapter),field,save,status);return;
 }



});
document.getElementById('study-root')?.addEventListener('change',event=>{if(event.target.matches('#kjv-book-picker,#kjv-chapter-picker')){activeToolRequest++;extraOutput?.replaceChildren();}});

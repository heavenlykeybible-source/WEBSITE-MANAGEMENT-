/* Dedicated KJV reading schedule. */
import {READING_YEAR,readingForDay,TODAY_REFLECTIONS} from './bible-catalog.js';
const root=document.getElementById('study-root');
const make=(tag,value,cls)=>{const e=document.createElement(tag);if(value!==undefined&&value!==null)e.textContent=value;if(cls)e.className=cls;return e;};
const heading=(title,description)=>{root.append(make('h2',title));if(description)root.append(make('p',description,'study-subtitle'));};
const link=(title,url)=>{const e=make('a',title,'btn secondary');e.href=url;return e;};
const readingPlan=()=>READING_YEAR;
function readPref(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
async function loadJSON(url){const response=await fetch(url);if(!response.ok)throw Error('Reading excerpts unavailable');return response.json();}
async function devotional(){
 heading('Daily KJV Discipleship Plan','A 365-day selection of KJV chapters with morning and evening readings. This is not a cover-to-cover plan of all 1,189 chapters.');
 const dates=readingPlan(),day=readingForDay().day-1;
 const excerpts=await loadJSON('daily-reading-excerpts.json').catch(()=>null);
 const progressKey='hk-daily-reading-progress-v1';
 const saved=readPref(progressKey,{});
 const progress=saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{};
 const progressStatus=make('p','');
 const refreshProgress=()=>{const done=Object.keys(progress).filter(k=>progress[k]===true&&/^(morning|evening):\\d{1,3}$/.test(k)).length;progressStatus.textContent=done+' of 730 reading sessions marked complete on this device. Progress is not synced.';};
 const c=make('section',null,'study-grid');
 for(const [n,slot,index] of [[0,'Morning devotion',day],[1,'Evening devotion',(day+181)%365]]){
  const reading=dates[index],card=make('article',null,'study-card'),title=make('h3',slot),ref=make('strong',reading.book+' '+reading.chapter),preview=make('blockquote');
  const book=books.find(x=>x.name===reading.book),item=excerpts?.readings?.[index];
  if(item&&item.book===reading.book&&item.chapter===reading.chapter&&typeof item.verse==='string'){
   preview.textContent=item.verse+' — '+reading.book+' '+reading.chapter+':1 (KJV)';
  }else{preview.textContent='Open the full KJV chapter to read the passage.';}
  if(!book){card.append(make('p','Bible book unavailable in the catalogue.'));c.append(card);continue;}
  const open=link('Read full chapter →','bible.html?book='+encodeURIComponent(book.id)+'&chapter='+reading.chapter);
  const key=(n===0?'morning':'evening')+':'+(day+1);
  const checkbox=make('input');checkbox.type='checkbox';checkbox.checked=progress[key]===true;checkbox.id='reading-complete-'+n;
  const label=make('label',' Mark '+slot.toLowerCase()+' complete');label.htmlFor=checkbox.id;
  const notice=make('p','');
  checkbox.addEventListener('change',()=>{
   if(checkbox.checked)progress[key]=true;else delete progress[key];
   try{localStorage.setItem(progressKey,JSON.stringify(progress));notice.textContent='Reading progress saved on this device.';}
   catch{checkbox.checked=!checkbox.checked;if(checkbox.checked)progress[key]=true;else delete progress[key];notice.textContent='Unable to save reading progress. Check browser storage settings.';}
   refreshProgress();
  });
  card.append(title,ref,preview,make('p',TODAY_REFLECTIONS[(index+n)%TODAY_REFLECTIONS.length]),open,checkbox,label,notice);c.append(card);
 }
 root.append(make('p','Day '+(day+1)+' of 365 · Reflections are devotional commentary, not Bible quotations.'),progressStatus,c);
 refreshProgress();
 root.append(make('p','The schedule contains selected chapters from 14 Bible books, not all 66. Completion is saved only on this device.','study-fine'));
}

if(root)devotional().catch(()=>root.append(make('p','The reading schedule could not load. Please refresh and try again.')));

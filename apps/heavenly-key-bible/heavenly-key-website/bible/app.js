(() => {
"use strict";
const books = [
    ["Genesis",50],["Exodus",40],["Leviticus",27],["Numbers",36],["Deuteronomy",34],
    ["Joshua",24],["Judges",21],["Ruth",4],["1 Samuel",31],["2 Samuel",24],
    ["1 Kings",22],["2 Kings",25],["1 Chronicles",29],["2 Chronicles",36],
    ["Ezra",10],["Nehemiah",13],["Esther",10],["Job",42],["Psalms",150],
    ["Proverbs",31],["Ecclesiastes",12],["Song of Solomon",8],["Isaiah",66],
    ["Jeremiah",52],["Lamentations",5],["Ezekiel",48],["Daniel",12],
    ["Hosea",14],["Joel",3],["Amos",9],["Obadiah",1],["Jonah",4],
    ["Micah",7],["Nahum",3],["Habakkuk",3],["Zephaniah",3],["Haggai",2],
    ["Zechariah",14],["Malachi",4],["Matthew",28],["Mark",16],["Luke",24],
    ["John",21],["Acts",28],["Romans",16],["1 Corinthians",16],["2 Corinthians",13],
    ["Galatians",6],["Ephesians",6],["Philippians",4],["Colossians",4],
    ["1 Thessalonians",5],["2 Thessalonians",3],["1 Timothy",6],["2 Timothy",4],
    ["Titus",3],["Philemon",1],["Hebrews",13],["James",5],["1 Peter",5],
    ["2 Peter",3],["1 John",5],["2 John",1],["3 John",1],["Jude",1],
    ["Revelation",22]
  ];
const el = id => document.getElementById(id);
const book = el("book"), chapter = el("chapter");
const codes = "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SOL ISA JER LAM EZE DAN HOS JOE AMO OBA JON MIC NAH HAB ZEP HAG ZEC MAL MAT MAR LUK JOH ACT ROM 1CO 2CO GAL EPH PHI COL 1TH 2TH 1TI 2TI TIT PHM HEB JAM 1PE 2PE 1JO 2JO 3JO JUD REV".split(" ");
const scriptureCache = new Map();
async function getBook(name) {
 const index = books.findIndex(x=>x[0]===name);
 if(index<0)throw new Error("Unknown Bible book");
 if(scriptureCache.has(name))return scriptureCache.get(name);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
 const response=await fetch("./data/kjv/"+codes[index]+".json",{signal:controller.signal,headers:{Accept:"application/json"}});
 if(!response.ok)throw new Error("Scripture file is unavailable");
 const data=await response.json();
 if(data.book!==name||data.translation!=="KJV"||!data.chapters||Object.keys(data.chapters).length!==books[index][1])throw new Error("Scripture file failed validation");
 for(let ch=1;ch<=books[index][1];ch++){
 const verses=data.chapters[String(ch)];
 if(!Array.isArray(verses)||!verses.length||verses.some((v,i)=>v.number!==i+1||v.isPlaceholder!==false||typeof v.text!=="string"||!v.text.trim()))throw new Error("Invalid scripture data");
 }
 scriptureCache.set(name,data);return data;
 }finally{clearTimeout(timer);}
}
// Scripture highlighting uses reviewed per-verse character offsets only.
// Missing annotations leave the original KJV verse uncoloured.
const annotationCache = new Map();
let curatedReferences=null;
async function getCuratedReferences(){
 if(curatedReferences)return curatedReferences;
 try {
  const response=await fetch("./data/annotations/center-references.json");
  if(!response.ok)throw Error("References unavailable");
  curatedReferences=await response.json();
 }catch{curatedReferences={};}
 return curatedReferences;
}

async function getAnnotations(code){
 if(annotationCache.has(code))return annotationCache.get(code);
 try {
  const r=await fetch("./data/annotations/"+code+".json");
  if(!r.ok)throw Error("No verified annotations");
  const data=await r.json();annotationCache.set(code,data);return data;
 } catch {annotationCache.set(code,{});return {}; }
}
function highlightedVerse(text,marks){
 const fragment=document.createDocumentFragment();
 const colors={jesus:"jesus-words",god:"god-words",reference:"center-reference"};
 const ranges=Array.isArray(marks)?marks.filter(m=>colors[m.type]&&Number.isInteger(m.start)&&Number.isInteger(m.end)&&m.start>=0&&m.end<=text.length&&m.start<m.end).sort((a,b)=>a.start-b.start):[];
 let cursor=0;
 for(const m of ranges){if(m.start<cursor)continue;fragment.append(document.createTextNode(text.slice(cursor,m.start)));const span=document.createElement("span");span.className=colors[m.type];span.textContent=text.slice(m.start,m.end);fragment.append(span);cursor=m.end;}
 fragment.append(document.createTextNode(text.slice(cursor)));return fragment;
}
let chapterRequest = 0, portalRequest = 0, detailRequest = 0, items = [], shareText = "";
let currentTrackKey=null;
let searchRequest = 0;
let narrationText = [], narrationToken = 0, speaking = false;
function stopNarration(){
 narrationToken++;speaking=false;
 if("speechSynthesis" in window)window.speechSynthesis.cancel();
 el("narrate").textContent="Read aloud with device voice";
}
function narrate(){
 if(speaking){stopNarration();message("audio-status","Device narration stopped.");return;}
 if(!("speechSynthesis" in window)||typeof SpeechSynthesisUtterance==="undefined"){message("audio-status","Device narration is not supported by this browser.");return;}
 if(!narrationText.length)return;
 for(const id of ["chapter-audio","song-audio","song-video"])el(id).pause();
 stopNarration();speaking=true;const token=narrationToken,lines=[...narrationText];let index=0;
 el("narrate").textContent="Stop device narration";message("audio-status","Reading with your device's voice. This is not a ministry recording.");
 function next(){
  if(token!==narrationToken)return;
  if(index>=lines.length){stopNarration();message("audio-status","Device narration completed.");return;}
  const utterance=new SpeechSynthesisUtterance(lines[index++]);utterance.lang="en-GB";utterance.rate=0.92;
  utterance.onend=next;utterance.onerror=()=>{if(token===narrationToken){stopNarration();message("audio-status","Device narration stopped. Please try again.");}};
  window.speechSynthesis.speak(utterance);
 }
 next();
}
const message = (id, text) => { el(id).textContent = text; };
const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
const read = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
const studyTools=window.HKStudyTools;
let planDay=0;
function planProgress(){return studyTools.progress(read("hk-bible-plan-progress"));}
function renderPlan(){
 const plan=studyTools.plans.find(x=>x.id===el("reading-plan").value)||studyTools.plans[0];
 planDay=Math.max(0,Math.min(planDay,plan.days.length-1));
 const completed=planProgress()[plan.id],done=completed.includes(planDay);
 el("plan-passages").replaceChildren();
 for(const passage of plan.days[planDay]){
  const button=document.createElement("button");button.type="button";button.textContent=passage.book+" "+passage.chapter;
  button.addEventListener("click",()=>{book.value=passage.book;chapters(passage.chapter);loadChapter().then(loaded=>{if(!loaded)return;const target=el("verses").querySelector('[data-verse="'+Number(verse.number)+'"]');(target||el("reader")).scrollIntoView({behavior:"smooth",block:"center"});});});
  el("plan-passages").append(button);
 }
 message("plan-day","Day "+(planDay+1)+" of "+plan.days.length);
 message("plan-status",completed.length+" of "+plan.days.length+" days completed ("+Math.round(completed.length/plan.days.length*100)+"%).");
 el("plan-complete").textContent=done?"Mark this day unread":"Mark this day complete";
 el("plan-previous").disabled=planDay===0;el("plan-next").disabled=planDay===plan.days.length-1;
}
function setupPlans(){
 for(const plan of studyTools.plans)el("reading-plan").add(new Option(plan.title,plan.id));
 const saved=read("hk-bible-active-plan");
 if(studyTools.plans.some(x=>x.id===saved?.id)){el("reading-plan").value=saved.id;planDay=Number.isInteger(saved.day)?saved.day:0;}
 const retain=()=>{renderPlan();save("hk-bible-active-plan",{id:el("reading-plan").value,day:planDay});};
 el("reading-plan").addEventListener("change",()=>{const plan=studyTools.plans.find(x=>x.id===el("reading-plan").value),completed=planProgress()[plan.id];planDay=plan.days.findIndex((_,index)=>!completed.includes(index));if(planDay<0)planDay=0;retain();});
 el("plan-previous").addEventListener("click",()=>{planDay--;retain();});
 el("plan-next").addEventListener("click",()=>{planDay++;retain();});
 el("plan-complete").addEventListener("click",()=>{
  const data=planProgress(),id=el("reading-plan").value;
  data[id]=data[id].includes(planDay)?data[id].filter(x=>x!==planDay):[...data[id],planDay].sort((a,b)=>a-b);
  if(save("hk-bible-plan-progress",data)){renderPlan();message("plan-save-status","Your reading progress was saved on this device.");}else message("plan-save-status","Reading progress could not be saved. Browser storage is unavailable or full.");
 });
 retain();
}
function downloadBackup(){
 const entries=studyEntries().map(entry=>({...entry,note:typeof entry.note==="string"?entry.note:""}));
 const backup={product:"HEAVENLY KEY BIBLE",version:1,translation:"KJV",createdAt:new Date().toISOString(),entries,progress:planProgress()};
 const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:"application/json"}));
 const link=document.createElement("a");link.href=url;link.download="heavenly-key-bible-study-backup.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
 message("backup-status","Your study backup download has started. Keep the file somewhere you can find it.");
}
async function importBackup(){
 const file=el("study-import").files?.[0];if(!file){message("backup-status","Choose your Bible study backup file first.");return;}
 if(file.size>4*1024*1024){message("backup-status","Choose a study backup smaller than 4 MB.");return;}
 const button=el("import-backup");button.disabled=true;
 try{
  const parsed=studyTools.parseBackup(JSON.parse(await file.text())),verified=[];
  message("backup-status","Checking the backup verse references…");
  for(const entry of parsed.entries){
   const source=await getBook(entry.book),verse=source.chapters[String(entry.chapter)]?.[entry.number-1];
   if(!verse||verse.number!==entry.number||verse.isPlaceholder!==false||typeof verse.text!=="string"||!verse.text.trim())throw Error("A backup verse does not exist in the KJV.");
   verified.push({...entry,text:verse.text});
  }
  const originalEntries=studyEntries(),merged=studyTools.mergeEntries(originalEntries,verified),previousProgress=planProgress();
  if(merged.length>500)throw Error("The combined backup exceeds the 500 saved verse limit. Remove some entries before importing.");
  const progress={};for(const plan of studyTools.plans)progress[plan.id]=[...new Set([...previousProgress[plan.id],...parsed.progress[plan.id]])].sort((a,b)=>a-b);
  if(!save("hk-bible-study",merged))throw Error("Browser storage could not save your imported notes.");
  renderStudy();
  if(!save("hk-bible-plan-progress",progress)){const restored=save("hk-bible-study",originalEntries);renderStudy();message("backup-status",restored?"Reading progress could not be saved, so the imported notes were rolled back. Try again after freeing browser storage.":"Reading progress could not be saved, and restoring the previous notes failed. Export a backup of your notes now.");return;}
  renderPlan();el("study-import").value="";
  message("backup-status","Backup imported. Your existing notes were kept when the same verse appeared twice.");
 }catch(error){message("backup-status",error instanceof SyntaxError?"This file is not a valid JSON study backup.":error.message||"The backup could not be imported.");}
 finally{button.disabled=false;}
}
let selectedVerse = null;
function studyEntries() {
 const data = read("hk-bible-study");
 return Array.isArray(data) ? data.filter(x => x && typeof x.key === "string" && typeof x.text === "string" && typeof x.book === "string" && books.some(b=>b[0]===x.book&&x.chapter>=1&&x.chapter<=b[1]) && Number.isInteger(x.chapter) && Number.isInteger(x.number) && x.number>0 && x.key===x.book+":"+x.chapter+":"+x.number).slice(0,500) : [];
}
function renderStudy() {
 el("saved-verses").replaceChildren();
 const entries = studyEntries();
 message("study-status",entries.length ? entries.length+" saved verse(s) on this device." : "Select a verse in the reader to save it or write a note.");
 for(const entry of entries) {
  const card=document.createElement("article"), title=document.createElement("h3"), text=document.createElement("p"), note=document.createElement("p"), open=document.createElement("button"), remove=document.createElement("button");
  title.textContent=entry.book+" "+entry.chapter+":"+entry.number; text.textContent=entry.text; note.textContent=typeof entry.note==="string"?entry.note:"";
  open.textContent="Open verse"; open.type="button"; open.addEventListener("click",()=>{if(!books.some(x=>x[0]===entry.book))return;book.value=entry.book;chapters(entry.chapter);loadChapter().then(()=>{const target=el("verses").querySelector('[data-verse="'+entry.number+'"]');(target||el("reader")).scrollIntoView({behavior:"smooth",block:"center"});});});
  const edit=document.createElement("button");edit.type="button";edit.textContent="Edit note";edit.addEventListener("click",()=>{selectedVerse={key:entry.key,book:entry.book,chapter:entry.chapter,number:entry.number,text:entry.text};el("study-editor").hidden=false;el("study-note").value=typeof entry.note==="string"?entry.note:"";message("selected-reference",entry.book+" "+entry.chapter+":"+entry.number+" (KJV)");message("selected-text",entry.text);el("selected-text").hidden=false;el("memory-toggle").textContent="Hide verse to practise";message("selected-reference",entry.book+" "+entry.chapter+":"+entry.number+" (KJV)");message("save-status","Edit your note and select Save.");el("study-editor").scrollIntoView({behavior:"smooth",block:"center"});});
  remove.textContent="Remove"; remove.type="button"; remove.addEventListener("click",()=>{if(!window.confirm("Remove saved verse "+entry.book+" "+entry.chapter+":"+entry.number+" and its note?"))return;if(save("hk-bible-study",studyEntries().filter(x=>x.key!==entry.key))){if(selectedVerse?.key===entry.key){selectedVerse=null;el("study-editor").hidden=true;}renderStudy();}else message("study-status","Your browser could not save this change.");});
  card.className="study-card";card.append(title,text,note,open,edit,remove);el("saved-verses").append(card);
 }
}
function selectVerse(verse,name,num) {
 selectedVerse={key:name+":"+num+":"+verse.number,book:name,chapter:num,number:verse.number,text:verse.text};
 const existing=studyEntries().find(x=>x.key===selectedVerse.key);
 el("study-editor").hidden=false;el("study-note").value=existing?.note||"";
 message("selected-reference",name+" "+num+":"+verse.number+" (KJV)");message("selected-text",verse.text);
 el("selected-text").hidden=false;el("memory-toggle").textContent="Hide verse to practise";message("save-status","");
 el("study-editor").scrollIntoView({block:"nearest"});
}
async function searchScripture(event){
 event.preventDefault();const query=el("scripture-query").value.trim().toLowerCase(),token=++searchRequest;
 el("scripture-results").replaceChildren();
 if(query.length<3){message("scripture-search-status","Enter at least three characters.");return;}
 const names=el("scripture-scope").value==="all"?books.map(b=>b[0]):[book.value];
 let count=0,checked=0,failed=0;message("scripture-search-status","Searching scripture…");
 for(const name of names){
  if(token!==searchRequest)return;
  try{
   const data=await getBook(name);if(token!==searchRequest)return;
   for(const [ch,verses] of Object.entries(data.chapters)){
    for(const verse of verses){
     if(verse.isPlaceholder===true||typeof verse.text!=="string"||!verse.text.trim()||!verse.text.toLocaleLowerCase().includes(query))continue;
     count++;
     if(count<=100){const button=document.createElement("button");button.type="button";button.className="search-result";button.textContent=name+" "+ch+":"+verse.number+" — "+verse.text;button.addEventListener("click",()=>{book.value=name;chapters(Number(ch));loadChapter();el("reader").scrollIntoView({behavior:"smooth"});});el("scripture-results").append(button);}
    }
   }
  }catch{failed++;}
  checked++;if(token===searchRequest)message("scripture-search-status","Searched "+checked+" of "+names.length+" books…");
 }
 if(token===searchRequest)message("scripture-search-status",(count?count+" match(es)."+(count>100?" Showing the first 100. Narrow your search for fewer results.":""):"No matches found.")+(failed?" "+failed+" book(s) could not be loaded; these results are incomplete.":""));
}
function scriptureImage(){
 if(!selectedVerse)return;
 const selection={...selectedVerse};
 const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1920;
 const ctx=canvas.getContext("2d");if(!ctx){message("save-status","Image creation is unavailable in this browser.");return;}
 ctx.fillStyle="#172f83";ctx.fillRect(0,0,1080,1920);ctx.fillStyle="#8a1538";ctx.fillRect(0,0,1080,240);
 ctx.fillStyle="#ffffff";ctx.font="bold 48px sans-serif";ctx.textAlign="center";ctx.fillText("HEAVENLY KEY BIBLE",540,142);
 ctx.textAlign="left";ctx.fillStyle="#ffda74";ctx.font="bold 36px sans-serif";ctx.fillText(selection.book+" "+selection.chapter+":"+selection.number+" (KJV)",90,380);
 const words=selection.text.split(/\s+/);let lines=[],size=66;
 for(;size>=30;size-=2){ctx.font=size+"px Georgia";lines=[];let line="";for(const word of words){const next=line?line+" "+word:word;if(ctx.measureText(next).width>900&&line){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);if(lines.length*size*1.5<=1100)break;}
 if(size<30){message("save-status","This verse is too long for the image layout. Please choose a shorter verse.");return;}
 ctx.fillStyle="#ffffff";lines.forEach((line,i)=>ctx.fillText(line,90,530+i*size*1.5));
 ctx.fillStyle="#ffda74";ctx.fillRect(90,1670,900,4);ctx.textAlign="center";ctx.font="bold 28px sans-serif";ctx.fillText("TAKING CHRIST TO THE NATIONS OF THE WORLD",540,1750);ctx.fillStyle="#ffffff";ctx.font="28px sans-serif";ctx.fillText("Heavenly Key Evangelistic Movement",540,1810);
 canvas.toBlob(blob=>{if(!blob){message("save-status","Image creation failed. Please try again.");return;}const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="heavenly-key-"+selection.book.replace(/\s+/g,"-")+"-"+selection.chapter+"-"+selection.number+".png";link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);message("save-status","Your scripture image download has started.");},"image/png");
}
async function api(path) {
 const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
 try { const response = await fetch(path, {headers:{Accept:"application/json"},signal:controller.signal});
 const data = await response.json(); if (!response.ok || data.success !== true) throw new Error("Content is unavailable. Please try again."); return data;
 } finally { clearTimeout(timer); }
}
function stop(id) { const player = el(id); player.pause(); player.removeAttribute("src"); player.load(); player.hidden = true; }
function approvedPath(path) { return typeof path === "string" && /^\/api\/media\/[1-9]\d*\/object$/.test(path) ? path : null; }
function chapters(value = 1) {
 const max = books.find(b => b[0] === book.value)[1]; chapter.replaceChildren();
 for(let i=1;i<=max;i++) chapter.add(new Option(String(i),String(i)));
 chapter.value = String(Math.min(Math.max(Math.trunc(Number(value))||1,1),max));
}
async function loadChapter() {
 const token = ++chapterRequest, name = book.value, num = Number(chapter.value);
 stopNarration();narrationText=[];el("narrate").disabled=true;
 stop("chapter-audio"); el("verses").replaceChildren(); el("share").disabled = true;
 selectedVerse=null;el("study-editor").hidden=true;
 shareText = ""; message("chapter-title",name+" "+num); message("reader-status","Loading chapter…"); message("audio-status","");
 const bookIndex=books.findIndex(item=>item[0]===name);
 el("previous").disabled = bookIndex===0 && num===1;
 el("next").disabled = bookIndex===books.length-1 && num===chapter.options.length;
 save("hk-bible-reader-location",[name,num]);
 try {
 const scripture = await getBook(name);
 const data = {verses:scripture.chapters[String(num)],warning:null};
 const annotations=await getAnnotations(codes[books.findIndex(x=>x[0]===name)]);
 const centerReferences=await getCuratedReferences();
 const bookCode=codes[books.findIndex(x=>x[0]===name)];

 if(token !== chapterRequest) return false;
 const verses = Array.isArray(data.verses) ? data.verses : [];
 const valid = verses.filter(v => v.isPlaceholder === false && typeof v.text === "string" && v.text.trim());
 narrationText=valid.map(v=>v.text);el("narrate").disabled=!narrationText.length;
 for(const verse of valid) { const p = document.createElement("p"), sup = document.createElement("sup"), select=document.createElement("button"); p.dataset.verse=String(verse.number); sup.textContent = String(verse.number); p.append(sup,highlightedVerse(verse.text,annotations[String(num)]?.[String(verse.number)])); select.type="button";select.className="verse-action";select.textContent="Study";select.setAttribute("aria-label","Study verse "+verse.number);select.addEventListener("click",()=>selectVerse(verse,name,num));p.append(select);
 const cross=centerReferences[bookCode]?.[String(num)]?.[String(verse.number)];
 if(Array.isArray(cross)&&cross.length){
  const refs=document.createElement("small");
  refs.className="center-reference";
  refs.append(document.createTextNode(" Related passages: "));
  for(let i=0;i<cross.length;i++){
   const match=/^(.+?) (\d+):(\d+)$/.exec(cross[i]);
   const target=match&&books.find(entry=>entry[0]===match[1]);
   if(!target||Number(match[2])<1||Number(match[2])>target[1]||Number(match[3])<1)continue;
   if(refs.querySelector(".reference-link"))refs.append(document.createTextNode(" · "));
   const link=document.createElement("button");link.type="button";
   link.className="reference-link";link.textContent=cross[i];
   link.setAttribute("aria-label","Read related passage "+cross[i]);
   link.addEventListener("click",()=>{
    book.value=match[1];chapters(Number(match[2]));
    loadChapter().then(loaded=>{
     if(!loaded)return;
     const targetVerse=el("verses").querySelector('[data-verse="'+Number(match[3])+'"]');
     if(targetVerse)targetVerse.scrollIntoView({behavior:"smooth",block:"center"});else message("reader-status","Related chapter opened; the referenced verse is unavailable in this edition.");
    });
   });
   refs.append(link);
  }
  p.append(refs);
 }
 el("verses").append(p); }
 message("reader-status",data.warning || (valid.length ? "" : "Scripture for this chapter has not been published yet."));
 if(valid.length && valid.length === verses.length && !data.warning) {
 shareText = name+" "+num+" (KJV)\n\n"+valid.map(v=>v.number+" "+v.text).join("\n")+"\n\nHEAVENLY KEY BIBLE";
 el("share").disabled = false;
 }
 return valid.length>0;
 } catch { if(token===chapterRequest)message("reader-status","This chapter could not be loaded. Check your connection and try again."); return false; }
}
function renderTracks() {
 const q = el("search").value.trim().toLowerCase(); el("tracks").replaceChildren();
 const favorites=studyTools.favoriteKeys(read("hk-bible-favorite-tracks")),savedOnly=el("saved-tracks-only").checked;
 const visible = items.filter(x=>(!savedOnly||favorites.includes(studyTools.trackKey(x)))&&[x.title,x.author,x.theme,x.speaker,x.firstLine].some(v=>String(v||"").toLowerCase().includes(q)));
 for(const item of visible) { const button = document.createElement("button"); button.className = "track"; button.type = "button";
 const title = document.createElement("span"), sub = document.createElement("small"); title.textContent = item.title || "Untitled recording"; sub.textContent = item.author || item.speaker || item.theme || "Heavenly Key Ministry Library";
 button.append(title,sub); button.addEventListener("click",()=>openTrack(item)); el("tracks").append(button); }
 message("portal-status",visible.length ? visible.length+" item(s)" : items.length ? savedOnly?"No saved titles match your search in this collection.":"No titles match your search." : "No approved items have been published in this collection yet.");
}
async function openTrack(item) {
 const token = ++detailRequest; stop("song-audio"); stop("song-video"); el("track-detail").hidden = false;
 currentTrackKey=studyTools.trackKey(item);el("save-track").disabled=!currentTrackKey;
 el("save-track").textContent=studyTools.favoriteKeys(read("hk-bible-favorite-tracks")).includes(currentTrackKey)?"Remove from saved titles":"Save this title";
 message("track-save-status","");
 message("track-title",item.title||"Recording"); message("track-credit",item.author||item.source||item.speaker||""); el("lyrics").replaceChildren();
 let selected = item;
 if(item.hymnId) { try { const data = await api("/api/hymns/"+item.hymnId); if(token!==detailRequest)return; selected = data.hymn;
 } catch { if(token===detailRequest)message("track-credit","This hymn could not be opened. Please try again."); return; } }
 if(token!==detailRequest)return;
 if(typeof selected.lyrics==="string") { const p=document.createElement("p"); p.className="lyrics"; p.textContent=selected.lyrics; el("lyrics").append(p); }
 if(selected.sourceUrl){try{const url=new URL(selected.sourceUrl);if(["hymnary.org","en.wikisource.org"].includes(url.hostname)&&url.protocol==="https:"){const link=document.createElement("a");link.href=url.href;link.textContent="Historical hymn text source";link.rel="noopener noreferrer";el("lyrics").append(link);}}catch{}}
 const path=approvedPath(selected.playbackUrl);
 if(path && ["audio","video"].includes(selected.mediaType)) { const player=el(selected.mediaType==="video"?"song-video":"song-audio"); player.src=path; player.hidden=false; }
 else { const p=document.createElement("p"); p.textContent="An approved recording has not been attached to this item yet."; el("lyrics").append(p); }
}
async function loadPortal() {
 const token=++portalRequest; ++detailRequest; stop("song-audio"); stop("song-video"); el("track-detail").hidden=true;
 currentTrackKey=null;el("save-track").disabled=true;
 items=[]; el("tracks").replaceChildren(); message("portal-status","Loading collection…");
 const hymns=el("collection").value==="hymns";
 if(el("collection").value==="classics"){
  try{const response=await fetch("./data/hymns.json");if(!response.ok)throw Error("Unavailable");
   const data=await response.json();if(token!==portalRequest)return;items=(data.items||[]).filter(x=>x.copyrightStatus==="public_domain"&&typeof x.lyrics==="string");renderTracks();
  }catch{if(token===portalRequest)message("portal-status","Classic hymn lyrics could not be loaded. Press Refresh to try again.");}return;
 }
 try { const data=await api(hymns?"/api/hymns":"/api/media?topic=gospel-music"); if(token!==portalRequest)return;
 items=(Array.isArray(data.items)?data.items:[]).map(x=>hymns?x:{...x,mediaType:x.file_type,playbackUrl:"/api/media/"+x.media_id+"/object"}).filter(x=>hymns||(["audio","video"].includes(x.mediaType)&&approvedPath(x.playbackUrl)));
 renderTracks(); } catch { if(token===portalRequest)message("portal-status","Collection could not be loaded. Check your connection and press Refresh."); }
}
for(const [name] of books)book.add(new Option(name,name));
const location=read("hk-bible-reader-location"); book.value=Array.isArray(location)&&books.some(x=>x[0]===location[0])?location[0]:"Genesis"; chapters(Array.isArray(location)?location[1]:1);
el("reader-form").addEventListener("submit",event=>{event.preventDefault();loadChapter();});
window.addEventListener("hk-read-reference",event=>{
 const name=event.detail?.book,num=Number(event.detail?.chapter),verse=event.detail?.verse;
 const target=books.find(b=>b[0]===name);
 if(!target||!Number.isInteger(num)||num<1||num>target[1]||(verse!==undefined&&(!Number.isInteger(verse)||verse<1||verse>176))){event.preventDefault();return;}
 book.value=name;chapters(num);loadChapter().then(()=>{
  if(verse===undefined||book.value!==name||Number(chapter.value)!==num)return;
  const row=el("verses").querySelector('[data-verse="'+verse+'"]');
  if(row){row.classList.add("is-selected");row.scrollIntoView({block:"center"});}
  else message("reader-status","Verse "+verse+" does not exist in "+name+" "+num+".");
 });
});
book.addEventListener("change",()=>{chapters();loadChapter();}); chapter.addEventListener("change",loadChapter);
function turnChapter(direction){
 const index=books.findIndex(item=>item[0]===book.value), number=Number(chapter.value);
 if(index<0)return;
 if(direction<0 && number>1)chapter.value=String(number-1);
 else if(direction>0 && number<books[index][1])chapter.value=String(number+1);
 else {const adjacent=books[index+direction];if(!adjacent)return;book.value=adjacent[0];chapters(direction<0?adjacent[1]:1);}
 loadChapter();
}
el("previous").addEventListener("click",()=>turnChapter(-1));
el("next").addEventListener("click",()=>turnChapter(1));
// Keep the reader preference on this device without touching saved study data.
const textSize = el("text-size");
const textSizeOutput = el("text-size-value");
function applyTextSize(value) {
 const size = Math.max(Number(textSize.min), Math.min(Number(textSize.max), Number(value) || 20));
 textSize.value = String(size);
 el("verses").style.fontSize = size + "px";
 textSizeOutput.textContent = size + " px";
}
applyTextSize(read("hk-bible-reader-text-size") ?? textSize.value);
textSize.addEventListener("input",()=>{applyTextSize(textSize.value); save("hk-bible-reader-text-size", Number(textSize.value));});
el("collection").addEventListener("change",loadPortal); el("search").addEventListener("input",renderTracks); el("refresh").addEventListener("click",loadPortal);
el("saved-tracks-only").addEventListener("change",renderTracks);
el("save-track").addEventListener("click",()=>{
 if(!currentTrackKey)return;
 const favorites=studyTools.favoriteKeys(read("hk-bible-favorite-tracks")),existing=favorites.includes(currentTrackKey);
 if(!existing&&favorites.length>=500){message("track-save-status","You have reached 500 saved titles. Remove a title before adding another.");return;}
 const changed=existing?favorites.filter(key=>key!==currentTrackKey):[...favorites,currentTrackKey];
 if(save("hk-bible-favorite-tracks",changed)){el("save-track").textContent=existing?"Save this title":"Remove from saved titles";message("track-save-status",existing?"Title removed from your saved collection.":"Title saved on this device.");renderTracks();}else message("track-save-status","Your browser could not save this title.");
});
el("share").addEventListener("click",async()=>{if(!shareText)return;try { if(navigator.share)await navigator.share({title:"HEAVENLY KEY BIBLE",text:shareText});else if(navigator.clipboard){await navigator.clipboard.writeText(shareText);message("reader-status","Chapter copied for sharing.");}else message("reader-status","Select the chapter text and copy it to share."); }catch(error){if(error.name!=="AbortError")message("reader-status","Sharing could not be completed. You can copy the chapter text.");}});
for(const id of ["chapter-audio","song-audio","song-video"]){el(id).addEventListener("play",()=>{stopNarration();for(const other of ["chapter-audio","song-audio","song-video"])if(other!==id)el(other).pause();});el(id).addEventListener("error",()=>message(id==="chapter-audio"?"audio-status":"track-credit","This recording could not be played. Please try again."));}
window.addEventListener("pagehide",()=>{stopNarration();for(const id of ["chapter-audio","song-audio","song-video"])el(id).pause();});
el("narrate").addEventListener("click",narrate);
el("save-verse").addEventListener("click",()=>{
 if(!selectedVerse)return;const entries=studyEntries(),index=entries.findIndex(x=>x.key===selectedVerse.key),entry={...selectedVerse,note:el("study-note").value.trim().slice(0,5000)};
 if(index<0&&entries.length>=500){message("save-status","You have reached 500 saved verses. Remove an entry before adding another.");return;}
 if(index>=0)entries[index]=entry;else entries.unshift(entry);
 if(save("hk-bible-study",entries)){renderStudy();message("save-status","Verse and note saved on this device.");}else message("save-status","Saving failed. Your browser storage may be unavailable or full. Keep a copy of your note.");
});
el("copy-verse").addEventListener("click",async()=>{
 if(!selectedVerse)return;
 const verse=selectedVerse,text=verse.book+" "+verse.chapter+":"+verse.number+" (KJV)\n"+verse.text;
 try{
  if(!navigator.clipboard?.writeText){message("save-status","Select the verse text and copy it using your browser.");return;}
  await navigator.clipboard.writeText(text);
  if(selectedVerse?.key===verse.key)message("save-status","Verse copied for sharing.");
 }catch{if(selectedVerse?.key===verse.key)message("save-status","Copying is unavailable. Select the verse text and copy it using your browser.");}
});
el("memory-toggle").addEventListener("click",()=>{el("selected-text").hidden=!el("selected-text").hidden;el("memory-toggle").textContent=el("selected-text").hidden?"Reveal verse":"Hide verse to practise";});
el("scripture-search").addEventListener("submit",searchScripture);
el("scripture-image").addEventListener("click",scriptureImage);
async function setupOffline(){
 const button=el("offline-download");
 if(!("serviceWorker" in navigator)){message("offline-status","Offline download is unavailable in this browser.");button.disabled=true;return;}
 try{
  await navigator.serviceWorker.register("./sw.js",{scope:"./"});
  let readyTimer;
  const registration=await Promise.race([
   navigator.serviceWorker.ready,
   new Promise((_,reject)=>{readyTimer=setTimeout(()=>reject(new Error("Offline setup timed out")),20000);})
  ]).finally(()=>clearTimeout(readyTimer));button.disabled=false;
  message("offline-status","Download all 66 books for reading without internet. Hymn and gospel recordings still need internet.");
  button.addEventListener("click",()=>{
   const worker=registration.active;
   if(!worker){message("offline-status","Offline setup is not ready. Reload the page and try again.");return;}
   button.disabled=true;const channel=new MessageChannel();message("offline-status","Downloading the Bible for offline reading…");
   channel.port1.onmessage=event=>{
    const data=event.data;
    if(data.type==="progress")message("offline-status","Downloaded "+data.count+" of "+data.total+" books…");
    if(["complete","error","busy"].includes(data.type)){
     button.disabled=false;channel.port1.close();
     message("offline-status",data.type==="complete"?"All 66 books saved for offline reading in this browser. Browser storage must remain available.":data.type==="busy"?"A Bible download is already running in another tab.":data.message);
    }
   };
   worker.postMessage({type:"SAVE_BIBLE_OFFLINE"},[channel.port2]);
  });
 }catch{message("offline-status","Offline setup failed. You can continue reading online.");button.disabled=true;}
}
setupOffline();
setupPlans();
el("export-backup").addEventListener("click",downloadBackup);
el("import-backup").addEventListener("click",importBackup);
window.addEventListener("storage",event=>{
 if(event.key==="hk-bible-study")renderStudy();
 if(event.key==="hk-bible-plan-progress")renderPlan();
 if(event.key==="hk-bible-favorite-tracks")renderTracks();
});
renderStudy(); loadChapter(); loadPortal();
})();


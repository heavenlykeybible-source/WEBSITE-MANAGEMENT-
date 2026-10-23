/* Reading plans and backup validation. User notes remain on the user's device. */
((root) => {
 "use strict";
 const bookList=[
 ["Genesis",50],["Exodus",40],["Leviticus",27],["Numbers",36],["Deuteronomy",34],["Joshua",24],["Judges",21],["Ruth",4],["1 Samuel",31],["2 Samuel",24],["1 Kings",22],["2 Kings",25],["1 Chronicles",29],["2 Chronicles",36],["Ezra",10],["Nehemiah",13],["Esther",10],["Job",42],["Psalms",150],["Proverbs",31],["Ecclesiastes",12],["Song of Solomon",8],["Isaiah",66],["Jeremiah",52],["Lamentations",5],["Ezekiel",48],["Daniel",12],["Hosea",14],["Joel",3],["Amos",9],["Obadiah",1],["Jonah",4],["Micah",7],["Nahum",3],["Habakkuk",3],["Zephaniah",3],["Haggai",2],["Zechariah",14],["Malachi",4],["Matthew",28],["Mark",16],["Luke",24],["John",21],["Acts",28],["Romans",16],["1 Corinthians",16],["2 Corinthians",13],["Galatians",6],["Ephesians",6],["Philippians",4],["Colossians",4],["1 Thessalonians",5],["2 Thessalonians",3],["1 Timothy",6],["2 Timothy",4],["Titus",3],["Philemon",1],["Hebrews",13],["James",5],["1 Peter",5],["2 Peter",3],["1 John",5],["2 John",1],["3 John",1],["Jude",1],["Revelation",22]
 ];
 const allChapters=bookList.flatMap(([book,count])=>Array.from({length:count},(_,index)=>({book,chapter:index+1})));
 const plans=[
  {id:"knowing-jesus",title:"Knowing Jesus — 7 days",days:[1,3,4,6,10,14,15].map(chapter=>[{book:"John",chapter}])},
  {id:"prayer-faith",title:"Prayer and faith — 7 days",days:[["Psalms",27],["Matthew",6],["Luke",18],["Philippians",4],["James",1],["Ephesians",6],["1 Thessalonians",5]].map(([book,chapter])=>[{book,chapter}])},
  {id:"whole-bible",title:"Whole Bible — 365 days",days:Array.from({length:365},(_,day)=>allChapters.slice(Math.floor(day*1189/365),Math.floor((day+1)*1189/365)))}
 ];
 function progress(raw) {
  const out={};
  for(const plan of plans){
   const days=raw&&typeof raw==="object"&&Array.isArray(raw[plan.id])?raw[plan.id]:[];
   out[plan.id]=[...new Set(days.filter(day=>Number.isInteger(day)&&day>=0&&day<plan.days.length))].sort((a,b)=>a-b);
  }
  return out;
 }
 function parseBackup(raw) {
  if(!raw||raw.product!=="HEAVENLY KEY BIBLE"||raw.version!==1||!Array.isArray(raw.entries)||raw.entries.length>500)throw Error("Choose a HEAVENLY KEY BIBLE study backup with no more than 500 saved verses.");
  if(raw.translation!==undefined&&raw.translation!=="KJV")throw Error("Only KJV study backups are supported.");
  const seen=new Set();
  const entries=raw.entries.map(entry=>{
   if(!entry||typeof entry.book!=="string"||!bookList.some(([name,count])=>name===entry.book&&Number.isInteger(entry.chapter)&&entry.chapter>=1&&entry.chapter<=count)||!Number.isInteger(entry.number)||entry.number<1||entry.number>176||typeof entry.note!=="string"||entry.note.length>5000)throw Error("The backup contains an invalid verse or note.");
   const key=entry.book+":"+entry.chapter+":"+entry.number;
   if(entry.key!==key||seen.has(key))throw Error("The backup contains duplicate or inconsistent verse references.");
   seen.add(key);
   return{key,book:entry.book,chapter:entry.chapter,number:entry.number,note:entry.note};
  });
  return{entries,progress:progress(raw.progress)};
 }
 function mergeEntries(existing,incoming) {
  const map=new Map(existing.map(entry=>[entry.key,entry]));
  for(const entry of incoming)if(!map.has(entry.key))map.set(entry.key,entry);
  if(map.size>500)throw Error("The combined notes exceed 500 saved verses. Remove some entries before importing.");
  return[...map.values()];
 }
 function trackKey(item){
  if(Number.isSafeInteger(item.hymnId)&&item.hymnId>0)return "hymn:"+item.hymnId;
  if(Number.isSafeInteger(item.media_id)&&item.media_id>0)return "gospel:"+item.media_id;
  if(typeof item.sourceUrl==="string"){
   try{const url=new URL(item.sourceUrl);if(url.protocol==="https:"&&["hymnary.org","en.wikisource.org"].includes(url.hostname))return "classic:"+url.href;}catch{}
  }
  return null;
 }
 function favoriteKeys(raw){
  return Array.isArray(raw)?[...new Set(raw.filter(key=>typeof key==="string"&&(/^(hymn|gospel):[1-9]\d*$/.test(key)||/^classic:https:\/\/(hymnary\.org|en\.wikisource\.org)\//.test(key))))].slice(0,500):[];
 }
 function isKjvRecording(item){
  return item&&typeof item.sourceLabel==="string"&&["KJV","KING JAMES (AUTHORIZED) VERSION","KING JAMES VERSION"].includes(item.sourceLabel.trim().toUpperCase())&&(item.translation===undefined||item.translation==="KJV");
 }
 root.HKStudyTools={plans,progress,parseBackup,mergeEntries,trackKey,favoriteKeys,isKjvRecording};
})(typeof window!=="undefined"?window:globalThis);

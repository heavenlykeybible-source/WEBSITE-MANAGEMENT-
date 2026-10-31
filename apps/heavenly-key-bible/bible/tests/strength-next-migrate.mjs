// Non-destructive migration of legacy twelve-topic devotionals into the new one-topic editorial format.
// Draft output is written ONLY to a private local directory, never to a public website folder.
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const source=resolve(dirname(fileURLToPath(import.meta.url)),'../../heavenly-key-website/bible');
const output=process.argv[2];
if(!output)throw Error('Provide a private output directory outside the public website');
const destination=resolve(output);
if(destination===source||destination.startsWith(source+'/'))throw Error('Refusing to write editorial drafts into public website');
const files=readdirSync(source).filter(n=>/^strength-devotionals-(2026|2027|year[1-5])(?:-batch\d+)?\.json$/.test(n)).sort();
const byDate=new Map();
for(const filename of files){
 const data=JSON.parse(readFileSync(resolve(source,filename),'utf8'));
 if(!Array.isArray(data.entries))throw Error('Missing entries: '+filename);
 for(const entry of data.entries){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)||!Array.isArray(entry.topics)||entry.topics.length!==12)throw Error('Invalid legacy entry in '+filename);
  if(byDate.has(entry.date))throw Error('Duplicate date: '+entry.date);
  const offset=Math.floor((Date.parse(entry.date+'T00:00:00Z')-Date.parse('2026-10-30T00:00:00Z'))/86400000);
  const selected=entry.topics[((offset%12)+12)%12];
  byDate.set(entry.date,{
   date:entry.date,status:'draft',review:{doctrinalApproved:false,sourcesVerified:false},
   provenance:{legacyFile:filename,legacyDate:entry.date,selectedTopicIndex:((offset%12)+12)%12,originalTitle:entry.title},
   sections:{
    topic:{title:selected.topic,reference:selected.reference,kjvText:selected.bibleText,reflection:selected.reflection},
    bibleReading:{oldTestament:[],newTestament:[]},
    hymn:null,bibleStory:null,worldStory:null,eternity:null,decision:null,
    warfare:{permanentReferences:['Matthew 11:12','Luke 18:1'],prayerPoints:[]},
    propheticPrayer:null,healthPrayer:null,salvation:null,
    challenges:entry.topics.map(t=>({theme:t.topic,text:'',legacyReference:t.reference,legacyReflection:t.reflection,legacyPrayer:t.prayer}))
   }
  });
 }
}
mkdirSync(destination,{recursive:true});
const entries=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
writeFileSync(resolve(destination,'strength-next-editorial-drafts.json'),JSON.stringify({publicationStatus:'editorial-hold',entries},null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({draftDays:entries.length,missingRequiredSections:true,publicationStatus:'editorial-hold'}));

const host=document.getElementById('chapter-study-output');
const extraHost=document.getElementById('extra-bible-output');

const tools=document.getElementById('chapter-study-tools');
const referenceBooks={'John':'john','Psalm':'psalms','Psalms':'psalms','Isaiah':'isaiah','Hebrews':'hebrews','Numbers':'numbers','1 John':'1john'};
const notes={
 'genesis:1':{summary:'God creates the heavens and the earth, orders creation, and makes humanity in His image.',lessons:['God is the Creator.','Human life bears God-given dignity.'],characters:['God'],important:[1,3,27,31],cross:['John 1:1-3','Psalm 33:6','Hebrews 11:3']},
 'psalms:23':{summary:'David describes the LORD as his shepherd, provider, protector and enduring hope.',lessons:['Trust God for guidance.','God is present through hardship.'],characters:['David (speaker)','The LORD (shepherd)'],important:[1,4,6],cross:['John 10:11','Isaiah 40:11']},
 'john:3':{summary:'Jesus teaches Nicodemus about new birth and the love of God; John the Baptist points people to Christ.',lessons:['New birth is spiritual.','Faith in Christ is central to the chapter.'],characters:['Jesus','Nicodemus','John the Baptist'],important:[3,16,17,30],cross:['Numbers 21:8-9','John 1:12','1 John 4:9']}
};
const dictionary={atonement:'Reconciliation with God; in Scripture, connected with sacrifice and forgiveness.',mercy:'Compassion shown to someone in need.',disciple:'A learner or follower.',parable:'A story used to teach a lesson.',prophet:'A person called to speak God’s message.',apostle:'One sent with a commission.',resurrection:'Rising from the dead.',redemption:'Deliverance by payment or release.',forgive:'To pardon or release from an offence.',blessed:'Favoured or made happy.',wisdom:'Sound judgment and understanding.',truth:'That which is true and faithful.',grace:'God’s undeserved favour.',faith:'Trust or confidence in God.',redeem:'To buy back or deliver.',shepherd:'One who cares for and guides a flock.',covenant:'A solemn binding agreement.',righteousness:'What is right or just before God.',repent:'To turn away from sin and turn toward God.',holy:'Set apart as sacred.',salvation:'Deliverance or rescue.',spirit:'Breath, wind, or a nonphysical being; meaning depends on context.'};
const namedPeople=['Jesus','Christ','Moses','Aaron','Abraham','Sarah','Isaac','Rebekah','Jacob','Esau','Joseph','Judah','David','Solomon','Samuel','Saul','Elijah','Elisha','Isaiah','Jeremiah','Ezekiel','Daniel','Jonah','Ruth','Naomi','Esther','Mordecai','Job','Noah','Adam','Eve','Cain','Abel','Peter','Paul','John','James','Andrew','Philip','Thomas','Matthew','Mary','Martha','Lazarus','Nicodemus','Pilate','Herod','Timothy','Titus','Barnabas','Stephen','Luke','Mark','Joshua','Caleb','Deborah','Gideon','Samson','Hannah','Elizabeth','Zacharias','Judas','Pharaoh'];
const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
let latestRequest=0;
document.getElementById('study-root')?.addEventListener('change',event=>{if(event.target.matches('#kjv-book-picker,#kjv-chapter-picker')){latestRequest++;host?.replaceChildren();}});
tools?.addEventListener('click',e=>{if(e.target.closest('[data-extra-tool]')){latestRequest++;host?.replaceChildren();}},true);
tools?.addEventListener('click',async e=>{
 const button=e.target.closest('button[data-study-tool]');if(!button||!host)return;
 const book=document.getElementById('kjv-book-picker'),chapter=document.getElementById('kjv-chapter-picker');
 if(!book||!chapter){host.replaceChildren(el('p','Bible reader is still loading. Please wait and try again.'));return;}
 extraHost?.replaceChildren();
 const request=++latestRequest;
 const key=book.value+':'+chapter.value,kind=button.dataset.studyTool,info=notes[key];
 const heading=button.textContent.trim()+' · '+book.selectedOptions[0].text+' '+chapter.value;
 host.replaceChildren(el('p','Loading '+book.selectedOptions[0].text+' '+chapter.value+'…'));
 try{
  let entry={name:book.selectedOptions[0].text};
  let verses=[];
  if(['definitions','important','summary','lessons','characters'].includes(kind)){
   const manifestResponse=await fetch('/kjv-manifest.json');if(!manifestResponse.ok)throw Error('Bible catalogue unavailable');
   const manifest=await manifestResponse.json();
   entry=manifest.books.find(b=>b.id===key.split(':')[0]);if(!entry)throw Error('Book not found');
   const bookResponse=await fetch('/'+entry.path);if(!bookResponse.ok)throw Error('Bible text unavailable');
   const data=await bookResponse.json();
   if(!data||data.book!==entry.name||!Array.isArray(data.chapters)||data.chapters.length!==entry.chapters)throw Error('Bible data integrity check failed');
   verses=data.chapters[Number(key.split(':')[1])-1];if(!Array.isArray(verses)||!verses.length||!verses.every(v=>typeof v==='string'))throw Error('Chapter unavailable');
  }
  if(request!==latestRequest||book.value+':'+chapter.value!==key)return;
  host.replaceChildren(el('h3',heading));
  if(kind==='definitions'){
   const words=Object.entries(dictionary).filter(([w])=>verses.some(v=>new RegExp('\\b'+w+'\\b','i').test(v)));
   if(!words.length)host.append(el('p','No matching terms in the reviewed glossary. Read the chapter above; the glossary is not exhaustive.'));
   for(const [word,definition] of words)host.append(el('p',word+': '+definition));
  }else if(kind==='cross'){
   if(!info?.cross?.length){host.append(el('p','Reviewed cross-references are not yet available for this chapter.'));return;}
   for(const reference of info.cross){
    const match=/^(1 John|John|Psalm|Psalms|Isaiah|Hebrews|Numbers) (\d+):(\d+)(?:-(\d+))?$/.exec(reference);
    const p=el('p','');
    if(match&&referenceBooks[match[1]]){
     const link=el('a',reference+' — Open in KJV Bible');
     link.href='/bible.html?book='+encodeURIComponent(referenceBooks[match[1]])+'&chapter='+encodeURIComponent(match[2])+'#study-root';
     p.append(link);
    }else p.textContent=reference;
    host.append(p);
   }
  }else if(kind==='important'){
   if(!info?.important){host.append(el('p','No editor-reviewed important-verse selections for this chapter. To avoid inventing a ranking, here is the opening verse for reading (not an importance ranking).'));if(verses[0])host.append(el('p',entry.name+' '+chapter.value+':1 — '+verses[0]));return;}
   for(const n of info.important)if(verses[n-1])host.append(el('p',entry.name+' '+chapter.value+':'+n+' — '+verses[n-1]));
  }else{
   const values=kind==='summary'?(info?.summary?[info.summary]:null):info?.[kind];
   if(!values){
    if(kind==='summary'){
     host.append(el('p','Scripture-based chapter overview (selected verses, not a reviewed interpretation):'));
     const positions=[0,Math.floor((verses.length-1)/2),verses.length-1];
     for(const i of [...new Set(positions)])host.append(el('p',entry.name+' '+chapter.value+':'+(i+1)+' — '+verses[i]));
    }else if(kind==='lessons'){
     host.append(el('p','Chapter-specific study questions (not automatically inferred doctrine):'));
     host.append(el('p','What does '+entry.name+' '+chapter.value+' teach about God?'));
     host.append(el('p','What instruction, warning, promise or example appears in this chapter?'));
     host.append(el('p','Which verses support your conclusions?'));
    }else if(kind==='characters'){
     const people=namedPeople.filter(name=>verses.some(v=>new RegExp('\\\\b'+name+'\\\\b','i').test(v)));
     host.append(el('p','Names found in this chapter (automated name matching; not a complete or reviewed character analysis):'));
     if(people.length)for(const person of people)host.append(el('p',person));
     else host.append(el('p','No names from the current name index were detected. This does not mean the chapter has no characters.'));
    }
    return;
   }
   for(const value of values)host.append(el('p',value));
  }
 }catch(err){if(request===latestRequest)host.replaceChildren(el('p','Unable to load chapter study material. Please try again online.'));}
});

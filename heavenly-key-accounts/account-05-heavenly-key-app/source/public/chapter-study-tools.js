atonement:'Reconciliation with God; in Scripture, connected with sacrifice and forgiveness.',mercy:'Compassion shown to someone in need.',disciple:'A learner or follower.',parable:'A story used to teach a lesson.',prophet:'A person called to speak God’s message.',apostle:'One sent with a commission.',resurrection:'Rising from the dead.',redemption:'Deliverance by payment or release.',forgive:'To pardon or release from an offence.',blessed:'Favoured or made happy.',wisdom:'Sound judgment and understanding.',truth:'That which is true and faithful.',grace:'God’s undeserved favour.',faith:'Trust or confidence in God.',redeem:'To buy back or deliver.',shepherd:'One who cares for and guides a flock.',covenant:'A solemn binding agreement.',righteousness:'What is right or just before God.',repent:'To turn away from sin and turn toward God.',holy:'Set apart as sacred.',salvation:'Deliverance or rescue.',spirit:'Breath, wind, or a nonphysical being; meaning depends on context.'},abide:"To remain or continue; often used of remaining in Christ.",altar:"A place where offerings or sacrifices are presented to God.",anoint:"To apply oil as a sign of consecration or appointment.",baptism:"A washing with water associated with repentance and identification with Christ.",blessing:"A gift, favour, or benefit received from God.",commandment:"An instruction or requirement given by God.",confession:"Acknowledging sin or declaring one's faith.",creation:"The act by which God brought the heavens and earth into existence.",deliverance:"Rescue from danger, oppression, or bondage.",eternal:"Without end; lasting forever.",fasting:"Voluntarily abstaining from food for a time of prayer or devotion.",fellowship:"Sharing in a common relationship or life, especially among believers.",forgiveness:"The pardoning of an offence or sin.",glory:"Honour, splendour, or the manifestation of God's greatness.",gospel:"The good news of Jesus Christ and salvation through Him.",humility:"A modest and lowly attitude before God and others.",intercession:"Prayer offered on behalf of another person.",justification:"Being declared righteous before God.",kingdom:"The reign or rule of a king; God's sovereign rule.",lamb:"A young sheep; a biblical image associated with sacrifice and Christ.",law:"A command or body of instructions, including God's commands.",love:"Self-giving care and commitment toward God and others.",messiah:"The Anointed One; the promised deliverer.",miracle:"An extraordinary act demonstrating divine power.",obedience:"Responding faithfully to a command or instruction.",peace:"Wholeness, reconciliation, and freedom from hostility.",prayer:"Communication with God in praise, confession, thanksgiving, or request.",promise:"An assurance that something will be done or given.",prophecy:"A message communicated by a prophet.",reconciliation:"The restoration of a broken relationship.",repentance:"Turning from sin toward God.",sabbath:"A day set apart for rest and worship.",sanctification:"Being set apart and made holy for God's purposes.",scripture:"Sacred writings; in Christianity, the books of the Bible.",sin:"An act, attitude, or condition contrary to God's will.",temptation:"A trial or enticement to do wrong.",testimony:"A witness or declaration of what one has seen, heard, or experienced.",thanksgiving:"The expression of gratitude to God.",worship:"Honour, reverence, and devotion offered to God.";
const dictionaryReferences={"atonement":"Romans 5:11","mercy":"Psalm 51:1","disciple":"Luke 14:27","parable":"Matthew 13:3","prophet":"Deuteronomy 18:18","apostle":"Mark 3:14","resurrection":"John 11:25","redemption":"Ephesians 1:7","forgive":"Ephesians 4:32","blessed":"Matthew 5:3","wisdom":"James 1:5","truth":"John 14:6","grace":"Ephesians 2:8","faith":"Hebrews 11:1","redeem":"Galatians 3:13","shepherd":"Psalm 23:1","covenant":"Genesis 17:7","righteousness":"Romans 3:22","repent":"Acts 3:19","holy":"1 Peter 1:16","salvation":"Acts 4:12","spirit":"John 4:24","abide":"John 15:4","altar":"Genesis 8:20","anoint":"1 Samuel 16:13","baptism":"Matthew 28:19","blessing":"Numbers 6:24","commandment":"John 14:15","confession":"1 John 1:9","creation":"Genesis 1:1","deliverance":"Psalm 34:17","eternal":"John 3:16","fasting":"Matthew 6:16","fellowship":"Acts 2:42","forgiveness":"Colossians 1:14","glory":"Psalm 19:1","gospel":"Mark 1:15","humility":"James 4:10","intercession":"1 Timothy 2:1","justification":"Romans 5:1","kingdom":"Matthew 6:33","lamb":"John 1:29","law":"Psalm 19:7","love":"1 Corinthians 13:4","messiah":"John 1:41","miracle":"John 2:11","obedience":"John 14:15","peace":"John 14:27","prayer":"Philippians 4:6","promise":"2 Peter 1:4","prophecy":"2 Peter 1:21","reconciliation":"2 Corinthians 5:18","repentance":"Acts 2:38","sabbath":"Exodus 20:8","sanctification":"1 Thessalonians 4:3","scripture":"2 Timothy 3:16","sin":"Romans 3:23","temptation":"James 1:13","testimony":"Revelation 12:11","thanksgiving":"1 Thessalonians 5:18","worship":"John 4:24"};
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
  if(kind==='dictionary'){
   host.replaceChildren();
   const shell=el('section');shell.className='hk-dictionary-app';
   shell.style.cssText='background:#e7f6df;border:3px solid #722039;border-radius:18px;padding:clamp(12px,3vw,24px);color:#243b26;max-width:850px;margin:12px auto;box-sizing:border-box';
   const title=el('h2','Bible Dictionary');title.style.cssText='color:#722039;margin:0 0 16px;font-size:clamp(1.35rem,3vw,1.8rem)';
   const search=el('input');search.type='search';search.placeholder='Search biblical words…';search.setAttribute('aria-label','Search Bible Dictionary');search.style.cssText='width:100%;box-sizing:border-box;padding:13px 15px;border:1.5px solid #722039;border-radius:12px;background:white;color:#243b26;font:inherit;margin-bottom:12px';
   const alphabet=el('nav');alphabet.setAttribute('aria-label','Dictionary alphabetical navigation');alphabet.style.cssText='display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px';
   const results=el('div');results.setAttribute('aria-live','polite');results.style.cssText='display:grid;gap:9px';
   let active='All';
   const show=()=>{
    results.replaceChildren();
    const q=search.value.trim().toLowerCase();
    const matches=Object.entries(dictionary).filter(([word,definition])=>(active==='All'||word[0].toUpperCase()===active)&&(!q||word.includes(q)||definition.toLowerCase().includes(q))).sort(([a],[b])=>a.localeCompare(b));
    if(!matches.length){results.append(el('p','No matching dictionary entries.'));return;}
    for(const [word,definition] of matches){
     const card=el('details');card.style.cssText='background:#f9fff6;border:1px solid #722039;border-radius:11px;padding:12px 14px';
     const summary=el('summary',word[0].toUpperCase()+word.slice(1));summary.style.cssText='cursor:pointer;color:#722039;font-weight:700;font-size:1.05rem';
     const meaning=el('p',definition);meaning.style.cssText='margin:10px 0 0;line-height:1.6';
     const actions=el('div');actions.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px';
     const reference=dictionaryReferences[word];
     if(reference){const verse=el('span',reference);verse.style.cssText='color:#722039;font-weight:600;font-size:.9rem';actions.append(verse);}
     const copy=el('button','Copy');copy.type='button';copy.setAttribute('aria-label','Copy definition of '+word);copy.style.cssText='border:1px solid #722039;border-radius:7px;background:white;color:#722039;padding:6px 12px;cursor:pointer';
     copy.addEventListener('click',async()=>{const content=word[0].toUpperCase()+word.slice(1)+' — '+definition+(reference?'\n'+reference:'');try{await navigator.clipboard.writeText(content);copy.textContent='Copied';}catch{const area=el('textarea');area.value=content;area.style.position='fixed';area.style.left='-9999px';document.body.append(area);area.select();const ok=document.execCommand('copy');area.remove();copy.textContent=ok?'Copied':'Select and copy';}});
     actions.append(copy);card.append(summary,meaning,actions);results.append(card);
    }
   };
   for(const letter of ['All',...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']){
    const button=el('button',letter);button.type='button';button.style.cssText='border:1px solid #722039;border-radius:7px;padding:5px 8px;background:white;color:#722039;cursor:pointer;font-weight:600;min-width:29px';
    button.addEventListener('click',()=>{active=letter;for(const b of alphabet.children){b.style.background=b===button?'#722039':'white';b.style.color=b===button?'white':'#722039';}show();});
    alphabet.append(button);
   }
   alphabet.firstChild.style.background='#722039';alphabet.firstChild.style.color='white';
   search.addEventListener('input',show);
   shell.append(title,search,alphabet,results);host.append(shell);show();
  }else if(kind==='definitions'){
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
     const people=namedPeople.filter(name=>verses.some(v=>new RegExp('\\b'+name+'\\b','i').test(v)));
     host.append(el('p','Names found in this chapter (automated name matching; not a complete or reviewed character analysis):'));
     if(people.length)for(const person of people)host.append(el('p',person));
     else host.append(el('p','No names from the current name index were detected. This does not mean the chapter has no characters.'));
    }
    return;
   }
   for(const value of values)host.append(el('p',value));
  }
 }catch(err){if(request===latestRequest&&book.value+':'+chapter.value===key)host.replaceChildren(el('p','Unable to load chapter study material. Please try again online.'));}
});

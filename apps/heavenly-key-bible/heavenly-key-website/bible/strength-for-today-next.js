(()=>{'use strict';
const sections=[["Today's Topic","One central topic will guide all 12 sections. Today's editorially approved topic is not available yet."],["Bible Reading","Six verified KJV passages will appear here: three from the Old Testament and three from the New Testament. Every verse will be displayed with its reference."],["Hymn of the Day","The matching hymn title and verified number from the Heavenly Key Old Time Gospel Revival Hymn Book will appear after editorial review."],["Bible Story","A short, Scripture-verified Bible account related to the day's central topic, with the source passage for further reading."],["Life Stories Around the World","A dated, verifiable contemporary account with source attribution and a practical lesson. No fictional testimony will be presented as fact."],["Eternity in View","A concise reflection connecting today's subject to obedience, Christ and eternity."],["Destiny Decision & Action","Thoughtful questions, a personal decision and one achievable action for today."],["Warfare Prayer","Permanent KJV references: Matthew 11:12 and Luke 18:1. Three spiritually focused prayer points will be written for the day's topic."],["Prophetic Prayer","A short, Scripture-consistent pastoral prayer for readers. This section will not guarantee specific outcomes."],["Health & Wellness Prayer","A brief evidence-informed health reminder and compassionate prayer. Prayer does not replace appropriate medical care."],["Salvation Prayer","A clear invitation to repentance and faith in Jesus Christ, with the existing I Say Yes to Jesus steps and voluntary follow-up."],["12 Kingdom Challenges for Today","The original 12 ministry themes will remain here as twelve distinct, very short daily challenges."]];
const names=['Revival & Spiritual Fire','Holiness & Righteousness','Hope & Encouragement','Prayer & Intercession','Salvation & Repentance','Faith & Trust','The Holy Spirit','Evangelism & Soul Winning','Love & Christian Unity','The Word & Obedience','Wisdom & Discernment','End-time & Rapture Readiness'];
const $=id=>document.getElementById(id);
let current=0;
const menu=$('menu'),body=$('content'),status=$('status');
function sectionText(index){const s=sections[index];return (index+1)+'. '+s[0]+'\n'+s[1]+(index===11?'\n'+names.map((n,i)=>(i+1)+'. '+n+' — Awaiting approved daily challenge.').join('\n'):'');}
function allText(){return 'STRENGTH FOR TODAY — OUR DAILY MANNA\nDevelopment preview: no devotional has been approved for publication.\n\n'+sections.map((_,i)=>sectionText(i)).join('\n\n');}
function render(){const s=sections[current];$('section-number').textContent='SECTION '+String(current+1).padStart(2,'0')+' OF 12';$('section-title').textContent=s[0];body.replaceChildren();const p=document.createElement('p');p.textContent=s[1];body.append(p);if(current===7){const x=document.createElement('div');x.className='scripture';x.textContent='Matthew 11:12 (KJV) · Luke 18:1 (KJV)';body.append(x);}
if(current===10){const a=document.createElement('a');a.href='https://www.heavenlykey.org/';a.textContent='Heavenly Key — ministry website';body.append(a);}
if(current===11)for(const [i,name] of names.entries()){const row=document.createElement('div');row.className='challenge';const label=document.createElement('strong');label.textContent=(i+1)+'. '+name;const detail=document.createElement('span');detail.className='muted';detail.textContent='Awaiting approved daily challenge.';row.append(label,detail);body.append(row);}
[...menu.children].forEach((b,i)=>{if(i===current)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current')});$('prev').disabled=current===0;$('next').disabled=current===11;$('progress').textContent=(current+1)+' / 12';status.textContent='';}
sections.forEach((s,i)=>{const button=document.createElement('button');button.type='button';button.textContent=String(i+1).padStart(2,'0')+'  '+s[0];button.onclick=()=>{current=i;render();$('section-title').focus()};menu.append(button)});
// Accessible keyboard navigation for the twelve-section menu.
menu.addEventListener('keydown',event=>{
 const buttons=[...menu.querySelectorAll('button')];
 const index=buttons.indexOf(document.activeElement);
 if(index<0)return;
 let target=index;
 switch(event.key){
  case 'ArrowDown':case 'ArrowRight':target=(index+1)%buttons.length;break;
  case 'ArrowUp':case 'ArrowLeft':target=(index-1+buttons.length)%buttons.length;break;
  case 'Home':target=0;break;
  case 'End':target=buttons.length-1;break;
  default:return;
 }
 event.preventDefault();buttons[target].focus();buttons[target].click();
});
$('prev').onclick=()=>{if(current>0){current--;render();$('section-title').focus()}};$('next').onclick=()=>{if(current<11){current++;render();$('section-title').focus()}};
async function copy(value){try{await navigator.clipboard.writeText(value);status.textContent='Copied preview text.'}catch{status.textContent='Copy unavailable on this device.'}}
$('copy-section').onclick=()=>copy('DEVELOPMENT PREVIEW — NOT FOR PUBLICATION\n'+sectionText(current));$('copy-all').onclick=()=>copy(allText());
$('share').onclick=async()=>{if(!navigator.share){await copy(allText());return}try{await navigator.share({title:'Strength for Today — Our Daily Manna (Preview)',text:allText()})}catch(e){if(e.name!=='AbortError')status.textContent='Sharing unavailable.'}};
render();
})();
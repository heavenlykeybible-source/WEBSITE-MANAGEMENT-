const el=(tag,cls,content)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(content)n.textContent=content;return n};
const dateIndex=(length)=>Math.floor(Date.UTC(new Date().getFullYear(),new Date().getMonth(),new Date().getDate())/86400000)%length;
export async function mountMiniManna(host){
 const head=el('div','gc-manna-head'),label=el('span','gc-manna-eyebrow','✦ STRENGTH FOR TODAY'),heading=el('strong','','Strength for Today');
 head.append(label,heading);
 const body=el('div','gc-manna-body'),status=el('p','gc-manna-status','Loading today’s devotional…'),category=el('strong','gc-manna-topic'),ref=el('strong','gc-manna-reference'),quote=el('blockquote','gc-manna-verse'),encouragement=el('p','gc-manna-encouragement'),prayer=el('p','gc-manna-prayer'),actions=el('div','gc-manna-actions');
 const previous=el('button','','‹ Topic'),next=el('button','','Next ›'),listen=el('button','','▶ Listen'),copy=el('button','','Copy'),full=el('a','gc-manna-full','Open Strength for Today ↗');
 previous.type=next.type=listen.type=copy.type='button';full.href='strength-for-today.html';
 const footer=el('small','gc-manna-footer','Together we take Christ to the Nations of the World');
 actions.append(previous,next,listen,copy);
 body.append(category,ref,quote,encouragement,prayer,actions,full,status,footer);host.replaceChildren(head,body);status.setAttribute('role','status');
 let items=[],themes=[],index=0,speech=null;
 function stop(){if('speechSynthesis'in window)window.speechSynthesis.cancel();speech=null}
 function show(){if(!items.length)return;stop();const x=items[index],theme=themes[index];category.textContent=x[0];ref.textContent=x[1]+' (KJV)';quote.textContent=x[2];encouragement.textContent=x[3];prayer.textContent='Prayer: '+x[4];status.textContent='';if(theme){host.style.setProperty('--mini-manna-accent',theme.middle);host.style.setProperty('--mini-manna-gold',theme.gold);host.style.setProperty('--mini-manna-base',theme.start)}}
 previous.onclick=()=>{index=(index+items.length-1)%items.length;show()};
 next.onclick=()=>{index=(index+1)%items.length;show()};
 listen.onclick=()=>{if(!('speechSynthesis'in window)||!window.SpeechSynthesisUtterance){status.textContent='Speech is not supported on this device.';return}stop();const x=items[index],utterance=new window.SpeechSynthesisUtterance(x[0]+'. '+x[1]+'. '+x[2]+'. '+x[3]+'. Prayer: '+x[4]);utterance.lang='en-GB';utterance.rate=.9;utterance.onend=()=>{speech=null;status.textContent='Reading complete.'};speech=utterance;window.speechSynthesis.speak(utterance);status.textContent='Reading on your device. Tap Listen again to restart.'};
 copy.onclick=async()=>{const x=items[index];try{await navigator.clipboard.writeText(x[0]+'\n'+x[1]+' (Authorised King James Version)\n'+x[2]+'\n\n'+x[3]+'\n\nPrayer: '+x[4]+'\nJoin the Global Christian Social Network www.global.heavenlykey.org');status.textContent='Daily Manna copied.'}catch{status.textContent='Copy unavailable on this device.'}};
 try{const response=await fetch('strength-for-today.html',{credentials:'same-origin',signal:AbortSignal.timeout?AbortSignal.timeout(12000):undefined});if(!response.ok)throw Error('Devotional could not be loaded.');const html=await response.text();const match=html.match(/const items=(\[[\s\S]*?\]);const DAILY_MANNA_THEMES=(\[[^;]+\]);window/);if(!match)throw Error('Devotional source unavailable.');items=JSON.parse(match[1]);themes=JSON.parse(match[2]);if(items.length!==12||themes.length!==12)throw Error('Devotional list is incomplete.');index=dateIndex(items.length);if(host.isConnected)show()}catch(e){status.textContent=e.message;full.textContent='Open Daily Manna ↗'}
 host.addEventListener('DOMNodeRemoved',stop,{once:true});
}

import {DAILY_MANNA,BIBLE_STARTERS,IMAGE_FORMATS,makeMannaDraft,makeBibleDraft} from './content-sources.js';
const el=(tag,label)=>{const node=document.createElement(tag);if(label)node.textContent=label;return node};
window.addEventListener('socialplus-post-editor-ready',event=>{
 const {form,textarea}=event.detail;if(!form||!textarea)return;
 const panel=el('section');panel.className='sp-content-studio';panel.setAttribute('aria-label','Daily Manna and Authorised King James Version editorial studio');
 panel.style.cssText='background:linear-gradient(115deg,#091c4b,#1b4da9 70%,#7d295a);border-radius:18px;padding:22px;color:#fff;margin:18px 0;box-shadow:0 14px 30px #0b25532a';
 const title=el('h3','✦ Daily Manna & Authorised King James Version');title.style.cssText='font-size:22px;margin:4px 0 10px;color:#fff';
 const intro=el('p','Prepare beautiful scripture content for the existing SocialPlus draft queue. Nothing publishes automatically.');intro.style.color='#f6e5c0';
 const category=el('select'),topic=el('select'),orientation=el('select'),date=el('input'),apply=el('button','Use Premium Draft'),note=el('p');
 category.setAttribute('aria-label','Content source');topic.setAttribute('aria-label','Scripture or devotional topic');orientation.setAttribute('aria-label','Portrait image dimensions');
 for(const [value,label] of [['manna','Daily Manna — Strength for Today'],['bible','Authorised King James Version Bible']]){const o=el('option',label);o.value=value;category.append(o)}
 for(const [value,label] of [['tiktok','TikTok & Reels portrait · 9:16'],['facebook','Facebook portrait · 3:4']]){const o=el('option',label);o.value=value;orientation.append(o)}
 date.type='date';date.value=new Date().toISOString().slice(0,10);date.setAttribute('aria-label','Daily Manna date');
 const label=(text,node)=>{const wrapper=el('label',text);wrapper.style.cssText='display:block;font-weight:800;margin:12px 0 5px';node.style.cssText='display:block;width:100%;min-height:42px;border-radius:9px;border:1px solid #a7b9d7;padding:9px;color:#172c53;background:#fff;box-sizing:border-box';wrapper.append(node);return wrapper};
 const sync=()=>{topic.replaceChildren();const options=category.value==='manna'?DAILY_MANNA.map((x,i)=>[String(i),x.topic]):BIBLE_STARTERS.map((x,i)=>[String(i),x.book+' '+x.chapter+':'+x.verse]);for(const [value,name] of options){const o=el('option',name);o.value=value;topic.append(o)}};
 category.addEventListener('change',sync);sync();orientation.value='tiktok';
 apply.type='button';apply.style.cssText='border:0;border-radius:11px;background:#f6cd6e;color:#242438;font-weight:850;padding:12px 18px;margin-top:14px;cursor:pointer';
 apply.onclick=()=>{try{let draft;if(category.value==='manna'){const selected=DAILY_MANNA[Number(topic.value)];if(!selected)throw Error('Select a devotional topic');const format=IMAGE_FORMATS[orientation.value];draft={...makeMannaDraft(date.value+'T12:00:00Z',orientation.value),topic:selected.topic,reference:selected.reference,scripture:selected.kjvText,caption:[selected.topic,selected.reference+' (Authorised King James Version)',selected.kjvText,selected.encouragement,'Prayer: '+selected.prayer,'Join the Global Christian Social Network www.global.heavenlykey.org'].join('\n\n')};note.textContent='Draft prepared · '+format.width+' × '+format.height+' image layout selected. Image rendering/attachment and publishing require separate approved delivery workflows.'}
 else{const item=BIBLE_STARTERS[Number(topic.value)];if(!item)throw Error('Select a Bible reference');draft=makeBibleDraft(item.book,item.chapter,item.verse);note.textContent='Bible scripture draft prepared. Verify references before publication.'}
 textarea.value=draft.caption;textarea.dispatchEvent(new Event('input',{bubbles:true}));textarea.focus();}catch(e){note.textContent=e.message}};
 note.setAttribute('role','status');note.style.cssText='font-size:13px;line-height:1.5;color:#fff5ce';
 panel.append(title,intro,label('Choose content',category),label('Bible topic or verse',topic),label('Social image format',orientation),label('Choose devotional date',date),apply,note);
 form.parentElement.insertBefore(panel,form);
});

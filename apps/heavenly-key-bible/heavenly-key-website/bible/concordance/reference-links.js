'use strict';
// Enhance the existing Related Scriptures tab with direct KJV verse navigation.
// Only turns references in the study panel into links; it never changes Bible text.
(()=>{
const panel=document.getElementById('detail');
const bookSelector=document.getElementById('book');
if(!panel||!bookSelector)return;
const pattern=/^(.+?) (\d+):(\d+)(?:[–-](\d+))?$/;
function enhance(){
 const selected=document.querySelector('[data-tab="references"][aria-selected="true"]');
 if(!selected)return;
 const paragraph=panel.querySelector('p:last-child');
 if(!paragraph||paragraph.dataset.linksReady)return;
 const source=paragraph.textContent;
 if(!source||source.includes('not yet available'))return;
 const parts=source.split(/(;\s*)/);
 const fragment=document.createDocumentFragment();
 let linked=0;
 for(const part of parts){
  const match=part.trim().match(pattern);
  const option=match?Array.from(bookSelector.options).find(o=>o.text===match[1]):null;
  if(!option){fragment.append(document.createTextNode(part));continue}
  const url=new URL(location.href);
  url.searchParams.set('book',option.value);
  url.searchParams.set('chapter',match[2]);url.searchParams.set('verse',match[3]);
  url.hash='commentary-heading';
  const a=document.createElement('a');a.href=url.href;a.textContent=part.trim();
  fragment.append(a);linked++;
 }
 if(linked){paragraph.replaceChildren(fragment);paragraph.dataset.linksReady='true'}
}
new MutationObserver(enhance).observe(panel,{childList:true,subtree:false});
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>queueMicrotask(enhance)));
})();

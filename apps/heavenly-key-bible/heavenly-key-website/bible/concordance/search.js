'use strict';
(()=>{
const form=document.getElementById('concordance-search');
const term=document.getElementById('search-term');
const scope=document.getElementById('search-scope');
const results=document.getElementById('search-results');
const progress=document.getElementById('search-progress');
const stop=document.getElementById('search-stop');
const bookSelector=document.getElementById('book');
let controller=null;
function message(value){progress.textContent=value}
function addResult(name,code,chapter,verse,text){
 const li=document.createElement('li');
 const link=document.createElement('a');
 const url=new URL(location.href);
 url.searchParams.set('book',code);url.searchParams.set('chapter',chapter);url.searchParams.set('verse',verse);
 link.href=url.toString();link.textContent=name+' '+chapter+':'+verse;
 const excerpt=document.createElement('p');excerpt.textContent=text;
 li.append(link,excerpt);results.append(li);
}
async function search(event){
 event.preventDefault();
 if(controller)controller.abort();
 controller=new AbortController();const signal=controller.signal;
 results.replaceChildren();
 const query=term.value.trim().toLocaleLowerCase();
 if(query.length<2){message('Enter at least two characters.');return}
 const selected=scope.value==='current'?Array.from(bookSelector.options).filter(b=>b.value===bookSelector.value).map(b=>[b.text,b.value]):Array.from(bookSelector.options).map(b=>[b.text,b.value]);
 stop.hidden=false;let checked=0,hits=0,failures=0;
 message('Searching '+selected.length+' book(s)…');
 try{
  for(const [name,code] of selected){
   if(signal.aborted)break;
   try{
    const response=await fetch('../data/kjv/'+encodeURIComponent(code)+'.json',{signal});
    if(!response.ok)throw Error('Book unavailable');
    const data=await response.json();
    for(const [chapter,verses] of Object.entries(data.chapters||{})){
     for(const verse of verses){
      if(typeof verse.text==='string'&&verse.text.toLocaleLowerCase().includes(query)){
       addResult(name,code,chapter,verse.number,verse.text);
       hits++;
       if(hits>=200)break;
      }
     }
     if(hits>=200)break;
    }
   }catch(error){if(error.name==='AbortError')break;failures++}
   checked++;
   message('Searched '+checked+'/'+selected.length+' books · '+hits+' matches'+(failures?' · '+failures+' unavailable':''));
   if(hits>=200)break;
  }
  if(signal.aborted)message('Search stopped. '+hits+' results shown.');
  else message(hits+' matching verses found'+(hits>=200?' (first 200 shown; refine your search)':'')+(failures?'; '+failures+' books could not be searched.':''));
 }finally{stop.hidden=true;controller=null}
}
form.addEventListener('submit',search);
stop.addEventListener('click',()=>controller?.abort());
})();

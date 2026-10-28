(()=>{'use strict';
const $=id=>document.getElementById(id);
const status=$('kjv-tool-status'),verses=$('verses');
if(!status||!verses)return;
let speech=null;
const speechAvailable=()=>typeof window.speechSynthesis!=='undefined'&&typeof window.SpeechSynthesisUtterance!=='undefined';
function reference(){return (($('book')?.selectedOptions?.[0]?.textContent||$('book')?.value||'Bible')+' '+($('chapter')?.value||'1')).trim()}
function passage(){const lines=[...verses.querySelectorAll('[data-verse]')].map(el=>{const copy=el.cloneNode(true);copy.querySelectorAll('button,a,.reference-link,[data-tool]').forEach(n=>n.remove());return (el.getAttribute('data-verse')||'')+'. '+copy.textContent.replace(/\s+/g,' ').trim()}).filter(x=>x.length>5);return lines.join(' ')}
function stop(){if(speechAvailable())window.speechSynthesis.cancel();speech=null}
$('kjv-listen').addEventListener('click',()=>{if(!speechAvailable()){status.textContent='Speech playback is unavailable in this browser.';return}const text=passage();if(!text){status.textContent='Open a chapter first.';return}stop();const u=new SpeechSynthesisUtterance(reference()+'. King James Version. '+text);u.lang='en-GB';u.rate=Number($('kjv-speed').value)||1;u.onend=()=>{status.textContent='Reading finished.';speech=null};u.onerror=()=>{status.textContent='Speech was interrupted or unavailable.';speech=null};speech=u;window.speechSynthesis.speak(u);status.textContent='Reading '+reference()+' aloud on this device.'});
$('kjv-pause').addEventListener('click',()=>{if(!speechAvailable()||!speech){status.textContent='Start listening first.';return}if(window.speechSynthesis.paused){window.speechSynthesis.resume();status.textContent='Reading resumed.'}else{window.speechSynthesis.pause();status.textContent='Reading paused.'}});
$('kjv-stop').addEventListener('click',()=>{stop();status.textContent='Reading stopped.'});
async function copy(value){if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);return}throw Error('Clipboard unavailable')}
function shareText(){return reference()+' (KJV)\n'+location.href+'\nTogether we take Christ to the Nations of the World'}
$('kjv-share').addEventListener('click',async()=>{const text=shareText();try{if(navigator.share){await navigator.share({title:reference()+' — KJV Bible',text,url:location.href});status.textContent='Sharing options opened.'}else{await copy(text);status.textContent='Scripture link copied. Paste it into your preferred social network.'}}catch(e){if(e?.name!=='AbortError')status.textContent='Sharing unavailable. Use Copy chapter link instead.'}});
$('kjv-copy').addEventListener('click',async()=>{try{await copy(shareText());status.textContent='Chapter link and reference copied.'}catch{status.textContent='Clipboard unavailable; copy the address from your browser.'}});
const observer=new MutationObserver(()=>{if(speech){stop();status.textContent='Chapter changed. Press Listen to hear the new chapter.'}});
observer.observe(verses,{childList:true});
window.addEventListener('pagehide',stop);
})();
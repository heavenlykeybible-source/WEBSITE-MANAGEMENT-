export const sections=[['home','Home'],['live','Live Studio'],['radio','24/7 Radio'],['library','Sources / Media Library'],['connections','Connections'],['editing','AI Editing'],['meetings','Live Meetings'],['autopost','Social Auto Post'],['automation','Social Automation'],['settings','Settings'],['help','Help']];
export function initNavigation(doc=document,win=window){
 function show(focus=false){const requested=win.location.hash.slice(1),index=Math.max(0,sections.findIndex(([key])=>key===requested)),key=sections[index][0];
  for(const panel of doc.querySelectorAll('[data-view]'))panel.hidden=panel.dataset.view!==key;
  for(const link of doc.querySelectorAll('[data-nav]')){if(link.dataset.nav===key)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
  const previous=doc.getElementById('previous-feature'),next=doc.getElementById('next-feature');previous.hidden=index===0;previous.href='#'+sections[Math.max(0,index-1)][0];previous.textContent='← '+sections[Math.max(0,index-1)][1];next.hidden=index===sections.length-1;next.href='#'+sections[Math.min(sections.length-1,index+1)][0];next.textContent='Next: '+sections[Math.min(sections.length-1,index+1)][1]+' →';doc.getElementById('feature-position').textContent=(index+1)+' / '+sections.length;
  if(focus)doc.querySelector('#view-'+key+' h2')?.focus({preventScroll:true});
 }
 win.addEventListener('hashchange',()=>{doc.querySelector('.workspace-more')?.removeAttribute('open');show(true);});show();return key=>{if(sections.some(([id])=>id===key)){win.location.hash=key;show(true);}};
}
function date(value){if(!value)return NaN;return Date.parse(value.includes('T')?value:value.replace(' ','T')+'Z');}
export function radioSummary({media=[],live=null,settings=[],playout=[]},now=Date.now()){
 const enabled=Boolean(settings.find(x=>x.channel==='radio')?.playlist_enabled),available=media.filter(x=>x.status==='published'&&(x.keep_media||!x.retention_until||date(x.retention_until)>now));const audio=available.filter(x=>x.media_type==='audio');
 if(live&&['live','reconnecting'].includes(live.status)&&['radio','both'].includes(live.destination||'both'))return {title:live.status==='reconnecting'?'Live radio · reconnecting':'Live radio programme',description:(live.title||'Live programme')+(live.status==='reconnecting'?' is waiting for the connection to return.':' has priority over recorded playback.')};
 const scheduled=playout.find(x=>['playing','scheduled'].includes(x.status)&&date(x.starts_at)<=now&&date(x.ends_at)>now);
 if(scheduled)return {title:'Scheduled radio programme',description:(scheduled.title||'A scheduled recording')+' has priority over the automatic playlist.'};
 if(!enabled)return {title:'Automatic radio is off',description:'Enable the radio playlist below to allow published recordings to play when no live or scheduled programme has priority.'};
 if(audio.length)return {title:'Automatic radio is enabled',description:audio.length+' published audio recording'+(audio.length===1?' is':'s are')+' available. Confirm actual sound on the listener page.'};
 if(available.some(x=>x.media_type==='video'))return {title:'Automatic radio · video audio fallback',description:'No published audio recording is available. Radio can use the sound from published video files. Add audio recordings to use less listener data.'};
 return {title:'Radio playlist needs a recording',description:'Automatic radio is enabled. Upload an audio recording, preview it, then add it to the radio playlist.'};
}

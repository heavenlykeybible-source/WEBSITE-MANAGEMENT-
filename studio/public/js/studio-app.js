import {mountProductionStudio} from './production-studio.js';
import {initNavigation,radioSummary} from './workspace.js';
const $=id=>document.getElementById(id);let authorized=false,paused=false,studio;const navigate=initNavigation();let cachedMedia=[];
function sessionEnded(){authorized=false;document.dispatchEvent(new CustomEvent('hk-admin-session',{detail:{profile:null}}));$('notice').textContent='Your Studio session ended. Use Renew sign-in to continue.';}
async function request(path,method='GET',data,raw=false){
 const r=await fetch(path,{method,credentials:'same-origin',headers:data===undefined?{}:{'Content-Type':raw?data.type||'application/octet-stream':'application/json'},body:data===undefined?undefined:raw?data:JSON.stringify(data)});
 const result=await r.json().catch(()=>({}));if(r.status===401)sessionEnded();if(!r.ok)throw Error(typeof result.error==='string'?result.error:result.error?.message||'Request failed ('+r.status+').');return result;
}
const api=(path,method='GET',data)=>request(path==='media'?'/api/media':'/api/media-engine/'+path,method,data);
function renderLibrary(){
 $('library').replaceChildren();const filter=$('library-filter').value;const media=cachedMedia.filter(m=>filter==='all'||m.media_type===filter);
 for(const m of media){const row=document.createElement('div');row.className='library-item';const name=document.createElement('h3');name.textContent=m.title||m.object_key.split('/').pop();const description=document.createElement('p');description.textContent=(m.media_type==='audio'?'Audio':'Video')+' · '+(m.status==='published'?'In the '+(m.media_type==='audio'?'radio':'television')+' playlist':m.status==='approved'?'Private · ready to preview':'Upload '+m.status)+(m.keep_media?' · kept permanently':' · temporary');row.append(name,description);
  if(['approved','published'].includes(m.status)){const preview=document.createElement('a');preview.textContent='Preview recording ↗';preview.href='/api/media/'+m.media_id+'/preview';preview.target='_blank';preview.rel='noopener';row.append(preview);const publish=document.createElement('button');publish.textContent=m.status==='published'?'Remove from playlist':'Add to '+(m.media_type==='audio'?'radio':'television')+' playlist';publish.onclick=async()=>{publish.disabled=true;try{await request('/api/media/'+m.media_id+'/publish','POST',{published:m.status!=='published'});await refresh();}catch(e){showError(e);}finally{publish.disabled=false;}};row.append(publish);}$('library').append(row);
 }
 if(!media.length)$('library').textContent=filter==='audio'?'No audio recordings yet. Upload a message or worship recording above.':'No recordings to show yet. Upload your first recording above.';
}
async function refresh(){
 const [media,live,settings,playout]=await Promise.all([request('/api/media'),request('/api/broadcast/live'),request('/api/broadcast/settings'),request('/api/playout')]);
 cachedMedia=media.items||[];document.dispatchEvent(new CustomEvent('hk-studio-state',{detail:{media:cachedMedia,live:live.live}}));renderLibrary();
 const videoSetting=(settings.items||[]).find(x=>x.channel==='video');$('video-playlist').replaceChildren();if(videoSetting){const b=document.createElement('button');b.textContent=videoSetting.playlist_enabled?'Turn off automatic television':'Turn on automatic television';b.onclick=async()=>{b.disabled=true;try{await request('/api/broadcast/settings','POST',{channel:'video',enabled:!videoSetting.playlist_enabled});await refresh();}catch(e){showError(e);}finally{b.disabled=false;}};$('video-playlist').append(b);}
 const summary=radioSummary({media:cachedMedia,live:live.live,settings:settings.items||[],playout:playout.items||[]});$('radio-state-title').textContent=summary.title;$('radio-state-description').textContent=summary.description;
 $('radio-playlist').replaceChildren();const setting=(settings.items||[]).find(x=>x.channel==='radio');if(setting){const b=document.createElement('button');b.textContent=setting.playlist_enabled?'Turn off automatic radio':'Turn on automatic radio';b.onclick=async()=>{b.disabled=true;try{await request('/api/broadcast/settings','POST',{channel:'radio',enabled:!setting.playlist_enabled});await refresh();}catch(e){showError(e);}finally{b.disabled=false;}};$('radio-playlist').append(b);}
}
$('library-filter').onchange=()=>{const type=$('library-filter').value;$('upload').elements.file.accept=type==='all'?'audio/*,video/*':type+'/*';renderLibrary();};
$('radio-library').onclick=()=>{$('library-filter').value='audio';$('upload').elements.file.accept='audio/*';renderLibrary();navigate('library');};
$('radio-prepare').onclick=()=>{if(!authorized||!studio){$('notice').textContent='Sign in through the control room before preparing a radio programme.';return;}navigate('live');studio.openRadio();};

function showError(e){$('notice').textContent=e.message;}
$('refresh').onclick=()=>refresh().catch(showError);
$('logout').onclick=async()=>{try{const r=await fetch('/auth/logout',{method:'POST'});if(!r.ok)throw Error('Sign out failed. Try again.');sessionEnded();location.replace('/');}catch(e){showError(e);}};
$('connection').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('button');b.disabled=true;try{const data=Object.fromEntries(new FormData(f));await api('livekit/connection','POST',data);f.reset();$('connection-status').textContent='LiveKit connection verified and saved.';}catch(e){$('connection-status').textContent=e.message;}finally{b.disabled=false;}};
$('check-connection').onclick=async()=>{try{await api('livekit/connection','POST',{action:'check'});$('connection-status').textContent='Saved connection verified.';}catch(e){$('connection-status').textContent=e.message;}};
$('destination').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;try{await api('restream/destination','POST',{...Object.fromEntries(new FormData(f)),enabled:true});f.reset();$('destination-status').textContent='Destination saved. Choose it in the Studio final check.';await refresh();}catch(e){$('destination-status').textContent=e.message;}};
$('pause-upload').onclick=()=>{paused=true;$('upload-status').textContent='Pausing after the current chunk. Select the same file and upload again to resume.';};
$('upload').onsubmit=async e=>{
 e.preventDefault();const f=e.currentTarget,file=f.elements.file.files[0],submit=f.querySelector('button'),keep=f.elements.keep.checked;if(!file||!file.size)return;
 if(file.size>2*1024**3){$('upload-status').textContent='Choose a file up to 2 GB.';return;}if(!/^(audio|video)\//.test(file.type)){$('upload-status').textContent='Choose a supported audio or video file.';return;}
 const resumeKey='hk-studio-upload:'+JSON.stringify([file.name,file.size,file.lastModified,file.type]);paused=false;submit.disabled=true;$('pause-upload').disabled=false;
 try{
  let id=Number(sessionStorage.getItem(resumeKey));if(!id){const created=await request('/api/media','POST',{object_key:'uploads/'+crypto.randomUUID()+'/'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_'),media_type:file.type.split('/')[0],mime_type:file.type,size_bytes:file.size,keep_media:keep});id=created.media_id;sessionStorage.setItem(resumeKey,String(id));}
  const started=await request('/api/media/'+id+'/multipart','POST',{}),state=await request('/api/media/'+id+'/multipart/status'),done=new Set((state.parts||[]).map(x=>x.part_number)),chunk=started.chunk_bytes;
  for(let offset=0,part=1;offset<file.size;offset+=chunk,part++){if(paused)return;if(done.has(part))continue;const bytes=file.slice(offset,Math.min(file.size,offset+chunk),file.type);let success=false;for(let attempt=0;attempt<3&&!success;attempt++){try{await request('/api/media/'+id+'/multipart/part/'+part,'PUT',bytes,true);success=true;}catch(e){if(attempt===2||!authorized)throw e;}}$('upload-status').textContent='Uploaded '+Math.round(Math.min(file.size,offset+chunk)/file.size*100)+'%';}
  if(paused)return;await request('/api/media/'+id+'/multipart/complete','POST',{});sessionStorage.removeItem(resumeKey);f.reset();$('upload-status').textContent='Upload complete. File is private until you publish it.';await refresh();
 }catch(e){$('upload-status').textContent=e.message+' Select the same file and upload again to retry.';}finally{submit.disabled=false;$('pause-upload').disabled=true;}
};
try{const me=await request('/api/studio/me');authorized=true;$('notice').textContent='Signed in as '+me.name+' · Choose a task from the menu. Preview stays private until Go live.';studio=mountProductionStudio({container:$('studio'),api,refresh:$('refresh'),isAuthorized:()=>authorized});await refresh();setInterval(()=>{if(authorized)refresh().catch(showError);},30000);setInterval(()=>{if(authorized)request('/api/studio/me').catch(showError);},60000);}catch(e){showError(e);}

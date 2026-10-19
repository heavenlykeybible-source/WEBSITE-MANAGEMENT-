import {mountProductionStudio} from './production-studio.js';
const $=id=>document.getElementById(id);let authorized=false,paused=false;
function sessionEnded(){authorized=false;document.dispatchEvent(new CustomEvent('hk-admin-session',{detail:{profile:null}}));$('notice').textContent='Your Studio session ended. Use Renew sign-in to continue.';}
async function request(path,method='GET',data,raw=false){
 const r=await fetch(path,{method,credentials:'same-origin',headers:data===undefined?{}:{'Content-Type':raw?data.type||'application/octet-stream':'application/json'},body:data===undefined?undefined:raw?data:JSON.stringify(data)});
 const result=await r.json().catch(()=>({}));if(r.status===401)sessionEnded();if(!r.ok)throw Error(typeof result.error==='string'?result.error:result.error?.message||'Request failed ('+r.status+').');return result;
}
const api=(path,method='GET',data)=>request(path==='media'?'/api/media':'/api/media-engine/'+path,method,data);
async function refresh(){
 const [media,live,settings]=await Promise.all([request('/api/media'),request('/api/broadcast/live'),request('/api/broadcast/settings')]);
 document.dispatchEvent(new CustomEvent('hk-studio-state',{detail:{media:media.items||[],live:live.live}}));
 $('library').replaceChildren();for(const m of media.items||[]){const row=document.createElement('div');row.className='library-item';const name=document.createElement('p');name.textContent=(m.title||m.object_key.split('/').pop())+' · '+m.status+(m.keep_media?' · retained':' · temporary');row.append(name);if(['approved','published'].includes(m.status)){const preview=document.createElement('a');preview.textContent='Preview';preview.href='/api/media/'+m.media_id+'/preview';preview.target='_blank';preview.rel='noopener';row.append(preview);const publish=document.createElement('button');publish.textContent=m.status==='published'?'Remove from 24/7 playlist':'Publish to 24/7 playlist';publish.onclick=()=>request('/api/media/'+m.media_id+'/publish','POST',{published:m.status!=='published'}).then(refresh).catch(showError);row.append(publish);} $('library').append(row);}
 if(!$('library').children.length)$('library').textContent='No media uploaded yet.';
 $('playlists').replaceChildren();for(const setting of settings.items||[]){const b=document.createElement('button');b.textContent=(setting.playlist_enabled?'Disable ':'Enable ')+setting.channel+' playlist';b.onclick=()=>request('/api/broadcast/settings','POST',{channel:setting.channel,enabled:!setting.playlist_enabled}).then(refresh).catch(showError);$('playlists').append(b);}
}
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
try{const me=await request('/api/studio/me');authorized=true;$('notice').textContent='Signed in as '+me.name+' · Preview is private until you choose Go live.';mountProductionStudio({container:$('studio'),api,refresh:$('refresh'),isAuthorized:()=>authorized});await refresh();setInterval(()=>{if(authorized)refresh().catch(showError);},30000);setInterval(()=>{if(authorized)request('/api/studio/me').catch(showError);},60000);}catch(e){showError(e);}

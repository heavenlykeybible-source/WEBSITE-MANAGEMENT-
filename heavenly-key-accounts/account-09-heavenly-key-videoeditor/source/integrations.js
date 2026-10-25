/* Account 9 integrated media, cloud projects and AI caption workflows. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const el = (tag, props = {}, parent) => { const n=document.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='text')n.textContent=v;else if(k==='type')n.type=v;else n.setAttribute(k,v)}if(parent)parent.append(n);return n; };
  const message=(id,s)=>{ $(id).textContent=s; };
  async function json(path,method='GET',data) {
    const r=await fetch('/api/'+path,{method,credentials:'same-origin',headers:{'content-type':'application/json','x-requested-with':'hk'},body:data===undefined?undefined:JSON.stringify(data)});
    const out=await r.json().catch(()=>({error:'Invalid server response'}));if(!r.ok)throw Error(out.error||'Request failed');return out;
  }
  const panel=el('div',{class:'panel'},$('projects'));
  el('h2',{text:'Cloud Project Library'},panel);
  const refresh=el('button',{type:'button',text:'Refresh projects'},panel);
  const list=el('ul',{},panel);
  const status=el('div',{class:'status',role:'status',text:'Sign in to manage cloud projects.'},panel);
  let selected=null,libraryGeneration=0;
  async function loadProjects(){
    const generation=libraryGeneration;
    try {
      const items=await json('projects');if(generation!==libraryGeneration)return;list.replaceChildren();
      for(const p of items){
        const li=el('li',{},list);el('span',{text:p.name+' · '+new Date(p.updated_at).toLocaleString()+' '},li);
        const open=el('button',{type:'button',text:'Open'},li);
        open.onclick=async()=>{try{const d=await json('projects/'+encodeURIComponent(p.id));selected=d.id;const state=d.data||{};if(!validProjectLayers(state.layers||[]))throw Error('Cloud project has invalid captions or exceeds 500 captions.');layers.splice(0,layers.length,...(state.layers||[]));$('pn').value=d.name;$('asp').value=state.aspect||'16:9';$('vfx').value=state.filter||'none';$('vb').value=state.brightness||100;showLayers();dims();window.hkTimeline?.restoreClips(state.timeline||[]);status.textContent='Project opened. Re-select your media file.';}catch(e){status.textContent=e.message}};
        const remove=el('button',{type:'button',text:'Delete'},li);remove.onclick=async()=>{if(!confirm('Delete project '+p.name+'?'))return;try{await json('projects/'+encodeURIComponent(p.id),'DELETE');if(selected===p.id)selected=null;await loadProjects()}catch(e){status.textContent=e.message}};
      }
      status.textContent=items.length+' cloud project(s) available.';
    }catch(e){if(generation===libraryGeneration)status.textContent=e.message}
  }
  refresh.onclick=loadProjects;
  const update=el('button',{type:'button',text:'Update selected cloud project'},panel);
  update.onclick=async()=>{if(!selected)return status.textContent='Open a cloud project first.';try{await json('projects/'+encodeURIComponent(selected),'PUT',{name:$('pn').value||'Untitled',data:snapshot()});status.textContent='Project updated.';await loadProjects()}catch(e){status.textContent=e.message}};
  const media=el('div',{class:'panel'},$('projects'));el('h2',{text:'Cloud Media Library'},media);
  el('p',{class:'muted',text:'Cloud uploads require sign-in. Maximum file size 50 MB; storage quota 500 MB per account.'},media);
  const picker=el('input',{type:'file',accept:'video/*,audio/*,image/png,image/jpeg,image/gif,image/webp'},media);
  const upload=el('button',{type:'button',text:'Upload selected file'},media);
  const mediaRefresh=el('button',{type:'button',text:'Refresh media'},media);
  const ml=el('ul',{},media);const ms=el('div',{class:'status',role:'status',text:'Sign in to view cloud media.'},media);
  async function loadMedia(){const generation=libraryGeneration;try{const d=await json('media');if(generation!==libraryGeneration)return;ml.replaceChildren();for(const f of d.items){const li=el('li',{},ml);el('span',{text:f.name+' ('+(f.size/1048576).toFixed(1)+' MB) '},li);const a=el('a',{href:'/api/media/'+encodeURIComponent(f.id),text:'Open / Download'},li);a.target='_blank';a.rel='noopener noreferrer';
      if(f.type.startsWith('video/')||f.type.startsWith('audio/')){
        const edit=el('button',{type:'button',text:'Edit in '+(f.type.startsWith('video/')?'Video':'Audio')+' Editor'},li);
        edit.onclick=async()=>{
          edit.disabled=true;ms.textContent='Loading '+f.name+' into the editor…';
          try{
            const res=await fetch('/api/media/'+encodeURIComponent(f.id),{credentials:'same-origin'});
            if(!res.ok){const err=await res.json().catch(()=>({}));throw Error(err.error||'Cannot load cloud media');}
            const blob=await res.blob();if(!blob.size)throw Error('Cloud media is empty');
            const input=$(f.type.startsWith('video/')?'vf':'af');
            input.dispatchEvent(new CustomEvent('change',{bubbles:true,detail:{file:new File([blob],f.name,{type:f.type})}}));
            document.querySelector('nav button[data-p="'+(f.type.startsWith('video/')?'video':'audio')+'"]')?.click();
            ms.textContent=f.name+' loaded into the editor.';
          }catch(e){ms.textContent='Could not load media: '+e.message}
          finally{edit.disabled=false}
        };
      }
      const del=el('button',{type:'button',text:'Delete'},li);del.onclick=async()=>{if(!confirm('Delete '+f.name+'?'))return;try{await json('media/'+encodeURIComponent(f.id),'DELETE');await loadMedia()}catch(e){ms.textContent=e.message}}}ms.textContent='Storage used: '+(d.used/1048576).toFixed(1)+' / '+(d.quota/1048576).toFixed(0)+' MB'}catch(e){ms.textContent=e.message}}
  mediaRefresh.onclick=loadMedia;
  upload.onclick=async()=>{const f=picker.files?.[0];if(!f)return ms.textContent='Choose a file.';if(f.size>50*1048576)return ms.textContent='File exceeds 50 MB.';upload.disabled=true;ms.textContent='Uploading…';try{const r=await fetch('/api/media?name='+encodeURIComponent(f.name),{method:'POST',credentials:'same-origin',headers:{'content-type':f.type||'application/octet-stream','x-requested-with':'hk'},body:f});const d=await r.json();if(!r.ok)throw Error(d.error||'Upload failed');ms.textContent='Uploaded '+f.name;await loadMedia()}catch(e){ms.textContent=e.message}finally{upload.disabled=false}};
  // AI transcription: decode audio locally and send short, mono 16 kHz WAV chunks.
  const info=el('p',{class:'muted',text:'AI captions: select an audio file in Audio Editor first. Sign in before transcription. Processing is limited to short audio chunks.'},$('autocap').parentElement);
  $('autocap').onclick=async()=>{
    if(!audioBuffer)return message('vm','Choose an audio file in Audio Editor first.');
    const selectedAudio=audioBuffer,selectedRevision=audioLoadRevision;
    const button=$('autocap');button.disabled=true;
    try{
      const sr=16000, seconds=8, maxChunks=12, total=Math.min(Math.ceil(selectedAudio.duration/seconds),maxChunks);
      const generated=[];
      const channels=Array.from({length:selectedAudio.numberOfChannels},(_,i)=>selectedAudio.getChannelData(i));
      for(let k=0;k<total;k++){
        if(audioLoadRevision!==selectedRevision)throw Error('Audio file changed during transcription. Start again with the new file.');
        message('vm','Transcribing chunk '+(k+1)+' of '+total+'…');
        const start=k*seconds, end=Math.min(selectedAudio.duration,start+seconds), count=Math.floor((end-start)*sr);
        const pcm=new ArrayBuffer(44+count*2),dv=new DataView(pcm),u=new Uint8Array(pcm);
        const put=(off,s)=>{for(let i=0;i<s.length;i++)u[off+i]=s.charCodeAt(i)};
        put(0,'RIFF');dv.setUint32(4,36+count*2,true);put(8,'WAVEfmt ');dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,1,true);dv.setUint32(24,sr,true);dv.setUint32(28,sr*2,true);dv.setUint16(32,2,true);dv.setUint16(34,16,true);put(36,'data');dv.setUint32(40,count*2,true);
        for(let i=0;i<count;i++){const at=Math.min(selectedAudio.length-1,Math.floor((start+i/sr)*selectedAudio.sampleRate));let sum=0;for(const channel of channels)sum+=channel[at];const v=Math.max(-1,Math.min(1,sum/selectedAudio.numberOfChannels));dv.setInt16(44+i*2,Math.round(v*32767),true)}
        const response=await fetch('/api/transcribe',{method:'POST',credentials:'same-origin',headers:{'content-type':'audio/wav','x-requested-with':'hk'},body:new Blob([pcm],{type:'audio/wav'})});
        const result=await response.json();if(audioLoadRevision!==selectedRevision)throw Error('Audio file changed during transcription. Start again.');if(!response.ok)throw Error(result.error||'Transcription failed');
        const words=Array.isArray(result.words)?result.words:[];if(words.length){for(let i=0;i<words.length;i+=8){const part=words.slice(i,i+8);generated.push({text:part.map(w=>w.word).join(' ').trim(),start:Math.min(end,Math.max(start,start+Number(part[0].start||0))),end:Math.min(end,Math.max(start,start+Number(part[part.length-1].end||seconds))),pos:'bottom',style:'outline',anim:'none',color:'#ffffff'})}}
        else if(result.text)generated.push({text:result.text,start,end,pos:'bottom',style:'outline',anim:'none',color:'#ffffff'});
      }
      if(audioLoadRevision!==selectedRevision)throw Error('Audio file changed during transcription. Start again.');
      const remaining=Math.max(0,500-layers.length);const accepted=generated.filter(l=>l.text&&l.end>l.start).slice(0,remaining);if(accepted.length)invalidateVideoDownload();layers.push(...accepted);showLayers();message('vm','Added '+accepted.length+' AI caption segments. Review timing before exporting.'+(selectedAudio.duration>maxChunks*seconds?' Only the first 96 seconds were processed.':''));
    }catch(e){message('vm','Transcription failed: '+e.message)}finally{button.disabled=false}
  };
  const originalLogin=$('login').onclick;$('login').onclick=async()=>{await originalLogin();try{await json('me');await Promise.allSettled([loadProjects(),loadMedia()])}catch{status.textContent='Sign in to manage cloud projects.';ms.textContent='Sign in to manage cloud media.'}};
  const originalLogout=$('logout').onclick;$('logout').onclick=async()=>{libraryGeneration++;selected=null;list.replaceChildren();ml.replaceChildren();await originalLogout();try{await json('me')}catch{selected=null;list.replaceChildren();ml.replaceChildren();status.textContent='Signed out. Cloud projects hidden.';ms.textContent='Signed out. Cloud media hidden.'}};
  json('me').then(d=>{message('authmsg','Signed in: '+d.email+' ('+d.role+')');loadProjects();loadMedia()}).catch(()=>{});
})();

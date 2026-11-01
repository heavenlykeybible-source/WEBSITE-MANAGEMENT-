/* Private, resumable archive staging. Never publishes or extracts an archive. */
(()=>{'use strict';
const $=id=>document.getElementById(id),start=$('project-import-start'),pause=$('project-import-pause'),status=$('project-import-status'),progress=$('project-import-progress');
if(!start||!pause||!status||!progress)return;
const CHUNK=4194304,MAX=1073741824;
let stopped=false,controller=null;
const tell=message=>{status.textContent=message;};
async function request(url,options={}){
 const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});
 if(!r.ok){let error='Request failed ('+r.status+')';try{const d=await r.json();error=d.error||error;}catch{}throw Error(error);}
 return r.json();
}
async function refreshWaitingRoom(){
 const container=$('project-review-list');
 if(!container)return;
 container.textContent='Loading saved imports…';
 try{
  const data=await request('/api/project-imports');
  container.replaceChildren();
  if(!data.imports?.length){container.textContent='No project imports yet.';return;}
  for(const entry of data.imports){
   const item=document.createElement('p');
   const date=entry.submittedAt||entry.createdAt;
   item.textContent=entry.name+' — '+entry.status+' — '+(entry.totalBytes/1048576).toFixed(1)+' MiB — '+new Date(date).toLocaleString()+' — ID: '+entry.id;
   container.append(item);
   if(entry.source==='github-tree'){
    const button=document.createElement('button');
    button.type='button';button.textContent='Inspect GitHub source files';
    const preview=document.createElement('pre');
    preview.style.whiteSpace='pre-wrap';preview.hidden=true;
    button.onclick=async()=>{
     button.disabled=true;preview.hidden=false;preview.textContent='Loading source inventory…';
     try{
      const listing=await request('/api/project-imports/'+encodeURIComponent(entry.id)+'/files');
      preview.textContent='Pinned commit: '+listing.commit+'\\n'+listing.files.map(file=>file.path+' ('+file.size+' bytes)').join('\\n')+(listing.total>listing.files.length?'\\nShowing first '+listing.files.length+' of '+listing.total+' files.':'');
     }catch(e){preview.textContent='Unable to inspect source: '+e.message;}
     finally{button.disabled=false;}
    };
    container.append(button,preview);
   }
  }
 }catch(e){container.textContent='Unable to load Waiting Room: '+e.message;}
}
$('project-review-refresh')?.addEventListener('click',refreshWaitingRoom);
$('account3-github-import')?.addEventListener('click',async()=>{
 const button=$('account3-github-import');
 button.disabled=true;
 tell('Reading the Account 3 GitHub source tree…');
 try{
  const result=await request('/api/project-imports/github',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({repository:'heavenlykeybible-source/onlinebible',ref:'main'})});
  tell('Account 3 source revision '+result.commit.slice(0,12)+' added to Waiting Room ('+result.fileCount+' files). Approval required; nothing published.');
  await refreshWaitingRoom();
 }catch(e){tell('GitHub import failed: '+e.message);}
 finally{button.disabled=false;}
});

function key(file){return 'hk-project-import:'+file.name+':'+file.size+':'+file.lastModified;}
pause.onclick=()=>{stopped=true;controller?.abort();tell('Paused. Choose the same archive and select Start / resume to continue.');};
start.onclick=async()=>{
 const file=$('project-import-file').files?.[0],name=$('project-import-name').value.trim();
 if(!file||!name){tell('Select a ZIP file and enter a project name.');return;}
 if(!/\.zip$/i.test(file.name)){tell('Choose a ZIP archive.');return;}
 if(file.size<1||file.size>MAX){tell('Archive must be between 1 byte and 1 GiB.');return;}
 stopped=false;start.disabled=true;controller=new AbortController();
 const storageKey=key(file);
 try{
  let id=sessionStorage.getItem(storageKey),info;
  if(id){try{info=await request('/api/project-imports/'+encodeURIComponent(id),{signal:controller.signal});if(info.totalBytes!==file.size||info.name!==name)throw Error('Project or archive changed');if(info.status==='waiting-review'){sessionStorage.removeItem(storageKey);progress.value=100;tell('Archive already submitted for review. Import ID: '+id);await refreshWaitingRoom();return;}if(info.status!=='staging')throw Error('This import can no longer accept chunks');}catch(e){if(e.name==='AbortError')throw e;id=null;sessionStorage.removeItem(storageKey);}}
  if(!id){const created=await request('/api/project-imports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,totalBytes:file.size}),signal:controller.signal});id=created.id;sessionStorage.setItem(storageKey,id);info={receivedIndices:[],parts:created.parts};}
  const done=new Set(info.receivedIndices||[]);
  progress.value=Math.floor(done.size/info.parts*100);
  for(let n=0;n<info.parts;n++){
   if(stopped)break;if(done.has(n))continue;
   const chunk=file.slice(n*CHUNK,Math.min(file.size,(n+1)*CHUNK));
   let success=false;
   for(let attempt=0;attempt<3&&!success;attempt++){
    try{await request('/api/project-imports/'+encodeURIComponent(id)+'/chunks/'+n,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:chunk,signal:controller.signal});success=true;}
    catch(e){if(stopped||e.name==='AbortError')throw e;if(attempt===2)throw e;}
   }
   done.add(n);progress.value=Math.floor(done.size/info.parts*100);
   tell('Staging '+file.name+' · '+progress.value+'% ('+done.size+'/'+info.parts+' chunks)');
  }
  if(!stopped){const check=await request('/api/project-imports/'+encodeURIComponent(id));if(!check.complete)throw Error('Some chunks are missing. Resume the upload.');if(check.status==='waiting-review'){sessionStorage.removeItem(storageKey);progress.value=100;tell('Archive already awaiting review. Import ID: '+id);await refreshWaitingRoom();return;}const submitted=await request('/api/project-imports/'+encodeURIComponent(id),{method:'POST',signal:controller.signal});sessionStorage.removeItem(storageKey);progress.value=100;tell('Upload verified and submitted for review. Archive is NOT published. Import ID: '+id+' · Status: '+submitted.status);await refreshWaitingRoom();}
 }catch(e){if(!stopped)tell('Upload interrupted: '+e.message+'. Select Start / resume to retry.');}
 finally{start.disabled=false;controller=null;}
};
refreshWaitingRoom();
})();
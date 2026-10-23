import { uploadMediaFile } from './media-uploader.js';

(()=>{
  'use strict';
  const $=(s)=>document.querySelector(s);
  const access=$('#schedule-access'),accessStatus=$('#schedule-access-status'),workspace=$('#schedule-workspace');
  const destinations=$('#schedule-destinations'),mediaSelect=$('#schedule-media');
  const postForm=$('#schedule-post-form'),postStatus=$('#schedule-post-status');
  const planForm=$('#schedule-plan-form'),planStatus=$('#schedule-plan-status'),draftFeed=$('#schedule-plan-drafts'),approvePlan=$('#schedule-plan-approve');
  const scheduledStatus=$('#scheduled-posts-status'),scheduledList=$('#scheduled-posts-list'),scheduledRefresh=$('#scheduled-posts-refresh');
  const batchFiles=$('#schedule-batch-files'),batchUpload=$('#schedule-batch-upload'),batchClear=$('#schedule-batch-clear'),batchStatus=$('#schedule-batch-status'),batchProgress=$('#schedule-batch-progress'),batchList=$('#schedule-batch-list');
  let accounts=[],media=[],drafts=[],batchMedia=[],profile=null;

  async function api(path,method='GET',body){
    const init={method,credentials:'same-origin',headers:{Accept:'application/json'}};
    if(body!==undefined){init.headers['Content-Type']='application/json';init.body=JSON.stringify(body);}
    const r=await fetch(path,init);let data={};try{data=await r.json();}catch{}
    if(!r.ok){const e=new Error(typeof data.error==='string'?data.error:data.error?.message||'The request could not be completed.');e.status=r.status;throw e;}
    return data;
  }
  const fmt=(v)=>{try{return new Date(v).toLocaleString();}catch{return String(v||'');}};
  const roles={'Member':1,'Moderator':2,'Administrator':3,'Deputy Super Administrator':4,'Super Administrator':5};
  const selectedAccounts=()=>[...destinations.querySelectorAll('input[name=account]:checked')].map(x=>x.value);
  const selectedPlatforms=()=>accounts.filter(a=>selectedAccounts().includes(String(a.id))).map(a=>String(a.platform||'').toLowerCase());

  function compose(data){
    const parts=[];
    if(String(data.title||'').trim())parts.push(String(data.title).trim());
    if(String(data.text||'').trim())parts.push(String(data.text).trim());
    if(String(data.presenter||'').trim())parts.push('🎙️ Preacher / Presenter: '+String(data.presenter).trim());
    parts.push('Source: Heavenly Key Evangelistic Movement','🌐 https://heavenlykey.org');
    return parts.join('\n\n');
  }

  function renderDestinations(){
    destinations.replaceChildren();
    for(const a of accounts.filter(x=>x.active&&x.connection_status==='connected')){
      const label=document.createElement('label');label.className='schedule-destination';
      const box=document.createElement('input');box.type='checkbox';box.name='account';box.value=a.id;
      const text=document.createElement('span');
      const tiktok=String(a.platform||'').toLowerCase()==='tiktok';
      box.disabled=tiktok;
      text.textContent=(a.platform||'').toUpperCase()+' · '+a.display_name+(tiktok?' · Manual publishing only until platform approval':'');
      label.append(box,text);destinations.append(label);
    }
    if(!destinations.children.length){
      const p=document.createElement('p');p.textContent='No active social publishing destinations are connected.';destinations.append(p);
    }
  }

  function renderMedia(){
    mediaSelect.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='No media · text only';mediaSelect.append(empty);
    for(const m of media.filter(x=>['approved','published'].includes(x.status)&&['image','video'].includes(x.media_type))){
      const o=document.createElement('option');o.value=String(m.media_id);o.textContent=String(m.object_key||('Media #'+m.media_id)).split('/').pop();o.dataset.type=m.media_type||'';mediaSelect.append(o);
    }
  }

  function renderBatch(){
    batchList.replaceChildren();
    batchMedia.forEach((m,i)=>{
      const item=document.createElement('article');item.className='scheduled-item';
      const strong=document.createElement('strong');strong.textContent=(i+1)+'. '+m.name;
      const small=document.createElement('small');small.textContent=(m.type||'media').toUpperCase()+' · ready for scheduling';
      item.append(strong,small);batchList.append(item);
    });
    if(batchMedia.length)batchStatus.textContent=batchMedia.length+' media file'+(batchMedia.length===1?'':'s')+' ready. At 5 posts per day this uses '+Math.ceil(batchMedia.length/5)+' day'+(Math.ceil(batchMedia.length/5)===1?'':'s')+'.';
  }

  function renderScheduled(jobs){
    scheduledList.replaceChildren();
    // Keep overdue queued posts visible, and retain lightweight receipts for completed posts.
    const scheduled=(jobs||[]).filter(j=>j.publish_mode==='scheduled'&&['queued','publishing','failed','published'].includes(j.status)).slice(0,60);
    const counts={queued:0,publishing:0,failed:0,published:0};
    for(const j of scheduled){
      counts[j.status]++;
      const item=document.createElement('article');item.className='scheduled-item';
      const title=document.createElement('strong');title.textContent=(j.platform||'').toUpperCase()+' · '+(j.display_name||'Destination');
      const time=document.createElement('small');time.textContent=String(j.status).toUpperCase()+' · '+fmt(j.status==='published'?(j.updated_at||j.publish_at):j.publish_at);
      item.append(title,time);
      if(j.text){const p=document.createElement('p');p.textContent=j.text;item.append(p);}
      if(j.provider_post_id){const id=document.createElement('small');id.textContent='Provider receipt: '+j.provider_post_id;item.append(id);}
      if(j.error){const err=document.createElement('p');err.textContent=j.error;item.append(err);}
      if(j.status==='queued'){
        const cancel=document.createElement('button');cancel.type='button';cancel.className='btn btn-secondary';cancel.textContent='Cancel Scheduled Post';
        cancel.addEventListener('click',async()=>{if(!confirm('Cancel this scheduled post?'))return;cancel.disabled=true;scheduledStatus.textContent='Cancelling scheduled post…';try{await api('/api/admin/social/jobs/'+j.job_id+'/cancel','POST',{});await refreshScheduled();scheduledStatus.textContent='Scheduled post cancelled.';}catch(err){scheduledStatus.textContent=err.message;cancel.disabled=false;}});
        item.append(cancel);
      }else if(j.status==='failed'&&j.error!=='Cancelled by administrator'&&!String(j.error||'').includes('Publication result unknown')){
        const retry=document.createElement('button');retry.type='button';retry.className='btn btn-primary';retry.textContent='Retry Failed Post';
        retry.addEventListener('click',async()=>{retry.disabled=true;scheduledStatus.textContent='Retrying failed post…';try{await api('/api/admin/social/jobs/'+j.job_id+'/retry','POST',{});await refreshScheduled();scheduledStatus.textContent='Retry completed.';}catch(err){scheduledStatus.textContent=err.message;retry.disabled=false;}});
        item.append(retry);
      }
      scheduledList.append(item);
    }
    scheduledStatus.textContent=scheduled.length?counts.queued+' queued · '+counts.publishing+' publishing · '+counts.published+' published · '+counts.failed+' failed (latest '+scheduled.length+' jobs shown).':'No scheduled posts found.';
  }

  async function refreshScheduled(){
    const j=await api('/api/admin/social/jobs?limit=200');
    renderScheduled(j.items||[]);
  }

  async function refreshMedia(){
    try{const m=await api('/api/admin/media-engine/media');media=m.items||m.media||[];}catch{media=[];}
    renderMedia();
  }

  async function load(){
    profile=(await api('/api/auth/profile')).profile;
    if((roles[profile?.roleName]||0)<3)throw Object.assign(new Error('Administrator access is required for scheduled publishing.'),{status:403});
    const [a,j]=await Promise.all([api('/api/admin/social/accounts'),api('/api/admin/social/jobs?limit=200')]);
    accounts=a.items||[];
    await refreshMedia();
    renderDestinations();renderScheduled(j.items||[]);
    access.hidden=true;workspace.classList.remove('schedule-hidden');
  }

  mediaSelect.addEventListener('change',()=>{
    const type=postForm.elements.media_type,o=mediaSelect.selectedOptions[0];if(o?.dataset.type==='video')type.value='video';else if(o?.dataset.type==='audio')type.value='audio';else if(o?.value)type.value='image';
  });

  postForm.addEventListener('submit',async e=>{
    e.preventDefault();if(!postForm.reportValidity())return;
    const ids=selectedAccounts();if(!ids.length){postStatus.textContent='Choose at least one destination.';return;}
    const data=Object.fromEntries(new FormData(postForm)),when=new Date(data.publish_at);
    if(!Number.isFinite(when.getTime())||when<=new Date()){postStatus.textContent='Choose a future schedule date and time.';return;}
    const button=postForm.querySelector('button[type=submit]');button.disabled=true;postStatus.textContent='Scheduling post…';
    try{
      await api('/api/admin/social/publish','POST',{
        account_ids:ids,text:compose(data),media_ids:data.media_id?[Number(data.media_id)]:[],
        media_type:data.media_id?data.media_type:null,publish_at:when.toISOString(),publish_mode:'scheduled'
      });
      postForm.elements.title.value='';postForm.elements.text.value='';postForm.elements.presenter.value='';postForm.elements.publish_at.value='';
      postStatus.textContent='Post scheduled successfully.';await refreshScheduled();
    }catch(err){postStatus.textContent=err.message;}finally{button.disabled=false;}
  });

  function validateFile(file){
    const type=file.type||'';
    if(!['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(type))return 'Unsupported: '+file.name;
    const max=type.startsWith('image/')?25*1024*1024:500*1024*1024;
    if(file.size>max)return (type.startsWith('image/')?'Image':'Video')+' too large: '+file.name+'. Maximum '+(type.startsWith('image/')?'25 MB':'500 MB')+'.';
    return '';
  }
  function validateBatchSize(files){
    const total=files.reduce((sum,f)=>sum+Number(f.size||0),0);
    return total>5*1024*1024*1024?'This batch is larger than 5 GB. Reduce the batch size and try again.':'';
  }

  batchFiles.addEventListener('change',()=>{
    const files=[...(batchFiles.files||[])];
    if(files.length>100){batchStatus.textContent='Choose no more than 100 pictures/videos at once.';batchFiles.value='';return;}
    const bad=files.map(validateFile).filter(Boolean),batchError=validateBatchSize(files);
    batchStatus.textContent=bad.length?bad[0]:batchError||files.length+' file'+(files.length===1?'':'s')+' selected. Press Upload Selected Media.';
  });

  batchUpload.addEventListener('click',async()=>{
    const files=[...(batchFiles.files||[])];
    if(!files.length){batchStatus.textContent='Choose pictures or videos first.';return;}
    if(files.length>100){batchStatus.textContent='Choose no more than 100 files.';return;}
    const bad=files.map(validateFile).filter(Boolean),batchError=validateBatchSize(files);if(bad.length||batchError){batchStatus.textContent=bad[0]||batchError;return;}
    batchUpload.disabled=true;batchClear.disabled=true;batchProgress.hidden=false;batchProgress.value=0;batchMedia=[];renderBatch();
    let uploaded=0;
    try{
      for(let i=0;i<files.length;i++){
        const file=files[i];
        batchStatus.textContent='Uploading '+(i+1)+' of '+files.length+' · '+file.name;
        const result=await uploadMediaFile({
          file,keep:false,retentionHours:30*24,actor:profile?.userId||profile?.user_id||'scheduler',
          shouldPause:()=>false,
          onProgress:(_message,info={})=>{
            const perFile=(Number(info.percent)||0)/100;
            batchProgress.value=Math.round(((i+perFile)/files.length)*100);
          }
        });
        if(!result?.mediaId)throw new Error('Upload finished without a media ID for '+file.name);
        const type=file.type.startsWith('image/')?'image':'video';
        batchMedia.push({mediaId:Number(result.mediaId),type,name:file.name});
        uploaded++;renderBatch();
      }
      batchProgress.value=100;batchStatus.textContent='All '+uploaded+' files uploaded and ready for automatic scheduling.';
      batchFiles.value='';await refreshMedia();
    }catch(err){batchStatus.textContent='Stopped after '+uploaded+' successful upload'+(uploaded===1?'':'s')+': '+err.message;}
    finally{batchUpload.disabled=false;batchClear.disabled=false;}
  });

  // Clear is a local selection action, not an authorization to erase files
  // that may already be referenced by a scheduled or partially submitted batch.
  batchClear.addEventListener('click',()=>{
    if(!confirm('Clear the selected batch and unscheduled drafts? Already uploaded files remain in media storage until normal retention cleanup. Scheduled posts will not be cancelled.'))return;
    batchMedia=[];drafts=[];batchFiles.value='';batchProgress.hidden=true;batchProgress.value=0;
    renderBatch();renderDrafts();batchStatus.textContent='Batch selection cleared. Uploaded files remain available in Media Library; unused temporary files expire automatically.';
  });

  const topics=['Revival & Awakening','Prayer & Destiny','Holiness & Consecration','Jesus Only','Faith of Our Fathers','Evangelism & Soul Winning','Christian Encouragement','Bible Truth','End-Time Readiness','Kingdom Service','Global Missions','Testimony & Thanksgiving','Prayer Cry','Christian Family & Character','Hope in Christ'];
  function times(day){return [8,11,14,17,20].map(h=>{const d=new Date(day);d.setHours(h,0,0,0);return d;});}

  function renderDrafts(){
    draftFeed.replaceChildren();
    drafts.forEach((d,i)=>{
      const item=document.createElement('article');item.className='scheduled-item';
      const strong=document.createElement('strong');strong.textContent=(i+1)+'. '+d.topic+' · '+d.mediaName;
      const small=document.createElement('small');small.textContent=fmt(d.when)+' · '+d.mediaType.toUpperCase();
      const ta=document.createElement('textarea');ta.rows=4;ta.maxLength=5000;ta.value=d.text;ta.addEventListener('input',()=>d.text=ta.value);
      item.append(strong,small,ta);draftFeed.append(item);
    });
    approvePlan.hidden=!drafts.length;
  }

  function incompatiblePlatforms(mediaType,platforms){
    if(mediaType==='image')return platforms.filter(p=>['youtube','tiktok','x','linkedin'].includes(p));
    if(mediaType==='video')return platforms.filter(p=>['x','linkedin','tiktok'].includes(p));
    return [];
  }

  planForm.addEventListener('submit',e=>{
    e.preventDefault();
    const ids=selectedAccounts();if(!ids.length){planStatus.textContent='Choose at least one connected destination above.';return;}
    if(!batchMedia.length){planStatus.textContent='Upload your batch of pictures/videos first.';return;}
    const data=Object.fromEntries(new FormData(planForm)),base=data.start_date?new Date(data.start_date+'T00:00:00'):null;
    if(!base||!Number.isFinite(base.getTime())){planStatus.textContent='Choose the first day of the schedule.';return;}
    if(batchMedia.length>150){planStatus.textContent='At 5 posts per day, 30 days can hold at most 150 posts.';return;}
    const platforms=selectedPlatforms();
    for(const m of batchMedia){
      const bad=incompatiblePlatforms(m.type,platforms);
      if(bad.length){planStatus.textContent=m.name+' cannot currently be auto-published as '+m.type+' to: '+bad.map(x=>x.toUpperCase()).join(', ')+'. Uncheck those destinations or use compatible media.';return;}
    }
    const theme=String(data.theme||'Heavenly Key Evangelistic Movement').trim()||'Heavenly Key Evangelistic Movement';
    drafts=[];let n=0;
    for(let day=0;day<30&&n<batchMedia.length;day++){
      const date=new Date(base);date.setDate(base.getDate()+day);
      for(const when of times(date)){
        if(n>=batchMedia.length)break;
        if(when.getTime()<=Date.now()+5*60*1000)continue;
        const m=batchMedia[n],topic=topics[n%topics.length];
        drafts.push({topic,when,mediaId:m.mediaId,mediaType:m.type,mediaName:m.name,text:topic+' — '+theme+'\n\nTaking Christ to the Nations of the World.\n\n#HeavenlyKey #JesusChrist #Revival'});
        n++;
      }
    }
    if(drafts.length!==batchMedia.length){planStatus.textContent='The selected start date does not leave enough future slots inside 30 days. Choose a later start date.';drafts=[];renderDrafts();return;}
    renderDrafts();planStatus.textContent=drafts.length+' media posts prepared at 5 posts per day across '+Math.ceil(drafts.length/5)+' day'+(Math.ceil(drafts.length/5)===1?'':'s')+'. Review captions, then approve once.';
  });

  approvePlan.addEventListener('click',async()=>{
    const ids=selectedAccounts();if(!ids.length||!drafts.length){planStatus.textContent='Choose destinations and build the plan first.';return;}
    // Never submit the same draft twice after partial success.
    if(!confirm('Schedule all '+drafts.length+' remaining media posts?'))return;
    approvePlan.disabled=true;planStatus.textContent='Scheduling…';let done=0;
    try{
      while(drafts.length){
        const d=drafts[0];
        const result=await api('/api/admin/social/publish','POST',{
          account_ids:ids,text:d.text,media_ids:[d.mediaId],media_type:d.mediaType,publish_at:d.when.toISOString(),publish_mode:'scheduled'
        });
        if(!Array.isArray(result.job_ids)||result.job_ids.length!==ids.length)throw Error('The server did not confirm every publishing destination. Refresh scheduled jobs before retrying.');
        done++;drafts.shift();renderDrafts();
        batchMedia=batchMedia.filter(m=>m.mediaId!==d.mediaId);renderBatch();
        planStatus.textContent='Scheduled '+done+' posts successfully; '+drafts.length+' remaining.';
      }
      planStatus.textContent='All '+done+' media posts scheduled. Review their status below for publication results.';
      try{await refreshScheduled();}catch{planStatus.textContent+=' Refresh the scheduled list to see their status.';}
    }catch(err){
      // If the request outcome is unknown, do not resend that draft automatically;
      // the owner should inspect Jobs first to avoid duplicate publishing.
      planStatus.textContent='Scheduled '+done+' confirmed posts. Paused: '+err.message+' Check Scheduled Posts before retrying the remaining '+drafts.length+' drafts.';
    }finally{approvePlan.disabled=false;}
  });

  scheduledRefresh.addEventListener('click',async()=>{scheduledRefresh.disabled=true;scheduledStatus.textContent='Refreshing…';try{await refreshScheduled();}catch(err){scheduledStatus.textContent=err.message;}finally{scheduledRefresh.disabled=false;}});
  $('#schedule-back').addEventListener('click',()=>{if(history.length>1)history.back();else location.href='admin.html';});
  load().catch(err=>{accessStatus.textContent=err.status===401?'Your administrator session has ended. Return to the main dashboard and sign in again.':err.message;});
})();

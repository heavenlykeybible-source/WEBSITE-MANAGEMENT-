/* Shared same-origin member session, community and ministry studio. No API credentials reach the browser. */
(function () {
 'use strict';
 const egressMode=new URLSearchParams(location.search).get('egress')==='1';if(egressMode)document.documentElement.dataset.broadcastEgress='true';
 const $=(s,root=document)=>root.querySelector(s), $$=(s,root=document)=>Array.from(root.querySelectorAll(s));
 const roles={'Member':1,'Moderator':2,'Administrator':3,'Deputy Super Administrator':4,'Super Administrator':5};
 function openCommunityAuth(){const panel=$('.community-auth');if(panel&&location.hash==='#login')panel.open=true;}
 window.addEventListener('hashchange',openCommunityAuth);document.addEventListener('click',e=>{if(e.target.closest('a[href="#login"]')){const panel=$('.community-auth');if(panel)panel.open=true;}});openCommunityAuth();
 let profile=null, feed='discussion', categories=[], activeGroup=null, media=[], live=null, heartbeat=null,studioOutputSettings={format:'landscape-720',qualityPreset:'balanced'};
 document.addEventListener('hk-studio-output-settings',e=>{if(e.detail?.format)studioOutputSettings={format:e.detail.format,qualityPreset:e.detail.qualityPreset||'balanced'};});
 async function api(path,method='GET',body,headers={}) {
  const init={method,credentials:'same-origin',headers:{Accept:'application/json',...headers}};
  if(body!==undefined){init.body=body instanceof Blob?body:JSON.stringify(body);if(!(body instanceof Blob))init.headers['Content-Type']='application/json';}
  const r=await fetch(path,init);let data;try{data=await r.json();}catch{throw new Error('The service did not return a valid response. Please retry.');}
  if(!r.ok){const e=new Error(typeof data.error==='string'?data.error:data.error?.message||'The request could not be completed.');e.status=r.status;throw e;}return data;
 }
 const text=(tag,value,cls)=>{const node=document.createElement(tag);node.textContent=value??'';if(cls)node.className=cls;return node;};
 const button=(label,fn)=>{const b=text('button',label,'btn btn-secondary');b.type='button';b.addEventListener('click',async()=>{b.disabled=true;try{await fn();}catch(e){let status=$('.card-status',b.parentElement);if(!status){status=text('p','','card-status');status.setAttribute('role','status');b.parentElement.append(status);}status.textContent=e.message;}finally{b.disabled=false;}});return b;};
 function message(selector,value){const el=$(selector);if(el)el.textContent=value;}
 function formatBytes(value){const n=Number(value||0);if(!Number.isFinite(n)||n<1)return '0 B';const units=['B','KB','MB','GB'];const i=Math.min(units.length-1,Math.floor(Math.log(n)/Math.log(1024)));return (n/1024**i).toFixed(i?1:0)+' '+units[i];}
 function formTask(form,fn){form.addEventListener('submit',async e=>{e.preventDefault();if(!form.reportValidity())return;const status=$('.form-status',form),b=$('button[type=submit]',form);b.disabled=true;status.textContent='Please wait…';try{const result=await fn(Object.fromEntries(new FormData(form)),form);status.textContent=result||'Saved.';}catch(err){status.textContent=err.message||'Sign-in is temporarily unavailable. Try again.';if(form.dataset.authForm==='login'){const field=form.querySelector('input[name="password"]');if(field){field.value='';field.focus();}}}finally{b.disabled=false;}});}
 async function session(){try{profile=(await api('/api/auth/profile')).profile;}catch(e){if(e.status===401)profile=null;else throw e;}
  $$('[data-auth-panel]').forEach(el=>el.hidden=!!profile);$$('[data-member-panel]').forEach(el=>el.hidden=!profile);$$('[data-member-name]').forEach(el=>el.textContent=profile?'Welcome, '+profile.name:'');
  $$('[data-compose-panel]').forEach(el=>el.hidden=!profile);$$('[data-signin-note]').forEach(el=>el.hidden=!!profile);$$('[data-admin-link]').forEach(el=>el.hidden=(roles[profile?.roleName]||0)<2);
  window.HKAdminProfile=profile;document.dispatchEvent(new CustomEvent('hk-admin-session',{detail:{profile}}));
  if($('#admin-workspace'))await setupAdmin();
 }
 $$('[data-auth-mode]').forEach(b=>b.addEventListener('click',()=>{$$('[data-auth-form]').forEach(f=>f.hidden=f.dataset.authForm!==b.dataset.authMode);$$('[data-auth-mode]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));}));
 // Password visibility is opt-in; default stays masked.
 $$('[data-auth-form] input[type="password"]').forEach(field=>{
  field.maxLength=128;
  if(field.parentElement?.querySelector('[data-password-toggle]'))return;
  const toggle=document.createElement('button');toggle.type='button';
  toggle.className='password-toggle';toggle.dataset.passwordToggle='1';
  toggle.textContent='Show password';toggle.setAttribute('aria-pressed','false');
  toggle.addEventListener('click',()=>{
   const visible=field.type==='password';field.type=visible?'text':'password';
   toggle.textContent=visible?'Hide password':'Show password';
   toggle.setAttribute('aria-pressed',String(visible));
  });
  field.parentElement?.append(toggle);
 });
 $$('[data-auth-form]').forEach(f=>formTask(f,async data=>{
  if(f.dataset.authForm==='register'){await api('/api/auth/register','POST',data);f.reset();$('[data-auth-mode="login"]').click();message('[data-auth-form="login"] .form-status','Account created. Sign in with your email and password.');return 'Account created.';}
  await api('/api/auth/login','POST',data);f.reset();await session();return 'Signed in.';
 }));
 $$('[data-logout]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;try{await api('/api/auth/logout','POST',{});await session();}catch(e){message('#admin-access-status',e.message);}finally{b.disabled=false;}}));
 function card(title,body,author){const el=text('article','','portal-card');el.append(text('h3',title),text('p',body,'post-body'));if(author)el.append(text('p',author,'portal-byline'));return el;}
 const feedPaths={discussion:'/api/discussions',prayer:'/api/prayer',testimony:'/api/testimonies',groups:'/api/groups'};
 async function loadFeed(){if(!$('#community-items'))return;message('#feed-status','Loading community…');try{const data=await api(feedPaths[feed]);const target=$('#community-items');target.replaceChildren();for(const item of data.items||[]){
   if(feed==='groups'){const c=card(item.name,item.description,item.visibility==='private'?'Membership requests reviewed by the group owner':'Public fellowship group');c.append(button('View conversation',()=>openGroup(item)),button('Join group',async()=>{if(!profile)throw new Error('Please sign in to join a group.');const result=await api(`/api/groups/${item.group_id}/join`,'POST',{});c.append(text('p',result.status==='requested'?'Your membership request has been sent.':'You joined this group.'));}));target.append(c);continue;}
   const c=card(item.title,item.body||item.requestText||item.story,item.displayName||'Anonymous');
   if(feed==='prayer')c.append(button('I am praying',async()=>{if(!profile)throw new Error('Please sign in to respond.');await api(`/api/prayer/${item.prayerId}/respond`,'POST',{responseType:'praying'});c.append(text('p','Thank you for praying.'));}));
   if(feed==='discussion'){c.append(button('Replies',()=>discussionReplies(c,item)),button('Encouraged',async()=>{if(!profile)throw new Error('Please sign in to respond.');const r=await api('/api/reactions','POST',{contentType:'discussion',contentId:item.discussionId,reactionType:'encouraged'});c.append(text('p',r.active?'You were encouraged.':'Reaction removed.'));}));}
   target.append(c);
  }message('#feed-status',data.items?.length?'':'No posts here yet. Be part of the first conversation.');}catch(e){message('#feed-status',e.message);}}
 $$('[data-feed]').forEach(b=>b.addEventListener('click',()=>{feed=b.dataset.feed;$$('[data-feed]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));loadFeed();}));
 $('[data-feed-refresh]')?.addEventListener('click',loadFeed);

 async function discussionReplies(c,item){let box=$('.discussion-replies',c);if(!box){box=text('div','','discussion-replies');c.append(box);}const r=await api('/api/comments?contentType=discussion&contentId='+item.discussionId);box.replaceChildren();for(const reply of r.items||[])box.append(card(reply.authorName,reply.body));if(!r.items?.length)box.append(text('p','No replies yet.'));if(profile&&!item.locked){const f=document.createElement('form'),label=text('label','Your reply'),area=document.createElement('textarea');area.name='body';area.required=true;area.maxLength=2000;label.append(area);const submit=text('button','Post reply','btn btn-primary');submit.type='submit';const status=text('p','','form-status');status.setAttribute('role','status');f.append(label,submit,status);formTask(f,async(data)=>{await api('/api/comments','POST',{contentType:'discussion',contentId:item.discussionId,body:data.body});await discussionReplies(c,item);return 'Reply posted.';});box.append(f);}}
 async function openGroup(group){activeGroup=group.group_id;$('#group-detail').hidden=false;message('#group-title',group.name);$('#group-posts').replaceChildren();try{const data=await api(`/api/groups/${activeGroup}/posts`);const items=data.items||data.posts||[];for(const p of items)$('#group-posts').append(card(p.title||'Group conversation',p.body,p.displayName||p.display_name||'Member'));if(!items.length)$('#group-posts').append(text('p','No group posts yet. Join the group to begin.'));}catch(e){$('#group-posts').append(text('p',e.message));}$('#group-detail').scrollIntoView({block:'start',behavior:'smooth'});}
 if($('#group-compose'))formTask($('#group-compose'),async(data,f)=>{if(!profile)throw new Error('Please sign in first.');await api(`/api/groups/${activeGroup}/posts`,'POST',{body:data.body,postType:'discussion',anonymous:false});f.reset();await openGroup({group_id:activeGroup,name:$('#group-title').textContent});return 'Your message was posted.';});
 function populateCategories(){const f=$('#community-compose');if(!f)return;const module=f.elements.module.value;const select=f.elements.categoryId;select.replaceChildren();categories.filter(c=>c.module===module).forEach(c=>{const o=text('option',c.name);o.value=c.category_id;select.append(o);});}
 if($('#community-compose')){const f=$('#community-compose');f.elements.module.addEventListener('change',populateCategories);api('/api/community/categories').then(r=>{categories=r.items||[];populateCategories();}).catch(e=>message('#feed-status',e.message));formTask(f,async(data,form)=>{if(!profile)throw new Error('Please sign in first.');const module=data.module;const body={categoryId:Number(data.categoryId),title:data.title,anonymous:!!data.anonymous};if(module==='discussion')body.body=data.body;else if(module==='prayer'){body.requestText=data.body;body.visibility='public';}else body.story=data.body;await api(feedPaths[module],'POST',body);form.elements.body.value='';feed=module;$$('[data-feed]').forEach(t=>t.setAttribute('aria-pressed',String(t.dataset.feed===feed)));await loadFeed();return module==='testimony'?'Your testimony was submitted for ministry review.':'Your post is now in the community.';});loadFeed();}
 async function inbox(){try{const r=await api('/api/admin/public-submissions');const target=$('#inbox-items');target.replaceChildren();for(const item of r.items||[]){const c=card(item.type,new Date(item.createdAt).toLocaleString(),item.status);for(const [key,value] of Object.entries(item.payload||{}))c.append(text('p',key+': '+(typeof value==='string'?value:JSON.stringify(value))));target.append(c);}message('#inbox-status',r.items?.length?'':'No ministry submissions yet.');}catch(e){message('#inbox-status',e.message);}}
 $('#inbox-refresh')?.addEventListener('click',inbox);
 async function moderation(){try{const [summary,pending]=await Promise.all([api('/api/admin/dashboard/moderation'),api('/api/admin/testimonies/pending')]);const target=$('#moderation-summary');target.replaceChildren();for(const [label,value] of Object.entries(summary.data||{}))target.append(card(label.replace(/([A-Z])/g,' $1'),String(value)));const list=$('#pending-testimonies');list.replaceChildren();for(const item of pending.items||[]){const c=card(item.title,item.story);c.append(button('Approve testimony',async()=>{await api(`/api/testimonies/${item.testimony_id}/approve`,'POST',{});await moderation();}));list.append(c);}message('#moderation-status',pending.items?.length?'':'No testimonies are awaiting review.');}catch(e){message('#moderation-status',e.message);}}
 async function setupAdmin(){const level=roles[profile?.roleName]||0;$('#moderation-workspace').hidden=level<2;$('#admin-workspace').hidden=level<3;message('#admin-access-status',profile?(level<2?'Your account is a community member. An existing ministry administrator must grant administrative access.':profile.roleName+' access'):'');$('#ministry-inbox').hidden=level<4;if(level>=4)await inbox();if(level>=2)await moderation();if(level>=3){await studio();if(level>=4)await restream();else if($('#social-restream-card'))$('#social-restream-card').hidden=true;await adminGroups();}else{clearInterval(heartbeat);heartbeat=null;}}
 function selects(){for(const el of $$('[data-media-select],[data-video-select]')){el.replaceChildren();const empty=text('option','Choose an uploaded file');empty.value='';el.append(empty);for(const m of media.filter(m=>['approved','published'].includes(m.status)&&(!el.hasAttribute('data-video-select')||m.media_type==='video'))){const o=text('option',`${m.media_id} · ${m.object_key.split('/').pop()} · ${m.media_type}`);o.value=m.media_id;el.append(o);}}}
 async function studio(){message('#studio-status','Checking broadcast studio…');try{const connection=await api('/api/admin/media-engine/status');if(!connection.ok)throw new Error('The Media Engine did not confirm its connection.');const [files,playout,status,settings,playlistOrder]=await Promise.all([api('/api/admin/media-engine/media'),api('/api/broadcast/playout'),api('/api/broadcast/live-status'),api('/api/admin/media-engine/broadcast-settings'),api('/api/admin/media-engine/playlist-order')]);const switches=$('#playlist-settings');switches.replaceChildren();for(const c of settings.items||[])switches.append(button((c.channel==='radio'?'Radio':'Video')+' 24/7 playlist: '+(c.playlist_enabled?'ON — click to pause':'OFF — click to enable'),async()=>{await api('/api/admin/media-engine/broadcast-settings','POST',{channel:c.channel,enabled:!c.playlist_enabled});await studio();}));media=files.items||[];live=status.live;
 const orderEditor=$('#playlist-order-editor');if(orderEditor){orderEditor.replaceChildren();const published=media.filter(m=>m.status==='published'),publishedAudio=published.filter(m=>m.media_type==='audio'),radioItems=publishedAudio.length?publishedAudio:published.filter(m=>m.media_type==='video'),videoItems=published.filter(m=>m.media_type==='video');
  const renderOrder=(channel,label,items,saved)=>{const section=text('div','','playlist-order-section');section.append(text('h3',label));if(!items.length){section.append(text('p','No published media in this playlist.'));orderEditor.append(section);return;}const byId=new Map(items.map(m=>[Number(m.media_id),m])),base=(Array.isArray(saved)?saved:[]).map(Number).filter(id=>byId.has(id)),missing=items.map(m=>Number(m.media_id)).filter(id=>!base.includes(id)),ids=[...base,...missing];const list=text('div','','playlist-order-list');const save=async next=>{await api('/api/admin/media-engine/playlist-order','POST',{channel,media_ids:next});await studio();};ids.forEach((id,index)=>{const m=byId.get(id),row=text('div','','playlist-order-row');row.append(text('span',(index+1)+'. '+m.object_key.split('/').pop()));if(index>0)row.append(button('Move up',()=>{const next=[...ids];[next[index-1],next[index]]=[next[index],next[index-1]];return save(next);}));if(index<ids.length-1)row.append(button('Move down',()=>{const next=[...ids];[next[index],next[index+1]]=[next[index+1],next[index]];return save(next);}));list.append(row);});section.append(list);orderEditor.append(section);};
  renderOrder('radio','Radio running order',radioItems,playlistOrder.radio);renderOrder('video','TV running order',videoItems,playlistOrder.video);
 }
 switches.append(button('Return to automatic 24/7',async()=>{if(live)await api('/api/broadcast/live-session/'+live.session_id+'/stop','POST',{});for(const channel of ['radio','video'])await api('/api/admin/media-engine/broadcast-settings','POST',{channel,enabled:true});await studio();}),button('Prepare manual live broadcast',()=>{document.querySelector('#production-studio')?.scrollIntoView({behavior:'smooth',block:'start'});document.dispatchEvent(new CustomEvent('hk-studio-prepare'));}));document.dispatchEvent(new CustomEvent('hk-studio-state',{detail:{media,playout:playout.items||[],live,settings:settings.items||[],playlistOrder,connection}}));selects();const target=$('#studio-media');target.replaceChildren();for(const m of media){const retention=m.keep_media?'Permanent':m.retention_until?'Expires '+new Date(m.retention_until).toLocaleString():'Temporary';const c=card(m.object_key.split('/').pop(),`${m.media_type.toUpperCase()} · ${formatBytes(m.size_bytes)} · ${m.status} · ${retention}`);c.dataset.status=m.status;const meta=text('p','Uploaded '+new Date(m.created_at).toLocaleString(),'studio-help');c.append(meta);if(['approved','published'].includes(m.status)){if(['audio','video'].includes(m.media_type)){c.append(button('Preview '+m.media_type,()=>{let player=c.querySelector('audio,video');if(!player){player=document.createElement(m.media_type);player.controls=true;player.preload='metadata';player.src='/api/admin/media-engine/media/'+m.media_id+'/preview';c.append(player);}player.play().catch(()=>{});}));}if(['audio','video'].includes(m.media_type))c.append(button(m.status==='published'?'Remove from 24/7 playlist':'Publish to 24/7 playlist',async()=>{await api(`/api/admin/media-engine/media/${m.media_id}/publish`,'POST',{published:m.status!=='published'});await studio();}));c.append(button(m.keep_media?'Use 48-hour retention':'Keep permanently',async()=>{await api(`/api/admin/media-engine/media/${m.media_id}/keep`,'POST',{keep:!m.keep_media});await studio();}));c.append(button('Delete file',async()=>{if(!confirm('Delete this media file permanently? This cannot be undone.'))return;await api(`/api/admin/media-engine/media/${m.media_id}/delete`,'POST',{});await studio();}));}target.append(c);}if(!media.length)target.append(text('p','No media uploaded yet. Upload audio or video above to build your radio, TV and studio library.'));
 const schedule=$('#studio-playout');schedule.replaceChildren();for(const p of playout.items||[]){const starts=new Date(p.starts_at),ends=new Date(p.ends_at),now=new Date(),phase=starts<=now&&ends>now?'ON AIR NOW':'UPCOMING';const c=card(p.title,`${phase} · ${starts.toLocaleString()} – ${ends.toLocaleString()} · media #${p.media_id}`);c.dataset.status=phase==='ON AIR NOW'?'live':'scheduled';c.append(button('Cancel scheduled programme',async()=>{await api(`/api/admin/media-engine/playout/${p.playout_id}/cancel`,'POST',{});await studio();}));schedule.append(c);}if(!playout.items?.length)schedule.append(text('p','No active or upcoming programmes. The normal 24/7 playlist will continue.'));
 $('#live-controls').hidden=!live;message('#live-title',live?`ON AIR · ${live.title} · ${live.destination||'both'} · ${live.source_type} · ${live.status}`:'');clearInterval(heartbeat);heartbeat=null;if(live&&!String(live.source_ref||'').startsWith('livekit:'))heartbeat=setInterval(async()=>{try{await api(`/api/broadcast/live-session/${live.session_id}/heartbeat`,'POST',{});}catch(e){message('#studio-status','Live heartbeat failed: '+e.message);}},60000);message('#studio-status',live?'Media Engine connected · LIVE programme active.':'Media Engine connected · studio ready.');}catch(e){message('#studio-status',e.message);}}
 $('#studio-refresh')?.addEventListener('click',studio);$('#moderation-refresh')?.addEventListener('click',moderation);
 const liveSourceType=$('#live-source-type');function syncLiveSourceFields(){const external=liveSourceType?.value==='camera';const uploaded=$('#live-uploaded-video-field'),stream=$('#live-external-stream-field');if(uploaded)uploaded.hidden=external;if(stream)stream.hidden=!external;}liveSourceType?.addEventListener('change',syncLiveSourceFields);syncLiveSourceFields();

 let pauseUpload=false;
 $('#upload-pause')?.addEventListener('click',()=>{pauseUpload=true;message('#media-upload .form-status','Pausing after the current part finishes…');});
 if($('#media-upload'))formTask($('#media-upload'),async(data,f)=>{pauseUpload=false;const pause=$('#upload-pause'),wrap=$('#upload-progress-wrap'),bar=$('#upload-progress'),label=$('#upload-progress-text');pause.hidden=false;wrap.hidden=false;bar.value=0;label.textContent='Preparing upload…';try{const {uploadMediaFile}=await import('./media-uploader.js?v=2.2.0');const result=await uploadMediaFile({file:f.elements.file.files[0],keep:!!data.keep,actor:profile?.userId||profile?.email||profile?.name,onProgress:(value,detail={})=>{message('#media-upload .form-status',value);if(Number.isFinite(detail.percent))bar.value=detail.percent;let extra='';if(detail.speedBytesPerSecond){const eta=detail.remainingBytes/detail.speedBytesPerSecond;extra=' · '+formatBytes(detail.speedBytesPerSecond)+'/s'+(Number.isFinite(eta)&&eta>0?' · about '+Math.ceil(eta)+'s remaining':'');}label.textContent=(Number.isFinite(detail.percent)?detail.percent+'%':'')+(detail.totalParts?' · part '+detail.part+' of '+detail.totalParts:'')+extra;},shouldPause:()=>pauseUpload});if(result.paused)return 'Paused safely. Keep this same file selected and press Upload to resume within 24 hours.';f.reset();await studio();bar.value=100;label.textContent='100% · upload verified';return 'Upload complete and verified. Preview it, then publish it if it belongs in the 24/7 playlist.';}finally{pause.hidden=true;setTimeout(()=>{if(bar.value===100)wrap.hidden=true;},4000);}});
 if($('#playout-form'))formTask($('#playout-form'),async(data,f)=>{const start=new Date(data.startsAt),end=new Date(data.endsAt);if(end<=start||end<=new Date())throw new Error('Choose an end time after the start time and later than now.');await api('/api/broadcast/playout','POST',{mediaId:Number(data.mediaId),title:data.title,startsAt:start.toISOString(),endsAt:end.toISOString()});f.reset();await studio();return 'Programme scheduled.';});
 if($('#live-form'))formTask($('#live-form'),async(data,f)=>{const body={isLive:true,title:data.title,sourceType:data.sourceType,destination:data.destination,fallbackMediaId:data.fallbackMediaId?Number(data.fallbackMediaId):undefined};if(data.sourceType==='video'){if(!data.visualMediaId)throw new Error('Choose an uploaded video.');body.visualMediaId=Number(data.visualMediaId);body.sourceRefId='media:'+data.visualMediaId;}else{let url;try{url=new URL(data.sourceRefId);}catch{throw new Error('Enter your streaming provider’s HTTPS playback URL.');}if(url.protocol!=='https:'||(url.hostname===location.hostname&&!url.pathname.startsWith('/api/broadcast/media/')))throw new Error('Use a direct media playback URL, not the radio or video webpage. For your camera, use Go live in Production studio.');body.sourceRefId=url.href;}await api('/api/broadcast/live-status','POST',body);f.reset();await studio();return 'Programme started. Keep this dashboard open.';});
 if($('#live-switch'))formTask($('#live-switch'),async(data)=>{if(!live)throw new Error('Start a programme first.');await api(`/api/broadcast/live-session/${live.session_id}/switch-to-prerecorded`,'POST',{mediaId:Number(data.mediaId)});await studio();return 'Switched to prerecorded video.';});
 $('#live-stop')?.addEventListener('click',async()=>{if(!live)return;try{await api(`/api/broadcast/live-session/${live.session_id}/stop`,'POST',{});await studio();}catch(e){message('#studio-status',e.message);}});

 async function adminGroups(){try{const r=await api('/api/admin/groups');const target=$('#groups-admin-list');target.replaceChildren();for(const g of r.items||[]){const c=card(g.name,g.description,g.visibility+' · '+g.status);c.append(button('Members and posts',()=>groupAdminDetail(g)),button(g.status==='active'?'Archive group':'Restore group',async()=>{await api(`/api/admin/groups/${g.group_id}`,'POST',{action:'status',status:g.status==='active'?'archived':'active'});await adminGroups();}));target.append(c);}message('#groups-admin-status',r.items?.length?'':'No groups yet. Create the first fellowship group.');}catch(e){message('#groups-admin-status',e.message);}}
 async function groupAdminDetail(g){const r=await api(`/api/admin/groups/${g.group_id}`);const target=$('#group-admin-detail');target.replaceChildren(text('h3',g.name));target.append(text('h4','Members'));for(const m of r.members||[])target.append(text('p',m.name+' · '+m.role));target.append(text('h4','Membership requests'));if(!r.requests?.length)target.append(text('p','No pending requests.'));for(const q of r.requests||[]){const c=card(q.name,'Requested membership');for(const status of ['approved','declined'])c.append(button(status==='approved'?'Approve':'Decline',async()=>{await api(`/api/admin/groups/${g.group_id}`,'POST',{action:'join',requestId:q.request_id,status});await groupAdminDetail(g);}));target.append(c);}target.append(text('h4','Group posts'));for(const post of r.posts||[]){const c=card(post.title||'Group conversation',post.body,post.status);c.append(button(post.status==='active'?'Hide post':'Restore post',async()=>{await api(`/api/admin/groups/${g.group_id}`,'POST',{action:'post',postId:post.post_id,status:post.status==='active'?'hidden':'active'});await groupAdminDetail(g);}));target.append(c);}}
 $('#groups-refresh')?.addEventListener('click',adminGroups);
 if($('#group-create'))formTask($('#group-create'),async(data,f)=>{await api('/api/groups','POST',{...data,type:'fellowship'});f.reset();await adminGroups();return 'Group created.';});
 function player(panel){
 const channel=panel.dataset.broadcastPlayer,title=$('[data-programme-title]',panel),status=$('[data-player-status]',panel),list=$('[data-playlist]',panel),simple=panel.hasAttribute('data-simple-player'),audioVisual=$('[data-audio-visual]',panel),audioVisualTitle=$('[data-audio-visual-title]',panel);
 let el=$('audio,video',panel),items=[],index=0,signature='',mode='offline',liveKitRoom=null,liveAudioEl=null,youtubeId=null,youtubeFrame=null,userPlaying=false,retryTimer=null,audioVisualMode=false;
  if(channel==='radio'&&new URLSearchParams(location.search).get('hk-player-window')==='1'&&!document.getElementById('hk-radio-popout-style')){
   document.documentElement.classList.add('hk-radio-popout');
   const popoutStyle=document.createElement('style');popoutStyle.id='hk-radio-popout-style';
   popoutStyle.textContent='html.hk-radio-popout,html.hk-radio-popout body{margin:0!important;padding:0!important;background:#07152f!important}html.hk-radio-popout .top-strip,html.hk-radio-popout .site-header,html.hk-radio-popout .site-footer,html.hk-radio-popout .hk-share-bless,html.hk-radio-popout .broadcast-assistant,html.hk-radio-popout .skip-link{display:none!important}html.hk-radio-popout .broadcast-public-main{padding:8px!important;margin:0!important}html.hk-radio-popout .broadcast-public-shell{display:block!important;max-width:none!important;margin:0!important;padding:0!important}html.hk-radio-popout .broadcast-public-card{margin:0 auto!important;padding:8px!important;max-width:390px!important;box-shadow:none!important}html.hk-radio-popout .hk-radio-page-heading{font-size:20px!important;margin:4px 0 8px!important}html.hk-radio-popout .hk-radio-original-art{max-width:340px!important;width:100%!important;margin:0 auto!important}html.hk-radio-popout .hk-radio-original-picture{width:100%!important;height:auto!important;max-height:64vh!important;object-fit:contain!important}html.hk-radio-popout .hk-radio-original-transport{max-width:100%!important}html.hk-radio-popout body{overflow-x:hidden!important}';
   document.head.append(popoutStyle);
  }

 const simpleSlot=$('[data-simple-play-control]',panel);
 const playback=text('div','','broadcast-playback-controls');
 const toggle=button('▶ PLAY WITH SOUND',async()=>{
  if(!items.length&&!liveKitRoom&&!youtubeId)await refresh();
  if(youtubeId){
   if(youtubeFrame){youtubeFrame.remove();youtubeFrame=null;userPlaying=false;status.textContent='Paused';syncToggle();return;}
   youtubeFrame=document.createElement('iframe');youtubeFrame.className='ministry-youtube-player';youtubeFrame.title='Ministry broadcast';youtubeFrame.allow='autoplay; encrypted-media; fullscreen; picture-in-picture';youtubeFrame.allowFullscreen=true;youtubeFrame.referrerPolicy='strict-origin-when-cross-origin';youtubeFrame.src='https://www.youtube-nocookie.com/embed/'+youtubeId+'?autoplay=1&playsinline=1&rel=0&origin='+encodeURIComponent(location.origin);el.hidden=true;panel.insertBefore(youtubeFrame,status);
   userPlaying=true;syncToggle();status.textContent='Playing';return;
  }
  if(el.paused){
   el.muted=false;el.volume=1;if(liveKitRoom)await liveKitRoom.startAudio();
   try{await el.play();userPlaying=true;status.textContent='Playing';}catch{status.textContent='Tap PLAY again to start.';}
  }else{el.pause();userPlaying=false;status.textContent='Paused';}
  syncToggle();
 });
 toggle.className='broadcast-toggle-button';
 function syncToggle(){const active=userPlaying&&(youtubeFrame||!el.paused);toggle.textContent=active?'❚❚ PAUSE':'▶ PLAY WITH SOUND';toggle.setAttribute('aria-pressed',String(Boolean(active)));}
 if(simpleSlot)simpleSlot.append(playback);else panel.insertBefore(playback,list);playback.append(toggle);playback.hidden=egressMode;
 // Bluetooth audio normally follows the operating system's selected output. Where a browser
 // exposes setSinkId(), offer an optional output selector; never require Web Bluetooth.
 let selectedOutputId='',outputSelect=null,outputStatus=null;
 if(channel==='radio'&&!egressMode){
  const outputWrap=text('div','','broadcast-output-picker');
  const outputLabel=text('label','Audio output ','broadcast-output-label');
  outputSelect=document.createElement('select');outputSelect.setAttribute('aria-label','Audio output device');
  const defaultOption=text('option','System default audio output');defaultOption.value='';outputSelect.append(defaultOption);
  outputLabel.append(outputSelect);outputStatus=text('p','Bluetooth headphones/speakers use your device audio settings.','broadcast-output-status');
  outputWrap.append(outputLabel,outputStatus);playback.append(outputWrap);
  const supportsSink=typeof el?.setSinkId==='function';
  if(!supportsSink){outputSelect.hidden=true;outputLabel.hidden=true;outputStatus.textContent='Audio follows your phone or computer audio output. Connect Bluetooth in your device settings, then press Play.';}
  async function loadOutputs(){
   if(!supportsSink||!navigator.mediaDevices?.enumerateDevices)return;
   try{
    const devices=await navigator.mediaDevices.enumerateDevices();
    const outputs=devices.filter(d=>d.kind==='audiooutput');
    const current=selectedOutputId||outputSelect.value;
    outputSelect.replaceChildren();const fallback=text('option','System default audio output');fallback.value='';outputSelect.append(fallback);
    for(const device of outputs){const option=text('option',device.label||('Audio output '+(outputSelect.options.length)),device.deviceId==='default'?'':'');option.value=device.deviceId==='default'?'':device.deviceId;outputSelect.append(option);}
    outputSelect.value=current;
    outputStatus.textContent=outputs.length>1?'Choose a listed speaker or headset. Bluetooth devices appear only when the browser exposes them.':'For Bluetooth, pair the device in your phone/computer settings; this browser currently exposes only the default output.';
   }catch{outputStatus.textContent='Audio follows your device settings. Pair Bluetooth from system settings if no output choices are listed.';}
  }
  outputSelect.addEventListener('focus',loadOutputs);outputSelect.addEventListener('pointerdown',loadOutputs);
  outputSelect.addEventListener('change',async()=>{
   const sink=outputSelect.value;
   if(typeof el?.setSinkId!=='function'){outputStatus.textContent='Use your phone/computer audio settings to select Bluetooth.';return;}
   try{await el.setSinkId(sink);selectedOutputId=sink;outputStatus.textContent=sink?'Audio output changed.':'Using system default audio output.';}
   catch{outputStatus.textContent='Could not switch output in this browser. Select the Bluetooth device in your system audio settings.';outputSelect.value=selectedOutputId;}
  });
  navigator.mediaDevices?.addEventListener?.('devicechange',loadOutputs);
 }
 function updateMediaSession(state){
   if(!('mediaSession' in navigator))return;
   try{
    if(state)navigator.mediaSession.playbackState=state;
    if(typeof MediaMetadata==='function')navigator.mediaSession.metadata=new MediaMetadata({title:title?.textContent||'Heavenly Key Radio',artist:'Heavenly Key Evangelistic Movement',album:'Heavenly Key Radio'});
   }catch{}
  }
  if(channel==='radio'&&'mediaSession' in navigator){
   const actions={play:()=>{if(el.paused)el.play().then(()=>{userPlaying=true;syncToggle();updateMediaSession('playing')}).catch(()=>{status.textContent='Tap Play in the radio player to resume.'})},pause:()=>{el.pause();userPlaying=false;syncToggle();updateMediaSession('paused')},stop:()=>{el.pause();userPlaying=false;syncToggle();updateMediaSession('paused')},nexttrack:()=>{if(items.length)select((index+1)%items.length,true)},previoustrack:()=>{if(items.length)select((index+items.length-1)%items.length,true)}};
   for(const [action,handler] of Object.entries(actions)){try{navigator.mediaSession.setActionHandler(action,handler)}catch{}}
  }
  let reconnectAttempts=0;
 function scheduleReconnect(){clearTimeout(retryTimer);if(userPlaying&&!egressMode&&navigator.onLine)retryTimer=setTimeout(async()=>{if(!userPlaying)return;signature='';await refresh();if(!el.paused)syncToggle();},Math.min(30000,2000*Math.pow(2,Math.min(reconnectAttempts++,4))));}
 function bindMediaEvents(){
  el.addEventListener('ended',()=>{if(items.length&&mode==='playlist'&&userPlaying)select((index+1)%items.length,true);});
  el.addEventListener('play',()=>{userPlaying=true;syncToggle();status.textContent='Playing';});
  el.addEventListener('pause',()=>{if(!el.ended&&!el.error){userPlaying=false;syncToggle();updateMediaSession('paused');}});
  el.addEventListener('waiting',()=>{status.textContent='Connecting…';});
  el.addEventListener('playing',()=>{reconnectAttempts=0;clearTimeout(retryTimer);userPlaying=true;syncToggle();status.textContent='Playing';updateMediaSession('playing');});
  el.addEventListener('error',()=>{status.textContent='Connection interrupted. Reconnecting automatically…';scheduleReconnect();});
 }
 function setAudioVisual(active,programmeTitle=''){
  audioVisualMode=!!active;
  if(audioVisual){audioVisual.hidden=!audioVisualMode;audioVisual.setAttribute('aria-hidden',String(!audioVisualMode));}
  if(audioVisualTitle&&programmeTitle)audioVisualTitle.textContent=programmeTitle;
  if(el)el.classList.toggle('broadcast-audio-only-element',audioVisualMode);
 }
 function ensureMediaElement(kind){
  const wanted=kind==='video'?'video':'audio';
  if(el.tagName.toLowerCase()===wanted)return el;
  const next=document.createElement(wanted);
  next.controls=false;next.preload=egressMode?'auto':'none';next.autoplay=egressMode;next.muted=false;next.volume=1;
  if(wanted==='video'){next.playsInline=true;next.setAttribute('playsinline','');}
  el.pause();el.removeAttribute('src');el.srcObject=null;el.replaceWith(next);el=next;bindMediaEvents();return el;
 }
 ensureMediaElement(channel==='video'?'video':'audio');
 el.controls=false;el.muted=false;el.volume=1;el.preload=egressMode?'auto':'none';el.autoplay=egressMode;
 async function disconnectLiveKit(){if(liveKitRoom){try{await liveKitRoom.disconnect();}catch{}liveKitRoom=null;}if(liveAudioEl){try{liveAudioEl.pause();}catch{}liveAudioEl.remove();liveAudioEl=null;}el.srcObject=null;}
 async function connectLiveKit(r){
   await disconnectLiveKit();ensureMediaElement(channel==='video'?'video':'audio');status.textContent='Connecting…';
   const tokenResponse=await fetch('/api/broadcast/livekit/viewer-token',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});const token=await tokenResponse.json();
   if(!tokenResponse.ok)throw new Error(token?.error?.message||token?.error||'Live broadcast is unavailable.');
   const mod=await import('https://cdn.jsdelivr.net/npm/livekit-client@2.22.3/+esm');
   liveKitRoom=new mod.Room({adaptiveStream:true,dynacast:true});
   liveKitRoom.on(mod.RoomEvent.TrackSubscribed,(track)=>{
    if(track.kind==='audio'){
     if(channel==='radio'){track.attach(el);el.hidden=false;}
     else {if(liveAudioEl){try{liveAudioEl.pause();}catch{}liveAudioEl.remove();}liveAudioEl=document.createElement('audio');liveAudioEl.autoplay=egressMode;liveAudioEl.hidden=true;liveAudioEl.volume=1;track.attach(liveAudioEl);panel.append(liveAudioEl);if(userPlaying||egressMode)liveAudioEl.play().catch(()=>{});}
    } else if(track.kind==='video'&&channel==='video'){track.attach(el);el.hidden=false;if(userPlaying||egressMode)el.play().catch(()=>{});}
   });
   liveKitRoom.on(mod.RoomEvent.Disconnected,()=>{if(userPlaying){status.textContent='Connection interrupted. Reconnecting automatically…';scheduleReconnect();}});
   await liveKitRoom.connect(token.url,token.token);title.textContent=token.title||r.title;status.textContent='Ready — tap PLAY WITH SOUND';
   if(egressMode){try{await liveKitRoom.startAudio();if(liveAudioEl)await liveAudioEl.play();await el.play();status.textContent='LIVE';}catch{status.textContent='Connecting…';}}
 }
 function select(i,play=false){
  index=i;const item=items[i];if(!item)return;
  const kind=item.type==='video'?'video':'audio';ensureMediaElement(kind);
  setAudioVisual(channel==='video'&&kind==='audio',item.title);
  let url;try{url=new URL(item.url,location.origin);}catch{return;}if(url.protocol!=='https:'&&url.origin!==location.origin)return;
  el.srcObject=null;el.muted=false;el.volume=1;el.src=url.href;el.load();el.loop=mode==='scheduled'||mode==='live'||mode==='reconnecting';
  title.textContent=item.title;updateMediaSession(userPlaying?'playing':'paused');status.textContent='Ready — tap PLAY WITH SOUND';
  if(play||egressMode)el.play().then(()=>{userPlaying=true;syncToggle();status.textContent=egressMode?'ON AIR':'Playing';}).catch(()=>{status.textContent=egressMode?'Connecting…':'Tap PLAY to begin.';if(egressMode)setTimeout(()=>el.play().catch(()=>{}),1200);});
 }
 async function refresh(){
  try{
   let r=await api('/api/broadcast/programme?channel='+channel);
   if(channel==='video'&&!r.transport&&!(r.items||[]).length){
    const radioFallback=await api('/api/broadcast/programme?channel=radio');
    const audioOnly=(radioFallback.items||[]).filter(item=>item.type==='audio');
    if(audioOnly.length)r={...radioFallback,items:audioOnly,audio_visual:true,title:radioFallback.title||'ONLINE REVIVAL RADIO'};
   }
   const next=JSON.stringify(r.items||[])+r.mode+(r.transport||'')+(r.sessionId||'')+(r.title||'')+(r.videoId||'')+(r.audio_visual?'audio-visual':'');
   if(next===signature)return;signature=next;mode=r.mode;const wasPlaying=userPlaying&&(youtubeFrame?true:!el.paused);items=r.items||[];list?.replaceChildren();youtubeFrame?.remove();youtubeFrame=null;youtubeId=null;
   if(r.transport==='youtube'){
    await disconnectLiveKit();ensureMediaElement(channel==='video'?'video':'audio');setAudioVisual(false);el.pause();el.removeAttribute('src');el.load();el.hidden=true;
    if(!/^[a-zA-Z0-9_-]{11}$/.test(r.videoId))throw Error('Invalid YouTube programme');youtubeId=r.videoId;title.textContent=r.title;status.textContent='Ready — tap PLAY WITH SOUND';syncToggle();return;
   }
   if(r.transport==='livekit'){setAudioVisual(false);await connectLiveKit(r);if(wasPlaying&&!egressMode){try{await liveKitRoom.startAudio();if(liveAudioEl)await liveAudioEl.play();await el.play();userPlaying=true;syncToggle();}catch{}}return;}
   await disconnectLiveKit();el.hidden=false;
   if(!items.length){updateMediaSession('paused');setAudioVisual(false);el.pause();el.removeAttribute('src');el.load();userPlaying=false;syncToggle();title.textContent=channel==='radio'?'ONLINE REVIVAL RADIO':'FAITH OF OUR FATHERS TV';status.textContent='No programme is available right now.';return;}
   select(0,wasPlaying||egressMode);
  }catch(e){signature='';status.textContent=userPlaying?'Connection interrupted. Reconnecting automatically…':(e.message||'Broadcast unavailable.');scheduleReconnect();}
 }
 bindMediaEvents();document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});window.addEventListener('online',()=>{signature='';refresh();});refresh();setInterval(()=>{if(!document.hidden)refresh();},15000);
 }
 async function restream(){
  const cardEl=$('#social-restream-card');if(!cardEl)return;cardEl.hidden=false;
  try{
   const [state,authResponse,setupResponse]=await Promise.all([api('/api/admin/media-engine/restream'),fetch('/api/admin/social/live-authorization',{credentials:'same-origin',headers:{Accept:'application/json'}}),fetch('/api/admin/social/setup-status',{credentials:'same-origin',headers:{Accept:'application/json'}})]);
   let authData={items:[]},setupData={providers:[]};try{authData=await authResponse.json();}catch{}try{setupData=await setupResponse.json();}catch{}if(!authResponse.ok)throw Error(authData?.error?.message||'Live authorization status could not load.');
   const authTarget=$('#authorized-live-destinations');authTarget?.replaceChildren();
   const setupByPlatform=new Map((setupData.providers||[]).map(p=>[p.platform,p]));
   for(const a of authData.items||[]){
    if(a.platform==='tiktok')continue;
    const setup=setupByPlatform.get(a.platform)||{};
    const tile=card((a.platform||'').toUpperCase(),a.connected?((a.auto_live_supported?'Authorized · automatic live available when provider access permits':'Authorized · publishing connection only')+(a.display_name?' · '+a.display_name:'')):(setup.credentials_configured?'Ready to authorize':'One-time authorization setup required'));
    tile.append(text('p',a.note||'','studio-help'));
    if(!a.connected&&setup.credentials_configured){
      tile.append(button('Authorize '+a.platform,async()=>{const r=await fetch('/api/admin/social/connections/start?platform='+encodeURIComponent(a.platform),{credentials:'same-origin',headers:{Accept:'application/json'}});const d=await r.json();if(!r.ok)throw Error(d?.error?.message||'Authorization could not start.');location.href=d.authorization_url;}));
    } else if(!a.connected){
      const setupButton=button('Open Platforms & Connections',async()=>document.dispatchEvent(new CustomEvent('hk-open-admin-settings')));
      tile.append(text('p','One-time provider setup is required. Complete it in Platforms & Connections; then this becomes a one-click authorization button.','studio-help'),setupButton);
    } else if(a.auto_live_supported)tile.append(text('span','Ready for Studio GO LIVE','studio-ready-badge'));
    else tile.append(text('span','Authorized for publishing','studio-ready-badge'));
    authTarget?.append(tile);
   }
   const target=$('#restream-destinations');target.replaceChildren();
   for(const d of state.destinations||[]){
    if(d.destination!=='tiktok')continue;
    const detail=d.configured?((d.enabled?'Enabled':'Disabled')+(d.host?' · '+d.host:'')):'Not connected';
    const row=card('TIKTOK LIVE',detail);
    if(d.configured){row.append(button(d.enabled?'Disable TikTok':'Enable TikTok',async()=>{await api('/api/admin/media-engine/restream/destination','POST',{destination:'tiktok',enabled:!d.enabled});await restream();}));row.append(button('Remove TikTok connection',async()=>{if(!confirm('Remove the saved TikTok stream connection and encrypted stream key?'))return;await api('/api/admin/media-engine/restream/destination','POST',{destination:'tiktok',action:'remove'});await restream();}));}
    target.append(row);
   }
   message('#restream-status',state.active?'LIVE distribution · '+state.active.source+' · '+(state.active.destinations||[]).join(', '):'Social distribution is stopped.');
   document.dispatchEvent(new CustomEvent('hk-restream-state',{detail:state,authorized:authData.items||[]}));
  }catch(e){message('#restream-status',e.message);}
 }
 async function prepareAuthorizedLiveDestinations(title,format){
  const status=await fetch('/api/admin/social/live-authorization',{credentials:'same-origin',headers:{Accept:'application/json'}});const info=await status.json();if(!status.ok)throw Error(info?.error?.message||'Authorized live accounts could not be checked.');
  const candidates=(info.items||[]).filter(x=>x.connected&&x.auto_live_supported&&x.platform!=='tiktok');
  const results=[];for(const item of candidates){try{const r=await fetch('/api/admin/social/live-authorization',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({platform:item.platform,title:title||'Heavenly Key Live',format:format||'landscape-720'})});const d=await r.json();if(!r.ok)throw Error(d?.error?.message||'Live preparation failed.');results.push({platform:item.platform,ok:true});}catch(e){results.push({platform:item.platform,ok:false,error:e.message});}}
  return results;
 }
 if($('#restream-destination-form'))formTask($('#restream-destination-form'),async(data,f)=>{
  await api('/api/admin/media-engine/restream/destination','POST',{destination:data.destination,server_url:data.server_url,stream_key:data.stream_key,enabled:!!data.enabled});
  f.reset();const enabled=f.querySelector('[name="enabled"]');if(enabled)enabled.checked=true;await restream();
  return 'Destination saved securely. The stream key is no longer displayed.';
 });
 $('#restream-live-start')?.addEventListener('click',async()=>{try{if(!live?.session_id)throw new Error('Start the live programme first.');const prepared=await prepareAuthorizedLiveDestinations(live?.title||'Heavenly Key Live',studioOutputSettings.format);const failures=prepared.filter(x=>!x.ok);await api('/api/admin/media-engine/restream/start','POST',{source:'live',session_id:Number(live.session_id),format:studioOutputSettings.format,quality:studioOutputSettings.qualityPreset});await restream();if(failures.length)message('#restream-status','Live started. Some authorized platforms need attention: '+failures.map(x=>x.platform+' · '+x.error).join(' | '));}catch(e){message('#restream-status',e.message);}});
 $('#restream-247-start')?.addEventListener('click',async()=>{try{await api('/api/admin/media-engine/restream/start','POST',{source:'247',format:'landscape-720',quality:'balanced'});await restream();}catch(e){message('#restream-status',e.message);}});
 $('#restream-stop')?.addEventListener('click',async()=>{try{await api('/api/admin/media-engine/restream/stop','POST',{});await restream();}catch(e){message('#restream-status',e.message);}});
 $$('[data-broadcast-player]').forEach(player);if($('[data-auth-panel]'))session().catch(e=>{$$('.form-status').forEach(s=>s.textContent=e.message);});
})();

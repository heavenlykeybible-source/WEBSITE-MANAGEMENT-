var SCREEN_POLL=null;
async function backupApprovalCard(request,mount){
 var status=h('p',{role:'status'}),repo=h('select',{'aria-label':'Backup destination repository'}),card=h('section',{class:'card'},h('h4',{},'Review backup: '+request.label),h('p',{},'Backup copies source/files only. External databases and secret values are excluded.'),status),busy=false;
 mount.appendChild(card);
 if(request.source==='static'){try{var targets=await api('github');targets.sites.forEach(function(s){repo.appendChild(h('option',{value:s.id},s.label));});card.appendChild(repo);}catch(e){status.textContent=e.message;}}
 (request.source==='github'?['github']:['github','drive']).forEach(function(destination){card.appendChild(h('button',{onclick:async function(){if(busy)return;busy=true;this.disabled=true;try{
  var result=await api(request.source==='github'?'operations/github-backup':'operations/site-backup','POST',{site:request.site,destination:destination,github:repo.value});card.innerHTML='';card.appendChild(h('a',{href:result.url,target:'_blank',rel:'noopener noreferrer'},'Open verified backup'));card.appendChild(h('p',{},result.coverage));
 }catch(e){status.textContent=e.message;}finally{busy=false;this.disabled=false;}}},destination==='github'?'Approve GitHub backup':'Approve Google Drive backup'));});
 card.appendChild(h('button',{class:'bad',onclick:function(){if(!busy)card.textContent='Backup declined. Nothing copied.';}},'Decline backup'));
}
function proposalCard(id,mount){
 mount.innerHTML='';var status=h('p',{role:'status'}),busy=false;
 mount.appendChild(h('b',{},'Proposal #'+id));
 mount.appendChild(h('button',{onclick:async function(){if(busy)return;busy=true;this.disabled=true;try{await openP(id,mount);}finally{busy=false;this.disabled=false;}}},'Review and approve'));
 mount.appendChild(h('button',{class:'bad',onclick:async function(){if(busy)return;busy=true;this.disabled=true;try{await api('proposals/'+id+'/decide','POST',{decision:'reject',comment:'Declined in chat'});mount.textContent='Declined. Nothing published.';}catch(e){status.textContent=e.message;}finally{busy=false;this.disabled=false;}}},'Decline'));
 mount.appendChild(status);
}
async function controlHome(){CURRENT_NAV='Home';try{
 var d=await api('summary');
 show(nav(),h('h3',{class:'page-title'},'Control Room'),h('p',{},'Manage your websites, review AI work and monitor connected accounts.'),
 h('section',{class:'stat-grid'},h('div',{class:'stat'},h('strong',{},String(d.waiting||0)),h('span',{},'Waiting for your review'))),
 h('div',{class:'card'},h('h3',{},'Your workspace'),h('button',{onclick:claude},'Chat with AI'),h('button',{onclick:websiteScreens},'Browse website screens'),h('button',{onclick:waiting},'Review waiting work'),h('button',{onclick:releaseHistory},'Release history and recovery')),
 h('div',{class:'card'},h('h3',{},'Connections'),h('button',{onclick:cloud},'Cloudflare accounts'),h('button',{onclick:github},'GitHub sites and backups'),h('button',{onclick:projectSources},'Google Drive project source')));
 }catch(e){oops(e);}}
async function githubSourceBackup(site,mount){try{
 mount.textContent='Backing up repository source…';var r=await api('operations/github-backup','POST',{site:site.id});mount.innerHTML='';mount.appendChild(h('a',{href:r.url,target:'_blank',rel:'noopener noreferrer'},'Open verified GitHub backup'));mount.appendChild(h('p',{},r.coverage));
 }catch(e){mount.textContent='Backup could not be verified: '+e.message;}}
async function workerRecovery(connection,worker,mount){try{
 mount.textContent='Reading deployment history…';var d=await api('operations/worker-history?connection='+connection.id+'&worker='+encodeURIComponent(worker.name));mount.innerHTML='';
 mount.appendChild(h('h4',{},'Previous deployed versions'));
 mount.appendChild(h('p',{},'Restore up to three earlier deployed code versions. Databases and uploaded files are separate. Review the version before approval.'));
 if(!d.previous.length)mount.appendChild(h('p',{},'No earlier deployed version is available.'));
 d.previous.forEach(function(v){var card=h('section',{class:'card'},h('b',{},v.id),h('p',{},lagosTime(v.created_on)));
 card.appendChild(h('button',{onclick:async function(){this.disabled=true;try{
  var r=await api('operations/worker-recovery','POST',{connection:connection.id,worker:worker.name,version:v.id});card.innerHTML='';
  card.appendChild(h('p',{},r.notice));card.appendChild(h('a',{href:'https://dash.cloudflare.com/'+connection.account_id+'/workers/services/view/'+worker.name+'/production/deployments',target:'_blank',rel:'noopener noreferrer'},'Inspect deployment in Cloudflare'));
  var checked=h('input',{type:'checkbox',style:'width:auto'}),state=h('p',{role:'status'}),busy=false;
  card.appendChild(h('label',{},checked,document.createTextNode('I reviewed this version and its compatibility with current data.')));
  ['approve','decline'].forEach(function(decision){card.appendChild(h('button',{class:decision==='decline'?'bad':'',onclick:async function(){if(busy)return;if(decision==='approve'&&!checked.checked){state.textContent='Review this version first.';return;}busy=true;try{var proof=decision==='approve'?await passwordDialog('Approve recovery of '+worker.name):undefined;if(decision==='approve'&&!proof)return;var result=await api('operations/worker-recovery/decide','POST',{id:r.review.id,decision:decision,reviewed:checked.checked,password:proof});card.textContent=result.status==='succeeded'?'Previous version deployed. Check the live screen.':'Recovery declined.';}catch(e){state.textContent=e.message;}finally{busy=false;}}},decision==='approve'?'Approve recovery':'Decline recovery'));});card.appendChild(state);
 }catch(e){card.appendChild(h('p',{role:'alert'},e.message));}finally{this.disabled=false;}}},'Review this recovery'));mount.appendChild(card);});
 }catch(e){mount.textContent='History could not load: '+e.message;}}
async function websiteScreens(){CURRENT_NAV='Website screens';try{
 var data=await Promise.all([api('sites'),api('remote'),api('github'),api('connections')]);
 var entries=[],select=h('select',{'aria-label':'Connected website'}),workerSelect=h('select',{'aria-label':'Worker website'}),status=h('p',{role:'status'}),health=h('p',{role:'status','aria-label':'Live website health'}),actions=h('div'),recovery=h('div'),url=h('p'),preview=h('iframe',{title:'Connected website live screen',sandbox:'allow-scripts allow-forms',referrerpolicy:'no-referrer',style:'width:100%;height:70dvh;border:1px solid #cad7d0;background:white'}),screen=h('section',{class:'card',style:'overflow:auto;min-width:0'}),connection=null;
 // Managed local sites cannot execute in the authenticated parent's origin.
 preview.setAttribute('sandbox','allow-scripts allow-forms');
 data[0].sites.forEach(function(s){entries.push({label:s.name,url:'/s/'+s.slug+'/',site:s,edit:function(){cmsPages(s);}});});
 data[1].sites.filter(function(s){return s.status==='ready';}).forEach(function(s){entries.push({label:s.label,url:s.url,edit:function(){remotePosts(s,'post');}});});
 data[2].sites.forEach(function(s){entries.push({label:'GitHub · '+s.label,github:s,edit:function(){ghFiles(s);}});});
 data[3].connections.forEach(function(c){entries.push({label:c.label,connection:c});});
 entries.forEach(function(s,i){select.appendChild(h('option',{value:String(i)},s.label));});
 async function draw(){if(SCREEN_POLL){clearInterval(SCREEN_POLL);SCREEN_POLL=null;}health.textContent='';var entry=entries[+select.value];actions.innerHTML='';recovery.innerHTML='';workerSelect.innerHTML='';preview.removeAttribute('src');url.textContent='';connection=null;if(!entry){status.textContent='Connect a website first.';return;}
  if(entry.edit)actions.appendChild(h('button',{onclick:entry.edit},'Edit / prepare changes'));
  if(entry.site){
   actions.appendChild(h('a',{class:'btn',href:'/api/owner/operations/site-backup?site='+encodeURIComponent(entry.site.slug)},'Download full site ZIP'));
   var repo=h('select',{'aria-label':'Backup GitHub repository'});data[2].sites.forEach(function(g){repo.appendChild(h('option',{value:g.id},g.label));});actions.appendChild(repo);
   ['github','drive'].forEach(function(destination){actions.appendChild(h('button',{onclick:async function(){this.disabled=true;try{var result=await api('operations/site-backup','POST',{site:entry.site.slug,destination:destination,github:repo.value});recovery.innerHTML='';recovery.appendChild(h('a',{href:result.url,target:'_blank',rel:'noopener noreferrer'},'Open verified backup'));recovery.appendChild(h('p',{},result.coverage));}catch(e){recovery.textContent=e.message;}finally{this.disabled=false;}}},destination==='github'?'Back up site to GitHub':'Back up site to Google Drive'));});
   actions.appendChild(h('button',{onclick:async function(){try{var versions=await api('operations/site-versions?site='+encodeURIComponent(entry.site.slug));recovery.innerHTML='';if(!versions.versions.length)recovery.textContent='Previous versions will be recorded when the next file change is approved.';versions.versions.forEach(function(v){var card=h('section',{class:'card'},h('p',{},'Version before publication #'+v.id+' · '+lagosTime(v.created_at)+' · '+v.files.length+' files'));card.appendChild(h('button',{onclick:async function(){this.disabled=true;try{var r=await api('operations/site-recovery','POST',{site:entry.site.slug,version:v.id});await openP(r.proposal_id,card);}catch(e){card.appendChild(h('p',{role:'alert'},e.message));}finally{this.disabled=false;}}},'Preview recovery'));recovery.appendChild(card);});}catch(e){recovery.textContent=e.message;}}},'Review three previous site versions'));
  }
  if(entry.github){actions.appendChild(h('button',{onclick:function(){githubSourceBackup(entry.github,recovery);}},'Back up repository to GitHub'));status.textContent='Use Edit to inspect the connected source. Its public URL is not configured here.';return;}
  if(entry.connection){connection=entry.connection;status.textContent='Loading connected Workers…';try{var d=await api('connections/'+connection.id+'/workers');d.workers.forEach(function(w,i){workerSelect.appendChild(h('option',{value:String(i)},w.name));});workerSelect.onchange=function(){if(SCREEN_POLL){clearInterval(SCREEN_POLL);SCREEN_POLL=null;}var w=d.workers[+workerSelect.value];recovery.innerHTML='';actions.innerHTML='';if(!w){status.textContent='No Workers returned.';return;}if(w.url){preview.src=w.url;url.textContent=w.url;var chosen=connection;async function checkHealth(){try{var result=await api('operations/worker-health?connection='+chosen.id+'&worker='+encodeURIComponent(w.name));health.textContent='Public response: HTTP '+result.status+' · '+lagosTime(result.checked_at)+' · '+result.notice;}catch(e){health.textContent='Live check unavailable: '+e.message;}}checkHealth();SCREEN_POLL=setInterval(checkHealth,30000);}status.textContent='Live public screen. New code stays in a proposal until you approve.';actions.appendChild(h('button',{onclick:function(){deployForm(connection);}},'Prepare Worker code change'));actions.appendChild(h('button',{onclick:function(){workerRecovery(connection,w,recovery);}},'Review rollback versions'));actions.appendChild(h('a',{class:'btn',href:'https://dash.cloudflare.com/'+connection.account_id+'/workers-and-pages',target:'_blank',rel:'noopener noreferrer'},'Open account in Cloudflare'));};workerSelect.onchange();}catch(e){status.textContent=e.message;}return;}
  preview.src=entry.url;url.textContent=entry.url;status.textContent='Public live screen. Some websites block embedding; use Open website if the screen is blank.';
 }
 select.onchange=draw;
 screen.appendChild(preview);
 var sizes=h('div');[['Phone','390px'],['Tablet','768px'],['Desktop','100%']].forEach(function(size){sizes.appendChild(h('button',{class:'sm',onclick:function(){preview.style.width=size[1];}},size[0]));});
 sizes.appendChild(h('button',{class:'sm',onclick:function(){if(screen.requestFullscreen)screen.requestFullscreen().catch(function(e){status.textContent=e.message;});}},'Full screen'));
 sizes.appendChild(h('button',{class:'sm',onclick:function(){if(preview.getAttribute('src'))preview.src=preview.getAttribute('src');}},'Refresh live screen'));
 sizes.appendChild(h('button',{class:'sm',onclick:function(){var value=preview.getAttribute('src');if(value)window.open(value,'_blank','noopener,noreferrer');}},'Open website'));
 show(nav(),h('h3',{class:'page-title'},'Website screens'),select,workerSelect,url,sizes,status,health,actions,screen,recovery,h('p',{},'Live users keep the currently deployed site while you prepare and review changes. No system can guarantee uninterrupted service. Cloudflare dashboard sign-in may still be required; saved API connections handle supported management tasks without repeated passwords.'));
 await draw();
 }catch(e){oops(e);}}

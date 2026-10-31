async function nativeImports(){try{
 var data=await api('workspace/catalog'),source=h('select',{'aria-label':'Source repository'}),project=h('select',{'aria-label':'Project to scan'}),dest=h('select',{'aria-label':'Destination site or account'}),worker=h('select',{'aria-label':'Destination Worker'}),status=h('p',{role:'status','aria-live':'polite'}),report=h('div'),preview=h('div'),scan=null,listing=null,busy=false;
 source.appendChild(h('option',{value:''},'Choose connected GitHub repository'));data.sources.forEach(function(s){source.appendChild(h('option',{value:s.id},s.label+' · '+s.repo+' · '+s.branch));});
 function reset(){scan=null;report.innerHTML='';preview.innerHTML='';stage.disabled=true;}
 source.onchange=async function(){reset();project.innerHTML='';if(!source.value)return;status.textContent='Reading repository projects…';try{listing=await api('workspace/candidates?source='+encodeURIComponent(source.value));project.appendChild(h('option',{value:''},'Choose built website or Worker'));listing.candidates.forEach(function(c,i){project.appendChild(h('option',{value:i},(c.kind==='static'?'Website · ':'Worker · ')+c.path));});status.textContent=listing.candidates.length?'Choose the exact project. Source commit '+listing.commit.slice(0,12):'No index.html or Worker entry candidates found. Connect the built output folder or use the existing ZIP importer.';}catch(e){status.textContent=e.message;}};
 project.onchange=function(){reset();dest.innerHTML='';worker.innerHTML='';if(project.value==='')return;var candidate=listing.candidates[+project.value];dest.appendChild(h('option',{value:''},'Choose exact destination'));(candidate.kind==='worker'?data.accounts:data.sites).forEach(function(c){dest.appendChild(h('option',{value:c.id||c.slug},candidate.kind==='worker'?c.label:'Managed website · '+c.name));});worker.hidden=candidate.kind!=='worker';};
 dest.onchange=async function(){preview.innerHTML='';if(project.value===''||listing.candidates[+project.value].kind!=='worker'||!dest.value)return;worker.innerHTML='';status.textContent='Reading Workers on selected account…';try{var result=await api('workspace/workers?connection='+encodeURIComponent(dest.value));result.workers.forEach(function(w){worker.appendChild(h('option',{value:w.name},w.name));});status.textContent='Choose the exact existing Worker. Its bindings and secrets will be retained.';}catch(e){status.textContent=e.message;}};
 var scanButton=h('button',{onclick:async function(){if(busy||!source.value||project.value==='')return;busy=true;reset();source.disabled=true;project.disabled=true;scanButton.disabled=true;status.textContent='Downloading and verifying the complete selected project…';try{var c=listing.candidates[+project.value];scan=await api('workspace/scan','POST',{source:+source.value,kind:c.kind,directory:c.directory,entry:c.path});report.appendChild(h('div',{},h('h4',{},'Scan passed · '+scan.files.length+' files'),h('p',{},scan.repo+' · commit '+scan.commit.slice(0,12)),h('p',{},scan.notice)));scan.checks.forEach(function(t){report.appendChild(h('p',{class:'tag'},'Checked: '+t));});scan.files.forEach(function(f){report.appendChild(h('p',{class:'tag'},f.path+' · '+f.size+' bytes'));});if(scan.omitted.length)report.appendChild(h('p',{},'Non-runtime metadata omitted: '+scan.omitted.join(', ')));stage.disabled=false;status.textContent='Choose the destination, then prepare a preview/review. No live website has changed.';}catch(e){status.textContent=e.message;}finally{busy=false;source.disabled=false;project.disabled=false;scanButton.disabled=false;}}},'Scan selected project');
 var stage=h('button',{disabled:true,onclick:async function(){if(busy||!scan||!dest.value)return;busy=true;stage.disabled=true;try{var result=await api('workspace/stage','POST',{scan:scan.id,site:scan.kind==='static'?dest.value:undefined,connection:scan.kind==='worker'?+dest.value:undefined,worker:worker.value});preview.innerHTML='';if(scan.kind==='static'){var link=await api('proposals/'+result.proposal_id+'/preview-link');preview.appendChild(h('section',{},h('h4',{},'Live isolated website preview'),h('iframe',{title:'Imported website live preview',class:'fr',sandbox:'allow-scripts allow-forms',src:link.url+'index.html'})));}else preview.appendChild(h('p',{},'Worker code review is ready. This server cannot execute an imported backend as a frontend preview. Review its complete code and target before deployment.'));var decision=h('div',{class:'card'},h('button',{onclick:function(){openP(result.proposal_id,decision);}},'Review and approve'),h('button',{class:'bad',onclick:async function(){try{await api('proposals/'+result.proposal_id+'/decide','POST',{decision:'reject',comment:'Declined in source importer'});decision.textContent='Declined. Nothing deployed.';}catch(e){status.textContent=e.message;}}},'Decline'));preview.appendChild(decision);status.textContent='Ready. Review and decide here; nothing is live until approved.';}catch(e){status.textContent=e.message;}finally{busy=false;stage.disabled=!scan;}}},'Prepare live preview / code review');
 show(nav(),h('main',{class:'card'},h('h3',{},'Import, scan and preview'),data.sources.length?null:h('section',{class:'card'},h('p',{},'No GitHub repository is connected to this Control Room yet. Your ChatGPT GitHub connection is separate. ZIP uploads below do not require GitHub.'),h('button',{onclick:github},'Connect a GitHub repository')),h('p',{},'Use connected repositories without a dashboard sign-in for each task. Select a complete built website or bundled Worker. Multi-file backend projects require a build; files are never silently deployed as a partial application.'),h('label',{},'1. Source repository'),source,h('label',{},'2. Exact project'),project,scanButton,report,h('label',{},'3. Destination'),dest,worker,h('p',{class:'tag'},'Websites use their existing managed content hosting. Bundled Workers target the exact selected Cloudflare account and Worker. This does not move databases or credentials.'),stage,status,preview,h('h4',{},'Upload from phone or computer'),h('p',{},'Use a built website ZIP up to 25 MB. Choose its managed site below.'),...data.sites.map(function(s){return h('div',{class:'card'},h('h4',{},s.name),packageForm(s));})));
 }catch(e){oops(e);}}
var PROVIDER_SEEN={},PROVIDER_POLL=null;
async function verificationPanel(mount){if(!own())return;try{var data=await api('verification');mount.innerHTML='';data.requests.forEach(function(r){var status=h('p',{role:'status'}),card=h('section',{class:'card'},h('h4',{},'Provider verification needed'),h('p',{},r.provider+' · '+r.reason),h('p',{class:'tag'},'Enter your email, password or verification code only on the official provider page. Human verification is not an email challenge and cannot be completed by this control room.'),h('a',{class:'btn',href:r.url,target:'_blank',rel:'noopener noreferrer',onclick:function(){status.textContent='When you return, the saved API connection will be checked. Dashboard sign-in does not grant token permissions.';window.addEventListener('focus',async function(){try{var result=await api('verification/resolve','POST',{id:r.id,action:'recheck'});status.textContent=result.notice;}catch(e){status.textContent=e.message+' Open Cloudflare connections to update this account token if its permissions are insufficient.';}},{once:true});}},'Open official '+r.provider+' verification'));
 if(!PROVIDER_SEEN[r.id]&&document.querySelector('[aria-label="AI chat"]')){PROVIDER_SEEN[r.id]=true;var dialog=h('dialog',{},h('h3',{},'Provider verification requested'),h('p',{},r.reason),h('a',{class:'btn',href:r.url,target:'_blank',rel:'noopener noreferrer'},'Verify directly with '+r.provider),h('p',{},'Do not enter provider passwords or email codes in this chat. This request does not grant AI permissions.'));dialog.appendChild(h('button',{class:'sm',onclick:function(){dialog.close();dialog.remove();}},'Back to chat'));dialog.addEventListener('cancel',function(e){e.preventDefault();dialog.close();dialog.remove();});document.body.appendChild(dialog);if(typeof dialog.showModal==='function')dialog.showModal();}
 ['recheck','decline'].forEach(function(action){card.appendChild(h('button',{class:action==='decline'?'bad':'sm',onclick:async function(){this.disabled=true;try{var result=await api('verification/resolve','POST',{id:r.id,action:action});card.innerHTML='';card.appendChild(h('p',{},result.notice));}catch(e){status.textContent=e.message;}finally{this.disabled=false;}}},action==='decline'?'Decline':'Recheck saved connection'));});card.appendChild(status);mount.appendChild(card);});}catch(e){mount.textContent='Verification status could not be loaded: '+e.message;}}
async function verificationCenter(){var mount=h('div');show(nav(),h('h3',{},'Provider verification'),h('p',{},'Routine operations use your saved API connections. Provider sign-ins, CAPTCHA and email challenges must be completed on the provider’s own page. Completing this panel never grants AI access automatically.'),mount,h('button',{class:'sm',onclick:function(){verificationPanel(mount);}},'Refresh'),h('button',{class:'sm',onclick:nativeImports},'Import from repository or phone'));await verificationPanel(mount);}

var AI_APPROVAL_PROOF=null,AI_APPROVAL_EXPIRES=0;
async function smartAIApproval(){
 if(AI_APPROVAL_PROOF&&Date.now()+15000<AI_APPROVAL_EXPIRES)return AI_APPROVAL_PROOF;
 AI_APPROVAL_PROOF=null;AI_APPROVAL_EXPIRES=0;
 var proof=null;
 if(typeof verifyOwnerDevice==='function'&&window.isSecureContext&&navigator.credentials){
  try{proof=await verifyOwnerDevice();}catch(e){
   if(e.name==='NotAllowedError')return null;
   // If no passkey is registered, the owner can use their password.
  }
 }
 if(!proof)proof=await passwordDialog('Verify once to authorize AI accounts for 10 minutes');
 if(!proof)return null;
 var session=await api('approval-session','POST',{password:proof});
 if(!session.proof||!(session.expires>Date.now()))throw Error('Owner verification was not confirmed');
 AI_APPROVAL_PROOF=session.proof;AI_APPROVAL_EXPIRES=session.expires;
 return AI_APPROVAL_PROOF;
}
async function endSmartAIApproval(){
 var proof=AI_APPROVAL_PROOF;
 AI_APPROVAL_PROOF=null;AI_APPROVAL_EXPIRES=0;
 if(!proof)return {ok:true,ended:true,message:'No quick-approval session is active in this tab.'};
 try{return await api('approval-session/end','POST',{proof:proof});}
 catch(e){throw Error('Local approval token cleared. Server revocation was not confirmed: '+e.message);}
}
async function accessRequestCenter(){try{
 var data=await api('ai/access-requests'),box=h('main',{class:'card'}),target=new URLSearchParams(location.search).get('review_access');
 show(nav(),h('h3',{},'AI account authorization'),h('p',{},'Verify your identity once for a short approval session. Every requested account still needs your explicit approval; AIs can never approve themselves.'),box);
 var requests=data.requests.filter(function(r){return !target||r.id===target;});
 if(!requests.length)box.appendChild(h('p',{role:'status'},'No active request. It may have expired or already been decided.'));
 requests.forEach(function(r){
  var all=h('input',{type:'checkbox'}),status=h('p',{role:'status','aria-live':'polite'}),card=h('section',{class:'card'},h('h4',{},r.reason),h('p',{},r.accounts.map(function(c){return c.label;}).join(', ')+' · '+r.hours+' hours'),h('label',{},all,document.createTextNode('Apply this access to all enabled staff AI connections')),h('p',{},'This authorizes preparation and Worker status checks for the listed accounts. Every production release still needs separate review.'));
  ['approve','decline'].forEach(function(decision){
   card.appendChild(h('button',{class:decision==='decline'?'bad':'',onclick:async function(){
    this.disabled=true;
    try{
     var proof=decision==='approve'?await smartAIApproval():null;
     if(decision==='approve'&&!proof){status.textContent='Verification cancelled. No AI permissions were granted.';return;}
     var result=await api('ai/access-requests/decide','POST',{id:r.id,decision:decision,approval_proof:proof,all_agents:all.checked});
     card.innerHTML='';
     var success=h('p',{role:'status','aria-live':'polite',style:'font-weight:700;color:'+ (decision==='approve'?'#0a7543':'#8a3a2d')},result.message|| (decision==='approve'?'AI access successfully authorized.':'AI access declined.'));
     card.appendChild(success);
     if(decision==='approve'){
      card.appendChild(h('p',{},'Approved accounts: '+(result.accounts||r.accounts).map(function(c){return c.label;}).join(', ')));
      if(result.expires_at)card.appendChild(h('p',{},'Access expires: '+lagosTime(result.expires_at)));
      card.appendChild(h('p',{},'Return to your AI conversation. Production publication still requires human approval.'));
     }
    }catch(e){
     if(/approval session expired|session expired|session.*revoked/i.test(e.message||'')){AI_APPROVAL_PROOF=null;AI_APPROVAL_EXPIRES=0;}
     status.textContent=e.message;
    }finally{this.disabled=false;}
   }},decision==='approve'?'Approve access':'Decline'));
  });
  card.appendChild(status);box.appendChild(card);
 });
}catch(e){oops(e);}}


async function studioTaskBoard(){
 try{
  var data=await Promise.all([api('agents'),api('connections'),api('studio/tasks')]);
  var agents=data[0].agents.filter(function(a){return a.status==='active'&&a.can_read&&a.can_propose&&!a.site_id&&!a.owner_id;});
  var accounts=data[1].connections,chosen=new Set();
  var account=h('select',{'aria-label':'Target Cloudflare account'}),worker=h('input',{'aria-label':'Worker name',placeholder:'Existing Worker name'}),
   goal=h('textarea',{'aria-label':'Assignment instructions',rows:4,placeholder:'Describe the change the AI should prepare'}),
   selections=h('div'),status=h('p',{role:'status','aria-live':'polite'}),tasks=h('div');
  accounts.forEach(function(c){account.appendChild(h('option',{value:c.id},c.label));});
  agents.forEach(function(a){
   var check=h('input',{type:'checkbox','aria-label':'Assign '+a.name});
   check.onchange=function(){if(check.checked)chosen.add(a.id);else chosen.delete(a.id);};
   selections.appendChild(h('label',{class:'card'},check,document.createTextNode(' '+a.name)));
  });
  async function refresh(page){
   page=page||0;
   var d=await api('studio/tasks?page='+page);
   if(page===0)tasks.innerHTML='';
   d.tasks.forEach(function(t){
    var card=h('section',{class:'card'},h('b',{},t.agent_name+' · '+t.worker),h('p',{},t.instruction),h('p',{role:'status'},t.status+' · '+lagosTime(t.updated_at)));
    if(t.progress)card.appendChild(h('p',{},'Progress: '+t.progress));
    if(t.proposal_id)card.appendChild(h('button',{onclick:function(){openP(t.proposal_id);}},'Review proposal #'+t.proposal_id));
    if(t.status==='assigned')card.appendChild(h('button',{class:'bad',onclick:async function(){try{await api('studio/tasks/'+t.id+'/cancel','POST',{});await refresh();}catch(e){status.textContent=e.message;}}},'Cancel task'));
    tasks.appendChild(card);
   });
   if(page===0&&!d.tasks.length)tasks.appendChild(h('p',{},'No AI assignments yet.'));
   if(d.next_page!==null&&d.next_page!==undefined){
    var more=h('button',{class:'sm',onclick:async function(){this.disabled=true;this.remove();try{await refresh(d.next_page);}catch(e){status.textContent=e.message;}}},'Load older AI assignments');
    tasks.appendChild(more);
   }
  }
  var submit=h('button',{onclick:async function(){
   this.disabled=true;try{
    var response=await api('studio/tasks','POST',{connection:+account.value,worker:worker.value.trim(),instruction:goal.value.trim(),agents:Array.from(chosen)});
    status.textContent='Assignments saved successfully: '+response.assigned+' AI tasks. Each AI can inspect its own assignment; no production release occurred.';
    await refresh();
   }catch(e){status.textContent=e.message;}finally{this.disabled=false;}
  }},'Assign selected AIs');
  show(nav(),h('h3',{},'Parallel AI Worker Studio'),h('p',{},'Give multiple AIs separate assignments at the same time. Submit more batches as needed. Each AI submits its completed code to Waiting Room; only the owner may approve a release.'),h('section',{class:'card'},h('label',{},'Cloudflare account'),account,h('label',{},'Worker to repair'),worker,h('label',{},'Task instructions'),goal,h('h4',{},'Choose assistants'),selections,submit,status),h('h3',{},'Assignments'),tasks);
  await refresh();
 }catch(e){oops(e);}
}

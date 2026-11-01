// Account 4 unified source -> scan -> preview -> reviewed installation workflow.
// Keep other management panels on their own pages. This is the single import experience.
async function universalImportHub(){
 try{
  var catalog=await api('workspace/catalog'),connections=catalog.sources||[],sites=catalog.sites||[],accounts=catalog.accounts||[];
  var mount=h('main',{class:'card'}),status=h('p',{role:'status','aria-live':'polite'}),details=h('div'),preview=h('div'),results=h('div'),fileTarget=h('div');
  var app=h('select',{'aria-label':'Choose application'}),provider=h('select',{'aria-label':'Import source'}),identity=h('select',{'aria-label':'Authorized GitHub identity'}),repos=h('select',{'aria-label':'Choose GitHub repository'}),project=h('select',{'aria-label':'Project detected in repository'}),destination=h('select',{'aria-label':'Destination Cloudflare account or managed website'}),targetWorker=h('select',{'aria-label':'Target existing Cloudflare Worker'}),site=h('select',{'aria-label':'Managed site for ZIP upload'});
  var query=h('input',{placeholder:'Filter repositories by name','aria-label':'Search repositories'}),refresh=h('button',{class:'sm'},'Find repositories'),connect=h('button',{class:'sm'},'Connect selected repository'),scanButton=h('button',{disabled:true},'Scan full project'),stageButton=h('button',{disabled:true},'Prepare preview and review'),buildButton=h('button',{disabled:true},'Register complete application build');
  var repoList=[],chosen=null,listing=null,scan=null,sourceId='',loading=false,loadedIdentity='',page=0,hasMore=false;
  function option(select,value,label){select.appendChild(h('option',{value:String(value)},label));}
  function empty(select,label){select.innerHTML='';option(select,'',label);}
  function note(message){status.textContent=message;}
  function setBusy(value){loading=value;refresh.disabled=value;connect.disabled=value;scanButton.disabled=value||!listing||project.value===''||listing.candidates[+project.value]?.kind==='application';stageButton.disabled=value||!scan;buildButton.disabled=value||!listing||project.value===''||listing.candidates[+project.value]?.kind!=='application';}
  function category(repo){
   var name=String(repo||'').toLowerCase(),which=app.value;
   if(which==='bible')return /bible|scripture|daily.?manna|devotion/.test(name);
   if(which==='community')return /community|social|network|gcc/.test(name);
   if(which==='website')return /website|heavenly|portal|control|cms/.test(name);
   return true;
  }
  function displayRepos(){
   var keep=repos.value,term=query.value.trim().toLowerCase();
   empty(repos,'Choose a repository');
   repoList.filter(function(r){return category(r.repo)&&(!term||r.repo.toLowerCase().includes(term));}).sort(function(a,b){return a.repo.localeCompare(b.repo);}).forEach(function(r){
    option(repos,r.repo,r.repo+(r.connected?' · Linked':' · Available to link')+(r.private?' · Private':''));
   });if(Array.from(repos.options).some(function(o){return o.value===keep;}))repos.value=keep;
  }
  function resetProject(){
   sourceId='';listing=null;chosen=null;scan=null;empty(project,'Select repository first');empty(destination,'Choose destination after selecting project');empty(targetWorker,'Choose Worker');details.innerHTML='';preview.innerHTML='';scanButton.disabled=true;stageButton.disabled=true;buildButton.disabled=true;
  }
  function connectedId(name){var match=connections.find(function(c){return c.repo.toLowerCase()===String(name).toLowerCase();});return match?String(match.id):'';}
  function mergeRepos(items){
   (items||[]).forEach(function(r){var name=r.repo||r.full_name;if(!name||!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(name))return;
    var existing=repoList.find(function(x){return x.repo.toLowerCase()===name.toLowerCase();});
    if(existing){existing.connected=existing.connected||!!connectedId(name);if(r.default_branch)existing.branch=r.default_branch;}
    else repoList.push({repo:name,branch:r.default_branch||r.branch||'main',private:!!r.private,connected:!!connectedId(name)});
   });displayRepos();
  }
  function chooseDestinations(){
   empty(destination,'Choose exact target account or site');empty(targetWorker,'Choose Worker');stageButton.disabled=true;scan=null;preview.innerHTML='';
   if(!listing||project.value==='')return;
   chosen=listing.candidates[+project.value];if(!chosen)return;
   if(chosen.kind==='static')sites.forEach(function(s){option(destination,'site:'+s.slug,'Managed website · '+s.name);});
   else accounts.forEach(function(a){option(destination,'account:'+a.id,'Cloudflare account · '+a.label);});
   buildButton.disabled=chosen.kind!=='application';
   note(chosen.kind==='application'?'Complete source application selected: reviewed build required before installation.':'Project selected. Scan all required project files, then choose the destination.');
  }
  async function ensureConnected(){
   if(!repos.value)throw Error('Choose an app repository first.');
   var id=connectedId(repos.value);if(id){sourceId=id;return id;}
   if(!identity.value)throw Error('Choose an authorized GitHub connection, or connect an identity first.');
   var selected=repoList.find(function(r){return r.repo===repos.value;});if(!selected)throw Error('Select a discovered repository.');
   var result=await api('workspace/github/reuse','POST',{source:+identity.value,repo:selected.repo,label:selected.repo+' ('+selected.branch+')',branch:selected.branch});
   connections.push(result);sourceId=String(result.id);selected.connected=true;displayRepos();repos.value=selected.repo;
   note('Repository verified and linked using your existing authorized GitHub identity. No deployment has occurred.');return sourceId;
  }
  async function openRepo(){
   if(!repos.value){resetProject();return;}
   setBusy(true);try{
    resetProject();var selected=repoList.find(function(r){return r.repo===repos.value;});if(!selected)throw Error('Repository unavailable');
    if(!selected.connected){note('This repository is discoverable. Choose “Connect selected repository” to authorize it for scanning.');return;}
    var id=await ensureConnected();listing=await api('workspace/candidates?source='+encodeURIComponent(id));
    empty(project,'Choose the detected project');
    (listing.candidates||[]).forEach(function(c,i){option(project,i,(c.kind==='application'?'Full application · build needed · ':c.kind==='worker'?'Cloudflare Worker · ':'Website · ')+c.path);});
    details.textContent='Source: '+selected.repo+' · Commit '+listing.commit.slice(0,12)+' · '+(listing.candidates||[]).length+' installable entry points found.';
    note(listing.candidates.length?'Choose the complete project to import.':'No installable project entry detected. A complete build/manifest may be required; no partial import will be sent.');
   }catch(e){note(e.message);}finally{setBusy(false);}
  }
  async function loadRepos(next){
   if(!identity.value)throw Error('Connect or select a GitHub identity first.');
   if(next&&(!hasMore||page>=20))return;
   var selected=identity.value;if(!next){page=0;hasMore=false;loadedIdentity=selected;repoList=[];mergeRepos(connections.map(function(c){return {repo:c.repo,branch:c.branch};}));}
   if(loadedIdentity!==selected)throw Error('Identity changed; search again.');
   var requested=page+1,response=await api('workspace/github/discover?source='+encodeURIComponent(selected)+'&page='+requested);
   if(loadedIdentity!==identity.value)throw Error('Identity changed. Search again.');
   page=requested;hasMore=response.hasMore&&page<20;mergeRepos(response.repositories);
   note('Found '+repoList.length+' accessible repositories. Choose Bible, Community or another app. Repository permissions remain controlled by GitHub.');
  }
  app.onchange=function(){displayRepos();resetProject();};
  query.oninput=displayRepos;
  identity.onchange=function(){repoList=[];page=0;hasMore=false;loadedIdentity='';mergeRepos(connections.map(function(c){return {repo:c.repo,branch:c.branch};}));resetProject();};
  repos.onchange=openRepo;
  connect.onclick=async function(){setBusy(true);try{await ensureConnected();await openRepo();}catch(e){note(e.message);}finally{setBusy(false);}};
  refresh.onclick=async function(){setBusy(true);try{await loadRepos(false);}catch(e){note(e.message);}finally{setBusy(false);}};
  var more=h('button',{class:'sm',onclick:async function(){this.disabled=true;try{await loadRepos(true);}catch(e){note(e.message);}finally{this.disabled=false;}}},'More accessible repositories');
  project.onchange=chooseDestinations;
  destination.onchange=async function(){
   empty(targetWorker,'Choose existing Worker');if(!destination.value||!chosen||chosen.kind==='static')return;
   setBusy(true);try{
    var id=destination.value.replace(/^account:/,''),r=await api('workspace/workers?connection='+encodeURIComponent(id));
    (r.workers||[]).forEach(function(w){option(targetWorker,w.name,w.name);});
    note('Select the exact existing Worker. The current binding and secret configuration must be preserved.');
   }catch(e){note(e.message);}finally{setBusy(false);}
  };
  scanButton.onclick=async function(){setBusy(true);try{
   if(!sourceId||!listing||project.value==='')throw Error('Select the complete repository project first.');
   var c=listing.candidates[+project.value];if(c.kind==='application')throw Error('Complete source applications require a reviewed build, not a partial static-file scan.');
   scan=await api('workspace/scan','POST',{source:+sourceId,kind:c.kind,directory:c.directory,entry:c.path});
   details.innerHTML='';details.appendChild(h('h4',{},'Scan completed · '+scan.files.length+' verified files'));
   details.appendChild(h('p',{},scan.repo+' @ '+scan.commit.slice(0,12)));
   (scan.checks||[]).forEach(function(v){details.appendChild(h('p',{class:'tag'},'✓ '+v));});
   details.appendChild(h('p',{},scan.notice||'Ready for review.'));
   if(scan.omitted&&scan.omitted.length)details.appendChild(h('p',{},'Omitted non-runtime metadata: '+scan.omitted.join(', ')));
   stageButton.disabled=false;note('Scan finished. Select the destination and prepare the isolated preview. Production is unchanged.');
  }catch(e){note(e.message);}finally{setBusy(false);if(scan)stageButton.disabled=false;}};
  stageButton.onclick=async function(){if(!scan)return;setBusy(true);try{
   if(!chosen||!destination.value)throw Error('Choose destination account or managed website.');
   if(listing.commit!==scan.commit)throw Error('Repository revision changed; rescan required.');
   if(chosen.kind==='worker'&&!targetWorker.value)throw Error('Choose an existing destination Worker.');
   var target=destination.options[destination.selectedIndex].textContent;
   if(!confirm('Prepare verified project for review?\n'+scan.repo+'\nCommit '+scan.commit+'\nDestination: '+target+'\nNo production deployment without owner approval.'))return;
   var input={scan:scan.id,site:chosen.kind==='static'?destination.value.replace(/^site:/,''):undefined,connection:chosen.kind==='worker'?+destination.value.replace(/^account:/,''):undefined,worker:chosen.kind==='worker'?targetWorker.value:undefined};
   var proposal=await api('workspace/stage','POST',input);preview.innerHTML='';
   if(chosen.kind==='static'){
    var link=await api('proposals/'+proposal.proposal_id+'/preview-link');
    preview.appendChild(h('h4',{},'Isolated website preview'));
    preview.appendChild(h('iframe',{title:'Verified website preview',class:'fr',sandbox:'allow-scripts allow-forms',src:link.url+'index.html'}));
   }else preview.appendChild(h('p',{},'Worker source prepared for code review. Backend execution is not represented as a visual website preview.'));
   preview.appendChild(h('button',{onclick:function(){openP(proposal.proposal_id,preview);}},'Review staged installation'));
   note('Import staged in Waiting Room. No production changes made.');
  }catch(e){note(e.message);}finally{setBusy(false);if(scan)stageButton.disabled=false;}};
  buildButton.onclick=async function(){setBusy(true);try{
   if(!chosen||chosen.kind!=='application'||!sourceId||!destination.value||!targetWorker.value)throw Error('Select application, Cloudflare destination and existing Worker.');
   if(!confirm('Register reviewed full-application build for '+repos.value+'? No production deployment.'))return;
   var result=await api('workspace/application-build','POST',{source:+sourceId,directory:chosen.directory,connection:+destination.value.replace(/^account:/,''),worker:targetWorker.value});
   note('Complete application build registered: '+result.id+'. Review build requirements in Waiting Room. Nothing has deployed.');
  }catch(e){note(e.message);}finally{setBusy(false);}};
  provider.onchange=function(){
   githubSection.hidden=provider.value!=='github';localSection.hidden=provider.value==='github';
   note(provider.value==='drive'?'Google Drive direct connector is not configured in this Control Room. Download the complete ZIP from Drive and choose it below.':'Choose an app, scan its complete files and stage an owner-reviewed import.');
  };
  var githubSection=h('section',{class:'card'},h('h3',{},'1 · Choose app and GitHub repository'),h('p',{},'One authorized GitHub identity can access every repository permitted by its GitHub permissions. No separate token per Cloudflare account.'));
  var appOptions=[['all','All applications'],['bible','Bible App / Daily Manna'],['community','Global Christian Community'],['website','Heavenly Key websites and Control Room']];
  appOptions.forEach(function(v){option(app,v[0],v[1]);});option(identity,'','Select authorized GitHub identity');connections.forEach(function(c){option(identity,c.id,c.label+' · '+c.repo);});
  githubSection.appendChild(h('label',{},'Application',app));
  githubSection.appendChild(h('label',{},'Central GitHub authorization',identity));
  githubSection.appendChild(h('button',{class:'sm',onclick:github},'Connect / reauthenticate GitHub'));
  githubSection.appendChild(h('div',{},refresh,more));
  githubSection.appendChild(h('label',{},'Search',query));empty(repos,'Choose a repository');githubSection.appendChild(repos);githubSection.appendChild(connect);
  githubSection.appendChild(h('label',{},'Detected app / project',project));
  githubSection.appendChild(h('h3',{},'2 · Scan and verify complete project'));githubSection.appendChild(scanButton);
  githubSection.appendChild(h('h3',{},'3 · Destination and preview'));githubSection.appendChild(destination);githubSection.appendChild(targetWorker);githubSection.appendChild(stageButton);githubSection.appendChild(buildButton);
  var localSection=h('section',{class:'card'},h('h3',{},'Import a complete ZIP from phone, computer or Google Drive'),h('p',{},'One upload form. Choose your saved ZIP, then the managed website where the reviewed upload should be staged.'));
  empty(site,'Choose managed website');sites.forEach(function(s){option(site,s.slug,s.name);});
  site.onchange=function(){fileTarget.innerHTML='';var entry=sites.find(function(s){return s.slug===site.value;});if(entry)fileTarget.appendChild(packageForm(entry));};
  localSection.appendChild(h('label',{},'Target managed website',site));localSection.appendChild(fileTarget);
  option(provider,'github','GitHub — connect once, browse all authorized repositories');
  option(provider,'device','Phone or computer — upload a complete website ZIP');
  option(provider,'drive','Google Drive — use an exported ZIP (direct connector pending)');
  mount.appendChild(h('h2',{},'Universal App Import'));
  mount.appendChild(h('p',{},'Choose an app → Locate full source → Scan → Preview → Review → Install. Your existing websites, databases and secrets remain protected.'));
  mount.appendChild(h('label',{},'Import from',provider));mount.appendChild(githubSection);mount.appendChild(localSection);
  mount.appendChild(h('h3',{},'Scan results'));mount.appendChild(details);mount.appendChild(h('h3',{},'Preview and approval'));mount.appendChild(preview);mount.appendChild(status);
  show(nav(),mount);localSection.hidden=true;
  mergeRepos(connections.map(function(c){return {repo:c.repo,branch:c.branch};}));
  note(connections.length?'Choose your existing GitHub authorization and click Find repositories.':'Connect a GitHub identity first, then discover all repositories authorized by that connection.');
 }catch(e){oops(e);}
}

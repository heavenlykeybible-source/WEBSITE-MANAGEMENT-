async function workerDemoCard(id,mount){
 var note=h('p',{role:'status'},'Loading website demo…');mount.appendChild(note);
 try{
  var demo=await api('proposals/'+id+'/demo'),pages=demo.files.filter(function(p){return /\.html?$/i.test(p);});
  var entry=pages.indexOf('/index.html')>=0?'index.html':(pages[0]||'/index.html').replace(/^\/+/,'');
  var view=h('iframe',{class:'fr',title:'Interactive proposed website demo',sandbox:'allow-scripts allow-forms allow-downloads',allow:'fullscreen',src:demo.url+entry,style:'display:block;width:100%;max-width:100%;height:70vh;min-height:360px;margin:12px auto;border:1px solid #ccd6e8;border-radius:12px;background:white'});
  var address=h('select',{'aria-label':'Demo page',style:'width:auto;max-width:100%;min-width:0'});
  pages.forEach(function(p){address.appendChild(h('option',{value:p.replace(/^\/+/,'')},p));});address.value=entry;
  var toolbar=h('div',{style:'display:flex;flex-wrap:wrap;align-items:center;gap:8px'},
   h('button',{class:'sm',onclick:function(){view.contentWindow.postMessage({type:'hk-demo-back'},'*');}},'Back'),
   h('button',{class:'sm',onclick:function(){view.src=demo.url+entry;address.value=entry;}},'Home'),address,
   h('button',{class:'sm',onclick:function(){if(address.value)view.src=demo.url+address.value;}},'Open page'));
  var sizes=h('div',{style:'display:flex;flex-wrap:wrap;gap:8px'});
  [['Phone','390px'],['Tablet','820px'],['Desktop','100%']].forEach(function(size){sizes.appendChild(h('button',{class:'sm',onclick:function(){view.style.width=size[1];}},size[0]));});
  sizes.appendChild(h('button',{class:'sm',onclick:function(){if(view.requestFullscreen)view.requestFullscreen().catch(function(){note.textContent='Full screen is unavailable in this browser. Use Desktop view.';});}},'Full screen'));
  note.textContent='Browse the demo and follow its links before approving.';
  mount.appendChild(h('section',{class:'card',style:'min-width:0;max-width:100%;overflow:hidden'},h('h4',{},'Proposed website demo'),toolbar,sizes,view,h('details',{},h('summary',{},'What can I test?'),h('p',{},demo.notice))));
 }catch(e){
  note.textContent='This release has no usable website demo. Ask for a complete preview package before approving.';
  mount.appendChild(h('details',{},h('summary',{},'Preview details'),h('p',{},e.message)));
 }
}
async function workerDiagnosticCard(connection,worker,mount){mount.textContent='Checking hosting configuration and live response…';try{var d=await api('connections/'+connection.id+'/worker-diagnostics?worker='+encodeURIComponent(worker));mount.innerHTML='';mount.appendChild(h('h4',{},d.account+' · '+d.name));d.checks.forEach(function(c){mount.appendChild(h('p',{},c.path+': '+(c.ok?JSON.stringify(c.configuration||c.bindings):c.error)));});if(d.url)mount.appendChild(h('a',{href:d.url,target:'_blank',rel:'noopener noreferrer'},'Open verified Worker address'));mount.appendChild(h('p',{},d.live_status?'Public response: HTTP '+d.live_status:d.live_error||'No usable Workers.dev address was returned. Hosting configuration must be corrected before this is a live release.'));}catch(e){mount.textContent=e.message;}}

async function workerSourceCard(c,mount){var name=prompt('Exact existing Worker name to inspect');if(!name)return;mount.textContent='Reading existing source…';try{var r=await api('connections/'+c.id+'/worker-source?worker='+encodeURIComponent(name));mount.innerHTML='';r.modules.forEach(function(file){mount.appendChild(h('h4',{},file.path));mount.appendChild(h('pre',{'data-worker-source':file.path},file.content));});}catch(e){mount.textContent=e.message;}}

async function initializeAccount9Card(mount){var name=h('input',{value:'heavenlykeyvideoeditor','aria-label':'Account 9 public Workers.dev name'}),status=h('p',{role:'status'});mount.innerHTML='';mount.appendChild(h('div',{class:'card'},h('h4',{},'Activate Account 9 public address'),h('p',{},'Uses the saved Account 9 connection to initialize its missing public Workers.dev address. Existing addresses are preserved.'),name,h('button',{onclick:async function(){this.disabled=true;try{var r=await api('operations/account9-address','POST',{subdomain:name.value});status.textContent='Address initialized: '+r.url;mount.appendChild(h('a',{href:r.url,target:'_blank',rel:'noopener noreferrer'},'Open Account 9'));}catch(e){status.textContent=e.message;}finally{this.disabled=false;}}},'Activate public address'),status));}

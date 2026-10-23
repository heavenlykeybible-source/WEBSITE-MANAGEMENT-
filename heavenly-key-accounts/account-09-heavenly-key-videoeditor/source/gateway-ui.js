(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const panel=document.createElement('section');panel.className='panel';panel.style.marginTop='16px';
  panel.innerHTML='<h2>Multi-AI Gateway</h2><p class="muted">Select a saved AI connection. Keys are held in Cloudflare secrets, never in this browser. Each provider enforces its own limits.</p><label for="gatewayConnection">AI connection</label><select id="gatewayConnection"><option value="">Loading connections…</option></select><button type="button" id="gatewayRefresh">Refresh connections</button><label for="gatewayTask">Task</label><select id="gatewayTask"><option value="chat">General chat</option><option value="coding">Coding assistance</option><option value="script">Script writing</option><option value="titles">Titles</option><option value="description">Descriptions</option><option value="captions">Captions</option><option value="rewrite">Rewrite</option><option value="hashtags">Hashtags</option><option value="summary">Summary</option><option value="outline">Video outline</option></select><label for="gatewayPrompt">Instructions</label><textarea id="gatewayPrompt" maxlength="6000" rows="5"></textarea><button type="button" id="gatewayRun">Ask selected AI</button><label for="gatewayOutput">Response</label><textarea id="gatewayOutput" rows="9"></textarea><div class="status" id="gatewayStatus" role="status">Choose a connection.</div>';
  document.querySelector('main').append(panel);
  async function refresh(){
    try{
      const r=await fetch('/api/ai-connections',{credentials:'same-origin',headers:{'x-requested-with':'hk'}});const d=await r.json();if(!r.ok)throw Error(d.error||'Cannot load connections');
      $('gatewayConnection').replaceChildren();
      for(const c of d.filter(x=>x.enabled)){const o=document.createElement('option');o.value=c.id;o.textContent=c.name+' — '+c.provider+' ('+c.model+')';$('gatewayConnection').append(o)}
      $('gatewayStatus').textContent=d.length+' configured connection(s).';
      if(!d.length)$('gatewayStatus').textContent='No AI accounts configured. Add authorized provider keys to the Cloudflare AI_CONNECTIONS_JSON secret.';
    }catch(e){$('gatewayStatus').textContent=e.message}
  }
  $('gatewayRefresh').onclick=refresh;
  $('gatewayRun').onclick=async()=>{
    const btn=$('gatewayRun');if(!$('gatewayConnection').value)return $('gatewayStatus').textContent='Select an AI account.';
    btn.disabled=true;$('gatewayStatus').textContent='Contacting provider…';
    try{
      const r=await fetch('/api/ai-gateway',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','x-requested-with':'hk'},body:JSON.stringify({connectionId:$('gatewayConnection').value,task:$('gatewayTask').value,prompt:$('gatewayPrompt').value})});
      const d=await r.json();if(!r.ok)throw Error(d.error||'Request failed');
      $('gatewayOutput').value=d.result||'';$('gatewayStatus').textContent='Completed using '+d.provider+'.';
    }catch(e){$('gatewayStatus').textContent=e.message}finally{btn.disabled=false}
  };
  refresh();
})();

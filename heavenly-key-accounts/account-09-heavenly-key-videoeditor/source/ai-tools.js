(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const panel=document.createElement('div');
  panel.className='panel';
  panel.style.marginTop='18px';
  panel.innerHTML='<h2>AI Creative Assistant</h2><p class="muted">Cloudflare Workers AI • sign-in required • daily usage limit • availability depends on account allowance</p><label for="aitask">Choose an AI task</label><select id="aitask"><option value="script">Video / podcast script</option><option value="titles">Video titles</option><option value="description">Video description</option><option value="captions">Rewrite captions</option><option value="rewrite">Rewrite text</option><option value="hashtags">Hashtags</option><option value="summary">Summarize</option><option value="outline">Scene-by-scene outline</option></select><label for="aiprompt">Topic or text</label><textarea id="aiprompt" rows="5" maxlength="4000" placeholder="Enter a topic, draft or notes"></textarea><div class="actions"><button id="airun" class="primary" type="button">Generate with AI</button><button id="aiuse" type="button">Use as video caption</button><button id="aicopy" type="button">Copy result</button></div><label for="airesult">AI result (editable)</label><textarea id="airesult" rows="10" placeholder="Generated content will appear here"></textarea><div class="status" id="aistatus" role="status">Ready.</div>';
  document.querySelector('main').append(panel);
  $('airun').onclick=async()=>{
    const btn=$('airun'),text=$('aiprompt').value.trim();
    if(text.length<3)return $('aistatus').textContent='Enter at least 3 characters.';
    btn.disabled=true;$('aistatus').textContent='Generating…';
    try{
      const r=await fetch('/api/ai-tools',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','x-requested-with':'hk'},body:JSON.stringify({task:$('aitask').value,text})});
      const d=await r.json();if(!r.ok)throw Error(d.error||'AI request failed');
      $('airesult').value=d.result||'';$('aistatus').textContent='Generated. Review the result for accuracy before publishing.';
    }catch(e){$('aistatus').textContent=e.message}finally{btn.disabled=false}
  };
  $('aiuse').onclick=()=>{
    const text=$('airesult').value.trim();if(!text)return $('aistatus').textContent='Generate or enter a result first.';
    $('tx').value=text.slice(0,250);$('aistatus').textContent='Added text to the caption editor. Set timing and click Add Caption.';
    document.querySelector('nav button[data-p="video"]').click();
  };
  $('aicopy').onclick=async()=>{try{await navigator.clipboard.writeText($('airesult').value);$('aistatus').textContent='Copied.'}catch{$('aistatus').textContent='Select the result and copy manually.'}};
})();

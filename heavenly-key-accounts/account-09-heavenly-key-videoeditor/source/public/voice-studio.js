(() => {
  'use strict';
  const panel=document.createElement('section');
  panel.className='panel';panel.style.marginTop='16px';
  panel.innerHTML='<h2>Voice Studio</h2><p>Convert speech to text using the existing Audio Editor transcription feature, or generate speech using a configured voice.</p><label for="voiceText">Text to speech</label><textarea id="voiceText" maxlength="1500" rows="5" placeholder="Enter your script"></textarea><label><input id="voiceConsent" type="checkbox"> I own this voice or have explicit permission to use it.</label><button id="voiceGenerate" type="button">Generate voice audio</button><p id="voiceStatus" role="status"></p><audio id="voicePlayer" controls style="width:100%"></audio><a id="voiceDownload" download="heavenly-key-voice.mp3" hidden>Download generated audio</a>';
  (document.querySelector('main')||document.body).append(panel);
  const $=id=>document.getElementById(id);let url;
  $('voiceGenerate').onclick=async()=>{
    if(!$('voiceConsent').checked){$('voiceStatus').textContent='Confirm that you are authorized to use the voice.';return}
    $('voiceGenerate').disabled=true;$('voiceStatus').textContent='Generating audio…';
    try{
      const r=await fetch('/api/voice-synthesize',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','x-requested-with':'hk'},body:JSON.stringify({text:$('voiceText').value,consentConfirmed:true})});
      if(!r.ok){const d=await r.json();throw Error(d.error||'Voice synthesis failed')}
      if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(await r.blob());
      $('voicePlayer').src=url;$('voiceDownload').href=url;$('voiceDownload').hidden=false;$('voiceStatus').textContent='Voice audio generated.';
    }catch(e){$('voiceStatus').textContent=e.message}finally{$('voiceGenerate').disabled=false}
  };
})();

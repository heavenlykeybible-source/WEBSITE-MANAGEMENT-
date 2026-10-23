(()=>{'use strict';
const p=document.createElement('section');p.className='panel';p.style.marginTop='16px';
p.innerHTML='<h2>Voice Enhancement & Noise Removal</h2><p class="muted">Local browser processing. Reduces steady background noise, rumble and uneven volume; not equivalent to Adobe Enhance Speech AI.</p><label for="enhanceFile">Voice recording (audio file)</label><input id="enhanceFile" type="file" accept="audio/*"><label for="enhanceStrength">Noise reduction strength</label><input id="enhanceStrength" type="range" min="0" max="100" value="65"><label><input id="enhanceNormalize" type="checkbox" checked> Normalize speech volume</label><div class="actions"><button id="enhanceRun" type="button">Enhance voice</button><a id="enhanceDownload" hidden download="heavenly-key-enhanced.wav">Download enhanced WAV</a></div><audio id="enhancePreview" controls></audio><div id="enhanceStatus" class="status" role="status">Select a recording.</div>';
document.getElementById('audio').append(p);
let currentUrl;
function wav(data,rate){const out=new ArrayBuffer(44+data.length*2),v=new DataView(out);const put=(off,str)=>{for(let i=0;i<str.length;i++)v.setUint8(off+i,str.charCodeAt(i))};put(0,'RIFF');v.setUint32(4,out.byteLength-8,true);put(8,'WAVE');put(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);put(36,'data');v.setUint32(40,data.length*2,true);for(let i=0;i<data.length;i++)v.setInt16(44+i*2,Math.max(-32768,Math.min(32767,Math.round(data[i]*32767))),true);return new Blob([out],{type:'audio/wav'})}
document.getElementById('enhanceRun').onclick=async()=>{
const f=document.getElementById('enhanceFile').files[0],status=document.getElementById('enhanceStatus'),button=document.getElementById('enhanceRun');if(!f)return status.textContent='Choose an audio file.';
if(f.size>40*1024*1024)return status.textContent='Choose a recording under 40 MB.';
button.disabled=true;status.textContent='Decoding and enhancing locally…';
let ctx;try{
ctx=new (window.AudioContext||window.webkitAudioContext)();
const decoded=await ctx.decodeAudioData(await f.arrayBuffer());
if(decoded.duration>300)throw Error('Recording must be five minutes or shorter.');
const rate=decoded.sampleRate,frames=decoded.length,channels=decoded.numberOfChannels;
const input=new Float32Array(frames);for(let c=0;c<channels;c++){const ch=decoded.getChannelData(c);for(let i=0;i<frames;i++)input[i]+=ch[i]/channels}
const strength=Number(document.getElementById('enhanceStrength').value)/100;
const out=new Float32Array(frames);let low=0,prev=0;const hp=Math.exp(-2*Math.PI*85/rate),lpAlpha=1-Math.exp(-2*Math.PI*7800/rate);
let smooth=0,noise=0.005;const attack=1-Math.exp(-1/(rate*.012)),release=1-Math.exp(-1/(rate*.16));
for(let i=0;i<frames;i++){
const x=input[i];low=hp*(low+x-prev);prev=x;const abs=Math.abs(low);
smooth+=(abs>smooth?attack:release)*(abs-smooth);
noise=Math.min(.035,Math.max(.0002,noise+(.000002)*(smooth-noise)));
const threshold=noise*(1.8+strength*4.5);
const gate=Math.max(0.07,Math.min(1,(smooth-threshold)/(threshold*1.5)));
const gain=(1-strength)+strength*gate;
out[i]=low*gain;
}
if(document.getElementById('enhanceNormalize').checked){let peak=0;for(let i=0;i<out.length;i++)peak=Math.max(peak,Math.abs(out[i]));const scale=peak>0?Math.min(8,.92/peak):1;for(let i=0;i<out.length;i++)out[i]*=scale}
const blob=wav(out,rate);if(currentUrl)URL.revokeObjectURL(currentUrl);currentUrl=URL.createObjectURL(blob);
document.getElementById('enhancePreview').src=currentUrl;const link=document.getElementById('enhanceDownload');link.href=currentUrl;link.hidden=false;status.textContent='Enhanced audio ready. Preview and download the WAV file.';
}catch(e){status.textContent='Enhancement failed: '+e.message}finally{if(ctx)await ctx.close();button.disabled=false}
};
})();
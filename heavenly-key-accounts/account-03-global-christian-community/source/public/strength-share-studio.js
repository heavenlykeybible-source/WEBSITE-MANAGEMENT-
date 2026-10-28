(()=>{'use strict';
const $=id=>document.getElementById(id),size=$('manna-image-size'),preview=$('manna-image-preview'),status=$('manna-image-status');
if(!size||!preview||!status)return;
const BRAND='GLOBAL CHRISTIAN SOCIAL NETWORK',SITE='www.global.heavenlykey.org',CAPTION='Join the Global Christian Social Network www.global.heavenlykey.org';
let objectUrl='',renderToken=0;
function say(message){status.textContent=message}
function fitLines(ctx,value,maxWidth,fontSize,minFont,maxLines){for(let px=fontSize;px>=minFont;px-=2){ctx.font='700 '+px+'px Georgia,serif';let lines=[],line='';for(const word of value.split(/\s+/)){const next=line?line+' '+word:word;if(ctx.measureText(next).width>maxWidth&&line){lines.push(line);line=word}else line=next}if(line)lines.push(line);if(lines.length<=maxLines&&lines.every(v=>ctx.measureText(v).width<=maxWidth))return {lines,px};}throw Error('The selected scripture is too long to fit legibly. Use Copy Text to share the complete verse.')}
function draw(ctx,textValue,x,y,maxWidth,fontSize,minFont,maxLines,lineFactor=1.45){const result=fitLines(ctx,textValue,maxWidth,fontSize,minFont,maxLines);ctx.font='700 '+result.px+'px Georgia,serif';for(const line of result.lines){ctx.fillText(line,x,y);y+=Math.round(result.px*lineFactor)}return y}
async function renderImage(){
 const item=items[current],vertical=size.value==='vertical',w=1080,h=vertical?1920:1440;
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image creation is not supported on this device.');
 const bg=ctx.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#051941');bg.addColorStop(.5,'#1745a3');bg.addColorStop(1,'#7b2054');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
 ctx.strokeStyle='#ffffff22';ctx.lineWidth=3;
 for(let r=180;r<=760;r+=155){ctx.beginPath();ctx.arc(1010,120,r,0,Math.PI*2);ctx.stroke()}
 ctx.fillStyle='#f6cc63';ctx.fillRect(72,76,936,7);
 ctx.textBaseline='top';ctx.fillStyle='#f8d87b';ctx.font='700 32px system-ui,sans-serif';ctx.fillText('DAILY MANNA  •  KJV',77,128);
 ctx.fillStyle='#fff';ctx.font='800 62px system-ui,sans-serif';ctx.fillText('STRENGTH FOR TODAY',77,205);
 const titleY=vertical?380:330;
 ctx.fillStyle='#f9dc9d';const topicEnd=draw(ctx,item[0],77,titleY,915,56,38,3,1.35);
 ctx.font='700 34px system-ui,sans-serif';ctx.fillStyle='#f9d477';ctx.fillText(item[1]+' (KJV)',77,topicEnd+32);
 const verseTop=topicEnd+130,footerTop=h-315,verseBottom=footerTop-105;
 const verse=fitLines(ctx,'“'+item[2]+'”',913,vertical?53:48,26,Math.floor((verseBottom-verseTop)/39));
 ctx.fillStyle='#fff';ctx.font='700 '+verse.px+'px Georgia,serif';
 let y=verseTop;for(const line of verse.lines){ctx.fillText(line,77,y);y+=Math.round(verse.px*1.45)}
 if(y>verseBottom)throw Error('The passage does not fit the selected image size. Try the taller format.');
 ctx.fillStyle='#f6cc63';ctx.fillRect(77,footerTop,926,3);
 ctx.fillStyle='#fff';ctx.font='800 33px system-ui,sans-serif';ctx.fillText(BRAND,77,footerTop+37);
 ctx.font='700 34px system-ui,sans-serif';ctx.fillStyle='#ffe49e';ctx.fillText(SITE,77,footerTop+92);
 ctx.font='500 24px system-ui,sans-serif';ctx.fillStyle='#f6f7ff';ctx.fillText('Together we take Christ to the Nations of the World',77,footerTop+163);
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Unable to export PNG.')),'image/png'));
 return {blob,w,h};
}
async function refresh(){const token=++renderToken;try{say('Creating your scripture card…');const out=await renderImage();if(token!==renderToken)return null;if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(out.blob);preview.src=objectUrl;preview.style.aspectRatio=out.w+' / '+out.h;say('Ready · '+out.w+' × '+out.h+' PNG.');return out}catch(e){if(token===renderToken)say(e.message||'Unable to create image.');return null}}
async function getImage(){return renderImage()}
const filename=()=> 'daily-manna-'+(current+1)+'-'+size.value+'.png';
function download(blob){const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=filename();document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
$('manna-refresh-image').onclick=refresh;
$('manna-download-image').onclick=async()=>{try{const result=await getImage();download(result.blob);say('PNG downloaded, with Global Christian Social Network branding and website address.')}catch(e){say(e.message)}};
$('manna-share-image').onclick=async()=>{const button=$('manna-share-image');button.disabled=true;try{const {blob}=await getImage(),file=new File([blob],filename(),{type:'image/png'});if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({files:[file],title:'Daily Manna — Strength for Today',text:CAPTION});say('Your device sharing options opened.')}else{download(blob);try{await navigator.clipboard.writeText(CAPTION);say('Image downloaded and sharing caption copied. Upload the image to your chosen social app.')}catch{say('Image downloaded. Add this caption when posting: '+CAPTION)}}}catch(e){if(e?.name!=='AbortError')say('Image sharing unavailable: '+e.message)}finally{button.disabled=false}};
$('manna-copy-caption').onclick=async()=>{try{await navigator.clipboard.writeText(CAPTION);say('Sharing text copied.')}catch{say(CAPTION)}};
// Keep the original Download Image button aligned with the selected premium format.
$('download').onclick=async()=>{try{const {blob}=await getImage();download(blob);$('status').textContent='Branded PNG downloaded to this device.'}catch(e){$('status').textContent=e.message}};
$('external').onclick=$('manna-share-image').onclick;
size.addEventListener('change',refresh);
document.querySelectorAll('.topic').forEach(button=>button.addEventListener('click',()=>{refresh()}));
$('surprise').addEventListener('click',()=>refresh());
refresh();
window.addEventListener('pagehide',()=>{if(objectUrl)URL.revokeObjectURL(objectUrl)});
})();
(()=>{'use strict';
const $=id=>document.getElementById(id),size=$('manna-image-size'),preview=$('manna-image-preview'),status=$('manna-image-status');
if(!size||!preview||!status)return;
const BRAND='GLOBAL CHRISTIAN SOCIAL NETWORK',SITE='www.global.heavenlykey.org',CAPTION='Join the Global Christian Social Network www.global.heavenlykey.org';
const THEMES={royal:{start:'#051941',middle:'#1745a3',end:'#7b2054',gold:'#f6cc63',subtitle:'#f9dc9d',text:'#ffffff'},crimson:{start:'#350b28',middle:'#a5173a',end:'#3a173f',gold:'#ffd16d',subtitle:'#ffe1a6',text:'#ffffff'},midnight:{start:'#07152b',middle:'#243b73',end:'#09192e',gold:'#e2e6f0',subtitle:'#e2e6f0',text:'#ffffff'},ivory:{start:'#fff9e8',middle:'#f8eac9',end:'#eed8a0',gold:'#92611e',subtitle:'#855318',text:'#172b4a'}};
const themeSelect=$('manna-theme');
let objectUrl='',renderToken=0;
function say(message){status.textContent=message}
function fitLines(ctx,value,maxWidth,fontSize,minFont,maxLines){for(let px=fontSize;px>=minFont;px-=2){ctx.font='700 '+px+'px Georgia,serif';let lines=[],line='';for(const word of value.split(/\s+/)){const next=line?line+' '+word:word;if(ctx.measureText(next).width>maxWidth&&line){lines.push(line);line=word}else line=next}if(line)lines.push(line);if(lines.length<=maxLines&&lines.every(v=>ctx.measureText(v).width<=maxWidth))return {lines,px};}throw Error('The selected scripture is too long to fit legibly. Use Copy Text to share the complete verse.')}
function draw(ctx,textValue,x,y,maxWidth,fontSize,minFont,maxLines,lineFactor=1.45){const result=fitLines(ctx,textValue,maxWidth,fontSize,minFont,maxLines);ctx.font='700 '+result.px+'px Georgia,serif';for(const line of result.lines){ctx.fillText(line,x,y);y+=Math.round(result.px*lineFactor)}return y}
async function renderImage(){
 const item=items[current],vertical=size.value==='vertical',w=1080,h=vertical?1920:1440;
 const theme=(themeSelect?.value==='topic' ? window.DAILY_MANNA_THEMES?.[current] : THEMES[themeSelect?.value])||window.DAILY_MANNA_THEMES?.[current]||THEMES.royal;const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image creation is not supported on this device.');
 const bg=ctx.createLinearGradient(0,0,w,h);bg.addColorStop(0,theme.start);bg.addColorStop(.5,theme.middle);bg.addColorStop(1,theme.end);ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
 ctx.strokeStyle='#ffffff22';ctx.lineWidth=3;
 for(let r=180;r<=760;r+=155){ctx.beginPath();ctx.arc(1010,120,r,0,Math.PI*2);ctx.stroke()}
 ctx.fillStyle=theme.gold;ctx.fillRect(72,76,936,7);ctx.globalAlpha=.15;ctx.font='bold 300px Georgia,serif';ctx.textAlign='center';ctx.fillText(theme.symbol||'✦',920,Math.round(h*.43));ctx.textAlign='left';ctx.globalAlpha=1;
 ctx.textBaseline='top';ctx.fillStyle=theme.gold;ctx.font='700 32px system-ui,sans-serif';ctx.fillText('DAILY MANNA  •  KJV',77,128);
 ctx.fillStyle=theme.text;ctx.font='800 62px system-ui,sans-serif';ctx.fillText('STRENGTH FOR TODAY',77,205);
 const titleY=vertical?380:330;
 ctx.fillStyle=theme.subtitle;const topicEnd=draw(ctx,item[0],77,titleY,915,56,38,3,1.35);
 ctx.font='700 34px system-ui,sans-serif';ctx.fillStyle=theme.gold;ctx.fillText(item[1]+' (KJV)',77,topicEnd+32);
 const verseTop=topicEnd+130,footerTop=h-315,verseBottom=footerTop-105;
 const verse=fitLines(ctx,'“'+item[2]+'”',913,vertical?53:48,26,Math.floor((verseBottom-verseTop)/39));
 ctx.fillStyle=theme.text;ctx.font='700 '+verse.px+'px Georgia,serif';
 let y=verseTop;for(const line of verse.lines){ctx.fillText(line,77,y);y+=Math.round(verse.px*1.45)}
 if(y>verseBottom)throw Error('The passage does not fit the selected image size. Try the taller format.');
 ctx.fillStyle=theme.gold;ctx.fillRect(77,footerTop,926,3);
 ctx.fillStyle=theme.text;ctx.font='800 33px system-ui,sans-serif';ctx.fillText(BRAND,77,footerTop+37);
 ctx.font='700 34px system-ui,sans-serif';ctx.fillStyle=theme.subtitle;ctx.fillText(SITE,77,footerTop+92);
 ctx.font='500 24px system-ui,sans-serif';ctx.fillStyle=theme.text;ctx.fillText('Together we take Christ to the Nations of the World',77,footerTop+163);
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
// Publish using the Social Network's existing design-card/premium-text post formats.
// Image export remains local; publishing a post does not imply image upload.
$('feed').onclick=async()=>{
 if(!await authenticated())return;
 const format=$('manna-network-format').value;
 if(!confirm('Publish this Daily Manna as a '+(format==='premium_text'?'Premium Text Design':'Premium Design Card')+' on the Global Christian Social Network?'))return;
 const button=$('feed');button.disabled=true;
 const item=items[current];
 try{
  const body=item[2]+'\n\n'+item[3]+'\n\nPrayer: '+item[4]+'\n\nTogether we take Christ to the Nations of the World';
  await request('/api/posts','POST',{postFormat:format,designCategory:'faith',title:item[0],body,scripture:item[1],postType:'post',visibility:'public',design:{templateId:'card-0',alignment:'center',fontSize:'standard',size:'portrait',decoration:'subtle'}});
  $('sharing-status').textContent='Daily Manna '+(format==='premium_text'?'premium text':'design card')+' submitted. Check the feed for its publishing or review status.';
 }catch(e){$('sharing-status').textContent='Unable to publish: '+e.message}
 finally{button.disabled=false}
};
size.addEventListener('change',refresh);themeSelect?.addEventListener('change',refresh);
document.querySelectorAll('.topic').forEach(button=>button.addEventListener('click',()=>{refresh()}));
$('surprise').addEventListener('click',()=>refresh());
refresh();
window.addEventListener('pagehide',()=>{if(objectUrl)URL.revokeObjectURL(objectUrl)});
})();
/* Legacy entry point: render native release routes once. */
(() => {const grid=document.getElementById('download-options');if(!grid||grid.children.length)return;
for(const [slug,label] of [['android','Android'],['iphone','iPhone'],['ipad','iPad'],['windows','Windows'],['mac','Mac']]){
 const card=document.createElement('article');card.className='downloadcard';const title=document.createElement('strong');title.textContent=label;
 const qrLink=document.createElement('a');qrLink.href='/download/'+slug+'/?app=all-in-one';const img=document.createElement('img');img.src='/qr/'+slug+'.svg';img.alt=label+' native release QR code';img.width=148;img.height=148;qrLink.append(img);
 const link=document.createElement('a');link.className='cta';link.href=qrLink.href;link.textContent='Check native release';card.append(title,qrLink,link);grid.append(card);
}})();

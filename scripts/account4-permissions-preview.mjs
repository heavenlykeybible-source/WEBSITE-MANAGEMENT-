import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const target=new URL('../control-room-worker.js',import.meta.url);
let source=fs.readFileSync(target,'utf8');
const changes=[
  ["h('a',{class:'btn',href:r.url,target:'_blank',rel:'noopener noreferrer'},'Open official '+r.provider+' verification')",
   "h('button',{class:'sm',onclick:async function(){this.disabled=true;try{var result=await api('verification/resolve','POST',{id:r.id,action:'recheck'});status.textContent=result.notice;await verificationPanel(mount);}catch(e){status.textContent='Saved connection check failed: '+e.message;}finally{this.disabled=false;}}},'Test saved '+r.provider+' connection')"],
  ["h('a',{class:'btn',href:r.url,target:'_blank',rel:'noopener noreferrer'},'Verify directly with '+r.provider)",
   "h('button',{class:'primary',onclick:async function(){this.disabled=true;try{var result=await api('verification/resolve','POST',{id:r.id,action:'recheck'});dialog.close();dialog.remove();await verificationPanel(mount);}catch(e){this.disabled=false;var err=h('p',{role:'alert'},'Saved connection check failed: '+e.message);dialog.appendChild(err);}}},'Check saved connection first')"],
  ["h('p',{},'Do not enter provider passwords or email codes in this chat. This request does not grant AI permissions.')",
   "h('p',{},'This checks the saved API connection; opening the Cloudflare dashboard alone does not authenticate the Control Room. If the API test fails, update token scopes in Connections. Never enter login codes in chat.')"],
  ["function frame(html){var f=h('iframe',{sandbox:'',class:'fr'});",
   "function frame(html){var f=h('iframe',{sandbox:'allow-scripts allow-forms',referrerpolicy:'no-referrer',title:'Interactive proposed website preview (isolated sandbox)',class:'fr'});"],
  ["if(/\\.html?$/i.test(f.path))kids.push(frame(f.after));",
   "if(/\\.html?$/i.test(f.path))kids.push(h('h4',{},'Interactive website preview · isolated · not published'),frame(f.after));"],
  ["'Code proposal: use full review to inspect every changed file.'",
   "'This change contains no HTML entry page. An interactive preview requires a complete website package or staging URL; review the source before approval.'"],
  ["h('h4',{},'Authorized Cloudflare deployment proposals')",
   "h('h4',{},'Choose authorized accounts in one place')"],
  ["'Select the accounts AI may prepare changes for. Cloudflare token permissions and external provider verification still apply. Agent maintenance access is managed separately under Cloudflare connections.'",
   "'Tick one or several connected accounts below and save once. This is a shared workspace permission policy, not yet separate grants for each AI. Provider token scopes remain distinct from approval of an AI proposal.'"]
];
let updated=0;
for(const [a,b] of changes){
 if(source.includes(b)){continue;}
 const pieces=source.split(a);
 if(pieces.length<2)throw Error('Cannot apply permission/preview patch safely: '+a.slice(0,75));
 source=source.replace(a,b);updated++;
}
if(!process.argv.includes('--check'))fs.writeFileSync(target,source);
console.log('Account 4 permission and preview patch '+(process.argv.includes('--check')?'validated':'applied')+' ('+updated+' changes)');

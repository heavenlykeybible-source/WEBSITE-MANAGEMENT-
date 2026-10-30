import fs from 'node:fs';
const target=new URL('../control-room-worker.js',import.meta.url);
let s=fs.readFileSync(target,'utf8');
const parts=[
 ["if (sub === 'ai/cloudflare-test' && m === 'POST') return json({ ok: true, reply: await aiTest(await aiResolve(env, 'cloudflare', sc.ow)) });",
  "if (sub === 'ai/cloudflare-test' && m === 'POST') return json({ ok: true, reply: await aiTest(await aiResolve(env, 'cloudflare', sc.ow)) });if (sub === 'ai/secret-test' && m === 'POST') {if(user.role!=='owner'||user.kind==='member'||sc.ow)fail('Owner-only Claude diagnostic',403);const started=Date.now();const reply=await aiTest(await aiResolve(env,'secret',null));return json({ok:true,reply,latency_ms:Date.now()-started});}"],
 ["if(a.id==='secret'){box.appendChild(h('div',{class:'card'},h('b',{},a.label),h('div',{class:'tag'},'Set by the ANTHROPIC_API_KEY secret \\u2022 '+a.model)));return;}",
  "if(a.id==='secret'){var secretStatus=h('p',{class:'tag',role:'status','aria-live':'polite'},'Not tested in this session');var secretTest=h('button',{class:'sm',onclick:async function(){this.disabled=true;secretStatus.textContent='Testing configured Claude API…';try{var r=await api('ai/secret-test','POST',{});secretStatus.textContent='Connected · '+r.latency_ms+' ms · '+r.reply;}catch(e){secretStatus.textContent='Claude connection failed · '+e.message;}finally{this.disabled=false;}}},'Test built-in Claude');box.appendChild(h('div',{class:'card'},h('b',{},a.label),h('div',{class:'tag'},'Configured by protected ANTHROPIC_API_KEY secret · '+a.model),secretTest,secretStatus));return;}"],
 ["var configured=d.accounts.filter(function(a){return /^\\d+$/.test(String(a.id));});",
  "var configured=d.accounts.filter(function(a){return /^\\d+$/.test(String(a.id))||a.id==='secret';});"],
 ["var result=await api('ai/accounts/'+a.id+'/test','POST');success++;",
  "var result=await api(a.id==='secret'?'ai/secret-test':'ai/accounts/'+a.id+'/test','POST');success++;"]
];
for(const [before,after] of parts){
 if(s.includes(after))continue;
 const scopeStart=before.startsWith('if (sub ===')?s.indexOf('async function ownerApiUnlocked('):s.indexOf('async function aiAccounts()');
 const scopeEnd=before.startsWith('if (sub ===')?s.indexOf('// ---------- WordPress and Blogger connections',scopeStart):s.indexOf('function frame(html)',scopeStart);
 if(scopeStart<0||scopeEnd<=scopeStart)throw Error('Cannot find requested Claude diagnostic scope');
 const section=s.slice(scopeStart,scopeEnd);
 if(section.split(before).length!==2)throw Error('Claude diagnostic source differs: '+before.slice(0,80));
 s=s.slice(0,scopeStart)+section.replace(before,after)+s.slice(scopeEnd);
}
if(!process.argv.includes('--check'))fs.writeFileSync(target,s);
console.log('PASS owner-only Claude API secret diagnostic '+(process.argv.includes('--check')?'checked':'applied'));

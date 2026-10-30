import fs from 'node:fs';
const target=new URL('../control-room-worker.js',import.meta.url);
let source=fs.readFileSync(target,'utf8');
const changes=[
 ["if (x[2] === 'test') return json({ ok: true, reply: await aiTest({ provider: r.provider, model: r.model, base: r.base_url, key: await unseal(env, r.key_enc) }) });",
  "if (x[2] === 'test') { const started=Date.now();const reply=await aiTest({ provider: r.provider, model: r.model, base: r.base_url, key: await unseal(env, r.key_enc) });return json({ok:true,reply,latency_ms:Date.now()-started,checked_at:new Date().toISOString()}); }"],
 ["var out=h('span',{class:'tag'},'');",
  "var out=h('span',{class:'tag',role:'status','aria-live':'polite'},'Not tested in this session');"],
 ["h('button',{class:'sm',onclick:function(){out.textContent=' Testing...';api('ai/accounts/'+a.id+'/test','POST').then(function(r){out.textContent=' Works: '+r.reply;}).catch(function(e){out.textContent=' Problem: '+e.message;});}},'Test'),",
  "h('button',{class:'sm',onclick:async function(){this.disabled=true;out.textContent='Testing saved connection…';try{var r=await api('ai/accounts/'+a.id+'/test','POST');out.textContent='Connected · '+r.latency_ms+' ms · '+r.reply;}catch(e){out.textContent='Connection failed · '+e.message;}finally{this.disabled=false;}}},'Test connection'),"],
 ["var pv=h('select',{});Object.keys(AIP).forEach",
  "var allStatus=h('p',{class:'tag',role:'status','aria-live':'polite'},'Select Test all to check saved AI connections without changing credentials. Tests may consume provider quota.');var testAll=h('button',{class:'sm',onclick:async function(){this.disabled=true;var configured=d.accounts.filter(function(a){return /^\\d+$/.test(String(a.id));});if(!configured.length){allStatus.textContent='No user-configured AI accounts to test.';this.disabled=false;return;}var success=0;var failures=[];allStatus.textContent='Checking '+configured.length+' saved connections, one at a time…';try{for(var a of configured){try{var result=await api('ai/accounts/'+a.id+'/test','POST');success++;allStatus.textContent='Checked '+(success+failures.length)+' of '+configured.length+' · '+a.label+' connected in '+result.latency_ms+' ms';}catch(e){failures.push(a.label+': '+e.message);allStatus.textContent='Checked '+(success+failures.length)+' of '+configured.length+' · '+a.label+' failed';}}allStatus.textContent=success+' of '+configured.length+' connected. '+(failures.length?failures.join(' | '):'All configured API connections responded.');}finally{this.disabled=false;}}},'Test all saved AI connections');var pv=h('select',{});Object.keys(AIP).forEach"],
 ["'Every AI works the same way here: it can read and propose, and nothing goes live until you approve.'),box,",
  "'Every AI works the same way here: it can read and propose only when requested, and nothing goes live until you approve. Test saved connections to diagnose authentication and provider response time.'),testAll,allStatus,box,"]
];
for(const [before,after] of changes){
 if(source.includes(after))continue;
 if(source.split(before).length!==2)throw Error('AI provider health patch anchor missing or duplicated: '+before.slice(0,85));
 source=source.replace(before,after);
}
if(!process.argv.includes('--check'))fs.writeFileSync(target,source);
console.log('PASS Account 4 AI provider health and response-time diagnostics '+(process.argv.includes('--check')?'checked':'applied'));

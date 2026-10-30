import fs from 'node:fs';
const target=new URL('../control-room-worker.js',import.meta.url);
let s=fs.readFileSync(target,'utf8');
const changes=[
 ["'Replace key'),","(a.base_url&&a.base_url.includes('generativelanguage.googleapis.com')?'Reconnect Gemini API key':'Replace API key')), "],
 ["h('b',{},'Add an AI account'),pv,lb,md,bs,ky,","h('b',{},'Add an AI account'),h('p',{class:'tag'},'Gemini: choose Google Gemini, enter a model ID available in your Google AI account, then paste a new Gemini API key. The Control Room tests the connection before encrypting and saving it. Reconnect an existing Gemini using its Reconnect Gemini API key button. ChatGPT: choose OpenAI and provide your OpenAI API key. A ChatGPT website login does not authorize API access.'),pv,lb,md,bs,ky,"],
 ["connectionStatus.textContent=e.message||'Connection failed. Please try again.';","connectionStatus.textContent=(pv.value==='gemini'?'Gemini authentication failed. Check the Gemini API key, enabled model and API quota. ':'')+(e.message||'Connection failed. Please try again.');"]
];
for(const [a,b] of changes){if(s.includes(b))continue;if(!s.includes(a))throw Error('Account 4 AI account UI changed: '+a.slice(0,70));s=s.replace(a,b);}
if(!process.argv.includes('--check'))fs.writeFileSync(target,s);
console.log('Gemini and OpenAI reconnection UI '+(process.argv.includes('--check')?'checked':'prepared'));

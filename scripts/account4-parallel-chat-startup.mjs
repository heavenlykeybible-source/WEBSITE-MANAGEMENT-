import fs from 'node:fs';
const target=new URL('../control-room-worker.js',import.meta.url);
let source=fs.readFileSync(target,'utf8');
const changes=[
 ["var sel=h('select',{'aria-label':'Choose AI assistant'});st.accounts.forEach",
  "var initialData=Promise.allSettled([api('ai/history'),own()?api('connections'):Promise.resolve({connections:[]}),ME.kind!=='member'?api('sites'):Promise.resolve({sites:[]}),api('github'),api('remote')]);var sel=h('select',{'aria-label':'Choose AI assistant'});st.accounts.forEach"],
 ["try{var savedChats=await api('ai/history');(savedChats.conversations||[])",
  "try{var initial=await initialData;var savedChats=initial[0].status==='fulfilled'?initial[0].value:{conversations:[]};(savedChats.conversations||[])"],
 ["if(own()){try{var connected=await api('connections');connected.connections.forEach",
  "if(own()){try{var connected=initial[1].status==='fulfilled'?initial[1].value:{connections:[]};connected.connections.forEach"],
 ["var destinationData=await Promise.all([ME.kind!=='member'?api('sites'):Promise.resolve({sites:[]}),api('github'),api('remote')]);var destinations=destinationData[0],ghTargets=destinationData[1],blogTargets=destinationData[2];",
  "var destinations=initial[2].status==='fulfilled'?initial[2].value:{sites:[]},ghTargets=initial[3].status==='fulfilled'?initial[3].value:{sites:[]},blogTargets=initial[4].status==='fulfilled'?initial[4].value:{sites:[]};"]
];
for(const [before,after] of changes){
 if(source.includes(after))continue;
 if(source.split(before).length!==2)throw Error('AI chat startup source differs: '+before.slice(0,85));
 source=source.replace(before,after);
}
if(!process.argv.includes('--check'))fs.writeFileSync(target,source);
console.log('PASS Account 4 concurrent chat startup patch '+(process.argv.includes('--check')?'applicable':'applied'));

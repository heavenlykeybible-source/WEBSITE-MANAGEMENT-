import fs from 'node:fs';
const target=new URL('../control-room-worker.js',import.meta.url);
let s=fs.readFileSync(target,'utf8');
const before="if(ME.kind!=='member'){var destinations=await api('sites');destinations.sites.forEach(function(s){target.appendChild(h('option',{value:'static:'+s.slug},'Website · '+s.name));});}var ghTargets=await api('github'),blogTargets=await api('remote');";
const after="var destinationData=await Promise.all([ME.kind!=='member'?api('sites'):Promise.resolve({sites:[]}),api('github'),api('remote')]);var destinations=destinationData[0],ghTargets=destinationData[1],blogTargets=destinationData[2];destinations.sites.forEach(function(s){target.appendChild(h('option',{value:'static:'+s.slug},'Website · '+s.name));});";
if(!s.includes(after)){
 if(s.split(before).length!==2)throw Error('AI chat destination loader changed; refusing update');
 s=s.replace(before,after);
}
if(!process.argv.includes('--check'))fs.writeFileSync(target,s);
console.log('AI chat destination lists use parallel reads; '+(process.argv.includes('--check')?'validated':'prepared'));

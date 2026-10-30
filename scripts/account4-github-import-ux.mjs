import fs from 'node:fs';
const target=new URL('../control-room-worker.js',import.meta.url);
let s=fs.readFileSync(target,'utf8');
const changes=[
["var scanButton=h('button',{onclick:async function()",
"worker.onchange=function(){stage.disabled=!scan||!dest.value||!worker.value;};var scanButton=h('button',{onclick:async function()"],
["project.appendChild(h('option',{value:''},'Choose built website or Worker'));listing.candidates.forEach(function(c,i){project.appendChild(h('option',{value:i},(c.kind==='static'?'Website · ':'Worker · ')+c.path));});",
"project.appendChild(h('option',{value:''},'Choose built website or Worker'));listing.candidates.forEach(function(c,i){project.appendChild(h('option',{value:i},(c.kind==='static'?'Website · ':'Worker · ')+c.path));});if(listing.candidates.length===1){project.value='0';project.onchange();}"],
["source.appendChild(h('option',{value:''},'Choose connected GitHub repository'));data.sources.forEach(function(s){source.appendChild(h('option',{value:s.id},s.label+' · '+s.repo+' · '+s.branch));});",
"source.appendChild(h('option',{value:''},'Choose connected GitHub repository'));data.sources.forEach(function(s){source.appendChild(h('option',{value:s.id},s.label+' · '+s.repo+' · '+s.branch));});"],
["stage.disabled=false;status.textContent='Choose the destination, then prepare a preview/review. No live website has changed.';",
"stage.disabled=(!dest.value||(scan.kind==='worker'&&!worker.value));status.textContent='Scan complete. Choose the destination and Worker, then prepare a preview/review. No live website has changed.';"],
["var stage=h('button',{disabled:true,onclick:async function(){if(busy||!scan||!dest.value)return;",
"var stage=h('button',{disabled:true,onclick:async function(){if(busy||!scan||!dest.value||(scan.kind==='worker'&&!worker.value))return;"],
["worker.hidden=candidate.kind!=='worker';};",
"worker.hidden=candidate.kind!=='worker';if(dest.options.length===2){dest.selectedIndex=1;dest.onchange();}};"],
["result.workers.forEach(function(w){worker.appendChild(h('option',{value:w.name},w.name));});status.textContent=",
"worker.appendChild(h('option',{value:''},'Choose existing Worker'));result.workers.forEach(function(w){worker.appendChild(h('option',{value:w.name},w.name));});if(result.workers.length===1)worker.value=result.workers[0].name;status.textContent="],
["'Use connected repositories without a dashboard sign-in for each task. Select a complete built website or bundled Worker. Multi-file backend projects require a build; files are never silently deployed as a partial application.'",
"'One-click import starts with your already connected GitHub repositories. Select the repository, let the system scan the complete built project, review the visual preview, then approve or decline. Only existing destinations are offered; full backend applications require a verified build and staging environment.'"],
["'No index.html or Worker entry candidates found. Connect the built output folder or use the existing ZIP importer.'",
"'No built website entry or Worker bundle found. This does not mean all repository files can be safely imported. Build the project first or upload its verified static ZIP.'"]
];
let n=0;
for(const [before,after] of changes){
 if(s.includes(after))continue;
 if(!s.includes(before))throw Error('GitHub import layout changed: '+before.slice(0,95));
 s=s.replace(before,after);n++;
}
if(!process.argv.includes('--check'))fs.writeFileSync(target,s);
console.log('Account 4 GitHub import UX '+(process.argv.includes('--check')?'verified':'applied')+' ('+n+' source edits)');

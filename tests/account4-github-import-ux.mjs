import fs from 'node:fs';
import assert from 'node:assert/strict';
const s=fs.readFileSync(new URL('../control-room-worker.js',import.meta.url),'utf8');
const start=s.indexOf('async function nativeImports()'),end=s.indexOf('var PROVIDER_SEEN=',start);
assert.ok(start>=0&&end>start,'Connected GitHub import UI missing');
const ui=s.slice(start,end);
for(const [label,value] of [
 ['connected GitHub discovery',"api('workspace/catalog')"],
 ['automatic single-project selection',"if(listing.candidates.length===1){project.value='0';project.onchange();}"],
 ['automatic sole destination selection',"if(dest.options.length===2){dest.selectedIndex=1;dest.onchange();}"],
 ['explicit Worker selection',"'Choose existing Worker'"],
 ['Worker selection stage gate','worker.onchange=function(){stage.disabled=!scan||!dest.value||!worker.value;}'],
 ['scan-based stage gate',"stage.disabled=(!dest.value||(scan.kind==='worker'&&!worker.value))"],
 ['scan endpoint',"api('workspace/scan'"],
 ['owner review staging',"api('workspace/stage'"],
 ['waiting room approval',"openP(result.proposal_id,decision)"],
 ['isolated HTML preview',"sandbox:'allow-scripts allow-forms'"]
])assert.ok(ui.includes(value),'Missing '+label);
assert.ok(!ui.includes('stage.disabled=false;status.textContent=\'Choose the destination'),'Unsafe premature staging remains');
console.log('PASS connected GitHub import scan, target selection, preview and owner approval');

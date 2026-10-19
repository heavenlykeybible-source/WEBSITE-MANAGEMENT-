import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root='heavenly-key-website/js';
const files=(await readdir(root,{recursive:true})).filter(name=>name.endsWith('.js')).map(name=>join(root,name)).sort();
const failures=[];
for(const file of files){
  const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(r.status!==0)failures.push({file,error:(r.stderr||r.stdout||'Syntax check failed').trim()});
  const source=await readFile(file,'utf8');
  if(/(?<!\$)\$\([^()\n]*\)\.forEach\(/.test(source))failures.push({file,error:'Use $(...) for multi-element iteration; $(...) returns only one element and .forEach will fail at runtime.'});
}
const studioPath=join(root,'production-studio.js');
try{
  const studio=await readFile(studioPath,'utf8');
  const declarations=['const quickLocalVideo=','const quickLibraryVideo='];
  for(const declaration of declarations){
    const name=declaration.match(/const (\w+)/)?.[1];
    const declaredAt=studio.indexOf(declaration);
    const usedAt=studio.indexOf(name+'.addEventListener');
    if(declaredAt<0||usedAt<0||usedAt<declaredAt)failures.push({file:studioPath,error:name+' must be declared before its browser event listener is attached.'});
  }
  if(!studio.includes("directCameraFallback=!programmeCanvas.captureStream"))failures.push({file:studioPath,error:'Direct-camera fallback for browsers without canvas captureStream is missing.'});
  if(!studio.includes("studio-final-check"))failures.push({file:studioPath,error:'Studio final confirmation panel is missing.'});
}catch(e){failures.push({file:studioPath,error:'Unable to inspect Production Studio runtime invariants: '+e.message});}

const shell=spawnSync('python3',['scripts/sync-account1-approved-shell.py','--check'],{encoding:'utf8'});
if(shell.status!==0)failures.push({file:'Account 1 approved homepage menu/footer',error:(shell.stderr||shell.stdout||'Approved shell verification failed').trim()});

if(failures.length){
  console.error('FRONTEND SYNTAX CHECK FAILED');
  for(const f of failures)console.error('\n'+f.file+'\n'+f.error);
  process.exit(1);
}
console.log('FRONTEND SYNTAX CHECK PASSED — '+files.length+' browser JavaScript files parsed successfully.');


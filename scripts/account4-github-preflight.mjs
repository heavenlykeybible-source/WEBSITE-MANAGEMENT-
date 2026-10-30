import fs from 'node:fs';
const target=new URL('../control-room-worker.js',import.meta.url);
let source=fs.readFileSync(target,'utf8');
const anchor='async function githubImport(';
const start=source.indexOf(anchor);
if(start<0)throw Error('GitHub import handler unavailable');
const end=source.indexOf('// Private chat attachments.',start);
if(end<start)throw Error('Cannot isolate GitHub import handler');
let section=source.slice(start,end);
const preflight="const scoped=tree.filter(t=>(!dir||t.path.startsWith(dir+'/'))&&t.type==='blob');if(scoped.some(t=>t.mode==='120000'))fail('Symlinks are not supported');const eligible=scoped.filter(t=>MIME[ext(t.path)]);if(eligible.some(t=>!Number.isSafeInteger(t.size)||t.size<0||t.size>MAX_FILE))fail('A website file exceeds the per-file import limit. No files were imported.',413);const names=new Set();for(const f of eligible){const relative=(dir?f.path.slice(dir.length+1):f.path).toLowerCase();if(names.has(relative))fail('Repository contains case-colliding website paths; no files were imported.',409);names.add(relative);}";
if(!section.includes(preflight)){
 const before='const tree = treeResult.tree || [];';
 if(!section.includes(before))throw Error('GitHub tree preflight anchor changed; inspect code before editing');
 section=section.replace(before,before+'   '+preflight);
}
const old="if (all.length > 40) fail('Direct GitHub import supports 40 files per request. For a larger website, upload its built website ZIP.');";
const improved="if (all.length > 40) fail('GitHub import found '+all.length+' eligible files; the direct import limit is 40. Nothing was imported. Use the full-project scanner or a built ZIP.',413);";
if(!section.includes(improved)&&section.includes(old))section=section.replace(old,improved);
source=source.slice(0,start)+section+source.slice(end);
if(!process.argv.includes('--check'))fs.writeFileSync(target,source);
console.log('PASS GitHub import fail-closed asset preflight '+(process.argv.includes('--check')?'checked':'applied'));

import fs from 'node:fs';
const target=new URL('../control-room-worker.js',import.meta.url);
let source=fs.readFileSync(target,'utf8');
const patches=[
 ["const all = tree.filter(t => t.type === 'blob' && (!dir || t.path.startsWith(dir + '/')) && MIME[ext(t.path)] && (t.size || 0) <= MAX_FILE);   if (all.some(t=>t.mode==='120000'))fail('Symlinks are not supported');",
  "const scoped=tree.filter(t=>(!dir||t.path.startsWith(dir+'/'))&&t.type==='blob');if(scoped.some(t=>t.mode==='120000'))fail('Symlinks are not supported');const all=scoped.filter(t=>MIME[ext(t.path)]);if(all.some(t=>!Number.isSafeInteger(t.size)||t.size<0||t.size>MAX_FILE))fail('A website file exceeds the per-file import limit. Nothing was imported; build a smaller package or use the verified ZIP importer.',413);const names=new Set();for(const f of all){const relative=(dir?f.path.slice(dir.length+1):f.path).toLowerCase();if(names.has(relative))fail('Repository contains case-colliding website file paths; nothing was imported.',409);names.add(relative);}"],
 ["if (all.length > 40) fail('Direct GitHub import supports 40 files per request. For a larger website, upload its built website ZIP.');",
  "if (all.length > 40) fail('Direct GitHub import requires a maximum of 40 eligible files. Found '+all.length+'. No files were imported; use the complete-project scanner or a built website ZIP.',413);"]
];
let applied=0;
for(const [before,after] of patches){if(source.includes(after))continue;if(!source.includes(before))throw Error('GitHub importer source changed; review preflight before patching: '+before.slice(0,85));source=source.replace(before,after);applied++;}
if(!process.argv.includes('--check'))fs.writeFileSync(target,source);
console.log('Account 4 GitHub preflight '+(process.argv.includes('--check')?'verified':'applied')+' ('+applied+' changes)');

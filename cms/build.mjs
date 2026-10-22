import fs from 'node:fs';
const target=new URL('../control-room-worker.js',import.meta.url);
let worker=fs.readFileSync(target,'utf8');
if (!worker.trim()) throw new Error('Refusing CMS build: active Worker source is empty');
const requiredMarkers = [
  ['VISUAL CMS CLIENT', '// BEGIN VISUAL CMS CLIENT', '// END VISUAL CMS CLIENT'],
  ['AI CAPABILITIES', '// BEGIN AI CAPABILITIES', '// END AI CAPABILITIES'],
  ['AI PERMISSION CLIENT', '// BEGIN AI PERMISSION CLIENT', '// END AI PERMISSION CLIENT'],
];
for (const [name, start, end] of requiredMarkers) {
  if (worker.split(start).length !== 2 || worker.split(end).length !== 2 || worker.indexOf(start) > worker.indexOf(end)) {
    throw new Error('Refusing CMS build: missing or duplicate Worker integration markers for ' + name);
  }
}
const frame=fs.readFileSync(new URL('./frame.js',import.meta.url),'utf8');
const client=fs.readFileSync(new URL('./editor.js',import.meta.url),'utf8');
const bundle='const CMS_FRAME = '+JSON.stringify(frame)+';\n'+client;
const replacement='// BEGIN VISUAL CMS CLIENT\n'+bundle.replaceAll('\\','\\\\').replaceAll('`','\\`').replaceAll('${','\\${')+'\n// END VISUAL CMS CLIENT';
worker=worker.replace(/\/\/ BEGIN VISUAL CMS CLIENT[\s\S]*?\/\/ END VISUAL CMS CLIENT/,()=>replacement);
worker=worker.replace(/\/\/ BEGIN AI CAPABILITIES[\s\S]*?\/\/ END AI CAPABILITIES/,()=> '// BEGIN AI CAPABILITIES\n'+fs.readFileSync(new URL('../ai/capabilities.js',import.meta.url),'utf8')+'\n// END AI CAPABILITIES');
const aiClient=fs.readFileSync(new URL('../ai/permissions.js',import.meta.url),'utf8');
worker=worker.replace(/\/\/ BEGIN AI PERMISSION CLIENT[\s\S]*?\/\/ END AI PERMISSION CLIENT/,()=> '// BEGIN AI PERMISSION CLIENT\n'+aiClient.replaceAll('\\','\\\\').replaceAll('`','\\`').replaceAll('${','\\${')+'\n// END AI PERMISSION CLIENT');
for (const [name, start, end] of requiredMarkers) {
  const section = worker.slice(worker.indexOf(start) + start.length, worker.indexOf(end));
  if (!section.trim()) throw new Error('Refusing CMS build: empty generated section ' + name);
}
fs.writeFileSync(target,worker);

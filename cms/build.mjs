import fs from 'node:fs';
import {build} from 'esbuild';
const target=new URL('../control-room-worker.js',import.meta.url);
let worker=fs.readFileSync(target,'utf8');
const passkeys=await build({entryPoints:[new URL('../security/owner-passkeys.js',import.meta.url).pathname],bundle:true,write:false,format:'iife',globalName:'OwnerPasskeys',platform:'browser',target:'es2022',minify:true});
const passkeyServer='// BEGIN OWNER PASSKEY SERVER\n'+passkeys.outputFiles[0].text.replace(/[ \t]+$/gm,'')+'\nconst ownerPasskeys=OwnerPasskeys.createOwnerPasskeyRoutes({json:(...a)=>json(...a),fail,body,reauthenticate,audit,withOperationLock});\n// END OWNER PASSKEY SERVER';
if(worker.includes('// BEGIN OWNER PASSKEY SERVER'))worker=worker.replace(/\/\/ BEGIN OWNER PASSKEY SERVER[\s\S]*?\/\/ END OWNER PASSKEY SERVER/,()=>passkeyServer);
else worker=passkeyServer+'\n'+worker;
const passkeyClient=fs.readFileSync(new URL('../security/passkey-client.js',import.meta.url),'utf8');
const passkeySection='// BEGIN OWNER PASSKEY CLIENT\n'+passkeyClient.replaceAll('\\','\\\\').replaceAll('`','\\`').replaceAll('${','\\${')+'\n// END OWNER PASSKEY CLIENT';
if(worker.includes('// BEGIN OWNER PASSKEY CLIENT'))worker=worker.replace(/\/\/ BEGIN OWNER PASSKEY CLIENT[\s\S]*?\/\/ END OWNER PASSKEY CLIENT/,()=>passkeySection);
else worker=worker.replace('async function passwordDialog(',passkeySection+'\nasync function passwordDialog(');
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
const workspace='// BEGIN AI WORKSPACE\n'+fs.readFileSync(new URL('../ai/workspace.js',import.meta.url),'utf8')+'\n// END AI WORKSPACE';
if(worker.includes('// BEGIN AI WORKSPACE'))worker=worker.replace(/\/\/ BEGIN AI WORKSPACE[\s\S]*?\/\/ END AI WORKSPACE/,()=>workspace);
else worker=worker.replace('// BEGIN AI CAPABILITIES',workspace+'\n// BEGIN AI CAPABILITIES');
const aiClient=fs.readFileSync(new URL('../ai/permissions.js',import.meta.url),'utf8');
worker=worker.replace(/\/\/ BEGIN AI PERMISSION CLIENT[\s\S]*?\/\/ END AI PERMISSION CLIENT/,()=> '// BEGIN AI PERMISSION CLIENT\n'+aiClient.replaceAll('\\','\\\\').replaceAll('`','\\`').replaceAll('${','\\${')+'\n// END AI PERMISSION CLIENT');
for (const [name, start, end] of requiredMarkers) {
  const section = worker.slice(worker.indexOf(start) + start.length, worker.indexOf(end));
  if (!section.trim()) throw new Error('Refusing CMS build: empty generated section ' + name);
}
fs.writeFileSync(target,worker);

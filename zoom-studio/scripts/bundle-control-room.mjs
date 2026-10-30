// Reproducible single-module package for the Control Room deployment form.
// No credentials or password hashes are embedded in this file or its output.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const types={html:'text/html;charset=utf-8',css:'text/css;charset=utf-8',js:'application/javascript',jpg:'image/jpeg',png:'image/png',webmanifest:'application/manifest+json'};
const assets={};
function collect(dir,rel=''){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  if(entry.name.startsWith('.')||entry.name.startsWith('_'))continue;
  const name=path.posix.join(rel,entry.name),file=path.join(dir,entry.name);
  if(entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile()))
    throw Error('Unsafe public asset entry rejected: '+name);
  if(entry.isDirectory()){collect(file,name);continue;}
  const ext=path.extname(name).slice(1);if(!types[ext])throw Error('Unrecognized public file type: '+name);
  if(Object.keys(assets).length>=1000)throw Error('Public asset count exceeds deployment safety limit');
  const bytes=fs.readFileSync(file);
  if(bytes.length>10*1024*1024)throw Error('Public asset exceeds 10 MiB safety limit: '+name);
  assets['/'+name]={type:types[ext],hash:createHash('sha256').update(bytes).digest('hex'),data:gzipSync(bytes,{level:9}).toString('base64')};
 }
}
collect(path.join(root,'site'));
if(Object.keys(assets).length>1000)throw Error('Public asset count exceeds deployment safety limit');
const backend=fs.readFileSync(path.join(root,'site/_worker.js'),'utf8').replace('export default {','const studioApplication = {');
const schema=fs.readFileSync(path.join(root,'migrations/0001_zoom_studio.sql'),'utf8').split('\n').filter(x=>!x.trim().startsWith('--')).join('\n');
if(/\b(?:DROP|DELETE|UPDATE|INSERT|ALTER|REPLACE)\b/i.test(schema))throw Error('Only additive CREATE statements may be bundled.');
const runtime=fs.readFileSync(path.join(root,'server/control-room-runtime.mjs'),'utf8');
const code=backend+'\nconst MEETING_ASSETS='+JSON.stringify(assets)+';\nconst MEETING_SCHEMA='+JSON.stringify(schema)+';\n'+fs.readFileSync(path.join(root,'server/meeting-rooms.mjs'),'utf8')+'\n'+runtime;
if(Buffer.byteLength(code)>1400000)throw Error('Meeting package exceeds the Control Room deployment limit.');
fs.mkdirSync(path.join(root,'build'),{recursive:true});
fs.writeFileSync(path.join(root,'build/meeting-worker.mjs'),code);
console.log(JSON.stringify({worker:'heavenly-key-meetingspace',files:Object.keys(assets).length,bytes:Buffer.byteLength(code),output:'build/meeting-worker.mjs'}));

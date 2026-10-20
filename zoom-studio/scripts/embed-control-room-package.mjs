// Maintains a credential-free embedded package for reviewed, server-side installation.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const code=fs.readFileSync(path.join(root,'build/meeting-worker.mjs'));
const manifest={sha256:createHash('sha256').update(code).digest('hex'),bytes:code.length,data:gzipSync(code,{level:9}).toString('base64')};
const target=path.join(root,'../control-room-worker.js');
const begin='// BEGIN REVIEWED MEETING PACKAGE',end='// END REVIEWED MEETING PACKAGE';
let source=fs.readFileSync(target,'utf8');
if(source.includes(begin))source=source.slice(0,source.indexOf(begin))+source.slice(source.indexOf(end)+end.length).replace(/^\n/,'');
const block=begin+'\nconst MEETING_INSTALL_PACKAGE='+JSON.stringify(manifest)+';\n'+end+'\n';
source=block+source;
fs.writeFileSync(target,source);
console.log(JSON.stringify({sha256:manifest.sha256,packageBytes:manifest.bytes,controlRoomBytes:Buffer.byteLength(source)}));

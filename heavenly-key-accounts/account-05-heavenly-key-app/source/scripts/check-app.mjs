import {readdirSync,readFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join,resolve,dirname} from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname);
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);}
for(const file of [...files(join(root,'src')),...files(join(root,'public'))].filter(f=>f.endsWith('.js'))){
 const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status!==0)throw Error(result.stderr);
 const source=readFileSync(file,'utf8');
 for(const match of source.matchAll(/(?:from\s*|import\s*\()\s*['"](\.\/[^'"]+)['"]/g))if(!existsSync(resolve(dirname(file),match[1])))throw Error('Missing module '+match[1]+' in '+file);
}
for(const file of files(join(root,'public')).filter(f=>f.endsWith('.html'))){
 const html=readFileSync(file,'utf8');
 for(const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)){
  const raw=match[1].replaceAll('&amp;','&');if(/^(?:https?:|#|mailto:|tel:|data:)/.test(raw))continue;
  const path=raw.split(/[?#]/)[0];if(!path||path==='/')continue;
  const target=path.startsWith('/')?join(root,'public',path):resolve(dirname(file),path);
  if(!existsSync(target))throw Error('Missing page/asset '+raw+' in '+file);
 }
}
console.log('All app scripts, module dependencies and local page/assets links verified.');

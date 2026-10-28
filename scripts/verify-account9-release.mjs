import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,join,relative,sep} from 'node:path';

const root=resolve('heavenly-key-accounts/account-09-heavenly-key-videoeditor/source');
const release=readFileSync(process.argv[2]||'release-packages/account9-control-room-full.mjs','utf8');
const token='const STATIC_ASSETS=';
const start=release.indexOf(token);
const finish=release.indexOf(';\nconst SECURITY_HEADERS=',start);
assert.ok(start>0 && finish>start,'Canonical Worker release must include packaged static assets');
const api=readFileSync(join(root,'functions/api/[[path]].js'),'utf8');
assert.equal(release.slice(0,start).trim(),api.trim(),'Release backend must match the current API source');
const assets=JSON.parse(release.slice(start+token.length,finish));
const paths=[];
function traverse(folder){
  for(const ent of readdirSync(folder,{withFileTypes:true})){
    const path=join(folder,ent.name);
    if(ent.isDirectory()&&!ent.name.startsWith('.')&&!ent.name.startsWith('_'))traverse(path);
    else if(ent.isFile()&&!ent.name.startsWith('_')&&!ent.name.startsWith('.'))paths.push(path);
  }
}
traverse(join(root,'public'));
assert.equal(Object.keys(assets).length,paths.length,'Release must contain every public asset, with no stale entries');
for(const path of paths){
  const name='/'+relative(join(root,'public'),path).split(sep).join('/');
  assert.ok(Object.hasOwn(assets,name),'Release missing '+name);
  assert.deepEqual(Buffer.from(assets[name],'base64'),readFileSync(path),'Release has stale or altered asset: '+name);
}
console.log('PASS Account 9 canonical release matches API source and '+paths.length+' public assets');

import fs from 'node:fs';
const target=new URL('../control-room-worker.js',import.meta.url);
let s=fs.readFileSync(target,'utf8');
const runtime=fs.readFileSync(new URL('./account4-large-upload-runtime.mjs',import.meta.url),'utf8');
const marker='async function ownerApiUnlocked(req, env, user, sub, m, u) {';
const gate="  const multipart=await account4MultipartRoutes(req,env,user,sub,m);if(multipart)return multipart;";
const begin=s.indexOf('// Account 4 private owner-only 1 GiB resumable R2 upload staging.');
const owner=s.indexOf(marker);
if(owner<0)throw Error('Owner API boundary changed');
if(begin>=0&&begin<owner){
 s=s.slice(0,begin)+runtime+'\n'+s.slice(owner);
}else if(!s.includes('async function account4MultipartRoutes(')){
 if(s.split(marker).length!==2)throw Error('Owner API boundary changed');
 s=s.replace(marker,runtime+'\n'+marker);
}else throw Error('Unknown older multipart handler lacks safe replacement marker');
if(!s.includes(gate)){
 const i=s.indexOf(marker);
 const end=s.indexOf('const permission=await aiPermissionRoutes(',i);
 if(i<0||end<0||end>i+1600)throw Error('Cannot locate first owner API route');
 s=s.slice(0,end)+gate+'\n   '+s.slice(end);
}
if(!process.argv.includes('--check'))fs.writeFileSync(target,s);
console.log('PASS Account 4 owner-only R2 multipart upload API '+(process.argv.includes('--check')?'verified':'installed'));

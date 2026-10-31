import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('..',import.meta.url));
const metadata=JSON.parse(fs.readFileSync(new URL('../patches/account4-reviewed-upgrade.json',import.meta.url),'utf8'));
const digest=b=>createHash('sha256').update(b).digest('hex');
const target=new URL('../control-room-worker.js',import.meta.url);
const current=digest(fs.readFileSync(target));
if(current!==metadata.after_sha256 && current!==metadata.built_sha256){
 if(current!==metadata.before_sha256){
  // A newer approved source supersedes the historical one-time upgrade patch.
  // Accept only an exact copy of the checked-in source: never silently
  // overwrite it, and never accept uncommitted changes as approved.
  const verified=spawnSync('git',['show','HEAD:control-room-worker.js'],{cwd:root,encoding:null,shell:false,maxBuffer:12*1024*1024});
  if(verified.status!==0 || digest(verified.stdout)!==current)
   throw Error('Refusing unreviewed Control Room source changes. Commit and review the new source before building.');
  const source=fs.readFileSync(target,'utf8');
  for(const required of ['function openMeetingStudioOwner()', 'Authorized Cloudflare deployment proposals', 'export default']){
   if(!source.includes(required))throw Error('Reviewed Control Room source missing required capability: '+required);
  }
 }else{
 const patch=new URL('../patches/account4-reviewed-upgrade.patch',import.meta.url);
 if(digest(fs.readFileSync(patch))!==metadata.patch_sha256)throw Error('Control Room upgrade patch integrity mismatch');
 for(const args of [['apply','--check',fileURLToPath(patch)],['apply',fileURLToPath(patch)]]){
  const result=spawnSync('git',args,{cwd:root,encoding:'utf8',shell:false});
  if(result.status!==0)throw Error('Reviewed Control Room source patch could not be applied: '+result.stderr);
 }
 if(digest(fs.readFileSync(target))!==metadata.after_sha256)throw Error('Reconstructed Control Room source failed exact-byte verification');
 }
}

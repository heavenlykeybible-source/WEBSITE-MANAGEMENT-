import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('..',import.meta.url));
const metadata=JSON.parse(fs.readFileSync(new URL('../patches/account4-reviewed-upgrade.json',import.meta.url),'utf8'));
const digest=b=>createHash('sha256').update(b).digest('hex');
const target=new URL('../control-room-worker.js',import.meta.url);
const current=digest(fs.readFileSync(target));
if(current!==metadata.after_sha256){
 if(current!==metadata.before_sha256)throw Error('Refusing to overwrite changed Control Room source. Review and regenerate the upgrade patch.');
 const patch=new URL('../patches/account4-reviewed-upgrade.patch',import.meta.url);
 if(digest(fs.readFileSync(patch))!==metadata.patch_sha256)throw Error('Control Room upgrade patch integrity mismatch');
 for(const args of [['apply','--check',fileURLToPath(patch)],['apply',fileURLToPath(patch)]]){
  const result=spawnSync('git',args,{cwd:root,encoding:'utf8',shell:false});
  if(result.status!==0)throw Error('Reviewed Control Room source patch could not be applied: '+result.stderr);
 }
 if(digest(fs.readFileSync(target))!==metadata.after_sha256)throw Error('Reconstructed Control Room source failed exact-byte verification');
}

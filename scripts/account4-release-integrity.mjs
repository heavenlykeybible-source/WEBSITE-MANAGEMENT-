import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const worker=new URL('../control-room-worker.js',import.meta.url);
const bytes=fs.readFileSync(worker);
const digest=crypto.createHash('sha256').update(bytes).digest('hex');
const checksum=new URL('../account4-reviewed-worker.sha256',import.meta.url);
const manifest=new URL('../account4-release-manifest.json',import.meta.url);
const expected=digest+'  control-room-worker.js\n';
if(process.argv.includes('--verify')){
 assert.equal(fs.readFileSync(checksum,'utf8'),expected,'Release Worker checksum changed after testing');
 const m=JSON.parse(fs.readFileSync(manifest,'utf8'));
 assert.equal(m.sha256,digest,'Release manifest and tested Worker differ');
 assert.equal(m.bytes,bytes.length,'Release size changed after testing');
 assert.equal(m.deploysAutomatically,false,'Review artifact must not deploy');
 assert.match(m.commit,/^[a-f0-9]{40}$/,'Release manifest requires exact Git commit');
 console.log('PASS Account 4 reviewed Worker matches manifest and SHA-256');
}else{
 const commit=process.env.GITHUB_SHA;
 assert.match(commit||'',/^[a-f0-9]{40}$/,'Exact GitHub commit SHA required');
 const m={application:'account4-website-management',commit,sha256:digest,bytes:bytes.length,deploysAutomatically:false,reviewRequired:true};
 fs.writeFileSync(checksum,expected);
 fs.writeFileSync(manifest,JSON.stringify(m,null,2)+'\n');
 console.log('Account 4 release manifest generated for '+commit);
}

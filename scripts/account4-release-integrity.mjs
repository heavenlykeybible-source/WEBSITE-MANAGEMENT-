import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const worker=new URL('../control-room-worker.js',import.meta.url);
const bytes=fs.readFileSync(worker);
const digest=crypto.createHash('sha256').update(bytes).digest('hex');
const checksum=new URL('../account4-reviewed-worker.sha256',import.meta.url);
const manifest=new URL('../account4-release-manifest.json',import.meta.url);
const expected=digest+'  control-room-worker.js\n';
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert.match(sourceCommit,/^[a-f0-9]{40}$/,'Repository commit cannot be verified');
if(process.env.GITHUB_SHA) assert.equal(process.env.GITHUB_SHA,sourceCommit,'Checked-out source differs from GitHub workflow commit');
if(process.argv.includes('--verify')){
 assert.equal(fs.readFileSync(checksum,'utf8'),expected,'Release Worker checksum changed after testing');
 const m=JSON.parse(fs.readFileSync(manifest,'utf8'));
 assert.equal(m.sha256,digest,'Release manifest and tested Worker differ');
 assert.equal(m.bytes,bytes.length,'Release size changed after testing');
 assert.equal(m.deploysAutomatically,false,'Review artifact must not deploy');
 assert.equal(m.commit,sourceCommit,'Release manifest does not identify the checked-out source commit');
 assert.equal(m.reviewRequired,true,'Release must require owner review');
 console.log('PASS Account 4 reviewed Worker matches manifest and SHA-256');
}else{
 const commit=sourceCommit;
 const m={application:'account4-website-management',commit,sha256:digest,bytes:bytes.length,deploysAutomatically:false,reviewRequired:true};
 fs.writeFileSync(checksum,expected);
 fs.writeFileSync(manifest,JSON.stringify(m,null,2)+'\n');
 console.log('Account 4 release manifest generated for '+commit);
}

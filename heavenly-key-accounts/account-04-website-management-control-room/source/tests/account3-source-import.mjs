// Integration regression: exercise the exact public Account 3 GitHub endpoints used
// by the import Worker, including URL-encoded paths containing spaces.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root='Global Christian Community/implementation/';
const base='https://api.github.com/repos/heavenlykeybible-source/onlinebible';
const headers={'Accept':'application/vnd.github+json','User-Agent':'Heavenly-Key-Control-Room-Test'};
const commitResult=await fetch(base+'/commits/main',{headers});
assert.equal(commitResult.status,200,'GitHub commit lookup should succeed');
const commit=await commitResult.json();
assert.match(commit.sha,/^[a-f0-9]{40}$/);
assert.match(commit.commit.tree.sha,/^[a-f0-9]{40}$/);
const response=await fetch(base+'/git/trees/'+commit.commit.tree.sha+'?recursive=1',{headers});
assert.equal(response.status,200,'GitHub tree lookup should succeed');
const tree=await response.json();
assert.equal(tree.truncated,false,'GitHub source tree must not be truncated');
const files=tree.tree.filter(entry=>entry.type==='blob'&&entry.path.startsWith(root));
assert.ok(files.length>20,'Expected full Account 3 implementation, not a stub');
const candidates=files.filter(entry=>entry.size<=1000000);
assert.ok(candidates.length>2,'Expected small source files');
const samples=[candidates.find(x=>x.path.endsWith('/package.json'))??candidates[0],candidates.find(x=>x.path.endsWith('.html'))??candidates[1],candidates.find(x=>x.path.endsWith('.js'))??candidates[2]];
for(const entry of samples){
 const encoded=entry.path.split('/').map(encodeURIComponent).join('/');
 const url='https://raw.githubusercontent.com/heavenlykeybible-source/onlinebible/'+commit.sha+'/'+encoded;
 const fetched=await fetch(url,{headers:{'User-Agent':'Heavenly-Key-Control-Room-Test'},redirect:'error'});
 assert.equal(fetched.status,200,'Pinned content should be readable: '+entry.path);
 const bytes=Buffer.from(await fetched.arrayBuffer());
 assert.equal(bytes.length,entry.size,'File byte length mismatch: '+entry.path);
 const sha=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\\0')).update(bytes).digest('hex');
 assert.equal(sha,entry.sha,'Git SHA mismatch: '+entry.path);
 console.log('VERIFIED '+entry.path+' '+bytes.length+' bytes '+sha);
}
console.log('ACCOUNT3_SOURCE_IMPORT_OK '+JSON.stringify({commit:commit.sha,fileCount:files.length,sampled:samples.length}));

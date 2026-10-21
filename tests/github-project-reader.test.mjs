import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectGitHubProject,planImmutableUploads} from '../project-import/github-reader.mjs';
const revision='a'.repeat(40),treeSha='b'.repeat(40);
const responses=[
 {tree:{sha:treeSha}},
 {truncated:false,tree:[
 {type:'blob',path:'heavenly-key-app/src/index.js',sha:'c'.repeat(40),size:4105},
 {type:'blob',path:'heavenly-key-app/public/index.html',sha:'d'.repeat(40),size:2048},
 {type:'blob',path:'other/secret.txt',sha:'e'.repeat(40),size:1}
 ]}
];
test('inspects only pinned project subtree without writing',async()=>{
 const calls=[];let i=0;
 const fetcher=async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>responses[i++]};};
 const result=await inspectGitHubProject({fetcher,token:'server-only',repository:'heavenlykeybible-source/onlinebible',revision,projectPath:'heavenly-key-app',target:{connectionId:4,worker:'heavenly-key-app'}});
 assert.equal(result.fileCount,2);
 assert.equal(result.totalBytes,6153);
 assert.equal(calls.length,2);
 assert.ok(calls.every(x=>x.options.method==='GET'&&x.options.redirect==='manual'));
 assert.ok(calls[0].url.endsWith('/git/commits/'+revision));
 const planned=planImmutableUploads(result);
 assert.equal(planned.length,2);
 assert.ok(planned[0].storageKey.includes(revision));
});
test('rejects incomplete GitHub trees',async()=>{
 let i=0;const fetcher=async()=>({ok:true,status:200,json:async()=>i++?{truncated:true,tree:[]}:responses[0]});
 await assert.rejects(inspectGitHubProject({fetcher,token:'server-only',repository:'heavenlykeybible-source/onlinebible',revision,projectPath:'heavenly-key-app',target:{connectionId:4,worker:'heavenly-key-app'}}));
});

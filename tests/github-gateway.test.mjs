import test from 'node:test';
import assert from 'node:assert/strict';
import {createGitHubGateway} from '../project-import/github-gateway.mjs';
const gateway=createGitHubGateway({
 listConnections:async()=>[{id:7,enabled:true,secret:'never expose'},{id:8,enabled:false}],
 githubFetch:async()=>({repositories:[{id:10,full_name:'example/one',private:true,default_branch:'main',permissions:{pull:true}},{id:11,full_name:'example/two',private:false,default_branch:'main',permissions:{pull:true}}]}),
 authorize:async()=>true
});
test('one connection lists multiple authorized repositories without credentials',async()=>{
 const repos=await gateway.repositories({actor:'owner',connectionId:7});
 assert.equal(repos.length,2);assert.equal(JSON.stringify(repos).includes('never expose'),false);
});
test('rejects unauthorized connection and unpinned revision',async()=>{
 await assert.rejects(gateway.repositories({actor:'owner',connectionId:8}));
 await assert.rejects(gateway.select({actor:'owner',connectionId:7,repository:'example/one',revision:'main'}));
});
test('selects only repositories in the installation',async()=>{
 const result=await gateway.select({actor:'owner',connectionId:7,repository:'example/two',revision:'a'.repeat(40)});
 assert.equal(result.repository,'example/two');
 await assert.rejects(gateway.select({actor:'owner',connectionId:7,repository:'other/private',revision:'a'.repeat(40)}));
});

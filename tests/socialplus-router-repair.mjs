import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {patchSocialPlus} from '../scripts/repair-socialplus-router.mjs';
const source=await readFile('heavenly-key-accounts/shared/portal-router/worker.mjs','utf8');
const origin='https://heavenly-key-social-management.fixture.workers.dev';
test('adds only SocialPlus and preserves other routes; repeat is idempotent',()=>{
 const result=patchSocialPlus(source,origin);
 assert.equal(result.replace("\n  'socialplus.heavenlykey.org': '"+origin+"',",''),source);
 assert.equal(patchSocialPlus(result,origin),result);
});
test('rejects foreign origins and an unexpected router',()=>{
 for(const bad of ['https://attacker.example','http://heavenly-key-social-management.fixture.workers.dev',origin+'/path'])assert.throws(()=>patchSocialPlus(source,bad));
 assert.throws(()=>patchSocialPlus('export default {}',origin));
});
test('forwards body, session, path and query and blocks foreign-origin writes',async()=>{
 const {route}=await import('data:text/javascript;base64,'+Buffer.from(patchSocialPlus(source,origin)).toString('base64'));
 const response=await route(new Request('https://socialplus.heavenlykey.org/api/draft?q=1',{method:'POST',headers:{Origin:'https://socialplus.heavenlykey.org',Cookie:'session=fixture'},body:'draft'}),async r=>{
  assert.equal(r.url,origin+'/api/draft?q=1');assert.equal(r.headers.get('Origin'),origin);assert.equal(r.headers.get('Cookie'),'session=fixture');assert.equal(await r.text(),'draft');return new Response('ok');
 });assert.equal(response.status,200);
 assert.equal((await route(new Request('https://socialplus.heavenlykey.org/api/draft',{method:'POST',headers:{Origin:'https://attacker.example'}}),()=>{throw Error('unexpected forwarding');})).status,403);
});

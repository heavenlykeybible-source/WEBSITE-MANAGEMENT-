import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync('control-room-worker.js','utf8');
const module=await import('./worker-test.mjs');
const {body,readLimited,login,ownerApi,minRole,route,UI,ghReadFile,ghFiles,corePutFile}=module;
let tests=0;
async function test(name,fn){await fn();tests++;console.log('PASS '+name)}
function db(handler){return {prepare(sql){let args=[];return {bind(...a){args=a;return this},async first(){return handler(sql,args,'first')},async run(){return handler(sql,args,'run')},async all(){return handler(sql,args,'all')}}}}}
await test('embedded browser JavaScript parses',()=>{const code=UI.match(/<script>([\s\S]*?)<\/script>/)[1];new vm.Script(code)});
await test('JSON rejects null, arrays, primitives and malformed input',async()=>{for(const v of ['null','[]','3','{'])await assert.rejects(body(new Request('https://test/',{method:'POST',body:v})),e=>e.status===400)});
await test('stream size is checked even without content-length',async()=>{await assert.rejects(readLimited(new Request('https://test/',{method:'POST',body:'12345'}),4),e=>e.status===413)});
await test('valid JSON passes and empty upload is supported',async()=>{assert.deepEqual(await body(new Request('https://test/',{method:'POST',body:'{"ok":true}'})),{ok:true});assert.equal((await readLimited(new Request('https://test/'),10)).length,0)});
await test('preview links enforce ownership',async()=>{const env={DB:db(()=>({owner_id:7}))};await assert.rejects(ownerApi(new Request('https://test/'),env,{id:1,kind:'staff',username:'owner'},'proposals/4/preview-link','GET',new URL('https://test/')),e=>e.status===404)});
await test('owner alone approves staff proposals',()=>{assert.equal(minRole('proposals/1/decide','POST'),4);assert.equal(minRole('proposals/1/undo','POST'),4)});
await test('cross-origin API requests rejected before database access',async()=>{await assert.rejects(route(new Request('https://test/api/login',{method:'POST',headers:{origin:'https://evil.test'}}),{ADMIN_USER:'owner',ADMIN_PASS:'strongpassword'}),e=>e.status===403)});
await test('missing signing secrets fail closed',async()=>{await assert.rejects(route(new Request('https://test/preview/1/9999999999999/'+ '0'.repeat(64)+'/'),{}),e=>e.status===503)});
await test('owner bootstrap password fails after setting a password',async()=>{const env={ADMIN_USER:'owner',ADMIN_PASS:'bootstrap-password',DB:db((sql)=>{if(sql.includes('COUNT(*)'))return {n:0};if(sql.includes("role='owner'"))return {id:1,status:'active',pass_hash:'set',email:null};if(sql.includes('(username=? OR email=?)'))return null;return {meta:{changes:1}}})};await assert.rejects(login(new Request('https://test/api/login',{method:'POST',body:JSON.stringify({user:'owner',pass:env.ADMIN_PASS})}),env),e=>e.status===401)});
await test('dashboard allows preview frames and prevents caching reset links',async()=>{const r=await module.default.fetch(new Request('https://test/'),{ADMIN_USER:'a',ADMIN_PASS:'b'});assert.match(r.headers.get('content-security-policy'),/frame-src 'self'/);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('referrer-policy'),'no-referrer')});
await test('large GitHub files cannot be saved as truncated content',async()=>{const key='a'.repeat(24);const originalFetch=globalThis.fetch; // Use encrypted credential via exported seal helper below.
const extra=module;
const env={VAULT_KEY:key};const token=await extra.seal(env,'token');globalThis.fetch=async()=>Response.json({encoding:'base64',sha:'abc',content:Buffer.from('x'.repeat(2097153)).toString('base64')});try{await assert.rejects(ghReadFile(env,{repo:'a/b',branch:'main',secret_enc:token},'a.js'),e=>e.status===413)}finally{globalThis.fetch=originalFetch}});
await test('large code upload bodies are bounded separately from login JSON',async()=>{const content='x'.repeat(1800000);const request=new Request('https://test/api/owner/propose-worker',{method:'POST',body:JSON.stringify({code:content})});assert.equal((await body(request)).code.length,content.length);await assert.rejects(body(new Request('https://test/api/login',{method:'POST',body:JSON.stringify({code:content})})),e=>e.status===413)});
await test('GitHub reads complete blobs when Contents API omits large file content',async()=>{const previous=globalThis.fetch,env={VAULT_KEY:'fixture-vault-long-enough'},secret_enc=await module.seal(env,'fixture-token'),source='x'.repeat(1200000);let calls=0;globalThis.fetch=async(url)=>{calls++;return Response.json(url.includes('/git/blobs/')?{encoding:'base64',content:Buffer.from(source).toString('base64')}:{type:'file',size:source.length,encoding:'none',sha:'blob-sha',content:''});};try{const file=await ghReadFile(env,{repo:'a/b',branch:'main',secret_enc},'app.js');assert.equal(file.content,source);assert.equal(file.truncated,false);assert.equal(calls,2);}finally{globalThis.fetch=previous;}});
console.log(`${tests} regression checks passed`);

import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {inspectZip,canSubmitPackage,acceptProposal,manageConnector,integrationsStatus} from 'file:///tmp/hkem-account4-upload-intake.mjs';

function createZip(files){
 const enc=new TextEncoder(),locals=[],centrals=[];let offset=0;
 for(const [name,content] of Object.entries(files)){
  const nameBytes=enc.encode(name),bytes=enc.encode(content),local=new Uint8Array(30+nameBytes.length+bytes.length),v=new DataView(local.buffer);
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(8,0,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,nameBytes.length,true);
  local.set(nameBytes,30);local.set(bytes,30+nameBytes.length);
  const central=new Uint8Array(46+nameBytes.length),c=new DataView(central.buffer);
  c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint32(20,bytes.length,true);c.setUint32(24,bytes.length,true);c.setUint16(28,nameBytes.length,true);c.setUint32(42,offset,true);central.set(nameBytes,46);
  locals.push(local);centrals.push(central);offset+=local.length;
 }
 const end=new Uint8Array(22),e=new DataView(end.buffer),centralSize=centrals.reduce((t,b)=>t+b.length,0);
 e.setUint32(0,0x06054b50,true);e.setUint16(8,centrals.length,true);e.setUint16(10,centrals.length,true);
 e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);
 const combined=[...locals,...centrals,end],out=new Uint8Array(combined.reduce((t,b)=>t+b.length,0));let i=0;for(const item of combined){out.set(item,i);i+=item.length;}
 return out;
}
const manifest='{"schemaVersion":1,"targetAccount":"1","kind":"theme-zip"}';
test('inspects safe ZIP and counts indexed files without executing them',()=>{
 const data=createZip({'account4-package.json':manifest,'heavenly-key-website/index.html':'<h1>Test only</h1>'});
 const info=inspectZip(data);assert.equal(info.fileCount,2);assert.ok(info.expandedBytes>0);
});
test('rejects unsafe and incompatible ZIP entries',()=>{
 const entries=['../secret.ts','folder/../../secrets.txt','.env','private-key.pem','nested.zip','src\\hack.ts','node_modules/a.js'];
 for(const entry of entries){const z=createZip({'account4-package.json':manifest,[entry]:'x'});assert.throws(()=>inspectZip(z),/Unsafe|unsupported/i,entry)}
 assert.throws(()=>inspectZip(createZip({'index.html':'test'})),/account4-package.json/);
});
test('reject ZIP path traversal in directory entries too',()=>{
 const names=['../','folder/../','folder/./','folder//','/absolute/','folder/../../','folder//nested/'];
 for(const name of names){
  const archive=createZip({'account4-package.json':manifest,[name]:'' ,'good/file.txt':'body'});
  assert.throws(()=>inspectZip(archive),/Unsafe|unsupported|inconsistent/i,'Unsafe directory: '+name);
 }
});
test('reject ZIPs whose local header disagrees with its central directory index',()=>{
 const valid=createZip({'account4-package.json':manifest,'src/index.js':'export default 1'});
 const badName=valid.slice();badName[30]='X'.charCodeAt(0);
 assert.throws(()=>inspectZip(badName),/file name differs/i,'Forged local filename');
 const badMethod=valid.slice();badMethod[8]=8;
 assert.throws(()=>inspectZip(badMethod),/headers disagree/i,'Forged local compression method');
 const badFlags=valid.slice();badFlags[6]=8;
 assert.throws(()=>inspectZip(badFlags),/headers disagree/i,'Forged local file flags');
});
test('connector authorization is private, provider-scoped and never a publish right',async()=>{
 const token='A'.repeat(48),expected=createHash('sha256').update(token).digest('hex');
 const env={OPENAI_SUBMIT_TOKEN_HASH:expected,DB:{prepare(){return {bind(){return {async first(){return null}}}}}}};
 assert.equal(await canSubmitPackage(new Request('https://preview.test/api/packages',{headers:{Authorization:'Bearer '+token}}),env,false),'chatgpt');
 assert.equal(await canSubmitPackage(new Request('https://preview.test/api/packages',{headers:{Authorization:'Bearer '+'x'.repeat(48)}}),env,false),null);
 assert.equal(await canSubmitPackage(new Request('https://preview.test/api/packages'),env,true),'dashboard');
});
test('assistant proposal remains stored in quarantine; no Cloudflare deployment occurs',async()=>{
 const stored=[];const statements=[];
 const env={
  CODE_INTAKE:{async head(){return null},async put(key,data){stored.push({key,size:data.length})}},
  DB:{prepare(sql){const cmd={sql,bind(...args){return{...cmd,args,async run(){return{meta:{changes:1}}},async first(){return null}}}};return cmd},async batch(rows){statements.push(...rows)}}
 };
 const document={schemaVersion:1,account:'1',name:'Homepage safe proposal',files:[{path:'heavenly-key-website/index.html',content:'<h1>Draft only</h1>'}]};
 const request=new Request('https://preview.test/api/proposals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(document)});
 const response=await acceptProposal(request,env,'chatgpt');
 assert.equal(response.status,201);
 const result=await response.json();assert.equal(result.status,'quarantined');assert.equal(stored.length,1);
 assert.ok(statements[0].args.includes('quarantined'));assert.equal(stored[0].key.includes('/proposals/'),true);
});
test('rejects assistant proposals containing path traversal',async()=>{
 const env={DB:{},CODE_INTAKE:{}};
 const p={schemaVersion:1,account:'1',name:'Unsafe title',files:[{path:'../passwords.json',content:'data'}]};
 const request=new Request('https://preview.test/api/proposals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});
 const response=await acceptProposal(request,env,'gemini');assert.equal(response.status,422);
});
test('dashboard has safe upload and up to five verified historical restore choices',()=>{
 const source=readFileSync('recovery-control/src/index.ts','utf8');
 const match=source.match(/const page = ("(?:\\.|[^"\\])*");/);assert.ok(match);
 const html=JSON.parse(match[1]),script=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(script);
 new vm.Script(script[1]);
 for(const key of ['package-upload','pkg-file','/api/packages','/api/integrations','slice(0,5)','Approve & Publish','Restore','cms-update-status','Check CMS Updates'])
  assert.ok(html.includes(key),'Missing dashboard feature '+key);
 assert.ok(source.includes("canSubmitPackage(req,env,owner)"),'Authenticated intake required');
 assert.ok(source.includes("acceptProposal(req,env,actor)"),'Assistant proposals must be restricted');
 assert.ok(source.includes("actor==='dashboard'&&!sameOrigin(req)"),'Same-origin CSRF protection');
 assert.ok(source.includes('verifyOwnerPassword(details?.password,env)'),'Rotating connector keys requires administrator password recheck');
});
test('owner can independently generate and revoke single-use displayed assistant connector credentials',async()=>{
 const values=new Map(),audit=[];
 const env={DB:{
  prepare(sql){return {bind(...args){return{
   async first(){return values.has(args[0])?{value:values.get(args[0])}:null},
   async run(){
    if(sql.startsWith('INSERT INTO account4_security_state'))values.set(args[0],args[1]);
    else if(sql.startsWith('INSERT INTO account4_connector_audit'))audit.push(args);
    else throw Error('Unexpected connector SQL');
    return{meta:{changes:1}};
   }
  }}}},
  async batch(statements){return Promise.all(statements.map(statement=>statement.run()));}
 }};
 const create=await manageConnector(env,{provider:'gemini',action:'rotate'});const info=await create.json();
 assert.equal(info.ok,true);assert.ok(/^[A-Za-z0-9_-]{43}$/.test(info.token));
 const authorized=await canSubmitPackage(new Request('https://control.test/api/proposals',{headers:{Authorization:'Bearer '+info.token}}),env,false);
 assert.equal(authorized,'gemini');
 const status=await (await integrationsStatus(env)).json();assert.equal(status.gemini,'configured');
 await manageConnector(env,{provider:'gemini',action:'revoke'});
 const blocked=await canSubmitPackage(new Request('https://control.test/api/proposals',{headers:{Authorization:'Bearer '+info.token}}),env,false);
 assert.equal(blocked,null);
 assert.deepEqual(audit,[['gemini','rotate','dashboard-admin'],['gemini','revoke','dashboard-admin']]);
 assert.equal(values.size,1,'Audit events must not overwrite credential state');
});
test('storage migration holds quarantine state and immutable SHA',()=>{
 const migration=readFileSync('recovery-control/migrations/0002_direct_upload.sql','utf8');
 for(const key of ['sha256 TEXT NOT NULL','account4_packages','account4_package_events','quarantined','source-proposal'])assert.ok(migration.includes(key));
 assert.ok(readFileSync('recovery-control/migrations/0003_security_quota.sql','utf8').includes('account4_intake_quota'));
 assert.ok(readFileSync('recovery-control/wrangler.toml','utf8').includes('heavenlykey-account4-code-quarantine'));
 assert.ok(readFileSync('recovery-control/src/package-intake.ts','utf8').includes('CODE_INTAKE'));
});

test('AI integrations are limited to submissions, not workflow promotion or key rotation',()=>{
 const source=readFileSync('recovery-control/src/index.ts','utf8');
 const authGate=source.indexOf('if(!owner){');
 const promote=source.indexOf('if (u.pathname === "/api/action"');
 assert.ok(authGate>0&&promote>authGate,'Production actions must be behind independent owner cookie authentication');
 assert.ok(source.includes("verifyOwnerPassword(details?.password,env)"),'Token management requires fresh owner-password proof');
 assert.ok(source.includes("'/api/integrations/openapi.json'"),'Downloadable assistant proposal spec is available');
 const spec=readFileSync('recovery-control/src/assistant-spec.ts','utf8');
 assert.ok(spec.includes('submitCodeProposalForReview'));
 assert.ok(!spec.includes("'/api/action'"),'External assistant schema cannot grant production controls');
});
test('owner production publishing and restoration require fresh masked password confirmation',()=>{
 const source=readFileSync('recovery-control/src/index.ts','utf8');
 assert.ok(source.includes("b.action==='promote'||b.action==='restore'"),'Both production actions require second password');
 assert.ok(source.includes('verifyOwnerPassword(b.ownerPassword,env)'),'Server must check owner password');
 const encoded=source.match(/const page = ("(?:\\.|[^"\\])*");/);assert.ok(encoded);
 const html=JSON.parse(encoded[1]);
 assert.ok(html.includes("input.type='password'"),'Mask password confirmation input');
 assert.ok(html.includes("await maskedPassword('Confirm"),'Production action requires password dialog');
 assert.ok(html.includes("Check CMS Updates"),'CMS update catalog control is displayed');
 assert.ok(source.includes("u.pathname==='/api/cms-updates'"),'CMS update API is wired');
});
test('production and emergency restore use separate trusted CMS policy sources',()=>{
 for(const path of ['.github/workflows/cloudflare-production.yml','.github/workflows/emergency-restore-account-1.yml']){
  const workflow=readFileSync(path,'utf8');
  assert.ok(workflow.includes('path: .trusted-cms-policy'),'Missing separate policy checkout in '+path);
  assert.ok(workflow.includes('ref: main'),'Trusted compatibility policy must be read from current main');
  assert.ok(workflow.includes('node .trusted-cms-policy/scripts/cms-permanence-gate.mjs'),'Must refuse restoring/deploying CMS-breaking Worker versions');
 }
});


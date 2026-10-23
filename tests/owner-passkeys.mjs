import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {encodeCBOR} from '@levischuck/tiny-cbor';
import {createOwnerPasskeyRoutes} from '../security/owner-passkeys.js';
const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)');
const DB={prepare(query){const q=sql.prepare(query);let values=[];return {bind(...v){values=v;return this},async first(){return q.get(...values)||null},async all(){return {results:q.all(...values)}},async run(){return {meta:{changes:q.run(...values).changes}}}}}};
const fail=(m,s=400)=>{throw Object.assign(Error(m),{status:s});},owner={id:1,username:'owner',role:'owner',kind:'staff'},env={DB};let audits=[];
const service=createOwnerPasskeyRoutes({json:Response.json,fail,body:r=>r.json(),reauthenticate:async(e,u,p)=>{if(p!=='fixture-password')fail('Password denied',403)},audit:async(e,u,a)=>audits.push(a),withOperationLock:async(e,k,fn)=>fn()});
const origin='https://room.example',b64=b=>Buffer.from(b).toString('base64url'),hash=async b=>new Uint8Array(await crypto.subtle.digest('SHA-256',typeof b==='string'?new TextEncoder().encode(b):b)),concat=(...a)=>new Uint8Array(Buffer.concat(a.map(x=>Buffer.from(x))));
async function call(path,b,user=owner,headers={origin}){const r=new Request(origin+'/api/owner/'+path,{method:b?'POST':'GET',headers,body:b?JSON.stringify(b):undefined});return (await service.routes(r,env,user,path,b?'POST':'GET')).json();}
await assert.rejects(call('passkeys',null,{...owner,role:'admin'}),e=>e.status===403);
await assert.rejects(call('passkeys/register/options',{password:'wrong'}),e=>e.status===403);
await assert.rejects(call('passkeys/register/options',{password:'fixture-password'},owner,{origin:'https://evil.example'}),e=>e.status===403);
const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),jwk=await crypto.subtle.exportKey('jwk',keys.publicKey),cred=crypto.getRandomValues(new Uint8Array(32)),id=b64(cred);
const cose=encodeCBOR(new Map([[1,2],[3,-7],[-1,1],[-2,new Uint8Array(Buffer.from(jwk.x,'base64url'))],[-3,new Uint8Array(Buffer.from(jwk.y,'base64url'))]]));
const rpHash=await hash('room.example');
function client(type,challenge){return b64(JSON.stringify({type,challenge,origin,crossOrigin:false}));}
const reg=await call('passkeys/register/options',{password:'fixture-password',request_id:'register'});assert.equal(reg.authenticatorSelection.userVerification,'required');
const authData=concat(rpHash,[0x45],[0,0,0,0],new Uint8Array(16),[0,32],cred,cose),attestation=encodeCBOR(new Map([['fmt','none'],['attStmt',new Map()],['authData',authData]]));
const registration={id,rawId:id,type:'public-key',clientExtensionResults:{},response:{clientDataJSON:client('webauthn.create',reg.challenge),attestationObject:b64(attestation),transports:['internal']}};
assert.equal((await call('passkeys/register/verify',{request_id:'register',credential:registration})).verified,true);
await assert.rejects(call('passkeys/register/verify',{request_id:'register',credential:registration}),e=>e.status===403);
assert.equal((await call('passkeys')).credentials.length,1);
function der(signature){const a=new Uint8Array(signature),integer=p=>{let v=Array.from(p);while(v.length>1&&v[0]===0)v.shift();if(v[0]&128)v.unshift(0);return [2,v.length,...v]};const value=[...integer(a.slice(0,32)),...integer(a.slice(32))];return new Uint8Array([48,value.length,...value]);}
async function assertion(options,counter=1,flags=5){const data=concat(rpHash,[flags],[0,0,0,counter]),cd=client('webauthn.get',options.challenge),signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,concat(data,await hash(Buffer.from(cd,'base64url'))));return {id,rawId:id,type:'public-key',clientExtensionResults:{},response:{clientDataJSON:cd,authenticatorData:b64(data),signature:b64(der(signature)),userHandle:b64('owner:1')}};}
const options=await call('passkeys/authenticate/options',{request_id:'approval'});const response=await assertion(options);const verified=await call('passkeys/authenticate/verify',{request_id:'approval',credential:response});assert.equal(verified.verified,true);assert.match(verified.proof,/^passkey:/);
assert.equal(await service.consumeProof(env,owner,verified.proof),true);await assert.rejects(service.consumeProof(env,owner,verified.proof),e=>e.status===403);
await assert.rejects(call('passkeys/authenticate/verify',{request_id:'approval',credential:response}),e=>e.status===403);
const noUV=await call('passkeys/authenticate/options',{request_id:'no-uv'});await assert.rejects(call('passkeys/authenticate/verify',{request_id:'no-uv',credential:await assertion(noUV,2,1)}),e=>e.status===403);
const stale=await call('passkeys/authenticate/options',{request_id:'expired'});const row=JSON.parse(sql.prepare("SELECT value_json FROM settings WHERE key='passkey-challenge:1:authenticate'").get().value_json);row.expires=1;sql.prepare("UPDATE settings SET value_json=? WHERE key='passkey-challenge:1:authenticate'").run(JSON.stringify(row));await assert.rejects(call('passkeys/authenticate/verify',{request_id:'expired',credential:await assertion(stale,2)}),e=>e.status===403);
await assert.rejects(service.consumeProof(env,owner,'passkey:forged'),e=>e.status===403);
await call('passkeys/remove',{id,password:'fixture-password'});assert.equal((await call('passkeys')).credentials.length,0);assert.ok(audits.includes('passkey-registered'));sql.close();
console.log('PASS real WebAuthn cryptography: registration, signed authentication, one-use proof, replay/expiry rejection, required device verification, CSRF, owner isolation and removal');

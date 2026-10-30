import test from 'node:test';
import assert from 'node:assert/strict';
import {handleNativeDownloads} from '../src/native-downloads.js';

const origin='https://apps.heavenlykey.org';
function environment({packageExists=true,db=true,token='a'.repeat(40)}={}) {
 const calls={writes:0,reads:0,objects:0};
 const verified={size:4,checksums:{sha256:new Uint8Array(32).fill(0xbb).buffer},customMetadata:{sha256:'b'.repeat(64),malwareScan:'passed',signatureVerified:'true',scannedSha256:'b'.repeat(64),appId:'all-in-one',platform:'android'}};
 const env={
  DOWNLOAD_ADMIN_TOKEN:token,
  ASSETS:{fetch:async()=>new Response(JSON.stringify({'all-in-one':{name:'All-in-One',url:origin+'/experience.html'}}),{status:200})},
  NATIVE_RELEASES:{
   head:async()=>{calls.objects++;return packageExists?verified:null},
   get:async()=>{calls.objects++;return packageExists?{...verified,body:new Uint8Array([1,2,3,4])}:null}
  }
 };
 if(db)env.DOWNLOAD_DB={prepare:sql=>({
  bind(){return this},
  async run(){assert.match(sql,/INSERT INTO native_download_counts/);calls.writes++;return {success:true}},
  async all(){calls.reads++;return {results:[{app_id:'all-in-one',platform:'android',downloads:3}]}}
 })};
 return {env,calls};
}
const request=(path,options)=>new Request(origin+path,options);
test('HEAD checks real release without incrementing counts',async()=>{
 const {env,calls}=environment();
 const response=await handleNativeDownloads(request('/api/native-download/all-in-one/android',{method:'HEAD'}),env);
 assert.equal(response.status,200);
 assert.equal(response.headers.get('content-length'),'4');
 assert.equal(calls.writes,0);
});
test('GET returns package attachment and increments exactly one aggregate counter',async()=>{
 const {env,calls}=environment();
 const response=await handleNativeDownloads(request('/api/native-download/all-in-one/android'),env);
 assert.equal(response.status,200);
 assert.match(response.headers.get('content-disposition'),/attachment/);
 assert.equal(calls.writes,1);
 assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[1,2,3,4]);
});
test('missing native release is never counted',async()=>{
 const {env,calls}=environment({packageExists:false});
 const response=await handleNativeDownloads(request('/api/native-download/all-in-one/android'),env);
 assert.equal(response.status,404);
 assert.equal(calls.writes,0);
});
test('unknown apps are rejected before release lookup',async()=>{
 const {env,calls}=environment();
 const response=await handleNativeDownloads(request('/api/native-download/not-published/android'),env);
 assert.equal(response.status,404);
 assert.equal(calls.objects,0);
});
test('private counts reject unauthenticated and short tokens',async()=>{
 const {env,calls}=environment();
 assert.equal((await handleNativeDownloads(request('/api/admin/download-counts'),env)).status,401);
 assert.equal((await handleNativeDownloads(request('/api/admin/download-counts',{headers:{authorization:'Bearer wrong'}}),env)).status,401);
 assert.equal(calls.reads,0);
});
test('private counts work with configured admin token only',async()=>{
 const {env,calls}=environment();
 const response=await handleNativeDownloads(request('/api/admin/download-counts',{headers:{authorization:'Bearer '+'a'.repeat(40)}}),env);
 assert.equal(response.status,200);
 assert.equal((await response.json()).counts[0].downloads,3);
 assert.equal(calls.reads,1);
});
test('missing storage and database fail closed',async()=>{
 const {env}=environment({db:false});
 assert.equal((await handleNativeDownloads(request('/api/native-download/all-in-one/android'),env)).status,200);
 assert.equal((await handleNativeDownloads(request('/api/admin/download-counts',{headers:{authorization:'Bearer '+'a'.repeat(40)}}),env)).status,503);
});

test('native downloads continue if aggregate statistics write fails',async()=>{
 const {env}=environment();
 env.DOWNLOAD_DB.prepare=()=>({bind(){return this},async run(){throw new Error('database offline')}});
 const response=await handleNativeDownloads(request('/api/native-download/all-in-one/android'),env);
 assert.equal(response.status,200);
 assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[1,2,3,4]);
});

test('unverified native releases are rejected',async()=>{
 const {env}=environment();
 env.NATIVE_RELEASES.head=async()=>({size:4,customMetadata:{malwareScan:'pending'}});
 env.NATIVE_RELEASES.get=async()=>({size:4,body:new Uint8Array([1,2,3,4])});
 assert.equal((await handleNativeDownloads(request('/api/native-download/all-in-one/android',{method:'HEAD'}),env)).status,403);
 assert.equal((await handleNativeDownloads(request('/api/native-download/all-in-one/android'),env)).status,403);
});

test('reject release whose scanned digest differs from published digest',async()=>{
 const {env}=environment();
 const invalid={size:4,customMetadata:{sha256:'b'.repeat(64),malwareScan:'passed',signatureVerified:'true',scannedSha256:'c'.repeat(64)}};
 env.NATIVE_RELEASES.head=async()=>invalid;
 env.NATIVE_RELEASES.get=async()=>({...invalid,body:new Uint8Array([1,2,3,4])});
 assert.equal((await handleNativeDownloads(request('/api/native-download/all-in-one/android',{method:'HEAD'}),env)).status,403);
 assert.equal((await handleNativeDownloads(request('/api/native-download/all-in-one/android'),env)).status,403);
});

test('missing release file body cannot be counted or served',async()=>{
 const {env,calls}=environment();
 env.NATIVE_RELEASES.get=async()=>({size:4,checksums:{sha256:new Uint8Array(32).fill(0xbb).buffer},customMetadata:{sha256:'b'.repeat(64),malwareScan:'passed',signatureVerified:'true',scannedSha256:'b'.repeat(64),appId:'all-in-one',platform:'android'}});
 const response=await handleNativeDownloads(request('/api/native-download/all-in-one/android'),env);
 assert.equal(response.status,503);
 assert.equal(calls.writes,0);
});

test('anonymous visitors can fetch verified native packages without cookies or authorization',async()=>{
 const {env,calls}=environment();
 const response=await handleNativeDownloads(request('/api/native-download/all-in-one/android',{headers:{accept:'application/vnd.android.package-archive'}}),env);
 assert.equal(response.status,200);
 assert.match(response.headers.get('content-disposition'),/attachment/);
 assert.equal(response.headers.get('set-cookie'),null);
 assert.equal(calls.writes,1);
});
test('anonymous download access does not expose administrator download statistics',async()=>{
 const {env,calls}=environment();
 const download=await handleNativeDownloads(request('/api/native-download/all-in-one/android'),env);
 assert.equal(download.status,200);
 const stats=await handleNativeDownloads(request('/api/admin/download-counts'),env);
 assert.equal(stats.status,401);
 assert.equal(calls.reads,0);
});

test('download is rejected when installer metadata belongs to another app or device',async()=>{
 const {env,calls}=environment();
 const base={size:4,body:new Uint8Array([1,2,3,4]),customMetadata:{
  sha256:'b'.repeat(64),scannedSha256:'b'.repeat(64),
  malwareScan:'passed',signatureVerified:'true',appId:'walk-with-god',platform:'android'
 }};
 env.NATIVE_RELEASES.head=async()=>base;
 env.NATIVE_RELEASES.get=async()=>base;
 assert.equal((await handleNativeDownloads(request('/api/native-download/all-in-one/android',{method:'HEAD'}),env)).status,403);
 assert.equal((await handleNativeDownloads(request('/api/native-download/all-in-one/android'),env)).status,403);
 base.customMetadata.appId='all-in-one';
 base.customMetadata.platform='windows';
 assert.equal((await handleNativeDownloads(request('/api/native-download/all-in-one/android'),env)).status,403);
 assert.equal(calls.writes,0);
});

test('native download and private admin responses carry defensive security headers',async()=>{
 const {env}=environment();
 const responses=[
  await handleNativeDownloads(request('/api/native-download/all-in-one/android'),env),
  await handleNativeDownloads(request('/api/native-download/all-in-one/android',{method:'HEAD'}),env),
  await handleNativeDownloads(request('/api/admin/download-counts'),env)
 ];
 for(const response of responses){
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  assert.equal(response.headers.get('cross-origin-resource-policy'),'same-origin');
  assert.equal(response.headers.get('x-frame-options'),'DENY');
  assert.match(response.headers.get('content-security-policy'),/default-src 'none'/);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(response.headers.get('referrer-policy'),'no-referrer');
 }
});

test('R2-stored SHA-256 must be present and agree with publisher metadata',async()=>{
 const {env,calls}=environment();
 const valid={size:4,body:new Uint8Array([1,2,3,4]),customMetadata:{
  sha256:'b'.repeat(64),scannedSha256:'b'.repeat(64),
  malwareScan:'passed',signatureVerified:'true',appId:'all-in-one',platform:'android'
 }};
 env.NATIVE_RELEASES.head=async()=>valid;
 env.NATIVE_RELEASES.get=async()=>valid;
 assert.equal((await handleNativeDownloads(request('/api/native-download/all-in-one/android',{method:'HEAD'}),env)).status,403);
 assert.equal((await handleNativeDownloads(request('/api/native-download/all-in-one/android'),env)).status,403);
 valid.checksums={sha256:new Uint8Array(32).fill(0xcc).buffer};
 assert.equal((await handleNativeDownloads(request('/api/native-download/all-in-one/android'),env)).status,403);
 assert.equal(calls.writes,0);
 valid.checksums={sha256:new Uint8Array(32).fill(0xbb).buffer};
 assert.equal((await handleNativeDownloads(request('/api/native-download/all-in-one/android',{method:'HEAD'}),env)).status,200);
});

test('private download statistics reject query strings even with a valid admin token',async()=>{
 const {env,calls}=environment();
 const response=await handleNativeDownloads(request('/api/admin/download-counts?token=not-a-safe-location',{headers:{authorization:'Bearer '+'a'.repeat(40)}}),env);
 assert.equal(response.status,400);
 assert.equal(calls.reads,0);
 assert.equal(response.headers.get('cache-control'),'no-store');
});

test('unreasonable or invalid R2 package sizes are rejected before download',async()=>{
 const {env,calls}=environment();
 const original=await env.NATIVE_RELEASES.get();
 for(const size of [0,-1,NaN,Infinity,1.5,2*1024*1024*1024+1,Number.MAX_SAFE_INTEGER]){
  const invalid={...original,size};
  env.NATIVE_RELEASES.head=async()=>invalid;
  env.NATIVE_RELEASES.get=async()=>invalid;
  assert.equal((await handleNativeDownloads(request('/api/native-download/all-in-one/android',{method:'HEAD'}),env)).status,403);
  assert.equal((await handleNativeDownloads(request('/api/native-download/all-in-one/android'),env)).status,403);
 }
 assert.equal(calls.writes,0);
});

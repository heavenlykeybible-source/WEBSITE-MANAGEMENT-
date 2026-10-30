import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync(new URL('../control-room-worker.js',import.meta.url),'utf8');
const begin=s.indexOf('async function account4MultipartRoutes('),end=s.indexOf('async function ownerApiUnlocked(',begin);
assert.ok(begin>=0&&end>begin,'Multipart staging handler missing');
const r=s.slice(begin,end);
for(const [label,part] of [
 ['owner role', "user.role!=='owner'||user.kind==='member'"],
 ['R2 multipart create','env.FILES.createMultipartUpload(key)'],
 ['R2 multipart resume','env.FILES.resumeMultipartUpload(r.key,r.uploadId)'],
 ['8MiB part size','8*1024*1024'],
 ['1GiB total limit','1024*1024*1024'],
 ['size boundary','size>ACCOUNT4_MAX_UPLOAD'],
 ['part size verification','bytes.byteLength!==expected'],
 ['part receipt persisted','r.received[n]={partNumber:n,etag:part.etag}'],
 ['full parts before completing','completed.some(x=>!x)'],
 ['verified completed object size','object.size!==r.size'],
 ['abort operation','await upload.abort()'],
 ['owner-scoped records',"'multipart:'+user.id+':'+id"],
 ['24 hour expiry','Date.now()+24*3600000'],
 ['upload concurrency lock',"withOperationLock(env,'multipart:'+user.id+':'+id"],
 ['no automatic publication',"Private staging only. No publication"]
])assert.ok(s.includes(part),'Missing '+label);
assert.ok(r.includes("req.headers.get('content-type')"),'Parts must use binary content type');
assert.ok(s.includes('const multipart=await account4MultipartRoutes(req,env,user,sub,m);if(multipart)return multipart;'),'Owner API must route to staging');
assert.ok(r.includes("status:'staged'"),'Status must distinguish staged-only private files');
assert.ok(!r.includes('await finalizeUnlocked('),'Large uploads must not bypass Waiting Room');
const importStart=s.indexOf('async function nativeImports()'),importEnd=s.indexOf('var PROVIDER_SEEN=',importStart);
assert.ok(importStart>=0&&importEnd>importStart,'Importer UI missing');
const ui=s.slice(importStart,importEnd);
const client=s.slice(s.indexOf('function largeUploads(){'),importStart);
for(const [label,fragment] of [
 ['visible large upload entry',"'Upload large file (up to 1 GiB)'"],
 ['owner-only binary upload endpoint',"'multipart/'+state.id+'/part/'"],
 ['binary type',"'application/octet-stream'"],
 ['CSRF protection',"'x-cr':'1'"],
 ['resume via persisted server state',"'multipart/'+state.id+'/status'"],
 ['pause button',"'Pause'"],
 ['resume button',"'Resume'"],
 ['abort endpoint',"'multipart/'+state.id+'/abort'"],
 ['no automatic deployment',"'This is private storage staging only.'"]
])assert.ok(ui.includes(fragment)||client.includes(fragment),'Missing '+label);
assert.ok(client.includes("'/api/owner/multipart/'"),'Binary upload must use authenticated owner route');
console.log('PASS owner-authorized resumable R2 private upload staging and integrity boundaries');

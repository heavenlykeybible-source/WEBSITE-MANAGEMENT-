// Real network release gate. Passing unit tests never proves an installer is publicly available.
import {createHash} from 'node:crypto';
const origin='https://apps.heavenlykey.org';
const types={android:'application/vnd.android.package-archive',windows:'application/msix',mac:'application/x-apple-diskimage'};
const full=process.argv.includes('--full');
const appId='all-in-one';
const results=[];
const expectedMax=2147483648;
async function request(url,method){
 const response=await fetch(url,{method,redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(full?180000:25000)});
 if(response.url!==url)throw Error('Redirect or origin changed');
 return response;
}
function validate(response,platform){
 if(response.status!==200)throw Error('HTTP '+response.status+' (no public native package)');
 if((response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!==types[platform])throw Error('Wrong package MIME');
 if(response.headers.has('content-range'))throw Error('Partial response');
 const raw=response.headers.get('content-length')||'';
 if(!/^[1-9][0-9]*$/.test(raw))throw Error('Missing or invalid package size');
 const bytes=Number(raw);
 if(!Number.isSafeInteger(bytes)||bytes>expectedMax)throw Error('Invalid package length');
 const digest=response.headers.get('x-release-sha256')||'';
 if(!/^[a-f0-9]{64}$/i.test(digest))throw Error('Missing release SHA-256');
 return {bytes,digest:digest.toLowerCase()};
}
for(const platform of Object.keys(types)){
 const url=origin+'/api/native-download/'+appId+'/'+platform;
 try{
  const head=validate(await request(url,'HEAD'),platform);
  if(full){
   const response=await request(url,'GET');
   const actual=validate(response,platform);
   if(actual.bytes!==head.bytes||actual.digest!==head.digest)throw Error('HEAD and GET release mismatch');
   const reader=response.body?.getReader();if(!reader)throw Error('No installer stream');
   const hash=createHash('sha256');let count=0;
   try{
    for(;;){const {done,value}=await reader.read();if(done)break;
     count+=value.length;if(count>head.bytes||count>expectedMax)throw Error('Oversized installer stream');
     hash.update(value);}
   }finally{reader.releaseLock();}
   if(count!==head.bytes)throw Error('Incomplete installer');
   if(hash.digest('hex')!==head.digest)throw Error('Installer SHA-256 mismatch');
  }
  results.push({platform,status:'verified',mode:full?'full-byte-hash':'HEAD-metadata',bytes:head.bytes});
 }catch(error){results.push({platform,status:'blocked',reason:String(error.message||error)});process.exitCode=1;}
}
console.log(JSON.stringify({origin,fullDownloadVerified:full,results},null,2));
if(process.exitCode)console.error('Native release gate FAILED. Do not advertise native package availability.');

// Read-only release gate: configuration is necessary, not proof of media delivery.
import {pathToFileURL} from 'node:url';
export function blockers(h, broadcast=false) {
 const required=['ok','accountsConfigured','databaseReady','meetingConfigured','turnConfigured'];
 if(broadcast)required.push('relayConfigured');
 return required.filter(k=>h[k]!==true);
}
export async function checkLive(origin, broadcast=false) {
 const u=new URL(origin);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('Use the exact HTTPS application origin');
 const response=await fetch(new URL('/api/health',u),{signal:AbortSignal.timeout(15000),redirect:'error',headers:{'cache-control':'no-cache'}});
 if(!response.ok)throw Error('Health endpoint returned HTTP '+response.status);
 const h=await response.json(), missing=blockers(h,broadcast);
 console.log(JSON.stringify({origin:u.origin,releaseId:h.releaseId,configurationReady:missing.length===0,missing,liveMediaTestRequired:true},null,2));
 return missing.length===0;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{if(!await checkLive(process.argv[2]||'https://meetingspace.heavenlykey.org',process.argv.includes('--broadcast')))process.exitCode=1;}
 catch(e){console.error(e.message);process.exitCode=1;}
}

/**
 * R2-backed resumable import assembly. The caller must authenticate the owner
 * or an authorized AI, persist upload session metadata and enforce quotas.
 * Never use the client-provided key as an R2 object key.
 */
export const CHUNK_SIZE=8*1024*1024;
export const MAX_PACKAGE_SIZE=1024*1024*1024;
const HEX=/^[a-f0-9]{64}$/i;
function checkSession(s){
 if(!s||typeof s.id!=='string'||!/^[a-zA-Z0-9_-]{16,128}$/.test(s.id)||
 !Number.isSafeInteger(s.totalBytes)||s.totalBytes<1||s.totalBytes>MAX_PACKAGE_SIZE||
 !HEX.test(s.sha256||''))throw Error('Invalid upload session');
}
export function chunkPlan(totalBytes){
 if(!Number.isSafeInteger(totalBytes)||totalBytes<1||totalBytes>MAX_PACKAGE_SIZE)throw Error('Upload size unsupported');
 return {totalBytes,chunkSize:CHUNK_SIZE,chunks:Math.ceil(totalBytes/CHUNK_SIZE)};
}
export async function receiveChunk({session,index,bytes,sha256,put,hash}){
 checkSession(session);
 if(typeof put!=='function'||typeof hash!=='function')throw Error('Upload storage unavailable');
 const plan=chunkPlan(session.totalBytes);
 if(!Number.isSafeInteger(index)||index<0||index>=plan.chunks)throw Error('Invalid chunk index');
 const expected=index===plan.chunks-1?session.totalBytes-index*CHUNK_SIZE:CHUNK_SIZE;
 if(!(bytes instanceof Uint8Array)||bytes.byteLength!==expected||!HEX.test(sha256||''))throw Error('Chunk size or checksum invalid');
 const digest=await hash(bytes);
 if(digest.toLowerCase()!==sha256.toLowerCase())throw Error('Chunk checksum mismatch');
 const key='imports/'+session.id+'/parts/'+String(index).padStart(4,'0');
 await put(key,bytes,{sha256:digest.toLowerCase()});
 return {index,key,bytes:expected,sha256:digest.toLowerCase()};
}
export async function verifyUpload({session,parts,hash,read}){
 checkSession(session);
 if(!Array.isArray(parts)||typeof read!=='function'||typeof hash!=='function')throw Error('Upload verification unavailable');
 const plan=chunkPlan(session.totalBytes);
 if(parts.length!==plan.chunks)throw Error('Missing upload chunks');
 let total=0;
 const verified=[];
 for(let i=0;i<parts.length;i++){
  const part=parts[i],key='imports/'+session.id+'/parts/'+String(i).padStart(4,'0');
  if(part?.index!==i||part.key!==key||!HEX.test(part.sha256||''))throw Error('Unexpected upload part');
  const bytes=await read(key);
  const expected=i===plan.chunks-1?session.totalBytes-i*CHUNK_SIZE:CHUNK_SIZE;
  if(!(bytes instanceof Uint8Array)||bytes.length!==expected)throw Error('Stored chunk size mismatch');
  if((await hash(bytes)).toLowerCase()!==part.sha256.toLowerCase())throw Error('Stored chunk checksum mismatch');
  total+=bytes.length;verified.push(bytes);
 }
 if(total!==session.totalBytes)throw Error('Package size mismatch');
 // Full package hash must be verified by a streaming hash service before release.
 return {verifiedChunks:verified.length,totalBytes:total,fullChecksumVerified:false,readyForRelease:false};
}

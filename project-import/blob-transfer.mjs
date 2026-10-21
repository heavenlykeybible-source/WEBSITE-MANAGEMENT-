import {createHash} from 'node:crypto';
import {validateProjectManifest} from './validation.mjs';
const API='https://api.github.com';
const MAX_BYTES=50*1024*1024;
function gitBlobSha(bytes) {
  const header=Buffer.from('blob '+bytes.length+'\0');
  return createHash('sha1').update(header).update(bytes).digest('hex');
}
export async function fetchVerifiedProjectFiles({fetcher,token,inspection,store}) {
  if(typeof fetcher!=='function'||typeof store!=='function'||!token)throw Error('Server-side transport and storage required');
  if(!inspection||!Array.isArray(inspection.files))throw Error('Inspection required');
  const [owner,name]=inspection.repository.split('/');
  const files=[];let total=0;
  for(const file of inspection.files) {
    if(!/^[a-f0-9]{40}$/.test(file.gitBlobSha)||file.bytes>MAX_BYTES)throw Error('Invalid blob');
    const url=API+'/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(name)+'/git/blobs/'+file.gitBlobSha;
    const response=await fetcher(url,{method:'GET',redirect:'manual',headers:{authorization:'Bearer '+token,accept:'application/vnd.github.raw+json','x-github-api-version':'2022-11-28'}});
    if(!response.ok||response.status>=300)throw Error('GitHub blob fetch failed');
    const data=new Uint8Array(await response.arrayBuffer());
    if(data.byteLength!==file.bytes||gitBlobSha(data)!==file.gitBlobSha)throw Error('GitHub blob integrity mismatch');
    total+=data.byteLength;if(total>250*1024*1024)throw Error('Project size limit exceeded');
    const sha256=createHash('sha256').update(data).digest('hex');
    const key='project-imports/'+inspection.revision+'/'+sha256;
    // The storage adapter must enforce immutable create-only writes.
    const saved=await store({key,bytes:data,sha256,createOnly:true});
    if(!saved?.created&&!saved?.alreadyVerified)throw Error('Immutable storage not confirmed');
    files.push({path:file.path,bytes:data.byteLength,sha256,storageKey:key});
  }
  const manifest=validateProjectManifest({...inspection,files});
  return {manifest,storage:files.map(({path,storageKey,sha256})=>({path,storageKey,sha256}))};
}

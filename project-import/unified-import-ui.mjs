/**
 * Account 4 unified import navigation.
 * Legacy Account 3 / TinyFish shortcuts are deliberately excluded.
 * Account 3 remains a normal selectable deployment destination.
 */
export const IMPORT_STEPS = Object.freeze([
  {id:'source',label:'Select source'},
  {id:'scan',label:'Scan files'},
  {id:'destination',label:'Choose destination'},
  {id:'preview',label:'Preview'},
  {id:'approval',label:'Waiting Room'},
  {id:'release',label:'Release'}
]);
export const IMPORT_SOURCES = Object.freeze([
  {id:'github',label:'GitHub repository'},
  {id:'upload',label:'Phone / computer upload'},
  {id:'google-drive',label:'Google Drive'},
  {id:'ai',label:'AI release package'},
  {id:'r2',label:'Stored project'}
]);
export function importNavigation(items=[]) {
  if(!Array.isArray(items)) throw Error('Navigation must be an array');
  return items.filter(item=>{
    const label=String(item?.label||'').toLowerCase();
    const href=String(item?.href||'').toLowerCase();
    return !(/tiny[ -]?fish/.test(label+' '+href) ||
      /(?:^|[\\/\-_])account[ -_]?3(?:$|[\\/\-_])/.test(label+' '+href) ||
      /(?:^|[\\/\-_])legacy[ -_]?import(?:$|[\\/\-_])/.test(label+' '+href));
  });
}
export function availableDestinations(connections=[]) {
  if(!Array.isArray(connections)) throw Error('Connections must be an array');
  return connections.filter(c=>c?.connected===true && Number.isSafeInteger(c.connectionId) && c.connectionId>0 &&
    typeof c.accountId==='string' && /^[a-f0-9]{32}$/i.test(c.accountId))
    .map(c=>({connectionId:c.connectionId,accountId:c.accountId,label:String(c.label||'Cloudflare account')}));
}
export function validateImportStep(step,context={}) {
  if(!IMPORT_STEPS.some(s=>s.id===step)) throw Error('Unknown import step');
  if(step==='source') return IMPORT_SOURCES.some(s=>s.id===context.source?.type);
  if(step==='scan') return context.scan?.passed===true && context.scan?.unsafeFiles===0;
  if(step==='destination') return availableDestinations(context.connections).some(c=>c.connectionId===context.destination?.connectionId && c.accountId===context.destination?.accountId);
  if(step==='preview') return context.buildVerified===true && context.previewVerified===true;
  if(step==='approval') return context.ownerApproved===true && context.proposalId;
  return context.ownerApproved===true && context.buildVerified===true && context.previewVerified===true && context.liveReleaseAuthorized===true;
}

/** 1 GiB is a total package ceiling, not a single HTTP request limit.
 * Upload services must implement resumable chunking, checksums and R2 storage.
 */
export const MAX_IMPORT_BYTES = 1024 * 1024 * 1024;
export const IMPORT_CHUNK_BYTES = 8 * 1024 * 1024;
export function validatePackageManifest(manifest) {
  if(!manifest || !['website','worker','application','archive'].includes(manifest.kind))
    throw Error('Unsupported complete project type');
  if(!Number.isSafeInteger(manifest.totalBytes) || manifest.totalBytes<1 || manifest.totalBytes>MAX_IMPORT_BYTES)
    throw Error('Package exceeds 1 GiB import limit');
  if(!Array.isArray(manifest.files) || manifest.files.length<1 || manifest.files.length>100000)
    throw Error('File inventory required');
  let sum=0;const seen=new Set();
  for(const f of manifest.files){
    if(typeof f.path!=='string' || !f.path || f.path.startsWith('/') || f.path.includes('\\\\') ||
       f.path.split('/').some(x=>!x||x==='.'||x==='..') || /[\\x00-\\x1f]/.test(f.path) ||
       !Number.isSafeInteger(f.bytes) || f.bytes<0 || !/^[a-f0-9]{64}$/i.test(f.sha256||''))
      throw Error('Unsafe or unverified project file');
    const key=f.path.toLowerCase();if(seen.has(key))throw Error('Duplicate file path');
    seen.add(key);sum+=f.bytes;
  }
  if(sum!==manifest.totalBytes)throw Error('Package byte count mismatch');
  return {valid:true,totalBytes:sum,fileCount:manifest.files.length,chunkBytes:IMPORT_CHUNK_BYTES};
}

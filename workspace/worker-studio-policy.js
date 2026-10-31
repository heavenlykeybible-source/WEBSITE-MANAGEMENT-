// Pure, fail-closed rules for the planned AI Worker Development Studio.
// Never performs a Cloudflare write; publishing remains a separate owner action.
const WORKER_NAME=/^[a-z0-9][a-z0-9-]{0,62}$/;
const DIGEST=/^[a-f0-9]{64}$/;
export function workerStudioRevision(input){
 const connection=Number(input?.connection),worker=String(input?.worker||'');
 if(!Number.isSafeInteger(connection)||connection<1)throw Error('Select one saved Cloudflare connection');
 if(!WORKER_NAME.test(worker))throw Error('Select one exact Worker');
 const source=String(input?.source||'');
 if(!source.trim()||new TextEncoder().encode(source).length>1400000)throw Error('Worker source must be 1–1,400,000 bytes');
 const base_sha256=String(input?.base_sha256||'').toLowerCase();
 if(!DIGEST.test(base_sha256))throw Error('Read the live Worker and supply its exact source SHA-256');
 if(input?.module_count!==1)throw Error('Multi-module Workers require a full project snapshot and build pipeline');
 if(input?.approval!==undefined||input?.publish!==undefined)throw Error('AI submissions cannot approve or publish');
 return Object.freeze({connection,worker,base_sha256,source,phase:'draft',publication:'owner-only'});
}
export function assertUnchangedWorkerBaseline(revision,current_sha256){
 if(String(current_sha256||'').toLowerCase()!==revision.base_sha256)throw Error('Worker changed since inspection; refresh before submitting');
 return true;
}
export function workerStudioPreviewPolicy(options={}){
 // Cloudflare Version URLs can use production bindings; they are not isolated demos.
 if(options.uses_production_bindings)throw Error('Production resource bindings cannot be used for an isolated preview');
 if(!options.isolated_environment)throw Error('Use an isolated preview environment with separate state');
 if(!options.private_access)throw Error('Private owner preview access is required');
 if(!options.no_automatic_publication)throw Error('Preview cannot publish to production');
 return Object.freeze({preview:'isolated',access:'private',production_traffic:false});
}

// Account 4 immutable R2 adapter. Requires a real R2 bucket binding and
// is intended to be invoked only from an authenticated server-side import route.
export function createImmutableR2Store(bucket) {
  if (!bucket || typeof bucket.head !== 'function' || typeof bucket.put !== 'function')
    throw Error('R2 binding required');
  return async function store({key,bytes,sha256,createOnly}) {
    if (!createOnly || !/^project-imports\/[a-f0-9]{40}\/[a-f0-9]{64}$/.test(key))
      throw Error('Immutable project storage key required');
    if (!(bytes instanceof Uint8Array) || bytes.byteLength > 50*1024*1024 ||
        !/^[a-f0-9]{64}$/.test(sha256)) throw Error('Invalid project blob');
    const existing=await bucket.head(key);
    if(existing) {
      if(existing.size!==bytes.byteLength || existing.customMetadata?.sha256!==sha256)
        throw Error('Existing project blob conflicts with requested content');
      return {alreadyVerified:true,key};
    }
    // Atomic create prevents racing imports from overwriting a previously saved blob.
    const result=await bucket.put(key,bytes,{
      onlyIf:{etagDoesNotMatch:'*'},
      customMetadata:{sha256},
      httpMetadata:{contentType:'application/octet-stream'}
    });
    if(!result) {
      const concurrent=await bucket.head(key);
      if(concurrent?.size===bytes.byteLength && concurrent.customMetadata?.sha256===sha256)
        return {alreadyVerified:true,key};
      throw Error('Concurrent project blob conflict');
    }
    return {created:true,key};
  };
}

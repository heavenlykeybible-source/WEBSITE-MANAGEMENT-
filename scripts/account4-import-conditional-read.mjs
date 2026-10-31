import {assertPrivateImportPublishable} from './account4-import-publish-gate.mjs';

// Read-only private stream: consumer must NOT expose this stream directly to
// the public. Future release must separately enforce owner approval at commit.
export async function readApprovedPrivateImport(db, bucket, actor, id) {
  const approval = await assertPrivateImportPublishable(db, bucket, actor, id);
  if (!bucket || typeof bucket.get !== 'function') throw new Error('Private R2 read unavailable');
  const object = await bucket.get(approval.key, {onlyIf:{etagMatches:approval.etag}});
  // Cloudflare returns a metadata-only object if a conditional GET fails.
  if (!object?.body || object.key !== approval.key ||
      object.size !== approval.size || object.version !== approval.version ||
      object.etag !== approval.etag)
    throw new Error('Private import changed after security approval');
  return {body:object.body, size:object.size, version:object.version, etag:object.etag};
}

import {ACCOUNT3_RELEASE,requestAccount3BuildReview} from './account3-reviewed-build.mjs';

/**
 * Server-side adapter for Control Room's authenticated account selector.
 * Resolves the target by immutable Cloudflare account ID, never by display label.
 * The caller must supply its existing authenticated permission and queue services.
 */
export async function queueAccount3FromControlRoom({
  actor, sourceCommit, connectedAccounts, authorize, enqueueWaiting
}) {
  if (!Array.isArray(connectedAccounts)) throw Error('Connected account registry required');
  const matching=connectedAccounts.filter(a=>a &&
    a.accountId===ACCOUNT3_RELEASE.accountId &&
    a.connected===true &&
    Number.isSafeInteger(a.connectionId) && a.connectionId>0);
  if (matching.length!==1) throw Error('Exactly one verified Account 3 connection required');
  return requestAccount3BuildReview({
    actor, revision:sourceCommit, connectionId:matching[0].connectionId,
    authorize, enqueueWaiting
  });
}

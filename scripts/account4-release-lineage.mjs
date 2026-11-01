export function liveReleaseCommit(body) {
  const markers = [...String(body).matchAll(/\/\/ ACCOUNT4_DEPLOY_COMMIT_SHA=([a-f0-9]{40})/gi)];
  return markers.at(-1)?.[1]?.toLowerCase() || null;
}
export function verifyForwardRelease({deployed,approved,allowUnmarked=false,isAncestor=false}) {
  if (!/^[a-f0-9]{40}$/i.test(approved)) throw new Error('Invalid approved release commit');
  if (!deployed) {
    if (!allowUnmarked) throw new Error('Existing Worker has no verifiable release commit; owner-approved legacy baseline required before first guarded upload');
    return 'legacy-bootstrap';
  }
  if (!/^[a-f0-9]{40}$/i.test(deployed)) throw new Error('Invalid live release marker');
  if (deployed.toLowerCase()===approved.toLowerCase()) throw new Error('This exact release is already deployed');
  if (!isAncestor) throw new Error('Account 4 rollback or unrelated history blocked: live deployed commit is not an ancestor of approved source');
  return 'forward';
}

import {queueCompleteRelease} from './complete-release-intake.mjs';

/**
 * Bind to the authenticated Control Room router. Dependencies are trusted
 * server services; no client-supplied actor, connection registry or approval.
 */
export function createReleaseRoutes({authenticate,accounts,authorize,enqueueWaiting,lookupProposal,approveProposal}) {
  for(const [name,fn] of Object.entries({authenticate,accounts,authorize,enqueueWaiting,lookupProposal,approveProposal}))
    if(typeof fn!=='function') throw Error('Missing release service: '+name);
  return async function releaseRoutes(request) {
    const url=new URL(request.url);
    if(!url.pathname.startsWith('/api/releases/')) return null;
    const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
    try {
      const actor=await authenticate(request);
      if(!actor) return json({error:'Authentication required'},401);
      if(url.pathname==='/api/releases/queue'&&request.method==='POST') {
        const raw=await request.text();
        if(raw.length>8192) return json({error:'Request too large'},413);
        const {source,target}=JSON.parse(raw);
        const result=await queueCompleteRelease({
          actor,source,target,connectedAccounts:await accounts(actor),
          authorize:args=>authorize({...args,request}),
          enqueueWaiting
        });
        return json(result,202);
      }
      if(url.pathname==='/api/releases/approve'&&request.method==='POST') {
        const raw=await request.text();
        if(raw.length>2048) return json({error:'Request too large'},413);
        const {proposalId}=JSON.parse(raw);
        if(typeof proposalId!=='string'||!/^[-\w]{1,128}$/.test(proposalId))
          return json({error:'Invalid proposal ID'},400);
        const proposal=await lookupProposal(proposalId);
        if(!proposal||proposal.kind!=='complete-project-release'||proposal.status!=='pending')
          return json({error:'Pending release not found'},404);
        if(proposal.buildVerified!==true||proposal.previewVerified!==true)
          return json({error:'Build and preview verification required'},409);
        if(await authorize({actor,action:'release-approve',proposal,request})!==true)
          return json({error:'Approval denied'},403);
        // Only trusted service can transition review status. Deployment is not performed here.
        return json(await approveProposal({actor,proposalId,expectedStatus:'pending'}));
      }
      return json({error:'Not found'},404);
    } catch(error) {
      return json({error:error instanceof SyntaxError?'Invalid JSON':'Release request rejected'},400);
    }
  };
}

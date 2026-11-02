/**
 * Owner-gated batch intake for complete projects.
 * Every application gets a distinct Waiting Room proposal; none is deployed.
 * Server-side adapters must perform authenticated source inspection and enqueue.
 */
export function createBatchReleaseIntake({inspect,propose,audit}){
  if([inspect,propose,audit].some(fn=>typeof fn!=='function'))throw Error('Trusted intake adapters required');
  async function stage({actor,projects,mode='individual'}){
    if(!actor||!Array.isArray(projects)||!projects.length)throw Error('Actor and projects required');
    if(!['individual','account','all-accounts'].includes(mode))throw Error('Unsupported release scope');
    const ids=new Set(),prepared=[];
    for(const project of projects){
      if(!project||!Number.isSafeInteger(project.siteId)||project.siteId<1||!/^[a-f0-9]{40}$/i.test(project.revision||''))throw Error('Pinned GitHub project required');
      if(ids.has(project.siteId))throw Error('Duplicate GitHub project');
      ids.add(project.siteId);
      const report=await inspect({actor,siteId:project.siteId});
      if(!report||!report.fileCount||!report.hasPackage||!report.hasWrangler||!report.hasLockfile||!report.hasFrontend)throw Error('Incomplete application: '+project.siteId);
      prepared.push({siteId:project.siteId,revision:project.revision,title:project.title});
    }
    const results=[];
    for(const p of prepared){
      try{
        const result=await propose({actor,...p});
        if(!result?.proposalId||result.status!=='pending'||result.deploymentAuthorized!==false)throw Error('Waiting Room confirmation missing');
        results.push({siteId:p.siteId,proposalId:result.proposalId,status:'pending'});
      }catch(e){
        await audit({event:'batch-release-partial',actor,mode,queued:results.length,failedSiteId:p.siteId});
        return {mode,complete:false,queued:results,failedSiteId:p.siteId,error:String(e?.message||e)};
      }
    }
    await audit({event:'batch-release-queued',actor,mode,count:results.length});
    return {mode,complete:true,queued:results,deployed:false};
  }
  return {stage};
}

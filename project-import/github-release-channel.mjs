/**
 * Read-only verification of the existing GitHub -> Control Room channel.
 * Never overwrites the existing importer or auto-deploys a repository.
 * Adapters must be authenticated, server-side Control Room services.
 */
export function createGithubReleaseChannel({authorize,listGithubSites,listGithubFiles,readGithubFile,enqueueWaiting,audit}){
 const dependencies=[authorize,listGithubSites,listGithubFiles,readGithubFile,enqueueWaiting,audit];
 if(dependencies.some(f=>typeof f!=='function'))throw Error('Trusted GitHub channel services required');
 async function inspect({actor,siteId}){
  if(!actor||!Number.isSafeInteger(siteId)||siteId<1)throw Error('Actor and GitHub site required');
  if(await authorize({actor,action:'github-channel-inspect',siteId})!==true)throw Error('Not authorized');
  const sites=await listGithubSites({actor});
  const site=sites?.find(s=>s.id===siteId);
  if(!site||!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(site.repo||''))throw Error('Connected repository unavailable');
  const files=await listGithubFiles({actor,siteId});
  if(!Array.isArray(files)||!files.length)throw Error('Repository inventory unavailable');
  const inventory=files.map(f=>{
   if(!f||typeof f.path!=='string'||f.path.startsWith('/')||f.path.split('/').some(p=>!p||p==='.'||p==='..')||!/^[a-f0-9]{40}$/i.test(f.sha||''))throw Error('Unsafe file inventory');
   return {path:f.path,sha:f.sha,size:f.size};
  });
  const root=site.dir?site.dir.replace(/\/$/,'')+'/':'';
  const has=p=>inventory.some(f=>f.path===root+p);
  const rootFiles=inventory.filter(f=>f.path.startsWith(root));
  const totalBytes=rootFiles.reduce((sum,f)=>sum+(Number.isSafeInteger(f.size)&&f.size>=0?f.size:0),0);
  return {siteId,repository:site.repo,branch:site.branch,root,fileCount:rootFiles.length,totalBytes,
   hasPackage:has('package.json'),hasWrangler:has('wrangler.toml')||has('wrangler.jsonc'),
   hasLockfile:has('package-lock.json'),hasFrontend:has('public/index.html'),
   files:inventory};
 }
 async function propose({actor,siteId,revision,title}){
  if(!/^[a-f0-9]{40}$/i.test(revision||''))throw Error('Exact approved commit SHA required');
  if(await authorize({actor,action:'github-channel-propose',siteId})!==true)throw Error('Not authorized');
  const report=await inspect({actor,siteId});
  if(!report.hasPackage||!report.hasWrangler||!report.hasLockfile||!report.hasFrontend)
   throw Error('Complete application files not verified');
  const manifest=await readGithubFile({actor,siteId,path:report.root+'package.json',revision});
  const lock=await readGithubFile({actor,siteId,path:report.root+'package-lock.json',revision});
  if(!lock?.content||!lock.sha)throw Error('Pinned dependency lockfile read failed');
  const expected=p=>report.files.find(f=>f.path===report.root+p)?.sha;
  if(manifest.sha!==expected('package.json')||lock.sha!==expected('package-lock.json'))
   throw Error('Pinned GitHub file SHA differs from inspected inventory');
  if(!manifest?.content||!manifest.sha)throw Error('Pinned source read failed');
  const result=await enqueueWaiting({kind:'github-complete-application',status:'pending',
   title:title||'Complete GitHub application release',actor,
   source:{siteId,repository:report.repository,revision,root:report.root},
   manifestSha:manifest.sha,lockSha:lock.sha,inventoryCount:report.fileCount,inventoryBytes:report.totalBytes,
   requiresOwnerApproval:true,deploymentAuthorized:false,
   buildVerified:false,previewVerified:false});
  if(!result?.id)throw Error('Waiting Room did not confirm proposal');
  await audit({event:'github-complete-release-proposed',actor,proposalId:result.id});
  return {proposalId:result.id,status:'pending',deploymentAuthorized:false};
 }
 return {inspect,propose};
}

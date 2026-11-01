/**
 * One GitHub gateway, many authorized installations/repositories.
 * Credentials remain server-side and are never returned to callers.
 * A GitHub App installation can only access repositories granted to it.
 */
export function createGitHubGateway({listConnections,githubFetch,authorize}) {
  if([listConnections,githubFetch,authorize].some(x=>typeof x!=='function'))
    throw Error('GitHub gateway services required');
  async function connected(actor) {
    if(!actor) throw Error('Authentication required');
    const connections=await listConnections(actor);
    if(!Array.isArray(connections)) throw Error('Invalid GitHub connections');
    return connections.filter(x=>x?.enabled===true && Number.isSafeInteger(x.id) && x.id>0);
  }
  async function repositories({actor,connectionId}) {
    const matches=(await connected(actor)).filter(x=>x.id===connectionId);
    if(matches.length!==1) throw Error('GitHub connection unavailable');
    if(await authorize({actor,action:'github-repositories',connectionId})!==true)
      throw Error('GitHub repository permission denied');
    const connection=matches[0];
    const all=[];let page=1;
    for(;page<=100;page++) {
      const result=await githubFetch({connection,path:`/installation/repositories?per_page=100&page=${page}`});
      if(!result||!Array.isArray(result.repositories)) throw Error('Invalid GitHub API response');
      all.push(...result.repositories.map(r=>({
        id:r.id,fullName:r.full_name,private:r.private,defaultBranch:r.default_branch,
        permissions:r.permissions
      })));
      if(result.repositories.length<100) break;
    }
    if(page>100) throw Error('Repository listing exceeds safe pagination; refine connection');
    return all;
  }
  async function select({actor,connectionId,repository,revision}) {
    if(!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository||''))
      throw Error('Invalid repository');
    if(!/^[a-f0-9]{40}$/.test(revision||'')) throw Error('Pinned Git commit required');
    const list=await repositories({actor,connectionId});
    const selected=list.find(x=>x.fullName.toLowerCase()===repository.toLowerCase());
    if(!selected) throw Error('Repository not authorized for this GitHub connection');
    if(await authorize({actor,action:'github-project-select',connectionId,repository,revision})!==true)
      throw Error('Project selection denied');
    return {connectionId,repository:selected.fullName,revision};
  }
  return {connected,repositories,select};
}

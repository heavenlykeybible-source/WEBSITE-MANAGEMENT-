import {createGitHubProjectImportService} from './github-project-service.mjs';

/**
 * HTTP adapter for an already-authenticated Control Room Worker.
 * Supply trusted services; this never reads credentials from request bodies.
 * No deployment is initiated by these routes.
 */
export function createGitHubImportRoutes({
  authenticate,listConnections,githubFetch,authorize,fetcher,bucket,enqueueWaiting
}) {
  if(typeof authenticate!=='function')throw Error('Authentication service required');
  const service=createGitHubProjectImportService({
    listConnections,githubFetch,authorize,fetcher,bucket,enqueueWaiting
  });
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{
    status,headers:{'content-type':'application/json','cache-control':'no-store'}
  });
  return async function handleGitHubImport(request) {
    const url=new URL(request.url);
    if(!url.pathname.startsWith('/api/project-gateway/'))return null;
    const actor=await authenticate(request);
    if(!actor)return reply({error:'Authentication required'},401);
    try {
      if(url.pathname==='/api/project-gateway/connections'&&request.method==='GET') {
        const connections=await service.connections(actor);
        return reply(connections.map(c=>({id:c.id,label:c.label||'GitHub',enabled:true})));
      }
      if(url.pathname==='/api/project-gateway/repositories'&&request.method==='GET') {
        const connectionId=Number(url.searchParams.get('connectionId'));
        if(!Number.isSafeInteger(connectionId)||connectionId<1)return reply({error:'Invalid connection'},400);
        return reply(await service.repositories({actor,connectionId}));
      }
      if(url.pathname==='/api/project-gateway/import'&&request.method==='POST') {
        const body=await request.text();
        if(body.length>8192)return reply({error:'Request too large'},413);
        const input=JSON.parse(body);
        // The actor and GitHub token are never taken from the client.
        const result=await service.import({
          actor,connectionId:input.connectionId,repository:input.repository,
          revision:input.revision,projectPath:input.projectPath,target:input.target
        });
        return reply(result,202);
      }
      return reply({error:'Route not found'},404);
    }catch(error){
      return reply({error:error instanceof SyntaxError?'Invalid JSON':'Import request rejected'},400);
    }
  };
}

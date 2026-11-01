import {createGitHubGateway} from './github-gateway.mjs';
import {importProjectToWaiting} from './waiting-room-adapter.mjs';

/**
 * Integrates a single server-side GitHub connection with complete project
 * import. Account authorization and owner review are mandatory.
 */
export function createGitHubProjectImportService({
  listConnections,githubFetch,authorize,fetcher,bucket,enqueueWaiting
}) {
  const gateway=createGitHubGateway({listConnections,githubFetch,authorize});
  if(typeof fetcher!=='function'||typeof enqueueWaiting!=='function'||!bucket)
    throw Error('Project importer dependencies required');
  return {
    connections:gateway.connected,
    repositories:gateway.repositories,
    async import({actor,connectionId,repository,revision,projectPath,target}) {
      const selection=await gateway.select({actor,connectionId,repository,revision});
      const connections=await gateway.connected(actor);
      const connection=connections.find(c=>c.id===connectionId);
      if(!connection||!connection.token) throw Error('Server-side GitHub credential required');
      if(!target||!Number.isSafeInteger(target.connectionId)||target.connectionId<1)
        throw Error('Destination Cloudflare connection required');
      if(await authorize({actor,action:'github-project-import',connectionId,repository:selection.repository,revision,target})!==true)
        throw Error('Project import permission denied');
      return importProjectToWaiting({
        fetcher,githubToken:connection.token,repository:selection.repository,
        revision,projectPath,target,bucket,actor,
        authorize:args=>authorize({...args,githubConnectionId:connectionId}),
        enqueueWaiting
      });
    }
  };
}

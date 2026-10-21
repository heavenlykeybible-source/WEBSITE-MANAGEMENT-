import {validateProjectManifest} from './validation.mjs';

// Read-only, injected GitHub transport. Never accept a caller-supplied URL or credentials.
// Call only from an authenticated Account 4 owner/staff server route.
const API='https://api.github.com';
const hex40=/^[a-f0-9]{40}$/;
const encodePath=p=>p.split('/').map(encodeURIComponent).join('/');
async function githubJSON(fetcher, token, path) {
  const response=await fetcher(API+path,{method:'GET',headers:{
    'accept':'application/vnd.github+json',
    'authorization':'Bearer '+token,
    'x-github-api-version':'2022-11-28'
  },redirect:'manual'});
  if(!response.ok || response.status>=300) throw Error('GitHub project read failed ('+response.status+')');
  return response.json();
}
export async function inspectGitHubProject({fetcher,token,repository,revision,projectPath,target}) {
  if(typeof fetcher!=='function'||typeof token!=='string'||!token)throw Error('Server GitHub connection required');
  if(!/^[\w.-]+\/[\w.-]+$/.test(repository||'')||!hex40.test(revision||''))
    throw Error('Pinned GitHub repository and commit required');
  if(!/^[\w.@+() -]+(?:\/[\w.@+() -]+)*$/.test(projectPath||'')||projectPath.split('/').some(x=>x==='.'||x==='..'))
    throw Error('Invalid project path');
  const [owner,name]=repository.split('/');
  const prefix='/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(name);
  const commit=await githubJSON(fetcher,token,prefix+'/git/commits/'+revision);
  if(!hex40.test(commit?.tree?.sha||''))throw Error('Commit tree missing');
  const tree=await githubJSON(fetcher,token,prefix+'/git/trees/'+commit.tree.sha+'?recursive=1');
  if(tree.truncated||!Array.isArray(tree.tree))throw Error('GitHub tree incomplete');
  const root=projectPath+'/';
  const selected=tree.tree.filter(e=>e.type==='blob'&&e.path.startsWith(root));
  if(!selected.length)throw Error('Project directory is empty');
  // This phase only lists objects. File bytes must be fetched separately, verified,
  // and uploaded to immutable R2 before constructing a Waiting Room proposal.
  const files=selected.map(e=>{
    if(!hex40.test(e.sha||'')||!Number.isSafeInteger(e.size))throw Error('Invalid GitHub blob metadata');
    return {path:e.path.slice(root.length),bytes:e.size,gitBlobSha:e.sha};
  });
  const manifest=validateProjectManifest({
    repository,revision,projectPath,target,
    files:files.map(f=>({...f,sha256:'0'.repeat(64)}))
  });
  return {repository,revision,projectPath,target,fileCount:manifest.fileCount,
    totalBytes:manifest.totalBytes,files};
}
export function planImmutableUploads(inspected) {
  if(!inspected||!Array.isArray(inspected.files))throw Error('Inspection required');
  return inspected.files.map(f=>({
    path:f.path,expectedGitBlobSha:f.gitBlobSha,expectedBytes:f.bytes,
    storageKey:'project-imports/'+inspected.revision+'/'+encodePath(inspected.projectPath)+'/'+encodePath(f.path)
  }));
}

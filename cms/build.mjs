import '../scripts/apply-reviewed-account4-upgrade.mjs';
import fs from 'node:fs';
import {build} from 'esbuild';
const target=new URL('../control-room-worker.js',import.meta.url);
let worker=fs.readFileSync(target,'utf8');
const mcpReview='// BEGIN MCP OWNER REVIEW\n'+fs.readFileSync(new URL('../workspace/mcp-review.js',import.meta.url),'utf8')+'\n// END MCP OWNER REVIEW';
if(worker.includes('// BEGIN MCP OWNER REVIEW'))worker=worker.replace(/\/\/ BEGIN MCP OWNER REVIEW[\s\S]*?\/\/ END MCP OWNER REVIEW/,()=>mcpReview);
else worker=mcpReview+'\n'+worker;
const operations='// BEGIN CONTROL OPERATIONS\n'+fs.readFileSync(new URL('../workspace/operations.js',import.meta.url),'utf8')+'\n// END CONTROL OPERATIONS';
if(worker.includes('// BEGIN CONTROL OPERATIONS'))worker=worker.replace(/\/\/ BEGIN CONTROL OPERATIONS[\s\S]*?\/\/ END CONTROL OPERATIONS/,()=>operations);
else worker=operations+'\n'+worker;
const screens='// BEGIN CONTROL SCREENS\n'+(fs.readFileSync(new URL('../workspace/screens.js',import.meta.url),'utf8')+'\n'+fs.readFileSync(new URL('../workspace/apps-client.js',import.meta.url),'utf8')).replaceAll('\\','\\\\').replaceAll('`','\\`').replaceAll('${','\\${')+'\n// END CONTROL SCREENS';
if(worker.includes('// BEGIN CONTROL SCREENS'))worker=worker.replace(/\/\/ BEGIN CONTROL SCREENS[\s\S]*?\/\/ END CONTROL SCREENS/,()=>screens);
else worker=worker.replace('var CURRENT_NAV=',screens+'\nvar CURRENT_NAV=');
const approvalCall='const approvalSession=await ownerApprovalSession(req,env,user,sub,m);if(approvalSession)return approvalSession;';
const permissionRoute='const permission=await aiPermissionRoutes(req,env,user,sub,m);if(permission)return permission;';
if(!worker.includes(approvalCall)){
  if(worker.split(permissionRoute).length!==2)throw new Error('Refusing build: missing or duplicate owner permission dispatch');
  worker=worker.replace(permissionRoute,approvalCall+'\n  '+permissionRoute);
}
const passkeys=await build({entryPoints:[new URL('../security/owner-passkeys.js',import.meta.url).pathname],bundle:true,write:false,format:'iife',globalName:'OwnerPasskeys',platform:'browser',target:'es2022',minify:true});
const passkeyServer='// BEGIN OWNER PASSKEY SERVER\n'+passkeys.outputFiles[0].text.replace(/[ \t]+$/gm,'')+'\nconst ownerPasskeys=OwnerPasskeys.createOwnerPasskeyRoutes({json:(...a)=>json(...a),fail,body,reauthenticate,audit,withOperationLock,createLoginSession:async(env,user)=>withCookie({ok:true},await sessionCookie(env,user.id,user.pass_ver))});\n// END OWNER PASSKEY SERVER';
if(worker.includes('// BEGIN OWNER PASSKEY SERVER'))worker=worker.replace(/\/\/ BEGIN OWNER PASSKEY SERVER[\s\S]*?\/\/ END OWNER PASSKEY SERVER/,()=>passkeyServer);
else worker=passkeyServer+'\n'+worker;
const nativeServer='// BEGIN NATIVE WORKSPACE SERVER\n'+fs.readFileSync(new URL('../workspace/imports.js',import.meta.url),'utf8')+'\n'+fs.readFileSync(new URL('../workspace/verification.js',import.meta.url),'utf8')+'\n'+fs.readFileSync(new URL('../workspace/browser.js',import.meta.url),'utf8')+'\n// END NATIVE WORKSPACE SERVER';
if(worker.includes('// BEGIN NATIVE WORKSPACE SERVER'))worker=worker.replace(/\/\/ BEGIN NATIVE WORKSPACE SERVER[\s\S]*?\/\/ END NATIVE WORKSPACE SERVER/,()=>nativeServer);
else worker=nativeServer+'\n'+worker;
worker=worker.replace('// END NATIVE WORKSPACE SERVER',()=>fs.readFileSync(new URL('../workspace/domains.js',import.meta.url),'utf8')+'\n// END NATIVE WORKSPACE SERVER');
const studioServer='// BEGIN MULTI AI STUDIO SERVER\n'+fs.readFileSync(new URL('../workspace/studio-tasks.js',import.meta.url),'utf8')+'\n// END MULTI AI STUDIO SERVER';
if(worker.includes('// BEGIN MULTI AI STUDIO SERVER'))worker=worker.replace(/\/\/ BEGIN MULTI AI STUDIO SERVER[\s\S]*?\/\/ END MULTI AI STUDIO SERVER/,()=>studioServer);
else worker=worker.replace('// END NATIVE WORKSPACE SERVER',()=>studioServer+'\n// END NATIVE WORKSPACE SERVER');
const studioRoute="const studioTasks=await studioTaskRoutes(req,env,user,sub,m);if(studioTasks)return studioTasks;";
const nativeDispatch="const workspace=await aiWorkspaceRoutes(req,env,user,sub,m);if(workspace)return workspace;";
if(!worker.includes(studioRoute)){
 if(worker.split(nativeDispatch).length!==2)throw Error('Refusing build: owner AI-workspace dispatch missing');
 worker=worker.replace(nativeDispatch,studioRoute+'\n  '+nativeDispatch);
}
const studioToolDispatch="if(['my_studio_assignments','claim_studio_assignment','update_studio_progress','submit_studio_assignment'].includes(name))return studioAITask(env,actor,name,args);";
const toolCallAnchor="if(name==='inspect_heavenlykey_domains')return inspectDomainsTool(env,actor,args);";
if(!worker.includes(studioToolDispatch)){
 const oldDispatch="if(name==='my_studio_assignments'||name==='submit_studio_assignment')return studioAITask(env,actor,name,args);";
 if(worker.includes(oldDispatch))worker=worker.replace(oldDispatch,studioToolDispatch);
 else{
  if(worker.split(toolCallAnchor).length!==2)throw Error('Refusing build: MCP/AI tool dispatch missing');
  worker=worker.replace(toolCallAnchor,studioToolDispatch+'\n  '+toolCallAnchor);
 }
}
const studioToolDefs=[
 {name:'my_studio_assignments',description:'List my independently assigned AI Worker Studio tasks, with page starting at 0. Read-only; no production change.',inputSchema:{type:'object',properties:{page:{type:'integer',minimum:0}},additionalProperties:false}},
 {name:'claim_studio_assignment',description:'Explicitly start working on my assignment without launching production operations.',inputSchema:{type:'object',properties:{task_id:{type:'string'}},required:['task_id'],additionalProperties:false}},
 {name:'update_studio_progress',description:'Record a brief progress update on my claimed task for the owner dashboard.',inputSchema:{type:'object',properties:{task_id:{type:'string'},progress:{type:'string',maxLength:600}},required:['task_id','progress'],additionalProperties:false}},
 {name:'submit_studio_assignment',description:'Link my completed task to my exact existing waiting Worker proposal. Owner review and approval remain necessary.',inputSchema:{type:'object',properties:{task_id:{type:'string'},proposal_id:{type:'integer'}},required:['task_id','proposal_id'],additionalProperties:false}}
];
const defsAnchor='const TOOLS = [';
if(!/"name"\s*:\s*"claim_studio_assignment"|name\s*:\s*'claim_studio_assignment'/.test(worker)){
 if(worker.split(defsAnchor).length!==2)throw Error('Refusing build: core MCP tools list missing');
 worker=worker.replace(defsAnchor,defsAnchor+'\n  '+studioToolDefs.filter(x=>x.name==='claim_studio_assignment'||x.name==='update_studio_progress').map(x=>JSON.stringify(x)).join(',\n  ')+',');
}
// Retain the SHA-256 captured when AI inspected the existing Worker.
// The approval stage and the last pre-publication check both re-read Cloudflare.
const pinnedProposalMeta="JSON.stringify({ connection_id: conn.id, name, ...(additions.length ? { bindings:additions } : {}) })";
const pinnedReplacement="JSON.stringify({ connection_id: conn.id, name, ...(additions.length ? { bindings:additions } : {}), ...(b.base_sha256 ? {base_sha256:b.base_sha256} : {}) })";
if(worker.includes(pinnedProposalMeta))worker=worker.replace(pinnedProposalMeta,pinnedReplacement);
if(!worker.includes(pinnedReplacement))throw Error('Refusing build: pinned Worker proposal metadata missing');
const reviewWorkerAnchor="candidate.source_hash = await sha256(await object.text());";
const reviewWorkerPin="if(m.base_sha256){await verifyPinnedStudioWorker(env,m);checks.push('Live Worker source SHA-256 still matches the original AI inspection');}";
if(!worker.includes(reviewWorkerPin)){
 if(worker.split(reviewWorkerAnchor).length!==2)throw Error('Refusing build: Worker review path missing');
 worker=worker.replace(reviewWorkerAnchor,reviewWorkerAnchor+'\n    '+reviewWorkerPin);
}
const reviewBaselineAnchor="baseline = current ? { exists: true, modified_on: current.modified_on || null } : { exists: false };";
const reviewPinRequired="requirePinnedExistingWorker(m,Boolean(current));";
if(!worker.includes(reviewPinRequired)){
 if(worker.split(reviewBaselineAnchor).length!==2)throw Error('Refusing build: Worker review baseline missing');
 worker=worker.replace(reviewBaselineAnchor,reviewPinRequired+'\n    '+reviewBaselineAnchor);
}
const deployWorkerAnchor="await deployWorker(env, meta.connection_id, meta.name, await o.text(), workerBindings(meta.bindings));";
const deployWorkerPin="if(meta.base_sha256)await verifyPinnedStudioWorker(env,meta);";
if(!worker.includes(deployWorkerPin)){
 if(worker.split(deployWorkerAnchor).length!==2)throw Error('Refusing build: Worker publication path missing');
 worker=worker.replace(deployWorkerAnchor,deployWorkerPin+'\n    '+deployWorkerAnchor);
}
const deploymentPinCheck="const proposedConn=await connById(env,meta.connection_id);const scriptList=(await cf(env,proposedConn,'GET','/workers/scripts')).result;if(!Array.isArray(scriptList))fail('Could not verify Worker existence',502);requirePinnedExistingWorker(meta,scriptList.some(x=>x.id===meta.name));";
if(!worker.includes(deploymentPinCheck)){
 if(worker.split("if(meta.base_sha256)await verifyPinnedStudioWorker(env,meta);").length!==2)throw Error('Refusing build: Worker release pin missing');
 worker=worker.replace("if(meta.base_sha256)await verifyPinnedStudioWorker(env,meta);",deploymentPinCheck+'\n    '+"if(meta.base_sha256)await verifyPinnedStudioWorker(env,meta);");
}
const nativeClient='// BEGIN NATIVE WORKSPACE CLIENT\n'+(fs.readFileSync(new URL('../workspace/client.js',import.meta.url),'utf8')+'\n'+fs.readFileSync(new URL('../workspace/browser-client.js',import.meta.url),'utf8')).replaceAll('\\','\\\\').replaceAll('`','\\`').replaceAll('${','\\${')+'\n// END NATIVE WORKSPACE CLIENT';
if(worker.includes('// BEGIN NATIVE WORKSPACE CLIENT'))worker=worker.replace(/\/\/ BEGIN NATIVE WORKSPACE CLIENT[\s\S]*?\/\/ END NATIVE WORKSPACE CLIENT/,()=>nativeClient);
else worker=worker.replace('var CHAT=[],',nativeClient+'\nvar CHAT=[],');
worker=worker.replace('// END NATIVE WORKSPACE CLIENT',()=>fs.readFileSync(new URL('../workspace/domains-client.js',import.meta.url),'utf8').replaceAll('\\','\\\\').replaceAll('`','\\`').replaceAll('${','\\${')+'\n// END NATIVE WORKSPACE CLIENT');
const passkeyClient=fs.readFileSync(new URL('../security/passkey-client.js',import.meta.url),'utf8');
const passkeySection='// BEGIN OWNER PASSKEY CLIENT\n'+passkeyClient.replaceAll('\\','\\\\').replaceAll('`','\\`').replaceAll('${','\\${')+'\n// END OWNER PASSKEY CLIENT';
if(worker.includes('// BEGIN OWNER PASSKEY CLIENT'))worker=worker.replace(/\/\/ BEGIN OWNER PASSKEY CLIENT[\s\S]*?\/\/ END OWNER PASSKEY CLIENT/,()=>passkeySection);
else worker=worker.replace('async function passwordDialog(',passkeySection+'\nasync function passwordDialog(');
if (!worker.trim()) throw new Error('Refusing CMS build: active Worker source is empty');
const requiredMarkers = [
  ['VISUAL CMS CLIENT', '// BEGIN VISUAL CMS CLIENT', '// END VISUAL CMS CLIENT'],
  ['AI CAPABILITIES', '// BEGIN AI CAPABILITIES', '// END AI CAPABILITIES'],
  ['AI PERMISSION CLIENT', '// BEGIN AI PERMISSION CLIENT', '// END AI PERMISSION CLIENT'],
];
for (const [name, start, end] of requiredMarkers) {
  if (worker.split(start).length !== 2 || worker.split(end).length !== 2 || worker.indexOf(start) > worker.indexOf(end)) {
    throw new Error('Refusing CMS build: missing or duplicate Worker integration markers for ' + name);
  }
}
const frame=fs.readFileSync(new URL('./frame.js',import.meta.url),'utf8');
const client=fs.readFileSync(new URL('./editor.js',import.meta.url),'utf8');
const bundle='const CMS_FRAME = '+JSON.stringify(frame)+';\n'+client;
const replacement='// BEGIN VISUAL CMS CLIENT\n'+bundle.replaceAll('\\','\\\\').replaceAll('`','\\`').replaceAll('${','\\${')+'\n// END VISUAL CMS CLIENT';
worker=worker.replace(/\/\/ BEGIN VISUAL CMS CLIENT[\s\S]*?\/\/ END VISUAL CMS CLIENT/,()=>replacement);
worker=worker.replace(/\/\/ BEGIN AI CAPABILITIES[\s\S]*?\/\/ END AI CAPABILITIES/,()=> '// BEGIN AI CAPABILITIES\n'+fs.readFileSync(new URL('../ai/capabilities.js',import.meta.url),'utf8')+'\n// END AI CAPABILITIES');
const workspace='// BEGIN AI WORKSPACE\n'+fs.readFileSync(new URL('../ai/workspace.js',import.meta.url),'utf8')+'\n// END AI WORKSPACE';
if(worker.includes('// BEGIN AI WORKSPACE'))worker=worker.replace(/\/\/ BEGIN AI WORKSPACE[\s\S]*?\/\/ END AI WORKSPACE/,()=>workspace);
else worker=worker.replace('// BEGIN AI CAPABILITIES',workspace+'\n// BEGIN AI CAPABILITIES');
const aiClient=fs.readFileSync(new URL('../ai/permissions.js',import.meta.url),'utf8');
worker=worker.replace(/\/\/ BEGIN AI PERMISSION CLIENT[\s\S]*?\/\/ END AI PERMISSION CLIENT/,()=> '// BEGIN AI PERMISSION CLIENT\n'+aiClient.replaceAll('\\','\\\\').replaceAll('`','\\`').replaceAll('${','\\${')+'\n// END AI PERMISSION CLIENT');
for (const [name, start, end] of requiredMarkers) {
  const section = worker.slice(worker.indexOf(start) + start.length, worker.indexOf(end));
  if (!section.trim()) throw new Error('Refusing CMS build: empty generated section ' + name);
}
fs.writeFileSync(target,worker);

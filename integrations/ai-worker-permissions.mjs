/**
 * Account 4 AI Worker operations: owner-controlled authorization contract.
 * This module grants NO permissions by itself. The Control Room's authenticated
 * owner UI must issue signed, stored grants and check them server-side.
 *
 * No tokens or worker source code may be returned to the browser/AI unless
 * the owner explicitly authorized that read.
 */
export const WORKER_CAPABILITIES=Object.freeze([
 "worker.inspect","worker.read_code","worker.deploy","worker.edit",
 "worker.rollback","worker.diagnostics","worker.logs"
]);
const ID=/^[a-f0-9]{32}$/i;
const WORKER=/^[a-z0-9][a-z0-9-]{0,62}$/;
const ALLOWED=new Set(WORKER_CAPABILITIES);
export function validateWorkerPermission(grant,request,now=Date.now()){
 if(!grant||!request||!ALLOWED.has(request.action))throw Error("Unsupported Worker operation");
 if(grant.status!=="approved"||grant.revokedAt||grant.disabled===true)throw Error("Owner permission not active");
 if(grant.action!==request.action)throw Error("Action not permitted");
 if(!ID.test(request.accountId||"")||!WORKER.test(request.worker||""))throw Error("Invalid Worker target");
 if(grant.accountId!==request.accountId||grant.worker!==request.worker)throw Error("Permission target mismatch");
 if(!grant.agentId||grant.agentId!==request.agentId)throw Error("AI identity mismatch");
 if(!grant.expiresAt||!Number.isFinite(Date.parse(grant.expiresAt))||Date.parse(grant.expiresAt)<=now)throw Error("Permission expired");
 if(["worker.deploy","worker.edit","worker.rollback"].includes(request.action)){
   if(!request.changeId||grant.changeId!==request.changeId)throw Error("Exact approved change required");
   if(grant.usedAt)throw Error("Write permission already used");
 }
 return {authorized:true,action:request.action,accountId:request.accountId,worker:request.worker};
}
/**
 * A Control Room integration MUST atomically consume one-time write grants in
 * its database before calling Cloudflare; validation alone is not sufficient.
 * Repeated read grants may persist until their expiration or owner revocation.
 */
export function permissionOptionsForUI(){
 return WORKER_CAPABILITIES.map(action=>({action,requiresOwnerApproval:true,
 oneTime:["worker.deploy","worker.edit","worker.rollback"].includes(action)}));
}

// Stable Account 9 deployment identity and version replacement policy.
// Keep this module pure: database/control-room backend calls remain server-owned.
export const ACCOUNT9_TARGET=Object.freeze({
  account:'account9',
  connection:'Cloudflare Account 9',
  worker:'heavenlykey-studio'
});
export function normalizeAccount(value){
  if(typeof value!=='string')return null;
  const s=value.trim().toLowerCase().replace(/[\s_-]+/g,'');
  if(s==='9'||s==='account9'||s==='account09'||s==='heavenlykeyvideoeditor'||s==='videoeditor')return 'account9';
  return null;
}
export function isAccount9Release(item){
  if(!item||typeof item!=='object')return false;
  const accountMatches=[item.account,item.accountId,item.slug,item.account_name,item.accountName].some(value=>normalizeAccount(value)==='account9');
  const explicitConnection=item.connection??item.connection_id??item.connectionId;
  const explicitWorker=item.worker??item.name??item.worker_name;
  // A mismatched explicit deployment target must never be swallowed by Account 9.
  if(accountMatches){
    if(explicitWorker && explicitWorker!==ACCOUNT9_TARGET.worker)return false;
    if(explicitConnection!==undefined && explicitConnection!==ACCOUNT9_TARGET.connection &&
      explicitConnection!==8 && explicitConnection!=='8')return false;
    return true;
  }
  // Proposals submitted through the Control Room identify Cloudflare Account 9
  // by its saved connection ID. Keep the Worker name exact to avoid conflating apps.
  const target=item.worker||item.name||item.worker_name;
  const connection=item.connection??item.connection_id??item.connectionId;
  return target===ACCOUNT9_TARGET.worker &&
    (connection===ACCOUNT9_TARGET.connection||connection===8||connection==='8');
}
export function chooseCurrentRelease(items){
  const relevant=items.filter(isAccount9Release);
  if(!relevant.length)return null;
  relevant.sort((a,b)=>{
    // Compare numeric components, not lexicographically (v10 > v9).
    const version=x=>String(x.version??'').trim().replace(/^v/i,'').split('.').map(n=>/^\d+$/.test(n)?Number(n):0);
    const va=version(a),vb=version(b);
    for(let i=0;i<Math.max(va.length,vb.length);i++){
      const diff=(vb[i]||0)-(va[i]||0);
      if(diff)return diff;
    }
    const at=Date.parse(a.created_at||a.createdAt||'')||0;
    const bt=Date.parse(b.created_at||b.createdAt||'')||0;
    if(at!==bt)return bt-at;
    return (Number(b.id)||0)-(Number(a.id)||0);
  });
  return relevant[0];
}
export function consolidateAccount9Releases(items){
  if(!Array.isArray(items))throw TypeError('Release list required');
  const current=chooseCurrentRelease(items);
  if(!current)return items.map(item=>({...item}));
  return items.filter(item=>!isAccount9Release(item)||item===current).map(item=>{
    if(item!==current)return {...item};
    return {...item,account:ACCOUNT9_TARGET.account,connection:ACCOUNT9_TARGET.connection,worker:ACCOUNT9_TARGET.worker};
  });
}
// Read-only queue projection: one actionable slot, older proposals retained
// only in history for rollback/audit. No false claim of server-side mutation.
const CLOSED_STATES=new Set(['declined','rejected','cancelled','canceled','superseded','failed']);
const isActionable=item=>!CLOSED_STATES.has(String(item.status??'waiting').toLowerCase());

export function projectAccount9Queue(items){
  if(!Array.isArray(items))throw TypeError('Proposal list required');
  const relevant=items.filter(isAccount9Release);
  // A cancelled or failed v6 must never hide an approved or pending v5.
  const current=chooseCurrentRelease(relevant.filter(isActionable));
  const active=items.filter(item=>!isAccount9Release(item)||(item===current&&isActionable(item)))
    .map(item=>item===current?{...item,account:ACCOUNT9_TARGET.account,connection:item.connection??ACCOUNT9_TARGET.connection,worker:ACCOUNT9_TARGET.worker}:{...item});
  const history=relevant.filter(item=>item!==current).map(item=>{
    if(!isActionable(item))return {...item};
    return {...item,status:'superseded',superseded_by:current?.id??null};
  });
  return {active,history,canonical_account:current?ACCOUNT9_TARGET.account:null};
}
// Pure ingestion reducer for Control Room integration. It replaces the
// actionable Account 9 slot instead of appending another row. Callers must
// persist the returned active and history records atomically on the server.
export function upsertAccount9Release(queue,newRelease){
  if(!queue||!Array.isArray(queue.active)||!Array.isArray(queue.history))throw TypeError('Invalid release queue');
  if(!isAccount9Release(newRelease))throw TypeError('Not an Account 9 release');
  const all=[...queue.active,...queue.history].filter(item=>item.id!==newRelease.id);
  all.push({...newRelease});
  const next=projectAccount9Queue(all);
  return {active:next.active,history:next.history};
}
export function supersededAccount9Ids(items){
  if(!Array.isArray(items))throw TypeError('Release list required');
  const current=chooseCurrentRelease(items);
  return items.filter(item=>isAccount9Release(item)&&item!==current).map(item=>item.id).filter(id=>id!==undefined);
}

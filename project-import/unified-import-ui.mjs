/**
 * Account 4 unified import navigation.
 * Legacy Account 3 / TinyFish shortcuts are deliberately excluded.
 * Account 3 remains a normal selectable deployment destination.
 */
export const IMPORT_STEPS = Object.freeze([
  {id:'source',label:'Select source'},
  {id:'scan',label:'Scan files'},
  {id:'destination',label:'Choose destination'},
  {id:'preview',label:'Preview'},
  {id:'approval',label:'Waiting Room'},
  {id:'release',label:'Release'}
]);
export const IMPORT_SOURCES = Object.freeze([
  {id:'github',label:'GitHub repository'},
  {id:'upload',label:'Upload ZIP / files'},
  {id:'r2',label:'Stored project'}
]);
export function importNavigation(items=[]) {
  if(!Array.isArray(items)) throw Error('Navigation must be an array');
  return items.filter(item=>{
    const label=String(item?.label||'').toLowerCase();
    const href=String(item?.href||'').toLowerCase();
    return !(/tiny[ -]?fish/.test(label+' '+href) ||
      /(?:^|[\\/\-_])account[ -_]?3(?:$|[\\/\-_])/.test(label+' '+href) ||
      /(?:^|[\\/\-_])legacy[ -_]?import(?:$|[\\/\-_])/.test(label+' '+href));
  });
}
export function availableDestinations(connections=[]) {
  if(!Array.isArray(connections)) throw Error('Connections must be an array');
  return connections.filter(c=>c?.connected===true && Number.isSafeInteger(c.connectionId) && c.connectionId>0 &&
    typeof c.accountId==='string' && /^[a-f0-9]{32}$/i.test(c.accountId))
    .map(c=>({connectionId:c.connectionId,accountId:c.accountId,label:String(c.label||'Cloudflare account')}));
}
export function validateImportStep(step,context={}) {
  if(!IMPORT_STEPS.some(s=>s.id===step)) throw Error('Unknown import step');
  if(step==='source') return IMPORT_SOURCES.some(s=>s.id===context.source?.type);
  if(step==='scan') return context.scan?.passed===true && context.scan?.unsafeFiles===0;
  if(step==='destination') return availableDestinations(context.connections).some(c=>c.connectionId===context.destination?.connectionId && c.accountId===context.destination?.accountId);
  if(step==='preview') return context.buildVerified===true && context.previewVerified===true;
  if(step==='approval') return context.ownerApproved===true && context.proposalId;
  return context.ownerApproved===true && context.buildVerified===true && context.previewVerified===true && context.liveReleaseAuthorized===true;
}

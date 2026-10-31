// Explicit deny-by-default operator authorization policy.
// Owner access is mediated by the separately protected administrator secret.
export const operatorActionAllowed=(role:'owner'|'operator'|'viewer',method:string,path:string):boolean=>{
 if(role==='owner')return true;
 if(method==='GET'||method==='HEAD')return true;
 if(role==='viewer')return false;
 if(role!=='operator'||method!=='POST')return false;
 return [
  '/api/human-requests',
  '/api/human-requests/resolve',
  '/api/takeover',
  '/api/messages',
  '/api/ai/suggest-reply'
 ].includes(path);
};

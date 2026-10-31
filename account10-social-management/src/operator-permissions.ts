// Role permissions are explicitly enumerated. New API routes are denied to staff by default.
// The master owner secret remains restricted and must be replaced with named owner MFA before launch.
export const operatorActionAllowed=(role:'owner'|'operator'|'viewer',method:string,path:string):boolean=>{
 if(role==='owner')return true;
 if(role!=='operator'&&role!=='viewer')return false;
 if(method==='GET'||method==='HEAD'){
  const sharedRead=[
   '/api/operator/session',
   '/api/dashboard',
   '/api/conversations',
   '/api/conversation',
   '/api/human-requests',
   '/api/handover-policy',
   '/api/activity',
   '/api/takeover'
  ];
  const operatorRead=[
   '/api/drafts',
   '/api/whatsapp/deliveries'
  ];
  return sharedRead.includes(path)||(role==='operator'&&operatorRead.includes(path));
 }
 if(role!=='operator'||method!=='POST')return false;
 return [
  '/api/human-requests',
  '/api/human-requests/resolve',
  '/api/takeover',
  '/api/messages',
  '/api/ai/suggest-reply'
 ].includes(path);
};

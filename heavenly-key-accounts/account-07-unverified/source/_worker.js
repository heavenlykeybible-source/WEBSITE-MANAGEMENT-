// Account 7 dedicated Radio Pages Worker. No cross-account service binding assumed.
// Set MEDIA_PUBLIC_ORIGIN only after verifying Account 2's public broadcast endpoint.
const allowed = /^\/api\/broadcast\/(?:programme|live|media\/\d+\/object)$/;
export default {
 async fetch(request,env) {
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/broadcast/')) {
   if(!['GET','HEAD'].includes(request.method)||!allowed.test(url.pathname))return new Response('Not found',{status:404});
   if(!env.MEDIA_PUBLIC_ORIGIN||!env.RADIO_PUBLIC_API_KEY)return Response.json({error:'Broadcast connection not configured'},{status:503,headers:{'Cache-Control':'no-store'}});
   let base;try{base=new URL(env.MEDIA_PUBLIC_ORIGIN);if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw Error('Invalid origin');}catch{return Response.json({error:'Invalid broadcast origin configuration'},{status:503});}
   const target=new URL(url.pathname+url.search,base);
   const headers=new Headers();headers.set('Authorization','Bearer '+env.RADIO_PUBLIC_API_KEY);if(request.headers.has('Range'))headers.set('Range',request.headers.get('Range'));
   // Account 2 verifies this server-side token; never expose it in browser assets.
   const response=await fetch(new Request(target,{method:request.method,headers,redirect:'manual'}));
   const h=new Headers(response.headers);h.set('Cache-Control','no-store');h.delete('set-cookie');h.delete('access-control-allow-origin');
   return new Response(response.body,{status:response.status,headers:h});
  }
  return env.ASSETS?env.ASSETS.fetch(request):new Response('Radio assets not configured',{status:503});
 }
};

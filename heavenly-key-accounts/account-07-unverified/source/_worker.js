// Account 7 dedicated Radio Pages Worker. No cross-account service binding assumed.
// Set MEDIA_PUBLIC_ORIGIN only after verifying Account 2's public broadcast endpoint.
const allowed = /^\/api\/broadcast\/(?:programme|live|media\/\d+\/object)$/;
const viewerPath='/api/broadcast/livekit/viewer-token';
export default {
 async fetch(request,env) {
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/broadcast/')) {
   const viewer=url.pathname===viewerPath&&request.method==='POST';
   if(!viewer&&(!['GET','HEAD'].includes(request.method)||!allowed.test(url.pathname)))return new Response('Not found',{status:404});
   if(!env.MEDIA_PUBLIC_ORIGIN||!env.RADIO_PUBLIC_API_KEY)return Response.json({error:'Broadcast connection not configured'},{status:503,headers:{'Cache-Control':'no-store'}});
   let base;try{base=new URL(env.MEDIA_PUBLIC_ORIGIN);if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw Error('Invalid origin');}catch{return Response.json({error:'Invalid broadcast origin configuration'},{status:503});}
   const target=new URL(viewer?'/api/media-engine/livekit/viewer-token':url.pathname,base);
   // This public endpoint is exclusively the radio channel, regardless of caller input.
   if(url.pathname.endsWith('/programme')||viewer)target.searchParams.set('channel','radio');
   const headers=new Headers();headers.set('Authorization','Bearer '+env.RADIO_PUBLIC_API_KEY);if(request.headers.has('Range'))headers.set('Range',request.headers.get('Range'));
   // Account 2 verifies this server-side token; never expose it in browser assets.
   let response;try{response=await fetch(new Request(target,{method:request.method,headers,redirect:'manual',signal:AbortSignal.timeout(15000)}));}catch{return Response.json({error:'Broadcast engine unreachable'},{status:502,headers:{'Cache-Control':'no-store'}});}
   if(response.status>=300&&response.status<400)return Response.json({error:'Unexpected broadcast redirect'},{status:502,headers:{'Cache-Control':'no-store'}});
   const h=new Headers(response.headers);h.set('Cache-Control','no-store');h.delete('set-cookie');h.delete('access-control-allow-origin');h.delete('content-security-policy');
   return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers:h});
  }
  return env.ASSETS?env.ASSETS.fetch(request):new Response('Radio assets not configured',{status:503});
 }
};

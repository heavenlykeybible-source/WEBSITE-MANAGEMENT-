// Account 7 dedicated Radio Pages Worker. No cross-account service binding assumed.
// Set MEDIA_PUBLIC_ORIGIN only after verifying Account 2's public broadcast endpoint.
const allowed = /^\/api\/broadcast\/(?:programme|live|media\/\d+\/object)$/;
const viewerPath='/api/broadcast/livekit/viewer-token';
const secureHeaders=()=>({
 'Cache-Control':'no-store',
 'X-Content-Type-Options':'nosniff',
 'X-Frame-Options':'DENY',
 'Referrer-Policy':'no-referrer',
 'Strict-Transport-Security':'max-age=31536000; includeSubDomains',
 'Content-Security-Policy':"default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'"
});
const json=(body,status=200)=>Response.json(body,{status,headers:secureHeaders()});
const plain=(body,status)=>new Response(body,{status,headers:{...secureHeaders(),'Content-Type':'text/plain; charset=utf-8'}});
export default {
 async fetch(request,env) {
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/broadcast/')) {
   const viewer=url.pathname===viewerPath&&request.method==='POST';
   if(!viewer&&(!['GET','HEAD'].includes(request.method)||!allowed.test(url.pathname)))return plain('Not found',404);
   if(!env.MEDIA_PUBLIC_ORIGIN||!env.RADIO_PUBLIC_API_KEY)return json({error:'Broadcast connection not configured'},503);
   let base;try{base=new URL(env.MEDIA_PUBLIC_ORIGIN);if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw Error('Invalid origin');}catch{return json({error:'Invalid broadcast origin configuration'},503);}
   const target=new URL(viewer?'/api/media-engine/livekit/viewer-token':url.pathname,base);
   // This public endpoint is exclusively the radio channel, regardless of caller input.
   if(url.pathname.endsWith('/programme')||viewer)target.searchParams.set('channel','radio');
   const headers=new Headers();headers.set('Authorization','Bearer '+env.RADIO_PUBLIC_API_KEY);if(request.headers.has('Range'))headers.set('Range',request.headers.get('Range'));
   // Account 2 verifies this server-side token; never expose it in browser assets.
   let response;try{response=await fetch(new Request(target,{method:request.method,headers,redirect:'manual',signal:AbortSignal.timeout(15000)}));}catch{return json({error:'Broadcast engine unreachable'},502);}
   if(response.status>=300&&response.status<400)return json({error:'Unexpected broadcast redirect'},502);
   const h=new Headers(response.headers);
   h.delete('set-cookie');
   for(const key of [...h.keys()])if(key.toLowerCase().startsWith('access-control-'))h.delete(key);
   h.delete('server');h.delete('x-powered-by');h.delete('x-aspnet-version');
   for(const [name,value] of Object.entries(secureHeaders()))h.set(name,value);
   return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers:h});
  }
  return env.ASSETS?env.ASSETS.fetch(request):plain('Radio assets not configured',503);
 }
};

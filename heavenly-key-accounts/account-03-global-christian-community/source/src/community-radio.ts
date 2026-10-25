/** Read-only access to the public Radio service. Never forwards member credentials. */
export async function communityRadio(request:Request):Promise<Response|null>{
 const u=new URL(request.url);if(!u.pathname.startsWith('/api/community-radio/'))return null;
 if(!['GET','HEAD'].includes(request.method))return Response.json({error:{message:'Read-only radio endpoint.'}},{status:405});
 const id=u.pathname.match(/^\/api\/community-radio\/media\/(\d+)$/),programme=u.pathname==='/api/community-radio/programme';if(!id&&!programme)return Response.json({error:{message:'Radio route not found.'}},{status:404});
 const path=programme?'/api/broadcast/programme?channel=radio':'/api/broadcast/media/'+id![1]+'/object',headers=new Headers();if(id&&request.headers.has('range'))headers.set('Range',request.headers.get('range')!);
 try{const r=await fetch('https://radio.heavenlykey.org'+path,{method:request.method,headers,redirect:'manual',signal:AbortSignal.timeout(15000)});if(r.status>=300&&r.status<400)return Response.json({error:{message:'Radio redirected unexpectedly.'}},{status:502});const h=new Headers({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});for(const k of ['content-type','content-length','content-range','accept-ranges','etag'])if(r.headers.has(k))h.set(k,r.headers.get(k)!);return new Response(request.method==='HEAD'?null:r.body,{status:r.status,headers:h});}catch{return Response.json({error:{message:'Radio connection unavailable.'}},{status:502});}
}

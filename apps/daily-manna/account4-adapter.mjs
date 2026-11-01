// Account 4 integration adapter. Not active until explicitly wired into existing owner routes.
// The caller MUST verify active staff owner session and CSRF token before invoking this.
export async function dailyMannaProxy(request,env,security){
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
 if(security?.owner!==true)return reply({error:'Owner session required'},403);
 const method=request.method.toUpperCase(),mutates=method!=='GET';
 if(!['GET','POST','PUT','DELETE'].includes(method))return reply({error:'Method not allowed'},405);
 if(mutates&&security.csrfVerified!==true)return reply({error:'CSRF validation required'},403);
 const url=new URL(request.url),prefix='/api/daily-manna/';
 if(!url.pathname.startsWith(prefix))return reply({error:'Invalid path'},404);
 const suffix=url.pathname.slice(prefix.length);
 const pictureUpload=method==='PUT'&&/^picture\/(default|\d{4}-\d{2}-\d{2})$/.test(suffix);
 const pictureDelete=method==='DELETE'&&/^picture\/(default|\d{4}-\d{2}-\d{2})$/.test(suffix);
 const picturePreview=method==='GET'&&/^picture-manage\/(default|\d{4}-\d{2}-\d{2})$/.test(suffix);
 const permitted=pictureUpload||pictureDelete||picturePreview||(method==='GET'&&['entries','deliveries','readiness'].includes(suffix))||
  (method==='POST'&&['entries','approve','publish-check'].includes(suffix))||
  (method==='PUT'&&/^entries\/[a-f0-9-]{36}$/.test(suffix));
 if(!permitted)return reply({error:'Operation not permitted'},405);
 if(!env.MANNA_EDITOR_ORIGIN||!env.MANNA_EDITOR_TOKEN)return reply({error:'Daily Manna integration is not configured'},503);
 let base;
 try{base=new URL(env.MANNA_EDITOR_ORIGIN)}catch{return reply({error:'Invalid upstream configuration'},503)}
 if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash)return reply({error:'Invalid upstream origin'},503);
 const target=new URL('/api/'+suffix,base);
 if(method==='GET'&&suffix==='entries'){const month=url.searchParams.get('month');if(month)target.searchParams.set('month',month)}
 let body;
 if(pictureUpload){if(Number(request.headers.get('content-length')||0)>2000000)return reply({error:'Picture too large'},413);body=await request.arrayBuffer();if(body.byteLength>2000000)return reply({error:'Picture too large'},413)}
 else{body=mutates&&method!=='DELETE'?await request.text():undefined;if(body&&new TextEncoder().encode(body).length>50000)return reply({error:'Request too large'},413)}
 try{
  const upstream=await fetch(target.toString(),{method,headers:{authorization:'Bearer '+env.MANNA_EDITOR_TOKEN,'content-type':pictureUpload?(request.headers.get('content-type')||'application/octet-stream'):'application/json'},body,redirect:'manual',signal:AbortSignal.timeout(15000)});
  if(upstream.status>=300&&upstream.status<400)return reply({error:'Unexpected upstream redirect'},502);
  if(picturePreview){const type=(upstream.headers.get('content-type')||'').split(';')[0];if(!upstream.ok)return reply({error:'Picture preview unavailable'},upstream.status);if(!['image/png','image/jpeg','image/webp'].includes(type))return reply({error:'Unexpected picture format'},502);const bytes=await upstream.arrayBuffer();if(bytes.byteLength>2000000)return reply({error:'Picture preview too large'},502);return new Response(bytes,{status:200,headers:{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff'}})}
  const raw=await upstream.text();
  if(new TextEncoder().encode(raw).length>1000000)return reply({error:'Response too large'},502);
  let payload;try{payload=JSON.parse(raw)}catch{return reply({error:'Invalid upstream response'},502)}
  return reply(payload,upstream.status);
 }catch{return reply({error:'Daily Manna service unavailable'},502)}
}

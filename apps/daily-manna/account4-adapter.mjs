// Account 4 integration adapter. Not active until explicitly wired into existing owner routes.
// The caller MUST verify active staff owner session and CSRF token before invoking this.
export async function dailyMannaProxy(request,env,security){
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
 if(security?.owner!==true)return reply({error:'Owner session required'},403);
 const method=request.method.toUpperCase(),mutates=method!=='GET';
 if(!['GET','POST','PUT'].includes(method))return reply({error:'Method not allowed'},405);
 if(mutates&&security.csrfVerified!==true)return reply({error:'CSRF validation required'},403);
 const url=new URL(request.url),prefix='/api/daily-manna/';
 if(!url.pathname.startsWith(prefix))return reply({error:'Invalid path'},404);
 const suffix=url.pathname.slice(prefix.length);
 const permitted=(method==='GET'&&['entries','deliveries'].includes(suffix))||
  (method==='POST'&&['entries','approve','publish-check'].includes(suffix))||
  (method==='PUT'&&/^entries\/[a-f0-9-]{36}$/.test(suffix));
 if(!permitted)return reply({error:'Operation not permitted'},405);
 if(!env.MANNA_EDITOR_ORIGIN||!env.MANNA_EDITOR_TOKEN)return reply({error:'Daily Manna integration is not configured'},503);
 let base;
 try{base=new URL(env.MANNA_EDITOR_ORIGIN)}catch{return reply({error:'Invalid upstream configuration'},503)}
 if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash)return reply({error:'Invalid upstream origin'},503);
 const target=new URL('/api/'+suffix,base);
 if(method==='GET'&&suffix==='entries'){const month=url.searchParams.get('month');if(month)target.searchParams.set('month',month)}
 const body=mutates?await request.text():undefined;
 if(body&&new TextEncoder().encode(body).length>50000)return reply({error:'Request too large'},413);
 try{
  const upstream=await fetch(target.toString(),{method,headers:{authorization:'Bearer '+env.MANNA_EDITOR_TOKEN,'content-type':'application/json'},body,redirect:'manual',signal:AbortSignal.timeout(15000)});
  if(upstream.status>=300&&upstream.status<400)return reply({error:'Unexpected upstream redirect'},502);
  const raw=await upstream.text();
  if(new TextEncoder().encode(raw).length>1000000)return reply({error:'Response too large'},502);
  let payload;try{payload=JSON.parse(raw)}catch{return reply({error:'Invalid upstream response'},502)}
  return reply(payload,upstream.status);
 }catch{return reply({error:'Daily Manna service unavailable'},502)}
}

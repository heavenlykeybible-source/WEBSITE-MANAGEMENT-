// Public-only, fixed-origin read gateway. No user session, cookie, token or private data crosses accounts.
const ORIGIN = 'https://heavenlykey.org';
const HEADERS = {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const response = (data,status=200) => new Response(JSON.stringify(data),{status,headers:HEADERS});
const text = (value,max=240) => typeof value==='string' ? value.trim().slice(0,max) : '';
async function publicJson(path, upstreamFetch) {
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),6500);
  try {
    // Never proxy request cookies, Authorization, client headers, query strings or redirects.
    const result = await upstreamFetch(ORIGIN+path,{method:'GET',headers:{Accept:'application/json'},
      credentials:'omit',redirect:'error',cache:'no-store',signal:controller.signal});
    if(!result.ok || !(result.headers.get('content-type')||'').toLowerCase().includes('application/json'))throw Error('Unavailable');
    const reader=result.body?.getReader();if(!reader)throw Error('Missing body');
    let count=0;const chunks=[];
    try {
      for(;;){const {value,done}=await reader.read();if(done)break;count+=value.length;
        if(count>98304){await reader.cancel();throw Error('Response too large');}chunks.push(value);}
    }finally{reader.releaseLock();}
    const bytes=new Uint8Array(count);let position=0;
    for(const chunk of chunks){bytes.set(chunk,position);position+=chunk.length;}
    const data=JSON.parse(new TextDecoder().decode(bytes));
    if(!data||typeof data!=='object'||Array.isArray(data)||data.success!==true)throw Error('Invalid source response');
    return data;
  }finally{clearTimeout(timer);}
}
export async function handleSiteSync(request,env,upstreamFetch=fetch) {
  const url=new URL(request.url);
  if(request.method!=='GET' || url.pathname!=='/api/site-sync')return response({error:'Not found'},404);
  if(url.search)return response({error:'Query parameters are not supported.'},400);
  if(env.SITE_PUBLIC_SYNC_ENABLED!=='true')return response({error:'Ministry content sync is not available yet.'},503);
  // Independent public endpoints: a failure never creates fake events or false live claims.
  const settled=await Promise.allSettled([
    publicJson('/api/site-content/homepage',upstreamFetch),
    publicJson('/api/events',upstreamFetch)
  ]);
  if(settled.every(x=>x.status==='rejected'))
    return response({error:'Current ministry updates cannot be reached; use the website links.'},502);
  const home=settled[0].status==='fulfilled'?settled[0].value.content:null;
  const events=settled[1].status==='fulfilled'?settled[1].value.items:null;
  const safe=home&&typeof home==='object'&&!Array.isArray(home)?home:{};
  const programme={
    title:text(safe.grdpc_title),
    solutionTitle:text(safe.grdpc_solution_title),
    solutionTime:text(safe.grdpc_solution_time),
    midnightTitle:text(safe.grdpc_midnight_title),
    midnightTime:text(safe.grdpc_midnight_time)
  };
  const items=Array.isArray(events)?events.slice(0,10)
    .filter(v=>v&&typeof v==='object'&&!Array.isArray(v))
    .map(v=>({title:text(v.title,160),description:text(v.description,600),
      startTime:text(v.start_time,80),location:text(v.location,160)}))
    .filter(v=>v.title):[];
  return response({success:true,
    synced:{homepage:!!home,events:Array.isArray(events)},
    mission:{title:text(safe.mission_title,240),body:text(safe.mission_body,700)},
    programme,
    media:{radioTitle:text(safe.radio_title),tvTitle:text(safe.tv_title)},
    events:items
  });
}

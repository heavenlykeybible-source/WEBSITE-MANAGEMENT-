// Account 3 owns accounts and sessions. This draft gateway creates no identity store.
const ORIGIN = 'https://global.heavenlykey.org';
const COOKIE = '__Host-hk_session';
const SESSION = /^[a-f0-9]{64}$/;
const HEADERS = {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','vary':'Cookie'};
const cookie = (value, age=2592000) => `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
const reply = (data,status=200,clear=false) => new Response(JSON.stringify(data),{status,headers:{...HEADERS,...(clear?{'set-cookie':cookie('',0)}:{})}});
const text = (value,max=160) => typeof value==='string'?value.slice(0,max):'';
function session(request) {
  const values=(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(COOKIE+'='));
  if(values.length!==1)return null;
  const value=values[0].slice(COOKIE.length+1);
  return SESSION.test(value)?value:null;
}
async function jsonBody(response,limit) {
  const reader=response.body?.getReader();if(!reader)throw Error('Missing body');
  const chunks=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('Limit exceeded');}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const data=JSON.parse(new TextDecoder().decode(bytes));
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid JSON');
  return data;
}
function route(path,method) {
  const routes={
    'POST /api/member/login':{path:'/api/auth/login',kind:'login'},
    'POST /api/member/logout':{path:'/api/auth/logout',kind:'logout'},
    'GET /api/member/session':{path:'/api/me',kind:'session'},
    'GET /api/member/tracks':{path:'/api/discipleship/tracks',kind:'tracks'}
  };
  const found=routes[method+' '+path];if(found)return found;
  const match=path.match(/^\/api\/member\/lessons\/([1-9]\d{0,9})\/complete$/);
  return match&&method==='POST'?{path:`/api/discipleship/lessons/${match[1]}/complete`,kind:'complete'}:null;
}
function shape(data,kind) {
  if(kind==='login'||kind==='logout'){if(data.ok!==true)throw Error('Invalid operation');return {ok:true};}
  if(kind==='complete'){if(data.completed!==true)throw Error('Invalid completion');return {completed:true};}
  if(kind==='session'){
    if(!data.user||!Number.isSafeInteger(data.user.userId)||!['active','restricted'].includes(data.user.status))throw Error('Invalid session');
    // No email, birth date, location, internal role or arbitrary profile fields.
    return {member:{displayName:text(data.profile?.displayName)||'Community member',status:data.user.status}};
  }
  if(!Array.isArray(data.items))throw Error('Invalid tracks');
  return {items:data.items.slice(0,20).map(track=>({title:text(track?.title),description:text(track?.description,3000),lessons:Array.isArray(track?.lessons)?track.lessons.slice(0,100).filter(l=>Number.isSafeInteger(l?.lesson_id)&&l.lesson_id>0).map(l=>({id:l.lesson_id,title:text(l.title),scripture:text(l.scripture_reference),body:text(l.lesson_text,20000),question:text(l.reflection_question,3000),action:text(l.action_step,3000),completed:l.completed===1||l.completed===true})):[]}))};
}
export async function memberGateway(request,env,upstreamFetch=fetch) {
  const url=new URL(request.url);
  if(url.pathname==='/api/member/config'&&request.method==='GET')return reply({enabled:env.COMMUNITY_MEMBER_ACCESS_ENABLED==='true'});
  const target=route(url.pathname,request.method);
  if(!target)return reply({error:'Member operation is not available.'},404);
  if(url.protocol!=='https:'||url.search)return reply({error:'Use the secure app without query parameters.'},400);
  const site=request.headers.get('Sec-Fetch-Site');
  if(site&&site!=='same-origin'&&site!=='none')return reply({error:'Cross-site member access denied.'},403);
  if(request.method==='POST'&&request.headers.get('Origin')!==url.origin)return reply({error:'Use this app to perform the action.'},403);
  if(env.COMMUNITY_MEMBER_ACCESS_ENABLED!=='true')return reply({error:target.kind==='logout'?'Signed out on this device. Server revocation is pending while member access is disabled.':'Member integration is pending verification.'},503,target.kind==='logout');
  const id=session(request);
  if(target.kind==='login'&&id)return reply({error:'Sign out before switching accounts.'},409);
  if(target.kind!=='login'&&!id)return reply({error:'Please sign in.'},401,true);
  let body;
  if(request.method==='POST'){
    if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return reply({error:'Send application/json.'},415);
    try {
      const data=await jsonBody(request,8192);
      if(target.kind==='login'){
        const email=text(data.email,161).trim().toLowerCase(),password=text(data.password,129);
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>160||!password||password.length>128)return reply({error:'Enter a valid email and password.'},400);
        body=JSON.stringify({email,password});
      }else if(target.kind==='complete'){
        if(typeof data.reflection!=='string'||data.reflection.length>1200)return reply({error:'Use a reflection of up to 1,200 characters.'},400);
        body=JSON.stringify({reflection:data.reflection});
      }else body='{}';
    }catch{return reply({error:'Request is invalid or too large.'},400);}
  }
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try {
    // Only the reviewed session is translated to the upstream cookie. No client
    // authorization, IP, role, Origin or other arbitrary headers are forwarded.
    const headers={Accept:'application/json'};
    if(id&&target.kind!=='login')headers.Cookie='gc_session='+id;
    if(body){headers['Content-Type']='application/json';headers.Origin=ORIGIN;}
    if(target.kind==='tracks'){
      // The upstream track route also permits anonymous reads. Validate this
      // session first so an expired cookie cannot masquerade as signed-in progress.
      const check=await upstreamFetch(ORIGIN+'/api/me',{method:'GET',headers:{Accept:'application/json',Cookie:'gc_session='+id},redirect:'error',credentials:'omit',cache:'no-store',signal:controller.signal});
      if(check.status===401)return reply({error:'Please sign in.'},401,true);
      if(!check.ok||!(check.headers.get('content-type')||'').includes('application/json'))throw Error('Session unavailable');
      const verified=shape(await jsonBody(check,262144),'session');
      if(verified.member.status!=='active')return reply({error:'Learning actions are unavailable for your restricted account.'},403);
    }
    const result=await upstreamFetch(ORIGIN+target.path,{method:request.method,headers,body,redirect:'error',credentials:'omit',cache:'no-store',signal:controller.signal});
    if(!result.ok){
      const status=[400,401,403,409,429,503].includes(result.status)?result.status:502;
      const message=status===401?'Email or password is incorrect, or your session has ended.':status===403?'This action is unavailable for your account.':status===429?'Too many attempts. Please wait before trying again.':'The member service could not complete this request.';
      return reply({error:message},status,status===401||target.kind==='logout');
    }
    if(!(result.headers.get('content-type')||'').toLowerCase().includes('application/json'))throw Error('Invalid content type');
    const data=await jsonBody(result,1048576);
    const response=reply(shape(data,target.kind),200,target.kind==='logout');
    if(target.kind==='login'){
      if(data.ok!==true)throw Error('Invalid login');
      const all=result.headers.getSetCookie?.()||[result.headers.get('set-cookie')||''];
      const tokens=all.map(value=>value.match(/^gc_session=([a-f0-9]{64});/)).filter(Boolean);
      if(tokens.length!==1)throw Error('Missing session');
      response.headers.set('set-cookie',cookie(tokens[0][1]));
    }
    return response;
  }catch{return reply({error:target.kind==='logout'?'Signed out on this device. Server revocation could not be confirmed.':'The member service is temporarily unavailable.'},502,target.kind==='logout');}
  finally{clearTimeout(timer);}
}

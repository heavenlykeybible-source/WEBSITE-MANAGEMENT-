// Exact public static routes only. Member APIs, directory assets and credentials never cross this boundary.
const ROUTES={
 "/bible.html":["BIBLE_READER_APP","bible-reader"],
 "/audio-bible.html":["AUDIO_BIBLE_APP","audio-bible"],
 "/audio-bible.js":["AUDIO_BIBLE_APP","audio-bible"],
 "/hymns.html":["HYMNS_APP","hymns"],
 "/featured-main-hymn.js":["HYMNS_APP","hymns"],
 "/devotional.html":["DAILY_READING_APP","daily-reading"],
 '/walk-offline.html':['WALK_APP','walk-with-god'], '/walk-offline.js':['WALK_APP','walk-with-god'], '/walk-offline.css':['WALK_APP','walk-with-god'], '/walk-offline-content.js':['WALK_APP','walk-with-god'], '/offline-vault.js':['WALK_APP','walk-with-god'],
 '/creation-to-eternity.html':['BIBLE_STUDY_APP','bible-study-portal'], '/creation-to-eternity.js':['BIBLE_STUDY_APP','bible-study-portal'], '/creation-to-eternity.css':['BIBLE_STUDY_APP','bible-study-portal'],
 '/eternity-in-view':['ETERNITY_APP','eternity-in-view'], '/eternity-in-view/':['ETERNITY_APP','eternity-in-view'], '/eternity-in-view/index.html':['ETERNITY_APP','eternity-in-view']
};
export async function routeIndependentApp(request,env){
 if(env.INDEPENDENT_APPS_ENABLED!=='true')return null;
 const url=new URL(request.url),route=ROUTES[url.pathname];if(!route)return null;
 const [binding,id]=route,headers={'Cache-Control':'no-store','X-HK-App-Service':id,'Content-Type':'text/plain; charset=utf-8'};
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers});
 if(!env[binding]?.fetch)return new Response('This application service is unavailable.',{status:503,headers});
 const path=binding==='ETERNITY_APP'?'/eternity-in-view/':url.pathname;
 try{const safeHeaders=new Headers();for(const name of ['accept','if-none-match','if-modified-since'])if(request.headers.has(name))safeHeaders.set(name,request.headers.get(name));
 const response=await env[binding].fetch(new Request('https://app.internal'+path,{method:request.method,headers:safeHeaders,signal:AbortSignal.timeout(10000)}));
 if(response.headers.get('X-HK-App-Service')!==id)return new Response('Application identity mismatch.',{status:502,headers});
 if(response.status>=300 && response.status<400 && response.status!==304)return new Response('Application redirect denied.',{status:502,headers});
 // Independent static apps must not set Account 5 session cookies or redirect
 // browsers through an unreviewed Location header.
 const safe=new Headers(response.headers);
 // Do not let a separately deployed application mutate Account 5 browser state,
 // perform meta-equivalent redirects or grant cross-origin access to this host.
 for(const name of ['set-cookie','location','refresh','clear-site-data',
  'access-control-allow-origin','access-control-allow-credentials',
  'access-control-allow-headers','access-control-allow-methods',
  'access-control-expose-headers','access-control-max-age'])safe.delete(name);
 safe.set('x-content-type-options','nosniff');
 safe.set('referrer-policy','no-referrer');
 const noBody=request.method==='HEAD'||[204,205,304].includes(response.status);
 return new Response(noBody?null:response.body,{status:response.status,statusText:response.statusText,headers:safe});
 }catch{return new Response('This application is temporarily unavailable. Please try again.',{status:503,headers});}
}

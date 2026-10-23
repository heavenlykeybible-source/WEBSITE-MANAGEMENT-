// Independent Account 5 public app shell. Never import production D1/KV/R2,
// administrator passwords or secrets from Cloudflare Accounts 1-4.
import {memberGateway} from './member-gateway.js';
import {handleSiteSync} from './site-sync.js';
const JSON_HEADERS={
  "content-type":"application/json; charset=utf-8",
  "cache-control":"no-store",
  "x-content-type-options":"nosniff",
  "referrer-policy":"no-referrer"
};
// Public-only allowlist. Account 3 still owns identity, moderation and data.
const COMMUNITY_READS = {"/api/community/feed":"/api/feed", "/api/community/tracks":"/api/discipleship/tracks"};
async function publicCommunity(request, env, upstreamFetch) {
  const url=new URL(request.url);
  if(env.COMMUNITY_PUBLIC_READS_ENABLED!=="true")
    return new Response(JSON.stringify({error:"Community integration pending verification."}),{status:503,headers:JSON_HEADERS});
  if(url.search)return new Response(JSON.stringify({error:"Query parameters are not supported."}),{status:400,headers:JSON_HEADERS});
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),7000);
  try {
    // Fixed reviewed destination: no arbitrary host, redirects, client headers or cookies.
    const upstream=await upstreamFetch("https://global.heavenlykey.org"+COMMUNITY_READS[url.pathname],{
      method:"GET",headers:{Accept:"application/json"},redirect:"error",credentials:"omit",cache:"no-store",signal:controller.signal
    });
    if(!upstream.ok||!(upstream.headers.get("content-type")||"").includes("application/json"))throw new Error("Unavailable");
    const reader=upstream.body?.getReader();if(!reader)throw new Error("Empty");
    let total=0;const chunks=[];
    try{while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>262144){await reader.cancel();throw new Error("Too large");}chunks.push(value);}}finally{reader.releaseLock();}
    const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const data=JSON.parse(new TextDecoder().decode(bytes));
    if(!Array.isArray(data.items))throw new Error("Invalid");
    // Return only public text fields, never user IDs, media, lessons or profile metadata.
    const text=value=>typeof value==="string"?value:"";
    const items=data.items.filter(item=>item&&typeof item==="object"&&item.post_type!=="video"&&item.type!=="video"&&!item.video_url&&item.post_format!=="video_link").slice(0,20).map(item=>
      url.pathname.endsWith("/feed")?{display_name:text(item.profile_name || item.display_name).slice(0,160),body:text(item.body).slice(0,5000)}:
        {title:text(item.title).slice(0,160),description:text(item.description).slice(0,5000)});
    return new Response(JSON.stringify({items}),{status:200,headers:JSON_HEADERS});
  }catch{return new Response(JSON.stringify({error:"Community content is temporarily unavailable."}),{status:502,headers:JSON_HEADERS});}
  finally{clearTimeout(timeout);}
}
export function createWorker(upstreamFetch=fetch) {
  return {

  async fetch(request, env) {
    const url = new URL(request.url);
    if(url.pathname==='/api/site-sync')return handleSiteSync(request,env,upstreamFetch);
    if(url.pathname.startsWith('/api/member/'))return memberGateway(request,env,upstreamFetch);
    if (url.pathname === "/api/health" && (request.method === "GET" || request.method === "HEAD")) {
      return new Response(request.method === "HEAD" ? null :
        JSON.stringify({service:"heavenly-key-app",status:"ok",release:"starter"}), {
        status:200,headers:JSON_HEADERS
      });
    }
    if(Object.hasOwn(COMMUNITY_READS,url.pathname)&&request.method==="GET")
      return publicCommunity(request,env,upstreamFetch);
    if (url.pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({error:"API not available on this app shell."}),{
        status:404,headers:JSON_HEADERS
      });
    }
    // Wrangler Static Assets handles public files; member APIs are isolated above.
    return env.ASSETS.fetch(request);
  }
  };
}
export default createWorker();

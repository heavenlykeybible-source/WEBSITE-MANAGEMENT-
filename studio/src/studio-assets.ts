import {assets} from './embedded-manifest';
export function fetchStudioAsset(req:Request,env:{ASSETS?:Fetcher}):Promise<Response>|Response{
 if(!['GET','HEAD'].includes(req.method))return new Response('Method not allowed',{status:405});
 const path=new URL(req.url).pathname,item=assets[path==='/'?'/index.html':path];
 // A single-file release owns its exact asset snapshot, even if an older
 // ASSETS binding is inherited from an earlier deployment.
 if(item)return new Response(req.method==='HEAD'?null:item.content,{headers:{'Content-Type':item.type,'X-Content-Type-Options':'nosniff','Cache-Control':path==='/'||path==='/signin.html'?'no-store':'public,max-age=300'}});
 if(env.ASSETS&&Object.keys(assets).length===0)return env.ASSETS.fetch(req);
 return Response.json({error:'Studio asset not found. Upload the complete packaged Studio Worker.'},{status:Object.keys(assets).length?404:503,headers:{'Cache-Control':'no-store'}});
}

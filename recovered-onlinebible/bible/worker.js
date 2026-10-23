const PUBLIC_API = "https://heavenlykey.alldaywow247.workers.dev";
function isKjvRecording(item){
 return item&&typeof item.sourceLabel==="string"&&["KJV","KING JAMES (AUTHORIZED) VERSION","KING JAMES VERSION"].includes(item.sourceLabel.trim().toUpperCase())&&(item.translation===undefined||item.translation==="KJV");
}
function publicOrigin(env){
 const origin=new URL(env.MINISTRY_PUBLIC_API_ORIGIN||PUBLIC_API);
 if(origin.protocol!=="https:"||origin.username||origin.password||origin.pathname!=="/"||origin.search||origin.hash)throw Error("Invalid public ministry origin");
 return origin.origin;
}
async function bundledChapter(request,env,match,url){
 let name;try{name=decodeURIComponent(match[1]);}catch{return Response.json({success:false,error:{message:"Bible book not found."}},{status:404});}
 if(!/^[1-3]? ?[A-Za-z ]{2,30}$/.test(name))return Response.json({success:false,error:{message:"Bible book not found."}},{status:404});
 const manifestResponse=await env.ASSETS.fetch(new Request(new URL("/data/kjv/manifest.json",url)));
 if(!manifestResponse.ok)throw Error("Scripture manifest unavailable");
 const manifest=await manifestResponse.json();
 if(manifest.translation!=="KJV"||!Array.isArray(manifest.books))throw Error("Only KJV scripture is supported");
 const book=manifest.books.find(item=>item.name===name);
 const chapter=Number(match[2]);
 if(!book||!Number.isSafeInteger(chapter)||chapter<1||chapter>book.chapters)return Response.json({success:false,error:{message:"Bible chapter not found."}},{status:404});
 if(!/^[A-Z0-9]{3}$/.test(book.code))throw Error("Invalid scripture metadata");
 const response=await env.ASSETS.fetch(new Request(new URL("/data/kjv/"+book.code+".json",url)));
 if(!response.ok)throw Error("Scripture book unavailable");
 const data=await response.json(),verses=data.chapters?.[String(chapter)];
 if(data.translation!=="KJV"||data.book!==name||!Array.isArray(verses)||!verses.length||verses.some((v,i)=>v.isPlaceholder!==false||v.number!==i+1||typeof v.text!=="string"||!v.text.trim()))throw Error("KJV scripture validation failed");
 let chapterId;
 if(url.searchParams.get("metadata")==="1"){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
  try{const metadata=await fetch(publicOrigin(env)+"/api/bible/"+encodeURIComponent(name)+"/"+chapter,{headers:{Accept:"application/json"},redirect:"error",signal:controller.signal});if(metadata.ok){const info=await metadata.json();if(info.success===true&&Number.isSafeInteger(info.chapterId)&&info.chapterId>0)chapterId=info.chapterId;}}catch{}finally{clearTimeout(timer);}
 }
 const result=Response.json({success:true,translation:"KJV",book:name,chapter,verses,warning:null,...(chapterId?{chapterId}:{})},{headers:{"X-Content-Type-Options":"nosniff"}});
 return request.method==="HEAD"?new Response(null,{status:result.status,headers:result.headers}):result;
}
function publicPath(url) {
 const path=url.pathname;
 if(path==="/api/hymns")return "/api/hymns";
 if(/^\/api\/hymns\/[1-9]\d*$/.test(path))return path;
 if(/^\/api\/media\/[1-9]\d*\/object$/.test(path))return path;
 if(path==="/api/media"&&url.searchParams.get("topic")==="gospel-music")return "/api/media?topic=gospel-music";
 if(path==="/api/bible/audio"){
  const id=url.searchParams.get("chapterId");
  return id&&/^[1-9]\d*$/.test(id)?"/api/bible/audio?chapterId="+id:null;
 }
 const chapter=path.match(/^\/api\/bible\/([^/]+)\/([1-9]\d*)$/);
 if(chapter){let name;try{name=decodeURIComponent(chapter[1]);}catch{return null;}
  if(/^[1-3]? ?[A-Za-z ]{2,30}$/.test(name)&&Number(chapter[2])<=150)return "/api/bible/"+encodeURIComponent(name)+"/"+chapter[2];
 }
 return null;
}
export default {
 async fetch(request, env) {
  const url=new URL(request.url);
  if(!["GET","HEAD"].includes(request.method))return Response.json({success:false,error:{message:"This Bible service is read-only."}},{status:405,headers:{Allow:"GET, HEAD"}});
  if(url.pathname==="/health"){
   const response=Response.json({ok:true,product:"HEAVENLY KEY BIBLE",scripture:{translation:"KJV",books:66,chapters:1189,verses:31102},media:"existing ministry public API"});
   return request.method==="HEAD"?new Response(null,{status:response.status,headers:response.headers}):response;
  }
  if(url.pathname.startsWith("/api/")){
   if(!["GET","HEAD"].includes(request.method))return Response.json({success:false,error:{message:"This Bible service exposes read-only public media."}},{status:405,headers:{Allow:"GET, HEAD"}});
   const chapterMatch=url.pathname.match(/^\/api\/bible\/([^/]+)\/([1-9]\d*)$/);
   if(chapterMatch){try{return await bundledChapter(request,env,chapterMatch,url);}catch{return Response.json({success:false,error:{message:"KJV scripture is temporarily unavailable."}},{status:503});}}
   const path=publicPath(url);
   if(!path)return Response.json({success:false,error:{message:"Public resource not found."}},{status:404});
   const headers=new Headers({Accept:path.endsWith("/object")?"*/*":"application/json"});
   const range=request.headers.get("Range");
   if(range&&path.endsWith("/object")&&/^bytes=\d*-\d*$/.test(range))headers.set("Range",range);
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
   try{
    const upstream=await fetch(publicOrigin(env)+path,{method:"GET",headers,redirect:"error",signal:controller.signal});
    if(path.startsWith("/api/bible/audio")&&upstream.ok){
     const data=await upstream.json();
     if(data.success!==true||!Array.isArray(data.items))throw Error("Invalid chapter audio metadata");
     const result=Response.json({success:true,translation:"KJV",items:data.items.filter(isKjvRecording).map(item=>({...item,translation:"KJV"}))},{headers:{"X-Content-Type-Options":"nosniff"}});
     return request.method==="HEAD"?new Response(null,{status:result.status,headers:result.headers}):result;
    }
    const responseHeaders=new Headers();
    for(const header of ["Content-Type","Content-Length","Content-Range","Accept-Ranges","ETag","Cache-Control"])if(upstream.headers.has(header))responseHeaders.set(header,upstream.headers.get(header));
    responseHeaders.set("X-Content-Type-Options","nosniff");
    responseHeaders.set("Referrer-Policy","strict-origin-when-cross-origin");
    return new Response(request.method==="HEAD"?null:upstream.body,{status:upstream.status,headers:responseHeaders});
   }catch{return Response.json({success:false,error:{message:"The ministry media service is temporarily unavailable."}},{status:502});}
   finally{clearTimeout(timeout);}
  }
  return env.ASSETS.fetch(request);
 }
};

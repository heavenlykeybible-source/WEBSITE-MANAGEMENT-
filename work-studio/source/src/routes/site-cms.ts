/** Visual website editor: isolated drafts, owner publishing, slider and image library.
 * Uses the existing administrator session and existing production R2 (no new token).
 * The review branch is not deployed automatically. */
import type { Env } from "../services/auth-service";
import { requireMinimumRole } from "../middleware/rbac";
import { withSecurityHeaders } from "./auth";
type CMS = Env & {MEDIA_R2?: R2Bucket};
type Field={key:string;type:"text"|"image"|"alt";value:string};
type Slide={id:string;src:string;alt:string;caption:string;subtitle:string;enabled:boolean};
const PAGES=new Set(["home","about","community","contact","events","grdpc","i-said-yes","legal-requests","ministries","missions","partner","privacy","radio","resources","terms","video"]);
const MIME:{[key:string]:string}={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"};
const JSON_HEADERS={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
const reply=(body:unknown,status=200)=>withSecurityHeaders(new Response(JSON.stringify(body),{status,headers:JSON_HEADERS}));
const page=(req:Request)=>{const n=new URL(req.url).searchParams.get("page")||"";return PAGES.has(n)?n:null;};
const validKey=(v:string)=>/^[tai]_[a-z0-9]{6,16}$/.test(v);
const validImage=(value:string)=>{
 if(!value)return true; // hidden/removed picture, never an executable URL
 if(/^\/api\/site-content\/assets\/[a-f0-9-]{36}$/.test(value))return true;
 if(/^https:\/\//.test(value)&&value.length<=700)return true;
 return value.length<=700&&!value.includes("..")&&/^[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp|gif|svg)$/.test(value);
};
const validFields=(data:unknown):data is Field[]=>{
 if(!Array.isArray(data)||data.length>600)return false;
 const seen=new Set<string>();
 for(const raw of data){
  if(!raw||typeof raw!=="object")return false;
  const {key,type,value}=raw;
  if(typeof key!=="string"||!validKey(key)||seen.has(key)||!["text","image","alt"].includes(type)||typeof value!=="string")return false;
  if(value.length>(type==="text"?5000:type==="alt"?500:700))return false;
  if(type==="image"&&!validImage(value.trim()))return false;
  seen.add(key);
 }
 return true;
};
const validSlides=(data:unknown):data is Slide[]=>{
 if(!Array.isArray(data)||data.length>12)return false;
 const ids=new Set<string>();
 return data.every(v=>{
  if(!v||typeof v!=="object"||typeof v.id!=="string"||!/^[a-zA-Z0-9-]{4,64}$/.test(v.id)||ids.has(v.id))return false;
  ids.add(v.id);
  return typeof v.src==="string"&&Boolean(v.src)&&validImage(v.src)&&
   typeof v.alt==="string"&&v.alt.length<=200&&
   typeof v.caption==="string"&&v.caption.length<=180&&
   typeof v.subtitle==="string"&&v.subtitle.length<=180&&
   typeof v.enabled==="boolean";
 });
};
const convert=(changes:Field[])=>Object.fromEntries(changes.map(i=>[i.key,{type:i.type,value:i.value}]));
const values=(raw:any)=>{
 const obj=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{};
 return Object.entries(obj).map(([key,value])=>({key,type:(value as any)?.type,value:(value as any)?.value}));
};
async function published(env:CMS,p:string){
 const rows=await env.DB.prepare("SELECT field_key,field_type,content_value FROM site_page_content WHERE page_key=?").bind(p).all<any>();
 return Object.fromEntries((rows.results||[]).filter(x=>validKey(x.field_key)).map(x=>[x.field_key,{type:x.field_type,value:x.content_value}]));
}
async function currentPage(env:CMS,p:string){
 const draft=await env.DB.prepare("SELECT content_json FROM site_cms_drafts WHERE page_key=?").bind(p).first<{content_json:string}>();
 const live=await published(env,p);
 return {content:draft?JSON.parse(draft.content_json):live,hasDraft:Boolean(draft),published:live};
}
async function admin(req:Request,env:CMS){
 return requireMinimumRole(req,env,"Administrator");
}
function originOK(req:Request){return req.headers.get("Origin")===new URL(req.url).origin;}
async function jsonBody(req:Request){try{return await req.json() as Record<string,any>;}catch{return null;}}
export async function handleCmsPublicPage(req:Request,env:CMS):Promise<Response>{
 const p=page(req);if(!p)return reply({error:"Unknown page"},404);
 return reply({page:p,content:await published(env,p)});
}
export async function handleCmsPage(req:Request,env:CMS):Promise<Response>{
 const actor=await admin(req,env);if(!actor)return reply({error:"Administrator login required"},403);
 const p=page(req);if(!p)return reply({error:"Unknown page"},404);
 if(req.method==="GET"){
  if(new URL(req.url).searchParams.has("history")){
   const v=await env.DB.prepare("SELECT revision_id,updated_at,action FROM site_cms_revisions WHERE page_key=? ORDER BY revision_id DESC LIMIT 25").bind(p).all();
   return reply({page:p,versions:v.results});
  }
  return reply({page:p,...await currentPage(env,p)});
 }
 if(req.method!=="POST"||!originOK(req))return reply({error:"Invalid request origin"},403);
 const input=await jsonBody(req);if(!input)return reply({error:"Invalid JSON"},400);
 const action=input.action||"save-draft";
 if(action==="save-draft"){
  if(!validFields(input.changes))return reply({error:"Invalid page fields"},400);
  const content=JSON.stringify(convert(input.changes as Field[]));
  await env.DB.prepare("INSERT INTO site_cms_drafts(page_key,content_json,updated_by) VALUES(?,?,?) ON CONFLICT(page_key) DO UPDATE SET content_json=excluded.content_json,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
   .bind(p,content,actor.userId).run();
  return reply({ok:true,draft:true,saved:(input.changes as Field[]).length});
 }
 if(action==="discard"){
  await env.DB.prepare("DELETE FROM site_cms_drafts WHERE page_key=?").bind(p).run();
  return reply({ok:true,draft:false});
 }
 let content:any;
 if(action==="restore"){
  const rev=Number(input.revisionId);
  if(!Number.isSafeInteger(rev)||rev<1)return reply({error:"Choose a valid revision"},400);
  const item=await env.DB.prepare("SELECT content_json FROM site_cms_revisions WHERE page_key=? AND revision_id=?").bind(p,rev).first<{content_json:string}>();
  if(!item)return reply({error:"Revision not found"},404);
  content=JSON.parse(item.content_json);
 }else if(action==="publish"){
  const draft=await env.DB.prepare("SELECT content_json FROM site_cms_drafts WHERE page_key=?").bind(p).first<{content_json:string}>();
  if(!draft)return reply({error:"Save a draft before publishing"},409);
  content=JSON.parse(draft.content_json);
 }else return reply({error:"Unsupported action"},400);
 const entries=values(content);if(!validFields(entries))return reply({error:"Invalid saved draft or revision"},409);
 const statements=[
  env.DB.prepare("DELETE FROM site_page_content WHERE page_key=?").bind(p),
  ...entries.map(x=>env.DB.prepare("INSERT INTO site_page_content(page_key,field_key,field_type,content_value,updated_by) VALUES(?,?,?,?,?)").bind(p,x.key,x.type,x.value,actor.userId)),
  env.DB.prepare("INSERT INTO site_cms_revisions(page_key,content_json,updated_by,action) VALUES(?,?,?,?)").bind(p,JSON.stringify(content),actor.userId,action),
  env.DB.prepare("DELETE FROM site_cms_drafts WHERE page_key=?").bind(p)
 ];
 await env.DB.batch(statements);
 return reply({ok:true,published:true,count:entries.length});
}
async function sliderRow(env:CMS){
 return env.DB.prepare("SELECT draft_json,published_json FROM site_cms_slider_state WHERE slider_key='home'").first<{draft_json:string|null;published_json:string|null}>();
}
export async function handleCmsSlider(req:Request,env:CMS,isAdmin:boolean):Promise<Response>{
 if(isAdmin&&!await admin(req,env))return reply({error:"Administrator login required"},403);
 const row=await sliderRow(env);
 if(req.method==="GET"){
  if(isAdmin)return reply({slides:row?.draft_json?JSON.parse(row.draft_json):(row?.published_json?JSON.parse(row.published_json):null),published:row?.published_json?JSON.parse(row.published_json):null,hasDraft:row?.draft_json!==null&&row?.draft_json!==undefined});
  return reply({slides:row?.published_json?JSON.parse(row.published_json):null});
 }
 if(!isAdmin||req.method!=="POST"||!originOK(req))return reply({error:"Invalid request"},403);
 const body=await jsonBody(req);if(!body)return reply({error:"Invalid JSON"},400);
 const action=body.action||"save-draft";
 if(action==="save-draft"){
  if(!validSlides(body.slides))return reply({error:"Slider must contain at most 12 pictures, each with valid details"},400);
  await env.DB.prepare("INSERT INTO site_cms_slider_state(slider_key,draft_json) VALUES('home',?) ON CONFLICT(slider_key) DO UPDATE SET draft_json=excluded.draft_json,updated_at=CURRENT_TIMESTAMP").bind(JSON.stringify(body.slides)).run();
  return reply({ok:true,draft:true});
 }
 if(action==="discard"){
  await env.DB.prepare("UPDATE site_cms_slider_state SET draft_json=NULL WHERE slider_key='home'").run();
  return reply({ok:true,draft:false});
 }
 let slides:unknown;
 if(action==="restore"){
  const revisionId=Number(body.revisionId);
  if(!Number.isSafeInteger(revisionId)||revisionId<1)return reply({error:"Invalid revision"},400);
  const old=await env.DB.prepare("SELECT slides_json FROM site_cms_slider_revisions WHERE revision_id=?").bind(revisionId).first<{slides_json:string}>();
  if(!old)return reply({error:"Revision not found"},404);
  slides=JSON.parse(old.slides_json);
 }else if(action==="publish"){
  if(!row||row.draft_json===null)return reply({error:"Save a slider draft before publishing"},409);
  slides=JSON.parse(row.draft_json);
 }else return reply({error:"Invalid slider action"},400);
 if(!validSlides(slides)||!(slides as Slide[]).some(s=>s.enabled&&s.src))return reply({error:"The public slider needs at least one enabled picture"},400);
 const encoded=JSON.stringify(slides);
 await env.DB.batch([
  env.DB.prepare("INSERT INTO site_cms_slider_state(slider_key,published_json,draft_json) VALUES('home',?,NULL) ON CONFLICT(slider_key) DO UPDATE SET published_json=excluded.published_json,draft_json=NULL,updated_at=CURRENT_TIMESTAMP").bind(encoded),
  env.DB.prepare("INSERT INTO site_cms_slider_revisions(slides_json,action) VALUES(?,?)").bind(encoded,action)
 ]);
 return reply({ok:true,published:true});
}
export async function handleCmsSliderHistory(req:Request,env:CMS):Promise<Response>{
 if(!await admin(req,env))return reply({error:"Administrator login required"},403);
 const rows=await env.DB.prepare("SELECT revision_id,created_at,action FROM site_cms_slider_revisions ORDER BY revision_id DESC LIMIT 25").all();
 return reply({versions:rows.results});
}
function sniff(bytes:Uint8Array){
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x))return "image/png";
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return "image/jpeg";
 if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP")return "image/webp";
 return "";
}
export async function handleCmsAssets(req:Request,env:CMS):Promise<Response>{
 if(!await admin(req,env))return reply({error:"Administrator login required"},403);
 if(!env.MEDIA_R2)return reply({error:"Site media storage is unavailable"},503);
 if(req.method==="GET"){
  const result=await env.DB.prepare("SELECT asset_id,filename,mime_type,size_bytes,created_at FROM site_cms_assets WHERE archived=0 ORDER BY created_at DESC LIMIT 100").all<any>();
  return reply({items:(result.results||[]).map((v:any)=>({...v,url:"/api/site-content/assets/"+v.asset_id}))});
 }
 if(req.method!=="POST"||!originOK(req))return reply({error:"Invalid upload origin"},403);
 const type=req.headers.get("Content-Type")||"";
 if(!MIME[type])return reply({error:"Use JPEG, PNG or WebP pictures"},415);
 if(Number(req.headers.get("Content-Length")||0)>8*1024*1024)return reply({error:"Picture exceeds 8 MB"},413);
 const data=new Uint8Array(await req.arrayBuffer());
 if(!data.length||data.length>8*1024*1024)return reply({error:"Choose a picture up to 8 MB"},413);
 if(sniff(data)!==type)return reply({error:"Picture data does not match its file type"},415);
 const id=crypto.randomUUID(),key="site-cms/"+id+"."+MIME[type];
 const name=decodeURIComponent(req.headers.get("X-Filename")||"picture").slice(0,160).replace(/[^\w .()-]/g,"");
 await env.MEDIA_R2.put(key,data,{httpMetadata:{contentType:type}});
 try{await env.DB.prepare("INSERT INTO site_cms_assets(asset_id,object_key,filename,mime_type,size_bytes) VALUES(?,?,?,?,?)").bind(id,key,name,type,data.length).run();}
 catch(e){await env.MEDIA_R2.delete(key);throw e;}
 return reply({ok:true,url:"/api/site-content/assets/"+id,asset_id:id},201);
}
export async function handleCmsImage(req:Request,env:CMS,id:string):Promise<Response>{
 if(!/^[a-f0-9-]{36}$/.test(id))return reply({error:"Invalid media"},404);
 if(!env.MEDIA_R2)return reply({error:"Media storage unavailable"},503);
 const row=await env.DB.prepare("SELECT object_key,mime_type FROM site_cms_assets WHERE asset_id=?").bind(id).first<{object_key:string;mime_type:string}>();
 if(!row)return reply({error:"Picture not found"},404);
 const object=await env.MEDIA_R2.get(row.object_key);if(!object)return reply({error:"Picture missing"},404);
 const headers=new Headers({"Content-Type":row.mime_type,"Cache-Control":"public,max-age=604800,immutable","X-Content-Type-Options":"nosniff","X-Robots-Tag":"noindex"});
 if(req.method==="HEAD")return new Response(null,{headers});
 return new Response(object.body,{headers});
}

type HomepageSection = {id:"hero"|"media"|"bottom";visible:boolean;background:string};
const DEFAULT_SECTIONS:HomepageSection[]=[
 {id:"hero",visible:true,background:""},
 {id:"media",visible:true,background:""},
 {id:"bottom",visible:true,background:""}
];
function validSections(input:unknown):input is HomepageSection[]{
 if(!Array.isArray(input)||input.length!==3)return false;
 const ids=input.map((v:any)=>v?.id);
 if(new Set(ids).size!==3||!["hero","media","bottom"].every(x=>ids.includes(x)))return false;
 return input.every((v:any)=>v&&typeof v.visible==="boolean"&&typeof v.background==="string"&&v.background.length<=700&&validImage(v.background));
}
async function getHomeLayout(env:CMS){
 return env.DB.prepare("SELECT draft_json,published_json FROM site_cms_layout WHERE page_key='home'").first<{draft_json:string|null;published_json:string|null}>();
}
export async function handleCmsLayout(req:Request,env:CMS,protectedRoute:boolean):Promise<Response>{
 let actor:any=null;
 if(protectedRoute){actor=await admin(req,env);if(!actor)return reply({error:"Administrator login required"},403);}
 const record=await getHomeLayout(env);
 if(req.method==="GET"){
  if(protectedRoute&&new URL(req.url).searchParams.has("history")){
   const rows=await env.DB.prepare("SELECT revision_id,updated_at,action FROM site_cms_layout_revisions WHERE page_key='home' ORDER BY revision_id DESC LIMIT 25").all();
   return reply({versions:rows.results});
  }
  const published=record?.published_json?JSON.parse(record.published_json):DEFAULT_SECTIONS;
  return reply(protectedRoute?{sections:record?.draft_json?JSON.parse(record.draft_json):published,hasDraft:record?.draft_json!=null,published}:{sections:published});
 }
 if(!protectedRoute||req.method!=="POST"||!originOK(req))return reply({error:"Invalid layout request"},403);
 const body=await jsonBody(req);if(!body)return reply({error:"Invalid JSON"},400);
 const action=body.action||"save-draft";
 if(action==="save-draft"){
  if(!validSections(body.sections))return reply({error:"The homepage needs exactly three valid editable sections"},400);
  await env.DB.prepare("INSERT INTO site_cms_layout(page_key,draft_json,updated_by) VALUES('home',?,?) ON CONFLICT(page_key) DO UPDATE SET draft_json=excluded.draft_json,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
   .bind(JSON.stringify(body.sections),actor.userId).run();
  return reply({ok:true,draft:true});
 }
 if(action==="discard"){
  await env.DB.prepare("UPDATE site_cms_layout SET draft_json=NULL WHERE page_key='home'").run();
  return reply({ok:true,draft:false});
 }
 let sections:unknown;
 if(action==="restore"){
  const version=Number(body.revisionId);
  if(!Number.isSafeInteger(version)||version<1)return reply({error:"Invalid revision"},400);
  const row=await env.DB.prepare("SELECT layout_json FROM site_cms_layout_revisions WHERE page_key='home' AND revision_id=?").bind(version).first<{layout_json:string}>();
  if(!row)return reply({error:"Version not found"},404);
  sections=JSON.parse(row.layout_json);
 }else if(action==="publish"){
  if(!record||record.draft_json===null)return reply({error:"Save a draft first"},409);
  sections=JSON.parse(record.draft_json);
 }else return reply({error:"Unknown layout action"},400);
 if(!validSections(sections)||!(sections as HomepageSection[]).some(s=>s.id==="hero"&&s.visible))
  return reply({error:"The homepage hero section must remain visible"},400);
 const jsonData=JSON.stringify(sections);
 await env.DB.batch([
  env.DB.prepare("INSERT INTO site_cms_layout(page_key,published_json,draft_json,updated_by) VALUES('home',?,NULL,?) ON CONFLICT(page_key) DO UPDATE SET published_json=excluded.published_json,draft_json=NULL,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP").bind(jsonData,actor.userId),
  env.DB.prepare("INSERT INTO site_cms_layout_revisions(page_key,layout_json,action,updated_by) VALUES('home',?,?,?)").bind(jsonData,action,actor.userId)
 ]);
 return reply({ok:true,published:true});
}

import type {Env,SessionUser} from "./types";
import {moderateText} from "./moderation";
const fail=(message:string,status=400)=>{throw Object.assign(new Error(message),{status});};
const text=(value:unknown,max:number,label:string,required=true)=>{const result=String(value??"").trim();if((required&&!result)||result.length>max)fail(label+" is required and must be at most "+max+" characters.");return result;};
export function advertUrl(value:unknown,optional=false){const input=String(value??"").trim();if(!input&&optional)return null;if(input.length>2048)fail("Advert URL is too long.");try{const u=new URL(input);if(u.protocol!=="https:"||u.username||u.password||!u.hostname.includes(".")||u.hostname==="localhost"||/^(127\.|10\.|192\.168\.|169\.254\.)/.test(u.hostname))throw Error();return u.href;}catch{return fail("Use a public HTTPS URL for adverts.");}}
export function validateAdvert(input:any){
 const placement=String(input.placement||"feed"),status=String(input.status||"draft");
 if(!["feed","sidebar","banner"].includes(placement))fail("Choose a valid advert placement.");
 if(!["draft","published","paused","archived"].includes(status))fail("Choose a valid advert status.");
 const time=(value:unknown)=>{if(!value)return null;const parsed=new Date(String(value));if(!Number.isFinite(parsed.getTime()))fail("Enter a valid advert date.");return parsed.toISOString();};
 const startsAt=time(input.startsAt),endsAt=time(input.endsAt);
 if(startsAt&&endsAt&&endsAt<=startsAt)fail("The end date must be after the start date.");
 const priority=Number(input.priority??0);if(!Number.isInteger(priority)||priority<0||priority>100)fail("Priority must be between 0 and 100.");
 const imageUrl=String(input.imageUrl||"").trim()||null;if(imageUrl&&!/^\/api\/adverts\/images\/[a-f0-9-]{36}$/.test(imageUrl))fail("Use an image uploaded through the advert manager.");
 const result={title:text(input.title,100,"Title"),body:text(input.body,1000,"Advert text"),sponsor:text(input.sponsor,100,"Sponsor"),linkUrl:advertUrl(input.linkUrl),imageUrl,buttonLabel:text(input.buttonLabel||"Learn more",40,"Button label"),placement,status,startsAt,endsAt,priority};
 if(status==="published"){const review=moderateText(result.title+" "+result.body+" "+result.sponsor,"post");if(["hold","block"].includes(review.decision))fail("Revise the advert to meet the community rules before publishing.");}return result;
}
export async function saveAdvert(env:Env,actor:SessionUser,input:any,id?:number){
 const a=validateAdvert(input);if(id&&!await env.DB.prepare("SELECT 1 FROM community_adverts WHERE advert_id=?").bind(id).first())fail("Advert not found.",404);
 if(a.imageUrl&&!await env.DB.prepare("SELECT 1 FROM advert_images WHERE image_id=?").bind(a.imageUrl.split("/").pop()).first())fail("Advert image not found. Upload the image again.");
 const values=[a.title,a.body,a.sponsor,a.linkUrl,a.imageUrl,a.buttonLabel,a.placement,a.status,a.startsAt,a.endsAt,a.priority];
 const results=await env.DB.batch([
 id?env.DB.prepare("UPDATE community_adverts SET title=?,body=?,sponsor=?,link_url=?,image_url=?,button_label=?,placement=?,status=?,starts_at=?,ends_at=?,priority=?,updated_by=?,updated_at=datetime('now') WHERE advert_id=? RETURNING advert_id").bind(...values,actor.userId,id):
 env.DB.prepare("INSERT INTO community_adverts(title,body,sponsor,link_url,image_url,button_label,placement,status,starts_at,ends_at,priority,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING advert_id").bind(...values,actor.userId,actor.userId),
 env.DB.prepare("INSERT INTO safety_audit(actor_user_id,action,target_type,target_id,reason) VALUES(?,?,'advert',COALESCE(?,last_insert_rowid()),?)").bind(actor.userId,id?"advert_update":"advert_create",id||null,a.status+": "+a.title)
 ]);return {advertId:Number((results[0].results?.[0] as any)?.advert_id)};
}
export async function listAdverts(env:Env,before:number){const rows=await env.DB.prepare("SELECT * FROM community_adverts WHERE (?=0 OR advert_id<?) ORDER BY advert_id DESC LIMIT 51").bind(before,before).all<any>();return {items:rows.results.slice(0,50),nextBefore:rows.results.length>50?rows.results[49].advert_id:null};}
export async function publicAdverts(env:Env){const now=new Date().toISOString();const rows=await env.DB.prepare("SELECT advert_id,title,body,sponsor,link_url,image_url,button_label,placement FROM (SELECT advert_id,title,body,sponsor,link_url,image_url,button_label,placement,ROW_NUMBER() OVER(PARTITION BY placement ORDER BY priority DESC,advert_id DESC) AS slot FROM community_adverts WHERE status='published' AND (starts_at IS NULL OR starts_at<=?) AND (ends_at IS NULL OR ends_at>?)) WHERE slot<=2 ORDER BY placement,slot").bind(now,now).all();return {items:rows.results};}
export async function uploadImage(env:Env,actor:SessionUser,request:Request){
 const limit=2*1024*1024;if(Number(request.headers.get("Content-Length"))>limit)fail("Advert images must be at most 2 MB.",413);
 const reader=request.body?.getReader();if(!reader)fail("Choose an advert image.");let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const part=await reader!.read();if(part.done)break;size+=part.value.length;if(size>limit){await reader!.cancel();fail("Advert images must be at most 2 MB.",413);}chunks.push(part.value);}}finally{reader!.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const mime=request.headers.get("Content-Type")||"",png=bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v),jpeg=bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255,webp=bytes.length>=12&&new TextDecoder().decode(bytes.slice(0,4))==="RIFF"&&new TextDecoder().decode(bytes.slice(8,12))==="WEBP";
 if(!(mime==="image/png"&&png||mime==="image/jpeg"&&jpeg||mime==="image/webp"&&webp))fail("Choose a PNG, JPEG or WebP image. SVG files are not accepted.");
 const id=crypto.randomUUID(),key="adverts/"+id;await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:mime}});
 try{await env.DB.batch([env.DB.prepare("INSERT INTO advert_images(image_id,object_key,mime_type,created_by) VALUES(?,?,?,?)").bind(id,key,mime,actor.userId),env.DB.prepare("INSERT INTO safety_audit(actor_user_id,action,target_type,target_id,reason) VALUES(?,'advert_image_upload','advert',0,?)").bind(actor.userId,id)]);}catch(e){await env.MEDIA.delete(key);throw e;}
 return {imageUrl:"/api/adverts/images/"+id};
}
export async function image(env:Env,id:string){const now=new Date().toISOString(),url="/api/adverts/images/"+id;const row=await env.DB.prepare("SELECT i.object_key,i.mime_type FROM advert_images i WHERE i.image_id=? AND EXISTS(SELECT 1 FROM community_adverts a WHERE a.image_url=? AND a.status='published' AND (a.starts_at IS NULL OR a.starts_at<=?) AND (a.ends_at IS NULL OR a.ends_at>?))").bind(id,url,now,now).first<any>();if(!row)return null;const object=await env.MEDIA.get(row.object_key);return object?{body:object.body,mime:row.mime_type,etag:object.httpEtag}:null;}

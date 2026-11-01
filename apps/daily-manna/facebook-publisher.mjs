// Publish one Daily Manna to an authorized Facebook Page.
// No credentials are hard-coded; this module does not schedule or retry jobs.
const MAX_MESSAGE=60000;
export function facebookReady(env){
 return Boolean(env.FACEBOOK_PAGE_ID&&/^[0-9]+$/.test(env.FACEBOOK_PAGE_ID)&&env.FACEBOOK_PAGE_TOKEN&&env.MANNA_PUBLIC_ORIGIN);
}
export function devotionalCaption(entry,origin){
 if(!entry||!/^\d{4}-\d{2}-\d{2}$/.test(entry.publish_date))throw Error('Invalid publication date');
 const home=new URL(origin);
 if(home.protocol!=='https:'||home.username||home.password||home.search||home.hash)throw Error('Invalid public origin');
 const link=new URL('/?date='+encodeURIComponent(entry.publish_date),home).toString();
 const text=[entry.title,entry.scripture,entry.body,entry.prayer?'Prayer: '+entry.prayer:'','Read STRENGTH FOR TODAY - our daily manna: '+link].filter(Boolean).join('\n\n');
 if(text.length>MAX_MESSAGE)throw Error('Caption exceeds provider limit');
 return {text,link};
}
export async function publishToFacebook(entry,env,fetcher=fetch){
 if(!facebookReady(env))throw Error('Facebook Page integration is not configured');
 const {text,link}=devotionalCaption(entry,env.MANNA_PUBLIC_ORIGIN);
 const version=/^v\d+\.\d+$/.test(env.FACEBOOK_GRAPH_VERSION||'')?env.FACEBOOK_GRAPH_VERSION:'v26.0';
 const page=env.FACEBOOK_PAGE_ID;
 const headers={authorization:'Bearer '+env.FACEBOOK_PAGE_TOKEN};
 const pictureKey=entry.picture_object_key;
 let endpoint='feed',body;
 if(pictureKey){
  if(!env.MANNA_IMAGES)throw Error('Selected picture storage unavailable');
  const image=await env.MANNA_IMAGES.get(pictureKey);
  if(!image)throw Error('Selected post picture missing');
  const bytes=await image.arrayBuffer();
  if(bytes.byteLength>2000000)throw Error('Selected post picture too large');
  const type=entry.picture_content_type;
  if(!['image/jpeg','image/png','image/webp'].includes(type))throw Error('Selected post picture type invalid');
  body=new FormData();
  body.set('source',new Blob([bytes],{type}),'daily-manna.'+(type==='image/png'?'png':type==='image/webp'?'webp':'jpg'));
  body.set('caption',text);
  endpoint='photos';
 }else{
  body=new URLSearchParams({message:text,link});
 }
 const result=await fetcher('https://graph.facebook.com/'+version+'/'+page+'/'+endpoint,{method:'POST',headers,body,redirect:'error',signal:AbortSignal.timeout(20000)});
 let json;try{json=await result.json()}catch{throw Error('Facebook response was not valid JSON')}
 if(!result.ok||!json?.id)throw Error('Facebook rejected publication (HTTP '+result.status+')');
 return {provider:'facebook',provider_post_id:String(json.post_id||json.id),with_picture:endpoint==='photos'};
}

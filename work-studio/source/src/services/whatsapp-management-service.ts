import type { Env as BaseEnv } from "./auth-service";
import { encryptField, decryptField } from "./encryption-service";

export interface CommunicationsEnv extends BaseEnv {
  ENCRYPTION_KEY?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  META_APP_SECRET?: string;
  META_GRAPH_VERSION?: string;
}

type ReplyKind="reply"|"prayer"|"human"|"support";
const enc=new TextEncoder();

function normalize(text:string){return text.trim().toLowerCase().replace(/\s+/g," ");}
async function hmacHex(secret:string,value:string){
  const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig=await crypto.subtle.sign("HMAC",key,enc.encode(value));
  return Array.from(new Uint8Array(sig)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
function safeEqual(a:string,b:string){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}

export function automatedReply(input:string):{kind:ReplyKind;body:string}|null{
  const value=normalize(input);
  if(/^(hi|hello|hey|menu|start|help|options|what can you do)$/.test(value))return {kind:"reply",body:[
    "Welcome to Heavenly Key Evangelistic Movement.","How can we help you today?","",
    "1. About Heavenly Key Evangelistic Movement",
    "2. Website / digital service enquiry",
    "3. Next ministry programme",
    "4. Connect with the ministry",
    "5. Ministry contact information",
    "6. Prayer request",
    "7. Speak with Evangelist Emmanuel Ogheneochuko Adiohwo",
    "8. Social media information",
    "9. Support / partnership",
    "10. Human assistance",
    "11. Global Christian Online Community",
    "12. Faith of Our Fathers TV / Revival Radio",
    "13. GRDPC — Global Revival & Destiny Prayer Cry",
    "14. Open the Heavenly Key website",
    "",
    "Reply with a number or MENU."
  ].join("\n")};
  if(/^(1|about|about heavenly key|what is heavenly key evangelistic movement)$/.test(value))return {kind:"reply",body:"Heavenly Key Evangelistic Movement is an End-Time, Non-Denominational, Apostolic & Evangelistic Movement — taking Christ to the nations of the world, uniting the Body of Christ and upholding the faith of our fathers.\n\nhttps://heavenlykey.org"};
  if(/^(2|website|digital service|need a website)$/.test(value))return {kind:"human",body:"Thank you. Your website/digital-service enquiry has been received. A ministry representative will follow up with you."};
  if(/^(3|next program|next programme|programme|program)$/.test(value))return {kind:"reply",body:"For the latest Heavenly Key crusades, revival programmes, prayer meetings and broadcasts, please visit the official website:\nhttps://heavenlykey.org\n\nReply MENU for more options."};
  if(/^(4|connect|connect with the ministry)$/.test(value))return {kind:"reply",body:"You can connect with Heavenly Key Evangelistic Movement through the official website, Global Christian Online Community, prayer programmes and social channels.\nhttps://heavenlykey.org"};
  if(/^(5|contact|contact information|phone)$/.test(value))return {kind:"human",body:"Thank you. A ministry representative can assist you directly. Please state your name, country and the reason you are contacting the ministry."};
  if(/^(6|prayer|pray|i need a prayer|prayer request)$/.test(value))return {kind:"prayer",body:"🙏 Please send your prayer point. It will be recorded for ministry prayer and follow-up."};
  if(/^(7|evangelist|speak with evangelist emmanuel|speak with evangelist emmanuel ogheneochuko adiohwo|speak with evangelist)$/.test(value))return {kind:"human",body:"Your request to speak with Evangelist Emmanuel Ogheneochuko Adiohwo has been received for authorized ministry follow-up."};
  if(/^(8|social|social media|social media information)$/.test(value))return {kind:"reply",body:"📱 Official Heavenly Key social links are maintained on the ministry website so you always receive the current accounts:\nhttps://heavenlykey.org"};
  if(/^(9|support|partner|partnership|contribute|contribution)$/.test(value))return {kind:"support",body:"🤝 Thank you for your desire to support, encourage, contribute or partner with Heavenly Key Evangelistic Movement. Please tell us how you would like to connect, and an authorized ministry representative will follow up."};
  if(/^(10|human|human assistance|agent|representative)$/.test(value))return {kind:"human",body:"Your request for human assistance has been received. An authorized ministry representative will follow up."};
  if(/^(11|community|global christian online community)$/.test(value))return {kind:"reply",body:"🌍 THE GLOBAL CHRISTIAN COMMUNITY is Heavenly Key's fellowship space for prayer, encouragement, teaching and ministry connection across nations.\nhttps://heavenly-key-global-community.heavenlykeyglobal-cd095c09.workers.dev"};
  if(/^(12|tv|radio|faith of our fathers tv|revival radio|broadcast)$/.test(value))return {kind:"reply",body:"📺 Faith of Our Fathers TV and Revival Radio carry Heavenly Key ministry broadcasts, revival messages, prayer programmes and teaching.\nhttps://heavenlykey.org/pages/video.html"};
  if(/^(13|grdpc|global revival and destiny prayer cry|global revival & destiny prayer cry)$/.test(value))return {kind:"reply",body:"🔥 GRDPC — GLOBAL REVIVAL & DESTINY PRAYER CRY is a global prayer programme of Heavenly Key Evangelistic Movement. It is centred on revival, prayer and destiny fulfilment in Christ.\nhttps://heavenlykey.org"};
  if(/^(14|website|open website|heavenly key website)$/.test(value))return {kind:"reply",body:"🌐 https://heavenlykey.org"};
  return null;
}

async function loadAccount(env:CommunicationsEnv){
  const row=await env.DB.prepare("SELECT phone_number_id,credential_ciphertext,credential_iv FROM whatsapp_accounts WHERE active=1 AND status='connected' ORDER BY updated_at DESC LIMIT 1").first<any>();
  if(row?.credential_ciphertext&&row?.credential_iv&&env.ENCRYPTION_KEY){
    const accessToken=await decryptField(row.credential_ciphertext,row.credential_iv,env.ENCRYPTION_KEY);
    return {phoneId:String(row.phone_number_id),accessToken};
  }
  if(env.WHATSAPP_PHONE_NUMBER_ID&&env.WHATSAPP_ACCESS_TOKEN)return {phoneId:env.WHATSAPP_PHONE_NUMBER_ID,accessToken:env.WHATSAPP_ACCESS_TOKEN};
  return null;
}

export async function saveWhatsAppAccount(env:CommunicationsEnv,input:{display_name?:string;phone_number_id:string;business_account_id?:string;access_token:string}){
  if(!env.ENCRYPTION_KEY)throw new Error("Encrypted credential storage is not configured.");
  if(!/^\d{5,30}$/.test(input.phone_number_id))throw new Error("Enter a valid WhatsApp phone number ID.");
  if(!input.access_token||input.access_token.length<20)throw new Error("Enter a valid WhatsApp access token.");
  const sealed=await encryptField(input.access_token,env.ENCRYPTION_KEY);
  await env.DB.prepare(`INSERT INTO whatsapp_accounts(display_name,phone_number_id,business_account_id,credential_ciphertext,credential_iv,status,active,updated_at)
    VALUES(?,?,?,?,?,'connected',1,CURRENT_TIMESTAMP)
    ON CONFLICT(phone_number_id) DO UPDATE SET display_name=excluded.display_name,business_account_id=excluded.business_account_id,credential_ciphertext=excluded.credential_ciphertext,credential_iv=excluded.credential_iv,status='connected',active=1,updated_at=CURRENT_TIMESTAMP`)
    .bind(input.display_name?.trim()||"Heavenly Key WhatsApp",input.phone_number_id,input.business_account_id?.trim()||null,sealed.ciphertext,sealed.iv).run();
  return {configured:true,phone_number_id:input.phone_number_id};
}

export async function getWhatsAppConnection(env:CommunicationsEnv){
  const row=await env.DB.prepare("SELECT account_id,display_name,phone_number_id,business_account_id,status,active,updated_at FROM whatsapp_accounts WHERE active=1 ORDER BY updated_at DESC LIMIT 1").first<any>();
  return row??{configured:!!(env.WHATSAPP_ACCESS_TOKEN&&env.WHATSAPP_PHONE_NUMBER_ID),status:(env.WHATSAPP_ACCESS_TOKEN&&env.WHATSAPP_PHONE_NUMBER_ID)?"connected":"disconnected"};
}

export async function sendWhatsApp(env:CommunicationsEnv,to:string,body:string){
  const account=await loadAccount(env);if(!account)throw new Error("WhatsApp is not connected.");
  const version=env.META_GRAPH_VERSION||"v24.0";
  const response=await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(account.phoneId)}/messages`,{method:"POST",headers:{authorization:`Bearer ${account.accessToken}`,"content-type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",to,type:"text",text:{preview_url:false,body}})});
  const raw=await response.text();let data:any={};try{data=raw?JSON.parse(raw):{};}catch{}
  if(!response.ok)throw new Error(data?.error?.message||`WhatsApp send failed (${response.status})`);
  return data;
}

async function ensureConversation(env:CommunicationsEnv,waId:string,profileName?:string){
  await env.DB.prepare(`INSERT INTO whatsapp_contacts(wa_id,profile_name,last_message_at,updated_at) VALUES(?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT(wa_id) DO UPDATE SET profile_name=COALESCE(excluded.profile_name,whatsapp_contacts.profile_name),last_message_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP`).bind(waId,profileName||null).run();
  const contact=await env.DB.prepare("SELECT contact_id,access_mode FROM whatsapp_contacts WHERE wa_id=?").bind(waId).first<any>();
  let conv=await env.DB.prepare("SELECT conversation_id FROM whatsapp_conversations WHERE contact_id=? AND status='open' LIMIT 1").bind(contact.contact_id).first<any>();
  if(!conv){const r=await env.DB.prepare("INSERT INTO whatsapp_conversations(contact_id,last_message_at) VALUES(?,CURRENT_TIMESTAMP)").bind(contact.contact_id).run();conv={conversation_id:Number(r.meta.last_row_id)};}
  return {contactId:Number(contact.contact_id),accessMode:String(contact.access_mode),conversationId:Number(conv.conversation_id)};
}

async function createNotification(env:CommunicationsEnv,conversationId:number,kind:string,title:string,body:string){
  await env.DB.prepare("INSERT INTO whatsapp_notifications(conversation_id,kind,title,body) VALUES(?,?,?,?)").bind(conversationId,kind,title,body.slice(0,2000)).run();
}

export async function verifyWebhookRequest(request:Request,env:CommunicationsEnv){
  const url=new URL(request.url),mode=url.searchParams.get("hub.mode"),token=url.searchParams.get("hub.verify_token"),challenge=url.searchParams.get("hub.challenge");
  if(mode==="subscribe"&&env.WHATSAPP_VERIFY_TOKEN&&token===env.WHATSAPP_VERIFY_TOKEN&&challenge)return new Response(challenge,{status:200,headers:{"content-type":"text/plain"}});
  return new Response("Forbidden",{status:403});
}

export async function processWebhook(request:Request,env:CommunicationsEnv){
  const raw=await request.text();
  if(!env.META_APP_SECRET)return Response.json({error:{message:"WhatsApp webhook signature verification is not configured."}},{status:503});
  const supplied=request.headers.get("x-hub-signature-256")||"",expected="sha256="+await hmacHex(env.META_APP_SECRET,raw);
  if(!safeEqual(supplied,expected))return new Response("Invalid signature",{status:401});
  let payload:any;try{payload=JSON.parse(raw);}catch{return new Response("Bad request",{status:400});}
  for(const entry of payload.entry||[])for(const change of entry.changes||[]){
    const value=change.value||{};
    for(const status of value.statuses||[]){if(status.id)await env.DB.prepare("UPDATE whatsapp_messages SET provider_status=? WHERE provider_message_id=?").bind(String(status.status||""),String(status.id)).run();}
    const contactsByWa=new Map((value.contacts||[]).map((c:any)=>[String(c.wa_id),c.profile?.name]));
    for(const msg of value.messages||[]){
      if(!msg?.id||!msg?.from)continue;
      const waId=String(msg.from),profileName=contactsByWa.get(waId) as string|undefined;
      const ctx=await ensureConversation(env,waId,profileName);
      const body=String(msg.text?.body||msg.button?.text||msg.interactive?.button_reply?.title||msg.interactive?.list_reply?.title||"").trim();
      const inserted=await env.DB.prepare(`INSERT OR IGNORE INTO whatsapp_messages(provider_message_id,conversation_id,direction,message_type,body,provider_status,provider_timestamp)
        VALUES(?,?,'inbound',?,?, 'received',?)`).bind(String(msg.id),ctx.conversationId,String(msg.type||"text"),body||null,msg.timestamp?new Date(Number(msg.timestamp)*1000).toISOString():null).run();
      if(!inserted.meta.changes)continue;
      await env.DB.prepare("UPDATE whatsapp_conversations SET unread_count=unread_count+1,last_message_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE conversation_id=?").bind(ctx.conversationId).run();
      if(ctx.accessMode==="blocked")continue;
      if(ctx.accessMode==="website_only"){const text="Please continue through the official Heavenly Key website: https://heavenlykey.org";const sent=await sendWhatsApp(env,waId,text);const pid=sent?.messages?.[0]?.id||null;await env.DB.prepare("INSERT INTO whatsapp_messages(provider_message_id,conversation_id,direction,body,provider_status) VALUES(?,?,'outbound',?,'sent')").bind(pid,ctx.conversationId,text).run();continue;}
      if(ctx.accessMode==="human_only"){await createNotification(env,ctx.conversationId,"human","WhatsApp message needs human attention",body||"New WhatsApp message");continue;}
      const auto=body?automatedReply(body):null;
      if(auto){
        if(auto.kind!=="reply"){await env.DB.prepare("UPDATE whatsapp_conversations SET category=?,handoff_reason=?,updated_at=CURRENT_TIMESTAMP WHERE conversation_id=?").bind(auto.kind,auto.kind,ctx.conversationId).run();await createNotification(env,ctx.conversationId,auto.kind,auto.kind==="prayer"?"New prayer request":auto.kind==="support"?"New support/partnership enquiry":"Human follow-up requested",body);}
        const sent=await sendWhatsApp(env,waId,auto.body),pid=sent?.messages?.[0]?.id||null;
        await env.DB.prepare("INSERT INTO whatsapp_messages(provider_message_id,conversation_id,direction,body,provider_status) VALUES(?,?,'outbound',?,'sent')").bind(pid,ctx.conversationId,auto.body).run();
      } else await createNotification(env,ctx.conversationId,"human","WhatsApp message needs human attention",body||"New WhatsApp message");
    }
  }
  return Response.json({ok:true});
}

export async function listConversations(env:CommunicationsEnv,limit=100){
  const r=await env.DB.prepare(`SELECT c.conversation_id,c.status,c.category,c.handoff_reason,c.assigned_to,c.unread_count,c.last_message_at,
    w.contact_id,w.wa_id,w.profile_name,w.access_mode,w.notes
    FROM whatsapp_conversations c JOIN whatsapp_contacts w ON w.contact_id=c.contact_id
    ORDER BY CASE WHEN c.status='open' THEN 0 ELSE 1 END,c.last_message_at DESC LIMIT ?`).bind(Math.min(Math.max(limit,1),200)).all();
  return r.results;
}
export async function getConversation(env:CommunicationsEnv,id:number){
  const conversation=await env.DB.prepare(`SELECT c.*,w.wa_id,w.profile_name,w.access_mode,w.notes FROM whatsapp_conversations c JOIN whatsapp_contacts w ON w.contact_id=c.contact_id WHERE c.conversation_id=?`).bind(id).first<any>();
  if(!conversation)return null;
  const messages=await env.DB.prepare("SELECT message_pk,provider_message_id,direction,message_type,body,provider_status,provider_timestamp,created_at FROM whatsapp_messages WHERE conversation_id=? ORDER BY message_pk LIMIT 500").bind(id).all();
  await env.DB.prepare("UPDATE whatsapp_conversations SET unread_count=0 WHERE conversation_id=?").bind(id).run();
  return {conversation,messages:messages.results};
}
export async function adminReply(env:CommunicationsEnv,id:number,body:string){
  const row=await env.DB.prepare(`SELECT c.conversation_id,w.wa_id,w.access_mode FROM whatsapp_conversations c JOIN whatsapp_contacts w ON w.contact_id=c.contact_id WHERE c.conversation_id=?`).bind(id).first<any>();
  if(!row)throw new Error("Conversation not found.");if(row.access_mode==="blocked")throw new Error("This WhatsApp contact is blocked.");
  const text=body.trim();if(!text||text.length>4096)throw new Error("Reply must be between 1 and 4096 characters.");
  const sent=await sendWhatsApp(env,String(row.wa_id),text),pid=sent?.messages?.[0]?.id||null;
  await env.DB.prepare("INSERT INTO whatsapp_messages(provider_message_id,conversation_id,direction,body,provider_status) VALUES(?,?,'outbound',?,'sent')").bind(pid,id,text).run();
  await env.DB.prepare("UPDATE whatsapp_conversations SET last_message_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE conversation_id=?").bind(id).run();
  return {provider_message_id:pid};
}

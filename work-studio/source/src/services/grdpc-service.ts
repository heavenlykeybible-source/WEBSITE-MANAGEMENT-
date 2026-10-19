
import type {CommandEnv} from "./ministry-command-center-service";
import {getReminderAccount,verifyReminderTemplate,sendReminderTemplate} from "./ministry-command-center-service";
export const LIVE_PATH="/pages/grdpc";
export const TEMPLATE_BODY="GRDPC — GLOBAL REVIVAL & DESTINY PRAYER CRY\nJabez called upon the God of Israel, and God granted his request. May God hear you as you join us to call upon Him!\nThe violent take it by force. — Matthew 11:12\n{{1}}\n{{2}}\nJoin us live on YouTube, Facebook & TikTok: {{3}}\nReply GRDPC STOP to unsubscribe.";
export function reminderSlot(time:number,reminders:{day:number;time:string}[]){
 const local=new Date(time+3600000),day=local.getUTCDay(),clock=local.toISOString().slice(11,16),date=local.toISOString().slice(0,10);
 return reminders.some(r=>r.day===day&&r.time===clock)?{slot:date+"T"+clock,day:date}:null;
}
export function nextPrayer(time:number){
 const local=new Date(time+3600000);const midnight=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate());
 for(let d=0;d<8;d++){const base=midnight+d*86400000,day=new Date(base).getUTCDay();const hour=day===0?20:day===1?0:null;if(hour===null)continue;const utc=base+hour*3600000-3600000;if(utc>=time)return {name:day===0?"Sunday prayer":"Monday midnight prayer",time:utc};}
 throw Error("Prayer schedule unavailable.");
}
export async function settings(env:CommandEnv){const row=await env.DB.prepare("SELECT config FROM grdpc_settings WHERE id=1").first<any>();return JSON.parse(row.config);}
export function validateConfig(input:any){
 if(typeof input.enabled!=="boolean"||typeof input.timingConfirmed!=="boolean")throw Error("Choose reminder status and confirm timing.");
 const phone=String(input.phone||"").trim();if(phone&&!/^[1-9]\d{7,14}$/.test(phone))throw Error("Use an international phone number, digits only.");
 const template=String(input.template||"").trim(),language=String(input.language||"en").trim();
 if(template&&!/^[a-z0-9_]{1,100}$/.test(template))throw Error("Enter a valid Meta template name.");
 if(!/^[a-z]{2}(?:_[A-Z]{2})?$/.test(language))throw Error("Enter a valid template language code.");
 const accountId=input.accountId==null||input.accountId===""?null:Number(input.accountId);
 if(accountId!==null&&(!Number.isSafeInteger(accountId)||accountId<1))throw Error("Choose a WhatsApp account.");
 const dailyLimit=Number(input.dailyLimit);if(!Number.isInteger(dailyLimit)||dailyLimit<1||dailyLimit>1000)throw Error("Daily send limit must be 1–1000.");
 if(!Array.isArray(input.reminders)||!input.reminders.length||input.reminders.length>14)throw Error("Choose 1–14 reminder times.");
 const seen=new Set<string>();const reminders=input.reminders.map((r:any)=>{if(!Number.isInteger(r.day)||r.day<0||r.day>6||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time))throw Error("Invalid reminder day or time.");const key=r.day+" "+r.time;if(seen.has(key))throw Error("Duplicate reminder time.");seen.add(key);return {day:r.day,time:r.time};});
 if(input.enabled&&(!input.timingConfirmed||!phone||!template))throw Error("Confirm timing, subscription number and template before enabling.");
 return {enabled:input.enabled,timingConfirmed:input.timingConfirmed,phone,template,language,accountId,dailyLimit,reminders};
}
export async function saveSettings(env:CommandEnv,input:any){
 const config=validateConfig(input);
 if(config.enabled){const a=await getReminderAccount(env,config.accountId);if(!a)throw Error("WhatsApp account is not connected.");await verifyReminderTemplate(env,a,config.template,config.language,TEMPLATE_BODY,config.phone);}
 await env.DB.prepare("UPDATE grdpc_settings SET config=?,updated_at=CURRENT_TIMESTAMP WHERE id=1").bind(JSON.stringify(config)).run();return config;
}
export async function subscriptionCommand(env:CommandEnv,body:string,contactId:number,phoneId:string){
 const text=body.trim().toUpperCase().replace(/\s+/g," ");
 if(!["GRDPC SUBSCRIBE","GRDPC STOP","GRDPC","13"].includes(text))return null;
 if(text==="GRDPC"||text==="13")return "GRDPC — Global Revival & Destiny Prayer Cry. Sunday 8:00 PM and Monday 12:00 midnight (Sunday night entering Monday), Nigeria time.\nReply GRDPC SUBSCRIBE to consent to recurring programme reminders. Reply GRDPC STOP to unsubscribe.\n"+((env as any).PUBLIC_SITE_URL||"https://heavenlykey.alldaywow247.workers.dev")+LIVE_PATH;
 const subscribed=text==="GRDPC SUBSCRIBE";
 await env.DB.prepare("INSERT INTO grdpc_subscribers(contact_id,phone_id,status,consented_at) VALUES(?,?,?,CASE WHEN ?=1 THEN CURRENT_TIMESTAMP ELSE NULL END) ON CONFLICT(contact_id,phone_id) DO UPDATE SET status=excluded.status,consented_at=CASE WHEN excluded.status='subscribed' THEN CURRENT_TIMESTAMP ELSE grdpc_subscribers.consented_at END,updated_at=CURRENT_TIMESTAMP").bind(contactId,phoneId,subscribed?"subscribed":"unsubscribed",subscribed?1:0).run();
 const c=await settings(env);
 return subscribed?"You are subscribed to GRDPC text reminders. "+(c.enabled?"Reminders follow the ministry schedule.":"Automatic sending is awaiting ministry activation.")+" Reply GRDPC STOP at any time to unsubscribe.":"You have unsubscribed from GRDPC reminders.";
}
export async function runReminders(env:CommandEnv,time:number){
 const c=await settings(env);if(!c.enabled||!c.timingConfirmed)return;
 let current=null;for(let offset=0;offset<15;offset++){current=reminderSlot(time-offset*60000,c.reminders);if(current)break;}if(!current)return;
 const a=await getReminderAccount(env,c.accountId);if(!a)return;
 // A stale cron event must never send a late or misleading reminder.
 if(Date.now()-time>120000)return;
 const next=nextPrayer(time);
 const members=await env.DB.prepare("SELECT s.contact_id,w.wa_id FROM grdpc_subscribers s JOIN whatsapp_contacts w ON w.contact_id=s.contact_id WHERE s.status='subscribed' AND s.phone_id=? AND w.access_mode NOT IN ('blocked','website_only') AND NOT EXISTS(SELECT 1 FROM grdpc_deliveries d WHERE d.contact_id=s.contact_id AND d.phone_id=s.phone_id AND d.slot=?) ORDER BY s.contact_id LIMIT 20").bind(a.phoneId,current.slot).all<any>();
 for(const member of members.results||[]){
 const claim=await env.DB.prepare("INSERT OR IGNORE INTO grdpc_deliveries(contact_id,phone_id,slot,day) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM grdpc_deliveries WHERE day=?)<? AND EXISTS(SELECT 1 FROM grdpc_subscribers s JOIN whatsapp_contacts w ON w.contact_id=s.contact_id WHERE s.contact_id=? AND s.phone_id=? AND s.status='subscribed' AND w.access_mode NOT IN ('blocked','website_only'))").bind(member.contact_id,a.phoneId,current.slot,current.day,current.day,c.dailyLimit,member.contact_id,a.phoneId).run();
 if(!claim.meta.changes)continue;
 try{const sent=await sendReminderTemplate(env,a,member.wa_id,c.template,c.language,[next.name,new Date(next.time).toLocaleString("en-GB",{timeZone:"Africa/Lagos"})+" Nigeria time",((env as any).PUBLIC_SITE_URL||"https://heavenlykey.alldaywow247.workers.dev")+LIVE_PATH]);await env.DB.prepare("UPDATE grdpc_deliveries SET status='sent',provider_id=? WHERE id=?").bind(sent.messages?.[0]?.id||null,claim.meta.last_row_id).run();}
 catch{await env.DB.prepare("UPDATE grdpc_deliveries SET status='unknown',error='Delivery failed or unconfirmed; not automatically retried' WHERE id=?").bind(claim.meta.last_row_id).run();}
 }
}

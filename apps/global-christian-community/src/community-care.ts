import type {Env,SessionUser} from './types';
import {moderateText,recordModeration} from './moderation';
const fail=(message:string,status=400)=>Object.assign(new Error(message),{status});
export const enabled=(env:Env)=>env.COMMUNITY_CARE==='enabled';
export function requireCare(env:Env){if(!enabled(env))throw fail('Community Care is awaiting activation.',503);}
const defaults={frequency:'off',timezone:'UTC',delivery_hour:8,weekly_day:0,prayer_reminders:1,next_delivery_at:null};
function zone(value:unknown){if(typeof value!=='string'||value.length>80)throw fail('Choose a valid time zone.');try{new Intl.DateTimeFormat('en',{timeZone:value}).format();return value;}catch{throw fail('Choose a valid time zone.');}}
const formatters=new Map<string,Intl.DateTimeFormat>();
export function localParts(time:number,timezone:string){let format=formatters.get(timezone);if(!format){format=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});if(formatters.size>=64)formatters.delete(formatters.keys().next().value!);formatters.set(timezone,format);}const d=format.formatToParts(time),get=(n:string)=>Number(d.find(p=>p.type===n)?.value);return{year:get('year'),month:get('month'),day:get('day'),hour:get('hour')};}
// Search actual UTC hours: handles skipped/repeated DST hours and half-hour time zones.
// Delivery is approximate, using the existing hourly scheduler, never an exact-time alarm.
export function nextDelivery(pref:any,now=Date.now(),afterToday=false){
 if(pref.frequency==='off')return null;
 const start=Math.floor(now/3600000)*3600000,current=localParts(now,pref.timezone);
 for(let i=1;i<=193;i++){const at=start+i*3600000,p=localParts(at,pref.timezone),day=new Date(Date.UTC(p.year,p.month-1,p.day)).getUTCDay();if((!afterToday||p.year!==current.year||p.month!==current.month||p.day!==current.day)&&p.hour===pref.delivery_hour&&(pref.frequency==='daily'||day===pref.weekly_day))return at;}
 throw fail('The next delivery time could not be calculated.');
}
export async function preferences(env:Env,userId:number){return await env.DB.prepare('SELECT frequency,timezone,delivery_hour,weekly_day,prayer_reminders,next_delivery_at FROM care_preferences WHERE user_id=?').bind(userId).first<any>()||{...defaults};}
export async function savePreferences(env:Env,userId:number,b:any){
 if(!['off','daily','weekly'].includes(b.frequency)||!Number.isInteger(b.delivery_hour)||b.delivery_hour<0||b.delivery_hour>23||!Number.isInteger(b.weekly_day)||b.weekly_day<0||b.weekly_day>6||typeof b.prayer_reminders!=='boolean')throw fail('Choose a frequency, hour, weekday and prayer-reminder preference.');
 const p={frequency:b.frequency,timezone:b.frequency==='off'?(await preferences(env,userId)).timezone:zone(b.timezone),delivery_hour:b.delivery_hour,weekly_day:b.weekly_day};
 await env.DB.prepare(`INSERT INTO care_preferences(user_id,frequency,timezone,delivery_hour,weekly_day,prayer_reminders,next_delivery_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET frequency=excluded.frequency,timezone=excluded.timezone,delivery_hour=excluded.delivery_hour,weekly_day=excluded.weekly_day,prayer_reminders=excluded.prayer_reminders,next_delivery_at=excluded.next_delivery_at,updated_at=datetime('now')`).bind(userId,p.frequency,p.timezone,p.delivery_hour,p.weekly_day,b.prayer_reminders?1:0,nextDelivery(p)).run();return preferences(env,userId);
}
async function readings(env:Env){return (await env.DB.prepare('SELECT reading_id,reference,scripture,prayer FROM care_readings WHERE approved=1 ORDER BY reading_id').all<any>()).results;}
function selectReading(items:any[],now:number,timezone:string,frequency='daily'){if(!items.length)return null;const p=localParts(now,timezone),day=Math.floor(Date.UTC(p.year,p.month-1,p.day)/86400000);return items[(frequency==='weekly'?Math.floor(day/7):day)%items.length];}
export async function today(env:Env,userId:number){const pref=await preferences(env,userId),items=await readings(env);return {preferences:pref,reading:selectReading(items,Date.now(),pref.timezone,pref.frequency)};}
export async function adminReadings(env:Env){return {items:(await env.DB.prepare('SELECT * FROM care_readings ORDER BY reading_id').all()).results};}
export async function approveReading(env:Env,user:SessionUser,id:number,b:any){
 if(typeof b.approved!=='boolean')throw fail('Choose approve or pause.');
 if(!await env.DB.prepare('SELECT 1 FROM care_readings WHERE reading_id=?').bind(id).first())throw fail('Reading not found.',404);
 await env.DB.batch([env.DB.prepare("UPDATE care_readings SET approved=?,approved_by=?,approved_at=datetime('now') WHERE reading_id=?").bind(b.approved?1:0,user.userId,id),env.DB.prepare("INSERT INTO safety_audit(actor_user_id,action,target_type,target_id,reason) VALUES(?,'care_reading_review','care_reading',?,?)").bind(user.userId,id,b.approved?'Approved KJV scripture and suggested prayer':'Paused encouragement reading')]);return {approved:b.approved};
}
// Matches the original prayer audience rules; private_ministry remains owner-only.
// viewer is an internal SQL expression, never request input.
const visible=(viewer:string)=>`u.status='active' AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_user_id=${viewer} AND b.blocked_user_id=pi.user_id) OR (b.blocker_user_id=pi.user_id AND b.blocked_user_id=${viewer})) AND (pi.care_status!='closed' OR pi.user_id=${viewer}) AND (pi.visibility='community' OR pi.user_id=${viewer} OR (pi.visibility='connections' AND EXISTS(SELECT 1 FROM global_connections c WHERE c.user_id=pi.user_id AND c.target_type='profile' AND c.target_id=${viewer})) OR (pi.visibility='circle' AND EXISTS(SELECT 1 FROM prayer_circle_members cm JOIN prayer_circles pc ON pc.circle_id=cm.circle_id WHERE cm.circle_id=pi.circle_id AND cm.user_id=${viewer} AND pc.status='active')))`;
export async function listPrayers(env:Env,userId:number|null,id?:number){
 const viewer=Number.isSafeInteger(userId)?String(userId):'NULL';
 const rows=await env.DB.prepare(`SELECT pi.*,p.display_name,(SELECT COUNT(*) FROM prayer_support ps JOIN users su ON su.user_id=ps.user_id WHERE ps.prayer_item_id=pi.prayer_item_id AND su.status='active' AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_user_id=${viewer} AND b.blocked_user_id=ps.user_id) OR (b.blocker_user_id=ps.user_id AND b.blocked_user_id=${viewer}))) praying_count,(SELECT follow_updates FROM prayer_support WHERE prayer_item_id=pi.prayer_item_id AND user_id=${viewer}) my_support FROM prayer_items pi JOIN profiles p ON p.user_id=pi.user_id JOIN users u ON u.user_id=pi.user_id WHERE ${visible(viewer)} ${id?'AND pi.prayer_item_id=?':''} ORDER BY pi.created_at DESC,pi.prayer_item_id DESC LIMIT 100`).bind(...(id?[id]:[])).all<any>();
 // Reminder schedules and internal version counters belong only to the requester.
 return rows.results.map(row=>{if(row.user_id!==userId){delete row.care_reminder_at;delete row.care_version;}return row;});
}
export async function prayer(env:Env,userId:number,id:number){const item=(await listPrayers(env,userId,id))[0];if(!item)throw fail('This prayer request is unavailable.',404);return {item,updates:(await env.DB.prepare('SELECT update_id,kind,body,created_at FROM prayer_updates WHERE prayer_item_id=? ORDER BY update_id DESC LIMIT 20').bind(id).all()).results};}
export async function support(env:Env,userId:number,id:number,b:any){
 if(typeof b.praying!=='boolean'||typeof b.followUpdates!=='boolean')throw fail('Choose whether you are praying and want updates.');
 const {item}=await prayer(env,userId,id);if(item.user_id===userId)throw fail('This is your own prayer request.');
 if(b.praying){await env.DB.prepare('INSERT INTO prayer_support(prayer_item_id,user_id,follow_updates) VALUES(?,?,?) ON CONFLICT(prayer_item_id,user_id) DO UPDATE SET follow_updates=excluded.follow_updates').bind(id,userId,b.followUpdates?1:0).run();}else await env.DB.prepare('DELETE FROM prayer_support WHERE prayer_item_id=? AND user_id=?').bind(id,userId).run();return prayer(env,userId,id);
}
// A member can withdraw their own support even after audience access is revoked.
// The generic response does not disclose whether the request exists.
export async function stopSupport(env:Env,userId:number,id:number){await env.DB.prepare('DELETE FROM prayer_support WHERE prayer_item_id=? AND user_id=?').bind(id,userId).run();return {following:false};}
export async function reminder(env:Env,userId:number,id:number,b:any){
 if(typeof b.enabled!=='boolean')throw fail('Choose whether to receive a follow-up.');
 const {item}=await prayer(env,userId,id);if(item.user_id!==userId)throw fail('This prayer request is unavailable.',404);if(['closed','testimony'].includes(item.care_status)||item.answered)throw fail('This request no longer needs a follow-up.');
 await env.DB.prepare('UPDATE prayer_items SET care_reminder_at=?,care_version=care_version+1 WHERE prayer_item_id=? AND user_id=?').bind(b.enabled?Date.now()+3*86400000:null,id,userId).run();return {enabled:b.enabled};
}
export async function updatePrayer(env:Env,userId:number,id:number,b:any){
 if(!['waiting','updated','testimony','closed'].includes(b.kind)||typeof b.body!=='string'||b.body.trim().length>2500)throw fail('Choose an update type and use at most 2,500 characters.');
 const text=b.body.trim();if(b.kind==='updated'&&text.length<3)throw fail('Write a short update or testimony.');
 if(typeof b.requestKey!=='string'||!/^[-a-f0-9]{36}$/.test(b.requestKey))throw fail('A valid update reference is required.');
 const {item}=await prayer(env,userId,id);if(item.user_id!==userId)throw fail('This prayer request is unavailable.',404);
 const previous=await env.DB.prepare('SELECT kind,body FROM prayer_updates WHERE prayer_item_id=? AND request_key=?').bind(id,b.requestKey).first<any>();if(previous){if(previous.kind!==b.kind||previous.body!==text)throw fail('This update reference has already been used.',409);return prayer(env,userId,id);}
 if(item.care_status==='closed')throw fail('This request is closed.');
 const mod=moderateText(text,'post',env.COMMUNITY_BLOCKED_WORDS);if(['hold','block'].includes(mod.decision)){await recordModeration(env,userId,'post',null,mod);throw fail('This prayer update needs Community Standards review. Please revise it.');}
 const statements=[env.DB.prepare("INSERT OR IGNORE INTO prayer_updates(prayer_item_id,kind,body,request_key) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM prayer_items WHERE prayer_item_id=? AND user_id=? AND care_version=? AND care_status!='closed')").bind(id,b.kind,text,b.requestKey,id,userId,item.care_version),env.DB.prepare(`UPDATE prayer_items SET care_status=?,answered=?,answer_testimony=?,visibility=CASE WHEN ?='closed' THEN 'private_ministry' ELSE visibility END,care_reminder_at=NULL,care_version=care_version+1 WHERE prayer_item_id=? AND user_id=? AND changes()>0`).bind(b.kind,b.kind==='testimony'?1:0,b.kind==='testimony'?text:null,b.kind,id,userId)];
 // Generic notifications never contain a prayer title, author, testimony or private text.
 // Eligibility is checked again in SQL at the moment recipients are selected.
 if(b.kind!=='closed')statements.push(env.DB.prepare(`INSERT INTO notifications(user_id,kind,title,body,href) SELECT ps.user_id,'care_prayer_update','Community Care · Prayer journey update','A prayer request you follow has a new update. Open Prayer Care to view updates available to you.','/prayer.html?request='||pi.prayer_item_id FROM prayer_support ps JOIN prayer_items pi ON pi.prayer_item_id=ps.prayer_item_id JOIN users u ON u.user_id=pi.user_id JOIN users recipient ON recipient.user_id=ps.user_id WHERE changes()>0 AND pi.prayer_item_id=? AND ps.follow_updates=1 AND recipient.status='active' AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=ps.user_id AND n.kind='care_prayer_update' AND n.href='/prayer.html?request='||pi.prayer_item_id AND (n.read_at IS NULL OR n.created_at>=datetime('now','-1 hour'))) AND ${visible('ps.user_id')}`).bind(id));
 const result=await env.DB.batch(statements);if(!result[0].meta.changes){const saved=await env.DB.prepare('SELECT kind,body FROM prayer_updates WHERE prayer_item_id=? AND request_key=?').bind(id,b.requestKey).first<any>();if(!saved||saved.kind!==b.kind||saved.body!==text)throw fail('This prayer request changed. Refresh before updating it.',409);}return prayer(env,userId,id);
}
export async function deliverDue(env:Env,onlyUser?:number){
 if(!enabled(env))return;const now=Date.now(),items=await readings(env),deliveries:{user:number,key:string,item:number,next:number|null}[]=[];
 // Bounded work per existing hourly tick. Oldest due users go first; no missed-day flood.
 if(items.length){const due=await env.DB.prepare(`SELECT cp.* FROM care_preferences cp JOIN users u ON u.user_id=cp.user_id WHERE u.status='active' AND cp.frequency!='off' AND cp.next_delivery_at<=? ${onlyUser?'AND cp.user_id=?':''} ORDER BY cp.next_delivery_at,cp.user_id LIMIT 900`).bind(now,...(onlyUser?[onlyUser]:[])).all<any>();for(const p of due.results){const local=localParts(now,p.timezone),reading=selectReading(items,now,p.timezone,p.frequency);deliveries.push({user:p.user_id,key:'e:'+local.year+'-'+local.month+'-'+local.day,item:reading.reading_id,next:nextDelivery(p,now,true)});}}
 const reminders=await env.DB.prepare(`SELECT pi.* FROM prayer_items pi JOIN users u ON u.user_id=pi.user_id LEFT JOIN care_preferences cp ON cp.user_id=pi.user_id WHERE u.status='active' AND pi.care_reminder_at<=? AND pi.care_status NOT IN ('closed','testimony') AND pi.answered=0 AND COALESCE(cp.prayer_reminders,1)=1 ${onlyUser?'AND pi.user_id=?':''} ORDER BY pi.care_reminder_at,pi.prayer_item_id LIMIT 100`).bind(now,...(onlyUser?[onlyUser]:[])).all<any>();for(const p of reminders.results)deliveries.push({user:p.user_id,key:'p:'+p.prayer_item_id+':'+p.care_version,item:p.prayer_item_id,next:null});
 for(let i=0;i<deliveries.length;i+=25){const part=deliveries.slice(i,i+25);await env.DB.prepare('INSERT OR IGNORE INTO care_deliveries(user_id,delivery_key,item_id,next_at) VALUES '+part.map(()=>'(?,?,?,?)').join(',')+' ON CONFLICT(user_id,delivery_key) DO UPDATE SET next_at=excluded.next_at').bind(...part.flatMap(d=>[d.user,d.key,d.item,d.next])).run();}
}

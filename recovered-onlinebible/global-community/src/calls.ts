import type {Env} from './types';
const now=()=>Math.floor(Date.now()/1000);
const fail=(message:string,status=400)=>{throw Object.assign(new Error(message),{status});};
function enabled(env:Env){return !!env.CALL_TURN_URLS&&!!env.CALL_TURN_SECRET;}
export async function config(env:Env,userId:number){
  if(!enabled(env))return {enabled:false,message:'Voice and video calling will open after the network relay is connected.'};
  const urls=String(env.CALL_TURN_URLS).split(',').map(x=>x.trim()).filter(Boolean);
  if(!urls.length||urls.some(x=>!/^turns?:[^\s]+$/.test(x)))return {enabled:false,message:'Calling is temporarily unavailable.'};
  const username=(now()+3600)+':'+userId;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.CALL_TURN_SECRET),{name:'HMAC',hash:'SHA-1'},false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(username)));
  return {enabled:true,iceServers:[{urls,username,credential:btoa(String.fromCharCode(...bytes))}],maxSeconds:1800};
}
async function allowed(env:Env,userId:number,conversationId:number){
  const c=await env.DB.prepare(`SELECT c.* FROM conversations c JOIN users a ON a.user_id=c.requester_user_id JOIN users b ON b.user_id=c.recipient_user_id
    WHERE c.conversation_id=? AND c.status='accepted' AND (c.requester_user_id=? OR c.recipient_user_id=?) AND a.status='active' AND b.status='active'
    AND NOT EXISTS(SELECT 1 FROM user_blocks WHERE (blocker_user_id=c.requester_user_id AND blocked_user_id=c.recipient_user_id) OR (blocker_user_id=c.recipient_user_id AND blocked_user_id=c.requester_user_id))`).bind(conversationId,userId,userId).first<any>();
  if(!c)fail('An approved conversation is required before calling.',403);return c;
}
const sdp=(v:any)=>{if(typeof v!=='string'||v.length>32000||!v.startsWith('v=0')||!v.includes('m=audio'))fail('Invalid call connection.');return v as string;};
async function prune(env:Env){await env.DB.prepare('DELETE FROM network_calls WHERE expires_at<=?').bind(now()).run();}
export async function cleanup(env:Env){await prune(env);}
export async function start(env:Env,userId:number,input:any){
  if(!(await config(env,userId)).enabled)fail('The call relay is not connected yet.',503);
  if(!['voice','video'].includes(input.mode))fail('Choose a voice or video call.');
  const c=await allowed(env,userId,Number(input.conversationId));const to=c.requester_user_id===userId?c.recipient_user_id:c.requester_user_id;
  const offer=sdp(input.offer);await prune(env);const id=crypto.randomUUID(),stamp=now();
  try{await env.DB.batch([
    env.DB.prepare('INSERT INTO network_calls(call_id,conversation_id,caller_id,recipient_id,mode,offer,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,c.conversation_id,userId,to,input.mode,offer,stamp,stamp+60),
    env.DB.prepare('INSERT INTO network_call_members(user_id,call_id) VALUES(?,?),(?,?)').bind(userId,id,to,id)
  ]);}catch{fail('One of you is already in a call. Please try later.',409);}
  return {callId:id,mode:input.mode,status:'ringing'};
}
export async function incoming(env:Env,userId:number){
  if(!enabled(env))return [];
  return (await env.DB.prepare(`SELECT c.call_id,c.conversation_id,c.mode,p.display_name caller_name FROM network_calls c JOIN profiles p ON p.user_id=c.caller_id JOIN conversations t ON t.conversation_id=c.conversation_id WHERE c.recipient_id=? AND c.status='ringing' AND c.expires_at>? AND t.status='accepted' LIMIT 1`).bind(userId,now()).all<any>()).results;
}
export async function read(env:Env,userId:number,id:string){
  const row=await env.DB.prepare('SELECT * FROM network_calls WHERE call_id=? AND (caller_id=? OR recipient_id=?)').bind(id,userId,userId).first<any>();if(!row)fail('Call unavailable.',404);
  await allowed(env,userId,row.conversation_id);
  if(row.expires_at<=now())return {callId:id,status:'ended'};
  return {callId:id,status:row.status,mode:row.mode,expiresAt:row.expires_at,offer:row.recipient_id===userId?row.offer:undefined,answer:row.caller_id===userId?row.answer:undefined};
}
export async function update(env:Env,userId:number,id:string,input:any){
  const row=await env.DB.prepare('SELECT * FROM network_calls WHERE call_id=? AND (caller_id=? OR recipient_id=?)').bind(id,userId,userId).first<any>();if(!row)fail('Call unavailable.',404);
  if(input.action==='end'||input.action==='decline'){
    if(input.action==='decline'&&row.recipient_id!==userId)fail('Only the recipient can decline.',403);
    await env.DB.batch([env.DB.prepare("UPDATE network_calls SET status=?,offer=NULL,answer=NULL,expires_at=? WHERE call_id=?").bind(input.action==='decline'?'declined':'ended',now()+60,id),env.DB.prepare('DELETE FROM network_call_members WHERE call_id=?').bind(id)]);return {status:'ended'};
  }
  await allowed(env,userId,row.conversation_id);
  if(input.action!=='accept'||row.recipient_id!==userId||row.status!=='ringing'||row.expires_at<=now())fail('Call invitation is no longer available.',409);
  const answer=sdp(input.answer);
  const r=await env.DB.prepare("UPDATE network_calls SET answer=?,status='accepted',expires_at=? WHERE call_id=? AND status='ringing' AND expires_at>?").bind(answer,now()+1800,id,now()).run();if(!r.meta.changes)fail('Call invitation is no longer available.',409);return {status:'accepted'};
}

import {verifyMeetingTicket} from './session-tokens.js';
import {getPlan} from './subscription-plans.js';

// Cloudflare Durable Object. Participants receive no media or chat until admitted.
export class MeetingRoom extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.clients=new Map();this.ownerId=null;this.locked=false;this.capacity=3;this.meetingDeadline=0;}
 send(socket,message){try{socket.send(JSON.stringify(message))}catch{}}
 broadcast(message,except=null){for(const [id,c] of this.clients)if(id!==except&&c.admitted)this.send(c.socket,message)}
 notifyOwner(message){for(const c of this.clients.values())if(c.role==='owner'&&c.admitted)this.send(c.socket,message)}
 async alarm(){for(const c of this.clients.values()){this.send(c.socket,{type:'meeting-ended',reason:'time-limit'});try{c.socket.close(1000,'Meeting time limit reached')}catch{}}this.clients.clear();this.ownerId=null;this.locked=false;this.meetingDeadline=0;await this.ctx.storage.deleteAlarm();}
 async fetch(request){
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('Upgrade required',{status:426});
  const demo=this.env.ALLOW_UNAUTHENTICATED_DEMO==='true'&&this.env.ENVIRONMENT==='development';
  const roomId=new URL(request.url).pathname.match(/^\/api\/rooms\/([A-Za-z0-9_-]{6,80})\/socket$/)?.[1];
  if(!roomId)return new Response('Invalid room',{status:400});
  const authorization=request.headers.get('Authorization')||'';
  const tokenProtocol=(request.headers.get('Sec-WebSocket-Protocol')||'').split(',').map(s=>s.trim()).find(s=>s.startsWith('mt.'));
  const ticket=authorization.startsWith('Bearer ')?authorization.slice(7):tokenProtocol?.slice(3);
  const claims=demo?{userId:crypto.randomUUID(),role:'owner'}:this.env.MEETING_TICKET_SECRET?await verifyMeetingTicket({ticket,roomId,secret:this.env.MEETING_TICKET_SECRET}):null;
  if(!claims)return new Response('Verified meeting identity required',{status:401});
  if(!demo&&claims.role==='owner'){
   const savedOwner=await this.ctx.storage.get('ownerUserId');
   if(savedOwner&&savedOwner!==claims.userId)return new Response('Room owner mismatch',{status:403});
  }
  if(this.meetingDeadline&&Date.now()>=this.meetingDeadline)return new Response('Meeting time limit reached',{status:403});
  if(this.clients.size>=Math.min(12,this.capacity))return new Response('Room full',{status:429});
  if(!demo&&claims.role==='owner'&&this.ownerId===claims.userId)return new Response('Owner already connected',{status:409});
  if(this.locked&&claims.role!=='owner')return new Response('Room locked',{status:403});
  if(claims.role==='owner'&&this.ownerId&&this.ownerId!==claims.userId)return new Response('Room owner mismatch',{status:403});
  if(claims.role!=='owner'&&!this.ownerId)return new Response('Host has not joined',{status:403});
  if([...this.clients.values()].some(c=>c.userId===claims.userId))return new Response('Identity already connected',{status:409});
  const pair=new WebSocketPair(),[client,server]=Object.values(pair);
  server.accept();
  const id=crypto.randomUUID(),admitted=claims.role==='owner';
  if(admitted){if(!demo&&!(await this.ctx.storage.get('ownerUserId')))await this.ctx.storage.put('ownerUserId',claims.userId);this.ownerId=claims.userId;const plan=demo?getPlan('free'):(getPlan(claims.planId)||getPlan('free'));this.capacity=plan.participants;this.meetingDeadline=Date.now()+plan.meetingMinutes*60000;await this.ctx.storage.setAlarm(this.meetingDeadline);}
  const record={socket:server,userId:claims.userId,role:claims.role,admitted};
  this.clients.set(id,record);
  if(admitted){
   this.send(server,{type:'peers',role:'owner',id,ids:[...this.clients].filter(([peerId,c])=>peerId!==id&&c.admitted).map(([peerId])=>peerId)});
   this.broadcast({type:'join',id},id);
   for(const [peerId,c] of this.clients)if(!c.admitted)this.send(server,{type:'admission-request',id:peerId});
  }else{
   this.send(server,{type:'waiting'});
   this.notifyOwner({type:'admission-request',id});
  }
  let windowStart=Date.now(),count=0;
  server.addEventListener('message',event=>{
   const now=Date.now();if(this.meetingDeadline&&now>=this.meetingDeadline){for(const c of this.clients.values()){this.send(c.socket,{type:'meeting-ended',reason:'time-limit'});c.socket.close(1000,'Meeting time limit reached')}this.clients.clear();this.ownerId=null;this.locked=false;return}if(now-windowStart>10000){windowStart=now;count=0}
   if(++count>100){server.close(1008,'Rate limit');return}
   if(typeof event.data!=='string'||event.data.length>120000){server.close(1009,'Message too large');return}
   let msg;try{msg=JSON.parse(event.data)}catch{return}
   if(record.role==='owner'&&record.admitted&&msg.type==='admission-decision'){
    const target=this.clients.get(msg.id);
    if(!target||target.admitted||!['admit','deny'].includes(msg.decision))return;
    if(msg.decision==='deny'){this.send(target.socket,{type:'denied'});target.socket.close(1008,'Admission denied');return}
    if(this.locked){this.send(server,{type:'error',message:'Room is locked'});return}
    target.admitted=true;
    this.send(target.socket,{type:'peers',role:target.role,id:msg.id,ids:[...this.clients].filter(([peerId,c])=>peerId!==msg.id&&c.admitted).map(([peerId])=>peerId)});
    this.broadcast({type:'join',id:msg.id},msg.id);
    return;
   }
   if(record.role==='owner'&&record.admitted&&msg.type==='room-lock'&&typeof msg.locked==='boolean'){this.locked=msg.locked;this.send(server,{type:'room-lock',locked:this.locked});return}
   if(record.role==='owner'&&record.admitted&&msg.type==='remove-participant'&&typeof msg.id==='string'){
    const target=this.clients.get(msg.id);
    if(!target||target===record||!target.admitted)return;
    this.send(target.socket,{type:'removed'});
    target.socket.close(1008,'Removed by host');
    return;
   }
   if(!record.admitted)return;
   if(msg.type==='chat'){
    if(typeof msg.text!=='string'||!msg.text.trim()||msg.text.length>2000)return;
    this.broadcast({type:'chat',from:id,text:msg.text.trim()},id);
    this.send(server,{type:'chat',from:id,text:msg.text.trim()});
    return;
   }
   if(msg.type!=='signal'||typeof msg.to!=='string')return;
   const target=this.clients.get(msg.to);if(!target?.admitted)return;
   const payload={type:'signal',from:id};
   if(msg.description&&['offer','answer'].includes(msg.description.type)&&typeof msg.description.sdp==='string'&&msg.description.sdp.length<100000)payload.description=msg.description;
   if(msg.candidate&&typeof msg.candidate.candidate==='string'&&msg.candidate.candidate.length<10000)payload.candidate=msg.candidate;
   if(payload.description||payload.candidate)this.send(target.socket,payload);
  });
  const cleanup=()=>{
   if(this.clients.get(id)!==record)return;
   this.clients.delete(id);
   if(record.admitted)this.broadcast({type:'leave',id},id);
   if(record.role==='owner'){this.ownerId=null;for(const c of this.clients.values())c.socket.close(1012,'Host disconnected');this.clients.clear();this.locked=false}
  };
  server.addEventListener('close',cleanup);server.addEventListener('error',cleanup);
  const offered=(request.headers.get('Sec-WebSocket-Protocol')||'').split(',').map(v=>v.trim());
  const headers=offered.includes('meetingspace')?{'Sec-WebSocket-Protocol':'meetingspace'}:{};
  return new Response(null,{status:101,webSocket:client,headers});
 }
}

// One object per hashed client: bounded counters, no shared global budget or chat data.
export class PublicChatLimits {
 constructor(state,env={}){this.state=state;const n=Number(env.ASSISTANT_CLIENT_HOURLY_LIMIT);this.limit=Number.isInteger(n)&&n>=1&&n<=10000?n:120;}
 async fetch(request){
  if(request.method!=='POST')return new Response(null,{status:405});
  let input;try{input=await request.json()}catch{return new Response(null,{status:400})}
  if(!/^[a-f0-9]{64}$/.test(input?.hash||''))return new Response(null,{status:400});
  const now=Date.now(),hour=Math.floor(now/3600000);
  const allowed=await this.state.storage.transaction(async tx=>{
   let client=await tx.get('client');if(!client||client.hour!==hour)client={hour,count:0};
   if(client.count>=this.limit)return false;
   client.count++;await tx.put('client',client);return true;
  });
  if(allowed&&this.state.storage.setAlarm)await this.state.storage.setAlarm((hour+2)*3600000);
  return new Response(null,{status:allowed?204:429});
 }
 async alarm(){await this.state.storage.deleteAll();}
}

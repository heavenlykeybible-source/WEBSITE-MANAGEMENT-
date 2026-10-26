// One bounded state record, containing only hashes and counters. No messages, credentials or member data.
export class PublicChatLimits {
 constructor(state){this.state=state;}
 async fetch(request){
  if(request.method!=='POST')return new Response(null,{status:405});
  let input;try{input=await request.json()}catch{return new Response(null,{status:400})}
  if(!/^[a-f0-9]{64}$/.test(input?.hash||''))return new Response(null,{status:400});
  const now=Date.now(),day=Math.floor(now/86400000),hour=Math.floor(now/3600000);
  const allowed=await this.state.storage.transaction(async tx=>{
   let budget=await tx.get('budget');if(!budget||budget.day!==day)budget={day,count:0,clients:{}};
   let client=budget.clients[input.hash];if(!client||client.hour!==hour)client={hour,count:0};
   if(budget.count>=200||client.count>=30)return false;
   client.count++;budget.count++;budget.clients[input.hash]=client;await tx.put('budget',budget);return true;
  });
  return new Response(null,{status:allowed?204:429});
 }
}

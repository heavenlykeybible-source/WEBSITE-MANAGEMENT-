// Shared, pure room-authorization rules. Server is the final authority.
export function safeMessage(data,maxLength=120000){
 if(typeof data!=='string'||data.length>maxLength)return null;
 try{
  const value=JSON.parse(data);
  return value&&typeof value==='object'&&!Array.isArray(value)?value:null;
 }catch{return null}
}
export function mayJoinRoom({isClosed=false,isExpired=false,isLocked=false,role='participant',active=0,capacity=3}={}){
 if(isClosed)return {allowed:false,status:410,reason:'Meeting ended'};
 if(isExpired)return {allowed:false,status:403,reason:'Meeting time limit reached'};
 if(isLocked&&role!=='owner')return {allowed:false,status:403,reason:'Room locked'};
 if(!Number.isInteger(capacity)||capacity<1||capacity>12)return {allowed:false,status:503,reason:'Invalid capacity configuration'};
 if(!Number.isInteger(active)||active<0)return {allowed:false,status:503,reason:'Invalid room state'};
 if(active>=capacity)return {allowed:false,status:429,reason:'Room full'};
 return {allowed:true,status:200};
}

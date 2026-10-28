// RFC 6238 TOTP primitives. Account enrollment and login integration are separate.
const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function encodeBase32(bytes:Uint8Array):string{
  let bits=0,value=0,out="";
  for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){out+=alphabet[(value>>>(bits-5))&31];bits-=5;}}
  if(bits)out+=alphabet[(value<<(5-bits))&31];return out;
}
export function decodeBase32(input:string):Uint8Array{
  const text=input.replace(/=+$/,"").toUpperCase();if(!text||!/^[A-Z2-7]+$/.test(text))throw new Error("Invalid authenticator secret.");
  let value=0,bits=0;const out:number[]=[];
  for(const char of text){value=(value<<5)|alphabet.indexOf(char);bits+=5;if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8;}}
  if(bits&&(value&((1<<bits)-1)))throw new Error("Invalid authenticator secret.");const bytes=Uint8Array.from(out);if(encodeBase32(bytes)!==text)throw new Error("Invalid authenticator secret.");return bytes;
}
export async function totpAt(secret:Uint8Array,timeMs:number,digits=6):Promise<string>{
  if(!Number.isSafeInteger(timeMs)||timeMs<0||![6,8].includes(digits)||secret.length<16)throw new Error("Invalid authenticator input.");
  const counter=BigInt(Math.floor(timeMs/30000)),message=new Uint8Array(8);new DataView(message.buffer).setBigUint64(0,counter,false);
  const key=await crypto.subtle.importKey("raw",Uint8Array.from(secret).buffer,{name:"HMAC",hash:"SHA-1"},false,["sign"]);
  const hash=new Uint8Array(await crypto.subtle.sign("HMAC",key,message)),offset=hash[hash.length-1]&15;
  const value=((hash[offset]&127)*0x1000000+hash[offset+1]*0x10000+hash[offset+2]*0x100+hash[offset+3])%(10**digits);
  return String(value).padStart(digits,"0");
}
// Return the matched time step so callers can atomically reject reused codes.
export async function matchTotp(secret:Uint8Array,code:string,timeMs:number,lastStep:number):Promise<number|null>{
  if(!/^\d{6}$/.test(code)||!Number.isSafeInteger(lastStep)||!Number.isSafeInteger(timeMs)||timeMs<30000)return null;
  const current=Math.floor(timeMs/30000);
  for(const step of [current,current-1,current+1]){
    if(step<=lastStep)continue;const expected=await totpAt(secret,step*30000);let diff=0;
    for(let i=0;i<6;i++)diff|=expected.charCodeAt(i)^code.charCodeAt(i);
    if(diff===0)return step;
  }
  return null;
}
const encoder=new TextEncoder();
async function sealKey(keyMaterial:string):Promise<CryptoKey>{
  if(!keyMaterial||keyMaterial.length<32)throw new Error("Authenticator service unavailable.");
  return crypto.subtle.importKey("raw",await crypto.subtle.digest("SHA-256",encoder.encode("global-community:totp:v1:"+keyMaterial)),"AES-GCM",false,["encrypt","decrypt"]);
}
export async function sealTotp(secret:Uint8Array,keyMaterial:string,userId:number):Promise<string>{
  if(!Number.isSafeInteger(userId)||userId<1||secret.length!==20)throw new Error("Invalid authenticator input.");
  const iv=crypto.getRandomValues(new Uint8Array(12)),data=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:encoder.encode("user:"+userId)},await sealKey(keyMaterial),Uint8Array.from(secret).buffer);
  return JSON.stringify({v:1,iv:Array.from(iv),data:Array.from(new Uint8Array(data))});
}
export async function openTotp(sealed:string,keyMaterial:string,userId:number):Promise<Uint8Array>{
  if(!Number.isSafeInteger(userId)||userId<1||sealed.length>1000)throw new Error("Invalid authenticator data.");
  const parsed=JSON.parse(sealed);if(parsed.v!==1||!Array.isArray(parsed.iv)||parsed.iv.length!==12||!Array.isArray(parsed.data)||parsed.data.length!==36||![...parsed.iv,...parsed.data].every((v:any)=>Number.isInteger(v)&&v>=0&&v<=255))throw new Error("Invalid authenticator data.");
  const result=await crypto.subtle.decrypt({name:"AES-GCM",iv:Uint8Array.from(parsed.iv),additionalData:encoder.encode("user:"+userId)},await sealKey(keyMaterial),Uint8Array.from(parsed.data));return new Uint8Array(result);
}
// Recovery codes have 128 random bits; only their hashes should be persisted.
export function generateRecoveryCodes(count=8):string[]{
  if(!Number.isSafeInteger(count)||count<1||count>10)throw new Error("Invalid recovery code count.");
  return Array.from({length:count},()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,"0")).join(""));
}
export async function recoveryCodeHash(code:string,userId:number):Promise<string>{
  if(!/^[a-f0-9]{32}$/.test(code)||!Number.isSafeInteger(userId)||userId<1)throw new Error("Invalid recovery code.");
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode("global-community:recovery:v1:"+userId+":"+code)));
  return Array.from(digest,b=>b.toString(16).padStart(2,"0")).join("");
}

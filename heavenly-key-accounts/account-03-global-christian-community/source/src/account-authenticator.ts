import type {Env} from "./types";
import {encodeBase32,sealTotp,openTotp,matchTotp,generateRecoveryCodes,recoveryCodeHash} from "./totp";

const fail=(message:string,status=400):never=>{throw Object.assign(new Error(message),{status});};
const randomId=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,"0")).join("");
const key=(env:Env)=>env.SESSION_SECRET||"";

export async function isEnabled(env:Env,userId:number):Promise<boolean>{
  return !!await env.DB.prepare("SELECT 1 FROM account_authenticators WHERE user_id=? AND active=1").bind(userId).first();
}
// Callers authenticate the member and rate-limit enrollment before invoking these methods.
export async function beginSetup(env:Env,userId:number,email:string){
  const secret=crypto.getRandomValues(new Uint8Array(20)),setupId=randomId(),sealed=await sealTotp(secret,key(env),userId),codes=generateRecoveryCodes(),expires=Date.now()+600000;
  const hashes=await Promise.all(codes.map(code=>recoveryCodeHash(code,userId)));
  const operations=[env.DB.prepare("INSERT INTO account_authenticators(user_id,sealed_secret,setup_id,active,last_step,expires_at) VALUES(?,?,?,0,-1,?) ON CONFLICT(user_id) DO UPDATE SET sealed_secret=excluded.sealed_secret,setup_id=excluded.setup_id,last_step=-1,expires_at=excluded.expires_at WHERE active=0").bind(userId,sealed,setupId,expires),env.DB.prepare("DELETE FROM authenticator_recovery_codes WHERE user_id=? AND EXISTS (SELECT 1 FROM account_authenticators WHERE user_id=? AND active=0 AND setup_id=?)").bind(userId,userId,setupId),...hashes.map(hash=>env.DB.prepare("INSERT INTO authenticator_recovery_codes(user_id,code_hash) SELECT ?,? WHERE EXISTS (SELECT 1 FROM account_authenticators WHERE user_id=? AND active=0 AND setup_id=?)").bind(userId,hash,userId,setupId))];
  const result=await env.DB.batch(operations);if(Number(result[0].meta.changes)!==1)fail("Two-factor authentication is already enabled.",409);
  const base32=encodeBase32(secret),label=encodeURIComponent("Global Christian Social Network:"+email);
  return {setupId,secret:base32,uri:"otpauth://totp/"+label+"?secret="+base32+"&issuer="+encodeURIComponent("Global Christian Social Network")+"&algorithm=SHA1&digits=6&period=30",recoveryCodes:codes};
}
export async function confirmSetup(env:Env,userId:number,setupId:string,code:string){
  if(!/^[a-f0-9]{32}$/.test(setupId))fail("Authenticator setup expired.");
  const row=await env.DB.prepare("SELECT sealed_secret,last_step FROM account_authenticators WHERE user_id=? AND setup_id=? AND active=0 AND expires_at>?").bind(userId,setupId,Date.now()).first<any>();if(!row)fail("Authenticator setup expired.");
  const step=await matchTotp(await openTotp(row.sealed_secret,key(env),userId),code,Date.now(),Number(row.last_step));if(step===null)fail("The authenticator code is incorrect.");
  const result=await env.DB.batch([env.DB.prepare("UPDATE account_authenticators SET active=1,last_step=?,expires_at=0 WHERE user_id=? AND setup_id=? AND active=0 AND expires_at>?").bind(step,userId,setupId,Date.now()),env.DB.prepare("UPDATE users SET session_version=session_version+1 WHERE user_id=? AND EXISTS (SELECT 1 FROM account_authenticators WHERE user_id=? AND setup_id=? AND active=1 AND last_step=?)").bind(userId,userId,setupId,step)]);
  if(Number(result[0].meta.changes)!==1)fail("Authenticator setup expired.");return {ok:true};
}
export async function verifySecondFactor(env:Env,userId:number,code:string):Promise<boolean>{
  const row=await env.DB.prepare("SELECT sealed_secret,last_step FROM account_authenticators WHERE user_id=? AND active=1").bind(userId).first<any>();if(!row)return false;
  if(/^[a-f0-9]{32}$/.test(code)){const hash=await recoveryCodeHash(code,userId);return !!await env.DB.prepare("DELETE FROM authenticator_recovery_codes WHERE user_id=? AND code_hash=? RETURNING code_hash").bind(userId,hash).first();}
  const step=await matchTotp(await openTotp(row.sealed_secret,key(env),userId),code,Date.now(),Number(row.last_step));if(step===null)return false;
  const result=await env.DB.prepare("UPDATE account_authenticators SET last_step=? WHERE user_id=? AND active=1 AND last_step<?").bind(step,userId,step).run();return Number(result.meta.changes)===1;
}

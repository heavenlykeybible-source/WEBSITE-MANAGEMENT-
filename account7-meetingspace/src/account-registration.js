// Provision user records ONLY from identity-provider verified sessions.
// Account passwords and email verification are delegated to the configured provider.
export function normalizedVerifiedIdentity(principal){
 if(principal?.authenticated!==true||principal.emailVerified!==true)throw Error('Verified email sign-in required');
 const id=principal.userId,email=principal.email;
 if(typeof id!=='string'||id.length<6||id.length>160||!/^[-a-zA-Z0-9_:|.]+$/.test(id))throw Error('Invalid identity subject');
 if(typeof email!=='string'||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Invalid verified email');
 return {id,email:email.toLowerCase()};
}
export async function provisionVerifiedAccount(db,principal,{now=Date.now()}={}){
 if(!db?.prepare)throw Error('Database unavailable');
 const account=normalizedVerifiedIdentity(principal);
 if(!Number.isSafeInteger(now)||now<=0)throw Error('Invalid registration time');
 await db.prepare('INSERT OR IGNORE INTO users (id,email,email_verified_at,created_at) VALUES (?,?,?,?)')
  .bind(account.id,account.email,now,now).run();
 const row=await db.prepare('SELECT id,email,disabled_at AS disabledAt FROM users WHERE id=? LIMIT 1').bind(account.id).first();
 if(!row||row.email?.toLowerCase()!==account.email||row.disabledAt!=null)throw Error('Account registration conflict or disabled account');
 return {id:row.id,email:row.email};
}

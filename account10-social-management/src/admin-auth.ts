// Shared-token compatibility layer until per-operator sessions and roles ship.
// Hash both values, compare every byte, and cap untrusted header size before hashing.
// No token or digest is logged or returned to callers.
export const administratorTokenMatches=async (authorization:string,secret:string):Promise<boolean>=>{
 if(authorization.length<8||authorization.length>520||!authorization.startsWith('Bearer '))return false;
 const candidate=authorization.slice(7);
 if(candidate.length!==secret.length)return false;
 const encoder=new TextEncoder();
 const [provided,expected]=await Promise.all([
  crypto.subtle.digest('SHA-256',encoder.encode(candidate)),
  crypto.subtle.digest('SHA-256',encoder.encode(secret))
 ]);
 const a=new Uint8Array(provided),b=new Uint8Array(expected);
 let diff=0;
 for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
 return diff===0;
};

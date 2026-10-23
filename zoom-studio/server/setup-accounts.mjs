// Private setup utility. Never runs during build/deployment; never overwrites existing accounts.
import { randomBytes, createHmac, pbkdf2Sync } from 'node:crypto';
const secret=process.env.AUTH_SECRET, password=process.env.STUDIO_INITIAL_PASSWORD;
if(!secret||secret.length<32||!password||password.length<8){console.error('Supply AUTH_SECRET (matching your studio deployment, 32+ characters) and STUDIO_INITIAL_PASSWORD (8+ characters) privately.');process.exit(1)}
console.log('BEGIN TRANSACTION;');
for(const role of ['owner','admin']){
 const email=role+'@studio.local',salt=randomBytes(16).toString('hex'),now=Date.now();
 const derived=pbkdf2Sync(password,'livestudio:'+email,210000,32,'sha256').toString('hex');
 const hash=createHmac('sha256',salt+'|'+secret).update(derived).digest('hex');
 console.log(`INSERT OR IGNORE INTO users(email,salt,hash,paid,verified,banned,tv,created,seen,role) VALUES('${email}','${salt}','${hash}',0,1,0,0,${now},${now},'${role}');`);
}
console.log('COMMIT;');

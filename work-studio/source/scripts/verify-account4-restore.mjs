import {createHmac,timingSafeEqual} from 'node:crypto';

/* Trusted immutable policy: never run this verifier from a user-selected release commit.
 * Restores require a fresh Account 4 owner-password confirmation and this action-specific
 * proof, bound to the exact account, target commit and one-hour expiry. */
const account=process.argv[2];
const sha=process.env.TARGET_REF;
const proof=process.env.RESTORE_PROOF;
const secret=process.env.APPROVAL_SECRET;
if(!['1','2','3'].includes(account)||!/^[0-9a-f]{40}$/.test(sha||'')||!secret||!proof)
  throw Error('Account 4 emergency-restore authorization required.');
const parts=proof.split('.');
if(parts.length!==2||!/^[0-9]{10}$/.test(parts[0])||!/^[0-9a-f]{64}$/.test(parts[1]))
  throw Error('Invalid Account 4 emergency-restore proof.');
const expiry=Number(parts[0]);
const now=Math.floor(Date.now()/1000);
if(expiry<now||expiry>now+3600)
  throw Error('Account 4 emergency-restore proof expired or too far in the future.');
const expected=createHmac('sha256',secret).update(
  'hkem-account4-owner-restore-v1:'+account+':'+sha+':'+parts[0]
).digest();
if(!timingSafeEqual(Buffer.from(parts[1],'hex'),expected))
  throw Error('Account 4 emergency-restore signature does not match the action, account or release.');
console.log('Account 4 signed owner emergency restore validated for account '+account+' and '+sha);

export const ACCOUNT4_ID='404ebf05a781fcccbbed44aeb02cb72b';
export function verifyAccount4Destination(value) {
 if(value!==ACCOUNT4_ID)throw new Error('Refusing Cloudflare destination: exact Account 4 ID required');
 return ACCOUNT4_ID;
}

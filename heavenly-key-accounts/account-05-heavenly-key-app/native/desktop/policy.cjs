'use strict';
function ministryURL(value) {
 try { const u=new URL(value);return u.protocol==='https:' && !u.username && !u.password && !u.port && (u.hostname==='heavenlykey.org'||u.hostname.endsWith('.heavenlykey.org')); } catch { return false; }
}
module.exports={ministryURL};

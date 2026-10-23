import assert from 'node:assert/strict';
import fs from 'node:fs';
for(const file of ['read-pray-reminder.js','study-extensions.js']){
 const js=fs.readFileSync('heavenly-key-website/bible/'+file,'utf8');
 assert(js.includes('if(notificationPending)return'),file+' must block concurrent reminders');
 assert(js.includes('notificationPending=true'),file+' must take the lock');
 assert(js.includes('finally{notificationPending=false;}'),file+' must release lock after failure');
}
assert(fs.readFileSync('heavenly-key-website/bible/sw.js','utf8').match(/hk-bible-shell-v\d+/));
console.log('PASS: both reader and study page prevent overlapping local notifications and app cache updated');

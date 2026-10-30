import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Idempotent patch to the existing Account 4 UI; never changes API authorization.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=path.join(root,'control-room-worker.js');
let s=fs.readFileSync(target,'utf8');
const original="group('Workspace');item('Home','⌂',controlHome);";
const updated="group('Quick access');item('Home','⌂',controlHome);if(lv()>=2)item('AI Chat','✦',claude);if(!M&&lv()>=4)item('Connections','▧',projectSources);item('Waiting','◷',waiting,'wb');item('Releases','↗',releaseHistory);group('Workspace');";
if(s.includes(updated)){console.log('Account 4 navigation already upgraded');process.exit(0);}
if(s.split(original).length!==2)throw Error('Unexpected navigation source; refusing unsafe patch');
s=s.replace(original,updated);
const replacements=[
 ["item('Waiting','◷',waiting,'wb');if(!M)item('Sites'","if(!M)item('Sites'"],
 ["if(lv()>=2)item('Assistant','✦',claude);",""],
 ["if(!M&&lv()>=4)item('Project sources','▧',projectSources);",""],
 ["item('Releases','↗',releaseHistory);item('Identity'","item('Identity'"]
];
for(const [from,to] of replacements){if(s.split(from).length!==2)throw Error('Navigation layout changed; refusing patch: '+from);s=s.replace(from,to);}
if(process.argv.includes('--check')){
 console.log('Account 4 quick navigation patch is applicable');
}else{
 fs.writeFileSync(target,s);
 console.log('Account 4 quick navigation upgraded');
}

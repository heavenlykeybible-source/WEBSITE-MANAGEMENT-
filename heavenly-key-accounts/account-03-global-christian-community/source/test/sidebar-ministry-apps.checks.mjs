import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const dir=resolve(fileURLToPath(new URL('..',import.meta.url)));
const source=readFileSync(resolve(dir,'public/sidebar-ministry-apps.js'),'utf8');
const css=readFileSync(resolve(dir,'public/sidebar-ministry-apps.css'),'utf8');
for(const name of ['index','account','fellowship','groups','grow','messages','missions','prayer','profile','safety','salvation','spaces','heavenly-key']){
 const html=readFileSync(resolve(dir,'public/'+name+'.html'),'utf8');
 assert(html.includes('sidebar-ministry-apps.css')&&html.includes('sidebar-ministry-apps.js'),'Missing app sidebar on '+name);
}
for(const key of ['study','assistant','eternity','community','radio','editor','calculator'])assert(source.includes("id:'"+key+"'"),'Missing app '+key);
assert.equal((source.match(/\{id:'(?:study|assistant|eternity|community|radio|editor|calculator)'/g)||[]).length,7);
assert(source.includes('approved-ai-transparent-original.png'),'Approved original assistant woman portrait required');
assert(source.includes("document.querySelector('.social-sidebar')"),'Launcher must be inside the right sidebar');
assert(source.includes('aside.lastElementChild')&&source.includes('aside.append(existing)'),'Dock must stay at sidebar bottom');
assert(source.includes('navigator.share')&&source.includes('navigator.clipboard'),'Sharing and fallback required');
assert(source.includes("visit.rel='noopener noreferrer'"),'App page must open securely');
assert(css.includes('@media(max-width:750px)'),'Mobile design required');
const csp=readFileSync(resolve(dir,'public/_headers'),'utf8');
assert(csp.includes('https://heavenlykey.org'),'Official portrait host must be permitted');
console.log('Active Global Christian Community sidebar contract verified');

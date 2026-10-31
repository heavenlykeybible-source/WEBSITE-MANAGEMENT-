import {readdirSync,readFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join,resolve,dirname} from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname);
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);}
for(const file of [...files(join(root,'src')),...files(join(root,'public'))].filter(f=>f.endsWith('.js'))){
 const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status!==0)throw Error(result.stderr);
 const source=readFileSync(file,'utf8');
 for(const match of source.matchAll(/(?:from\s*|import\s*\()\s*['"](\.\/[^'"]+)['"]/g))if(!existsSync(resolve(dirname(file),match[1])))throw Error('Missing module '+match[1]+' in '+file);
}
for(const file of files(join(root,'public')).filter(f=>f.endsWith('.html'))){
 const html=readFileSync(file,'utf8');
 for(const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)){
  const raw=match[1].replaceAll('&amp;','&');if(/^(?:https?:|#|mailto:|tel:|data:)/.test(raw))continue;
  const path=raw.split(/[?#]/)[0];if(!path||path==='/')continue;
  const target=path.startsWith('/')?join(root,'public',path):resolve(dirname(file),path);
  if(!existsSync(target))throw Error('Missing page/asset '+raw+' in '+file);
 }
}
console.log('All app scripts, module dependencies and local page/assets links verified.');

// Enforce the Account 5 strict-CSP contract on primary public entry points.
for(const name of ['walk-offline.html','experience.html','devotional.html','creation-to-eternity.html','old-time-gospel-revival-hymn-book.html']){
 const file=join(root,'public',name);const html=readFileSync(file,'utf8');
 if(/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i.test(html))throw Error('Inline script violates strict CSP in '+name);
 if(/\sstyle\s*=/i.test(html))throw Error('Inline style violates strict CSP in '+name);
 if(/<iframe\b/i.test(html))throw Error('Nested frame is not allowed by Account 5 frame policy in '+name);
}
const policy=readFileSync(join(root,'public','_headers'),'utf8');
for(const directive of ["script-src 'self'","style-src 'self'","frame-src 'none'","frame-ancestors 'none'","object-src 'none'","base-uri 'none'","upgrade-insecure-requests"]){if(!policy.includes(directive))throw Error('Missing required CSP directive: '+directive)}
const reading=readFileSync(join(root,'public','daily-reading-plan.js'),'utf8');
if(!reading.includes("import {KJV_BOOKS,READING_YEAR,readingForDay,TODAY_REFLECTIONS}"))throw Error('Daily reading catalogue import missing');
if(!reading.includes('KJV_BOOKS.find(x=>x.name===reading.book)')||!reading.includes('encodeURIComponent(book.slug)'))throw Error('Daily reading Bible-book lookup is not aligned with the KJV catalogue');
if(reading.includes('books.find')||reading.includes(':\\\\d{1,3}'))throw Error('Daily reading runtime/progress regression detected');
console.log('Account 5 strict-CSP, page, module and daily-reading checks passed.');

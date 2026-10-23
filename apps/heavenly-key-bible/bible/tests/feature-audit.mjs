import fs from 'node:fs';import assert from 'node:assert/strict';import path from 'node:path';
const root=path.resolve('heavenly-key-website/bible');
const txt=f=>fs.readFileSync(path.join(root,f),'utf8');
const dict=JSON.parse(txt('dictionary.json'));const topics=JSON.parse(txt('daily-topics.json'));
assert(dict.length>=160);assert(new Set(dict.map(e=>e.term.toLowerCase())).size===dict.length,'duplicate dictionary terms');
for(const entry of dict){assert(entry.term&&entry.meaning&&entry.reference,'invalid dictionary entry')}
assert(Object.keys(topics).length>=53);for(const [name,entry] of Object.entries(topics)){assert(Array.isArray(entry)&&entry.length===2&&entry.every(x=>typeof x==='string'&&x.length>4),name)}
const needed=['Faith','Salvation','Repentance','Forgiveness','Marriage','Rapture','Revival','Holiness'];for(const name of needed)assert(Object.keys(topics).some(t=>t.toLowerCase().includes(name.toLowerCase())),name);
const main=txt('index.html'),extras=txt('study-extensions.html'),script=txt('study-extensions.js'),sw=txt('sw.js');
assert(main.includes('read-pray-reminder.js'),'main reader missing reminder monitor');assert(sw.includes('read-pray-reminder.js'),'reminder not offline cached');
assert(extras.includes('READ &amp; PRAY DAILY ROUTINE'));assert(script.includes('hk-read-pray-v2'));assert(script.includes('state.manifest'));
assert(script.includes('textIndex.get(word)'));assert(script.includes("$('stop')"));
assert(txt('read-pray-reminder.js').includes('Notification.permission'));
assert(!script.includes('i<3650'),'routine duration limit');
const manifest=JSON.parse(txt('data/kjv/manifest.json'));assert.equal(manifest.books.length,66);
for(const book of manifest.books){const data=JSON.parse(txt(`data/kjv/${book.code}.json`));assert(data.chapters&&Object.keys(data.chapters).length===book.chapters,book.code)}
console.log('PASS: 160 dictionary entries, 53 subjects, 66 books, main app+study reminders, full index wiring, unsubscribe, no expiry cap');

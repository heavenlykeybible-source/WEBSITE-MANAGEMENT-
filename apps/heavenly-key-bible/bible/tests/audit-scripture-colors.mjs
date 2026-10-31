// Audit existing KJV word-colour annotations against the exact local verses.
// Does not infer speakers, add editorial approval, or claim full Bible coverage.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../heavenly-key-website/bible');
const annotationRoot=resolve(root,'data/annotations');
const files=readdirSync(annotationRoot).filter(name=>/^[A-Z0-9]{3}\.json$/.test(name));
assert.ok(files.length,'No Scripture colour annotations found');
const allowed=new Set(['jesus','god','reference']);
const counts={jesus:0,god:0,reference:0};
for(const name of files){
 const annotation=JSON.parse(readFileSync(resolve(annotationRoot,name),'utf8'));
 const book=JSON.parse(readFileSync(resolve(root,'data/kjv',name),'utf8'));
 assert.equal(book.translation,'KJV',name);
 for(const [chapter,verses] of Object.entries(annotation)){
  const source=book.chapters[chapter];
  assert.ok(Array.isArray(source),name+' chapter '+chapter+' unavailable');
  for(const [number,marks] of Object.entries(verses)){
   const verse=source[Number(number)-1];
   assert.ok(verse?.number===Number(number)&&verse.isPlaceholder===false,name+' verse '+chapter+':'+number+' unavailable');
   assert.ok(Array.isArray(marks),name+' marks must be array');
   let lastEnd=0;
   for(const mark of [...marks].sort((a,b)=>a.start-b.start)){
    assert.ok(allowed.has(mark.type),name+' unexpected colour type');
    assert.ok(Number.isInteger(mark.start)&&Number.isInteger(mark.end)&&mark.start>=lastEnd&&mark.end>mark.start&&mark.end<=verse.text.length,name+' invalid or overlapping offsets at '+chapter+':'+number);
    lastEnd=mark.end;
    counts[mark.type]++;
   }
  }
 }
}
// Verify each curated centre reference points to a real, non-placeholder KJV verse.
const kjvFiles=readdirSync(resolve(root,'data/kjv')).filter(name=>/^[A-Z0-9]{3}\.json$/.test(name));
const kjvByBook=new Map();
for(const name of kjvFiles){
 const data=JSON.parse(readFileSync(resolve(root,'data/kjv',name),'utf8'));
 assert.equal(data.translation,'KJV',name);
 kjvByBook.set(data.book,data);
}
const references=JSON.parse(readFileSync(resolve(annotationRoot,'center-references.json'),'utf8'));
let referenceLinks=0;
for(const [code,chapters] of Object.entries(references)){
 const source=JSON.parse(readFileSync(resolve(root,'data/kjv',code+'.json'),'utf8'));
 for(const [chapter,verses] of Object.entries(chapters)){
  assert.ok(Array.isArray(source.chapters[chapter]),code+' missing reference chapter '+chapter);
  for(const [number,targets] of Object.entries(verses)){
   const verse=source.chapters[chapter][Number(number)-1];
   assert.ok(verse?.number===Number(number)&&verse.isPlaceholder===false,code+' missing reference source '+chapter+':'+number);
   assert.ok(Array.isArray(targets)&&targets.length,code+' missing reference targets');
   assert.equal(new Set(targets).size,targets.length,code+' repeated reference targets');
   for(const target of targets){
    const match=typeof target==='string'&&/^(.+?) (\d+):(\d+)$/.exec(target);
    assert.ok(match,code+' malformed reference '+target);
    const destination=kjvByBook.get(match[1]);
    const destVerse=destination?.chapters[match[2]]?.[Number(match[3])-1];
    assert.ok(destVerse?.number===Number(match[3])&&destVerse.isPlaceholder===false,code+' invalid reference '+target);
    referenceLinks++;
   }
  }
 }
}
const style=readFileSync(resolve(root,'style.css'),'utf8');
for(const selector of ['.jesus-words','.god-words','.center-reference'])assert.ok(style.includes(selector),'Missing stylesheet selector: '+selector);
const result={annotatedBooks:files.length,totalBibleBooks:66,annotations:counts,referenceLinks,complete:files.length===66};
console.log(JSON.stringify(result,null,2));
if(!result.complete)console.log('COVERAGE INCOMPLETE: Unannotated books remain plain KJV text. Manual KJV speaker and reference review required.');

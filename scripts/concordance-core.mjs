/** Shared local KJV inventory. No network, generation, approval or deployment. */
import fs from 'node:fs';
import crypto from 'node:crypto';
export const root='apps/heavenly-key-bible/heavenly-key-website/bible/';
export const study=root+'concordance/';
export const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
export const normalize=text=>String(text??'').toLowerCase().replace(/\s+/g,' ').trim();
export function loadCanon(){
 const source=fs.readFileSync(study+'concordance.js','utf8');
 const match=source.match(/const books="([^"]+)"\.split\(","\)\.map\(x=>x\.split\(":"\)\)/);
 if(!match)throw Error('Cannot read existing book mapping');
 const books=match[1].split(',').map(x=>x.split(':'));
 if(books.length!==66||new Set(books.map(x=>x[0])).size!==66)throw Error('Invalid 66-book mapping');
 const canon=[];let chapters=0;
 for(const [name,code] of books){
  const b=JSON.parse(fs.readFileSync(root+'data/kjv/'+code+'.json','utf8'));
  if(b.book!==name)throw Error('Book name mismatch '+code);
  const cs=Object.keys(b.chapters).sort((a,b)=>Number(a)-Number(b));
  cs.forEach((c,i)=>{
   if(Number(c)!==i+1)throw Error('Nonsequential chapter '+name+' '+c);
   const vs=b.chapters[c];if(!Array.isArray(vs)||!vs.length)throw Error('Empty chapter '+name+' '+c);
   vs.forEach((v,j)=>{
    if(v.number!==j+1||v.isPlaceholder||typeof v.text!=='string'||!v.text.trim())throw Error('Invalid KJV verse '+name+' '+c+':'+v.number);
    canon.push({ref:name+' '+c+':'+v.number,text:v.text});
   });chapters++;
  });
 }
 if(canon.length!==31102||chapters!==1189||new Set(canon.map(x=>x.ref)).size!==31102)throw Error('Invalid KJV coverage');
 return {canon,books,chapters,byRef:new Map(canon.map(v=>[v.ref,v]))};
}
export function loadDrafts(){
 const files=fs.readdirSync(study+'drafts').filter(f=>f.endsWith('.json')).sort();
 const entries=files.flatMap(file=>{
  const data=JSON.parse(fs.readFileSync(study+'drafts/'+file,'utf8'));
  if(!Array.isArray(data))throw Error('Draft is not an array: '+file);
  return data.map(entry=>({...entry,sourceFile:file}));
 });return {files,entries};
}
// Existing legacy references use Psalm (singular) and same-chapter ranges.
export function expandReference(ref,byRef){
 if(typeof ref!=='string')return null;
 const r=ref.trim().replace(/^Psalm /,'Psalms ').replace(/[–—]/g,'-');
 if(byRef.has(r))return [r];
 const m=r.match(/^(.+ \d+:)(\d+)-(\d+)$/);
 if(!m||Number(m[3])<Number(m[2])||Number(m[3])-Number(m[2])>176)return null;
 const refs=Array.from({length:Number(m[3])-Number(m[2])+1},(_,i)=>m[1]+(Number(m[2])+i));
 return refs.every(x=>byRef.has(x))?refs:null;
}
export function validateEntries(entries,byRef,{strict=false}={}){
 const errors=[],warnings=[],seen=new Set(),texts=new Map();
 for(const e of entries){
  if(!e||typeof e!=='object'){errors.push('Invalid record');continue;}
  const prefix=String(e.ref);
  if(!byRef.has(e.ref))errors.push(prefix+': unknown verse');
  if(seen.has(e.ref))errors.push(prefix+': duplicate verse');seen.add(e.ref);
  for(const f of ['explanation','context','application'])if(typeof e[f]!=='string'||e[f].trim().length<20)errors.push(prefix+': missing/short '+f);
  if(!['pending','approved','needs_revision'].includes(e.reviewStatus))errors.push(prefix+': invalid reviewStatus');
  // A receipt is required for approved data, but only human governance can verify authorization.
  if(e.reviewStatus==='approved'&&(!e.reviewedBy||!e.reviewedAt||!e.reviewEvidence))errors.push(prefix+': no human review evidence');
  if(!Array.isArray(e.crossReferences)||!e.crossReferences.length)errors.push(prefix+': missing crossReferences');
  else for(const r of e.crossReferences)if(!expandReference(r,byRef))errors.push(prefix+': invalid cross-reference '+r);
  const n=normalize(e.explanation);
  if(texts.has(n))errors.push(prefix+': identical explanation to '+texts.get(n));texts.set(n,prefix);
  const missing=[];
  if(typeof e.historicalContext!=='string'||!e.historicalContext.trim())missing.push('historicalContext');
  if(typeof e.kjvText!=='string'||e.kjvText!==byRef.get(e.ref)?.text)missing.push('exact kjvText');
  if(e.kjvTextHash!==hash(byRef.get(e.ref)?.text??''))missing.push('kjvTextHash');
  if(!Array.isArray(e.reviewFlags))missing.push('reviewFlags');
  if(e.reviewFlags?.length&&e.publicationHold!==true)errors.push(prefix+': flagged entry must have publicationHold');
  if(strict&&e.reviewStatus!=='pending')errors.push(prefix+': new AI drafts must be pending');
  if(missing.length)(strict?errors:warnings).push(prefix+': missing '+missing.join(', '));
  if(strict&&String(e.explanation??'').trim().split(/\s+/).length<35)errors.push(prefix+': explanation below new-draft 35-word floor');
 }
 return {errors,warnings};
}

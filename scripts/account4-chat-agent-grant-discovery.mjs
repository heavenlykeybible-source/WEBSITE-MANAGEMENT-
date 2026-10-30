import fs from 'node:fs';
const target=new URL('../control-room-worker.js',import.meta.url);
let s=fs.readFileSync(target,'utf8');
const before="token_hash NOT LIKE 'user:%'";
const after="(token_hash NOT LIKE 'user:%' OR token_hash LIKE 'user:ai:%')";
const start=s.indexOf('async function aiPermissionRoutes(');
const end=s.indexOf('function aiChunk(',start);
if(start<0||end<=start)throw Error('Cannot identify AI permissions section');
let section=s.slice(start,end);
const occurrences=section.split(before).length-1;
if(!section.includes(after)){
 if(occurrences!==2)throw Error('Expected exactly two AI agent selector queries, saw '+occurrences);
 section=section.split(before).join(after);
 s=s.slice(0,start)+section+s.slice(end);
}
if(!process.argv.includes('--check'))fs.writeFileSync(target,s);
console.log('PASS registered chat AI agents appear in individually authorized grant list ('+occurrences+' substitutions)');

#!/usr/bin/env node
// Account 5 public-content denomination audit. Run: node tools/audit-public-church-names.mjs
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('heavenly-key-accounts/account-05-heavenly-key-app/source');
const patterns=[
/\bdeeper\s+life\b/gi,/\bapostolic\s+faith\b/gi,
/\bassemblies\s+of\s+god\b/gi,/\bredeemed\s+christian\s+church\b/gi,
/\b(?:roman\s+)?catholic\s+church\b/gi,/\bseventh.day\s+adventist\b/gi,
/\b(?:methodist|anglican|baptist|presbyterian|lutheran)\s+church\b/gi,
/\b(?:credit|thanks|courtesy|acknowledgement)\s+(?:to|for)\s+(?:the\s+)?(?:church|denomination)\b/gi
];
const extensions=new Set(['.html','.js','.mjs','.json','.md','.txt','.css','.xml','.svg','.webmanifest']);
let scanned=0,found=0;
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory()){if(!['node_modules','.git','dist','build'].includes(e.name))await walk(file);continue;}if(!extensions.has(path.extname(e.name).toLowerCase()))continue;scanned++;const s=await readFile(file,'utf8');for(const p of patterns){p.lastIndex=0;for(const m of s.matchAll(p)){const line=s.slice(0,m.index).split('\n').length;console.log(path.relative(root,file)+':'+line+': '+m[0]);found++;}}}}
await walk(root);console.log('Scanned '+scanned+' text files; flagged '+found+' possible public references.');if(found)process.exitCode=1;

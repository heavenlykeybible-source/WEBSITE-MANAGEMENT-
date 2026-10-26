#!/usr/bin/env node
// Read-only inventory: node scripts/platform-quality-audit.mjs
// Optional strict exit: node scripts/platform-quality-audit.mjs --strict
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(), issues=[], counts={files:0,localAssets:0,externalLinks:0,smallFonts:0};
const skip=new Set(['.git','node_modules','dist','build','.next','coverage','.wrangler','.cache']);
const exts=new Set(['.html','.htm','.css','.jsx','.tsx','.vue']);
const knownRoutes=new Set();
const entries=[];
async function walk(dir){
 for(const e of await readdir(dir,{withFileTypes:true})){
  if(e.isDirectory()){if(!skip.has(e.name))await walk(path.join(dir,e.name));continue;}
  if(!e.isFile()||!exts.has(path.extname(e.name).toLowerCase()))continue;
  const file=path.join(dir,e.name);if((await stat(file)).size>1_000_000)continue;
  entries.push(file);knownRoutes.add(file);
 }
}
await walk(root);
for(const file of entries){
 const s=await readFile(file,'utf8');counts.files++;
 const relative=path.relative(root,file);
 for(const m of s.matchAll(/(?:href|src)\s*=\s*["']([^"'#]+)["']/gi)){
  const u=m[1].trim();
  if(/^(?:https?:|\/\/)/i.test(u)){counts.externalLinks++;continue;}
  if(/^(?:data:|mailto:|tel:|javascript:|blob:|about:|\{|\$|%)/i.test(u)||u.includes('{{'))continue;
  const clean=u.split(/[?#]/)[0];if(!clean||clean.startsWith('/'))continue; // absolute routes need live route verification
  let decoded;try{decoded=decodeURIComponent(clean)}catch{issues.push({type:'malformed-url',file:relative,value:u});continue}
  const target=path.resolve(path.dirname(file),decoded);
  if(!target.startsWith(root+path.sep))continue;
  if(!/\.[a-z0-9]{1,8}$/i.test(decoded))continue; // client routes are not static assets
  counts.localAssets++;
  try{await stat(target)}catch{issues.push({type:'possible-missing-local-asset',file:relative,value:u})}
 }
 if(path.extname(file).toLowerCase()==='.css'){
  for(const m of s.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi)){
   if(Number(m[1])<14){counts.smallFonts++;issues.push({type:'font-under-14px-review',file:relative,value:m[0]})}
  }
 }
}
const report={generatedAt:new Date().toISOString(),scope:'static repository files; not live browser or server routes',counts,issueCount:issues.length,issues};
console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--strict')&&issues.length)process.exitCode=1;

#!/usr/bin/env node
// Read-only repository-wide quality inventory. Run: node scripts/platform-quality-audit.mjs
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(), issues=[], counts={files:0,links:0,smallFonts:0};
const skip=new Set(['.git','node_modules','dist','build','.next','coverage','.wrangler']);
const exts=new Set(['.html','.htm','.css','.jsx','.tsx','.vue']);
async function walk(dir){
 for(const e of await readdir(dir,{withFileTypes:true})){
  if(e.isDirectory()){if(!skip.has(e.name)) await walk(path.join(dir,e.name));continue;}
  if(!e.isFile()||!exts.has(path.extname(e.name).toLowerCase()))continue;
  const file=path.join(dir,e.name);if((await stat(file)).size>1_000_000)continue;
  const s=await readFile(file,'utf8');counts.files++;
  for(const m of s.matchAll(/(?:href|src)\s*=\s*["']([^"'#]+)["']/gi)){
   const u=m[1].trim();counts.links++;
   if(/^(?:https?:|data:|mailto:|tel:|javascript:|\/\/|\{|\$|%)/i.test(u))continue;
   const target=path.resolve(path.dirname(file),decodeURIComponent(u.split(/[?#]/)[0]));
   if(!target.startsWith(root+path.sep))continue;
   try{await stat(target)}catch{issues.push({type:'missing-local-asset',file:path.relative(root,file),target:u})}
  }
  if(path.extname(file)==='.css')for(const m of s.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi)){
   if(Number(m[1])<14){counts.smallFonts++;issues.push({type:'font-under-14px',file:path.relative(root,file),value:m[0]})}
  }
 }
}
await walk(root);
console.log(JSON.stringify({counts,issueCount:issues.length,issues:issues.slice(0,500)},null,2));
if(issues.length)process.exitCode=1;

#!/usr/bin/env node
// Read-only security hygiene checks. Does not access production secrets or mutate files.
import {readdir,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(), findings=[], skip=new Set(['.git','node_modules','dist','build','coverage','.wrangler']);
const extensions=new Set(['.js','.mjs','.cjs','.ts','.tsx','.jsx','.html']);
let scanned=0;
async function walk(dir){
 for(const entry of await readdir(dir,{withFileTypes:true})){
  if(entry.isDirectory()){if(!skip.has(entry.name))await walk(path.join(dir,entry.name));continue}
  if(!entry.isFile()||!extensions.has(path.extname(entry.name)))continue;
  const file=path.join(dir,entry.name);if((await stat(file)).size>500000)continue;
  const source=await readFile(file,'utf8'),rel=path.relative(root,file);scanned++;
  const checks=[
   ['dangerous-eval',/\beval\s*\(/g],
   ['dynamic-function-constructor',/\bnew\s+Function\s*\(/g],
   ['unsafe-innerhtml-assignment',/\.innerHTML\s*=(?!=)/g],
   ['insecure-http-resource',/(?:src|href)\s*=\s*["']http:\/\//gi],
   ['disabled-tls-validation',/NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0/g]
  ];
  for(const [type,pattern] of checks)for(const match of source.matchAll(pattern)){
   const line=source.slice(0,match.index).split('\n').length;
   findings.push({type,file:rel,line,note:'Review manually; a match does not prove a vulnerability'});
  }
 }
}
await walk(root);
console.log(JSON.stringify({scope:'heuristic source scan, not penetration testing',filesScanned:scanned,findingsCount:findings.length,findings:findings.slice(0,500)},null,2));
if(process.argv.includes('--strict')&&findings.length)process.exitCode=1;

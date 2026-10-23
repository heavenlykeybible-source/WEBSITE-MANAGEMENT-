import { readFile, stat } from "node:fs/promises";
import assert from "node:assert/strict";
const root=new URL("../../heavenly-key-website/bible/",import.meta.url);
const html=await readFile(new URL("index.html",root),"utf8"),js=await readFile(new URL("app.js",root),"utf8");
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,"Duplicate HTML IDs");
for(const [,id] of js.matchAll(/el\("([^"]+)"\)/g))assert(ids.includes(id),"Missing UI element "+id);
for(const [,target] of html.matchAll(/(?:href|src)="([^"]+)"/g)){if(target.startsWith("https://"))continue;if(target.startsWith("#")){assert(ids.includes(target.slice(1)));continue;}const asset=new URL(target,root);if(asset.pathname.endsWith("/"))asset.pathname+="index.html";assert((await stat(asset)).isFile(),"Missing asset "+target);}
const manifest=JSON.parse(await readFile(new URL("manifest.webmanifest",root),"utf8"));assert.equal(manifest.name,"HEAVENLY KEY BIBLE");assert.equal(manifest.scope,"./");assert.equal(manifest.start_url,"./index.html");
const hymns=JSON.parse(await readFile(new URL("data/hymns.json",root),"utf8"));assert.equal(hymns.items.length,3);for(const h of hymns.items){assert.equal(h.copyrightStatus,"public_domain");assert(h.author&&h.lyrics&&h.sourceUrl.startsWith("https://"));}
console.log("PASS: UI element wiring, local assets, section links, install manifest and sourced hymn lyrics.");

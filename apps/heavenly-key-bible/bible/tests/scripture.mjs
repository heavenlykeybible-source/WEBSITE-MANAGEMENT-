import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root = new URL("../../heavenly-key-website/bible/data/kjv/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifest.json", root), "utf8"));
assert.equal(manifest.books.length, 66);
let chapters = 0, verses = 0;
for (const book of manifest.books) {
 const raw = await readFile(new URL(book.code+".json", root));
 assert.equal(createHash("sha256").update(raw).digest("hex"), book.sha256, book.code+" checksum");
 const data = JSON.parse(raw);
 assert.equal(data.book, book.name);
 assert.equal(data.translation, "KJV");
 assert.equal(Object.keys(data.chapters).length, book.chapters);
 let bookVerses = 0;
 for (let chapter=1;chapter<=book.chapters;chapter++) {
  const items=data.chapters[String(chapter)];
  assert(items.length>0);
  items.forEach((v,i)=>{assert.equal(v.number,i+1);assert.equal(v.isPlaceholder,false);assert.equal(typeof v.text,"string");assert(v.text.trim());});
  chapters++;bookVerses+=items.length;
 }
 assert.equal(bookVerses,book.verses);verses+=bookVerses;
}
assert.equal(chapters,1189);assert.equal(verses,31102);
console.log("PASS: complete 66-book KJV bundle; 1,189 chapters, 31,102 verses and all file checksums.");

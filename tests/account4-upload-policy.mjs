import assert from 'node:assert/strict';
import {MAX_UPLOAD_BYTES,PART_BYTES,validateImportMetadata,validatePart} from '../scripts/account4-upload-policy.mjs';
const actor={id:7,authenticated:true,canImport:true};
const meta=validateImportMetadata({name:'archive.zip',size:MAX_UPLOAD_BYTES},actor);
assert.equal(meta.partCount,103);
assert.equal(validatePart({partNumber:1,byteLength:PART_BYTES},meta),true);
assert.equal(validatePart({partNumber:103,byteLength:MAX_UPLOAD_BYTES-102*PART_BYTES},meta),true);
for(const bad of [{},{authenticated:true,canImport:false},{authenticated:true,canImport:true},{id:0,authenticated:true,canImport:true},{id:-1,authenticated:true,canImport:true},{id:'7',authenticated:true,canImport:true}])
  assert.throws(()=>validateImportMetadata({name:'archive.zip',size:100},bad));
for(const name of ['../secret','config.env','run.sh','a/b.zip','','document.php.jpg','document.PHTML.zip','file.jspx.txt','file.phar.zip','CON.txt','LPT1.zip','package.zip.','package.zip '])
  assert.throws(()=>validateImportMetadata({name,size:100},actor));
for(const file of [null,undefined,[],false,'archive.zip'])
  assert.throws(()=>validateImportMetadata(file,actor));
for(const size of [0,-1,MAX_UPLOAD_BYTES+1,1.5,NaN])
  assert.throws(()=>validateImportMetadata({name:'file.zip',size},actor));
assert.throws(()=>validatePart({partNumber:1,byteLength:1},meta));
assert.throws(()=>validatePart({partNumber:104,byteLength:1},meta));
for(const safe of ['archive.zip','project.html','style.css','image.png','content.json']) assert.equal(validateImportMetadata({name:safe,size:100},actor).name,safe);
console.log('PASS Account 4 multipart upload policy boundaries');

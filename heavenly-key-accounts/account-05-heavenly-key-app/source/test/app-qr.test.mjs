import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const publicRoot = new URL('../public/',import.meta.url);
const read = p=>fs.readFileSync(new URL(p,publicRoot),'utf8');
const devices = ['android','iphone','ipad','windows','mac'];
const origin='https://apps.heavenlykey.org';

test('every active QR belongs to the reviewed app catalogue and correct device URL',()=>{
 const items=JSON.parse(read('qr/destinations.json'));
 const apps=JSON.parse(read('app-downloads.json'));
 const identifiers=new Set(),urls=new Set();
 assert.equal(items.length,70);
 for(const item of items) {
  assert.ok(!identifiers.has(item.id),'Duplicate QR ID: '+item.id);
  assert.ok(!urls.has(item.url),'Duplicate QR destination: '+item.url);
  identifiers.add(item.id); urls.add(item.url);
  const svg=read(item.qr.slice(1));
  assert.equal(createHash('sha256').update(svg).digest('hex'),item.sha256,'QR file changed: '+item.id);
  if(item.kind==='device'){
   assert.ok(devices.includes(item.id));
   assert.equal(item.url,origin+'/download/'+item.id+'/');
  }else if(item.kind==='app-device'){
   assert.ok(Object.hasOwn(apps,item.app),'Retired or unknown app QR: '+item.id);
   assert.ok(devices.includes(item.device));
   assert.equal(item.id,item.app+'-'+item.device);
   assert.equal(item.qr,'/qr/app-'+item.app+'-'+item.device+'.svg');
   assert.equal(item.url,origin+'/download/'+item.device+'/?app='+item.app);
  }else{
   assert.equal(item.kind,'app');
   assert.ok(Object.hasOwn(apps,item.id),'Retired app QR: '+item.id);
   assert.equal(item.url,apps[item.id].url,'Wrong app QR destination: '+item.id);
  }
 }
 for(const device of devices) assert.ok(identifiers.has(device),'Missing device QR '+device);
 for(const id of Object.keys(apps)) {
  if(id!=='all-in-one') assert.ok(identifiers.has(id),'Missing app QR '+id);
  for(const device of devices){
   const svg='qr/app-'+id+'-'+device+'.svg';
   assert.ok(fs.existsSync(new URL(svg,publicRoot)),'Missing QR asset '+svg);
   if(id!=='all-in-one') assert.ok(identifiers.has(id+'-'+device),'Unlisted QR '+id+'-'+device);
  }
 }
});

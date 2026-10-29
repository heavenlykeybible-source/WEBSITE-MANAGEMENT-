import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
const publicRoot=new URL('../public/',import.meta.url),read=p=>fs.readFileSync(new URL(p,publicRoot),'utf8');
test('Public QR catalogue has complete current app/device coverage and unchanged verified images',()=>{
 const apps=JSON.parse(read('app-downloads.json')),items=JSON.parse(read('qr/destinations.json')),devices=['android','iphone','ipad','windows','mac'];
 assert.equal(new Set(items.map(x=>x.url)).size,items.length);
 assert.equal(items.length,devices.length+(Object.keys(apps).length-1)+devices.length*Object.keys(apps).length);
 for(const device of devices)assert.equal(items.filter(x=>x.kind==='device'&&x.id===device).length,1);
 for(const [id,app]of Object.entries(apps)){
  if(id!=='all-in-one')assert.equal(items.filter(x=>x.kind==='app'&&x.id===id).length,1,id);
  for(const device of devices)assert.equal(items.filter(x=>x.kind==='app-device'&&x.app===id&&x.device===device).length,1,id+' '+device);
 }
 for(const item of items){assert.equal(createHash('sha256').update(read(item.qr.slice(1))).digest('hex'),item.sha256);
  if(item.kind==='device')assert.equal(item.url,'https://apps.heavenlykey.org/download/'+item.id+'/');
  else if(item.kind==='app-device'){assert.ok(Object.hasOwn(apps,item.app));assert.equal(item.url,'https://apps.heavenlykey.org/download/'+item.device+'/?app='+item.app);}
  else {assert.ok(Object.hasOwn(apps,item.id));assert.equal(item.url,apps[item.id].url);for(const page of ['index.html','downloads.html']){assert.ok(read(page).includes('href="'+item.url+'"'));assert.ok(read(page).includes('src="'+item.qr+'"'));}}
 }
 assert.ok(!items.some(x=>['audio-bible','hymns','audio-hymns','bible-study-portal'].includes(x.app||x.id)));
});

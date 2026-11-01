import assert from 'node:assert/strict';
import {studioReady,formatDailyMannaPost,submitToStudio,readStudioStatus} from './studio-bridge.mjs';
const env={STUDIO_BRIDGE_ORIGIN:'https://studio.example.test/',STUDIO_BRIDGE_SECRET:'test-secret',STUDIO_FIRST_POST_DATE:'2026-11-01',MANNA_PUBLIC_ORIGIN:'https://dailyword.heavenlykey.org'};
const entry={delivery_id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',publish_date:'2026-11-01',title:'A New Morning',scripture:'Psalm 1',body:'The message',prayer:'Help us',picture_object_key:null};
assert.equal(studioReady(env),true);
assert.equal(studioReady({...env,STUDIO_BRIDGE_ORIGIN:'http://insecure.test/'}),false);
assert.equal(studioReady({...env,STUDIO_FIRST_POST_DATE:''}),false);
const caption=formatDailyMannaPost(entry,env.MANNA_PUBLIC_ORIGIN);
assert.ok(caption.includes('STRENGTH FOR TODAY - our daily manna'));
assert.ok(caption.includes('https://dailyword.heavenlykey.org/?date=2026-11-01'));
const veryLong=formatDailyMannaPost({...entry,title:'A'.repeat(250),scripture:'B'.repeat(500),body:'C'.repeat(40000),prayer:'D'.repeat(5000)},env.MANNA_PUBLIC_ORIGIN);
assert.ok(Array.from(veryLong).length<=1950,'Social caption must fit Instagram and preserve direct reading link');
assert.ok(veryLong.includes('https://dailyword.heavenlykey.org/?date=2026-11-01'));

let received=0;
const transport=async(url,opt)=>{
 received++;
 assert.equal(url,'https://studio.example.test/api/integrations/daily-manna/publish');
 assert.equal(opt.method,'POST');
 assert.equal(opt.headers['x-manna-key'],entry.delivery_id);
 assert.match(opt.headers['x-manna-signature'],/^[a-f0-9]{64}$/);
 const payload=JSON.parse(opt.body);
 assert.equal(payload.source,'daily-manna');
 assert.equal(payload.requires_picture,false);
 return Response.json({ok:true,job_ids:[123]});
};
const result=await submitToStudio(entry,env,transport);
assert.deepEqual(result.job_ids,[123]);
assert.equal(received,1);
const status=await readStudioStatus(entry.delivery_id,env,async(url,options)=>{
 assert.equal(url,'https://studio.example.test/api/integrations/daily-manna/publish');
 assert.equal(options.headers['x-manna-key'],entry.delivery_id);
 assert.match(options.headers['x-manna-signature'],/^[0-9a-f]{64}$/);
 assert.deepEqual(JSON.parse(options.body),{source:'daily-manna',action:'status'});
 return Response.json({ok:true,receipt_status:'submitted',jobs:[{job_id:123,platform:'facebook',status:'published',provider_post_id:'987_654',display_name:'Heavenly Key Page'}]});
});
assert.equal(status.jobs[0].provider_post_id,'987_654','Real provider result is available to owner');
assert.equal(status.receipt_status,'submitted');
await submitToStudio({...entry,picture_object_key:'post-banners/foo',studio_media_id:45},env,async(_url,options)=>{assert.equal(JSON.parse(options.body).studio_media_id,45);return Response.json({ok:true,job_ids:[555]})});

await assert.rejects(submitToStudio({...entry,picture_object_key:'post-banners/image'},env,async(u,opt)=>{
 assert.equal(JSON.parse(opt.body).requires_picture,true);
 return Response.json({error:'Picture must first be imported'}, {status:409});
}),/Studio rejected delivery/);
await assert.rejects(submitToStudio({...entry,delivery_id:'unsafe'},env,transport),/stable delivery key/);
console.log('PASS signed Studio bridge, URL validation, image requirement and handoff receipt');

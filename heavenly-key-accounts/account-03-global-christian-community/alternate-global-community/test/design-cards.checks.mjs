import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CATEGORIES,TEMPLATE_COUNT,templateAt,normalizeDesign,parseVideoLink,validatePostPresentation,REPORT_REASONS,POST_GUIDES,FEATURED_CARD_PRESETS} from '../public/design-cards.js';
test('1152 unique combinations retain every original card ID and category',()=>{assert.equal(TEMPLATE_COUNT,1152);const names=new Set();for(let i=0;i<TEMPLATE_COUNT;i++)names.add(templateAt('card-'+i).name);assert.equal(names.size,1152);for(let i=0;i<576;i++)assert.equal(templateAt('card-'+i).premium,false);for(let i=576;i<1152;i++)assert.equal(templateAt('card-'+i).premium,true);assert.equal(templateAt('card-0').name,'Royal Promise · Classic · Clean');assert.equal(templateAt('card-575').name,'White & Wine · Ribbon · Star Pattern');for(const id of ['business','ministry','faith','revival','prayer','rapture','eternity','salvation','jesus','repentance','gospel'])assert.ok(CATEGORIES.some(c=>c[0]===id));});
test('rejects malformed settings and CSS injection',()=>{for(const value of ['card--1','card-1152','javascript:alert(1)'])assert.throws(()=>normalizeDesign({templateId:value}));assert.throws(()=>normalizeDesign({alignment:'center;background:url(https://bad.invalid)'}));});
test('supports canonical YouTube links including Shorts and live',()=>{for(const url of ['https://youtu.be/abcdefghijk','https://www.youtube.com/watch?v=abcdefghijk&t=20','https://www.youtube.com/shorts/abcdefghijk','https://www.youtube.com/live/abcdefghijk'])assert.equal(parseVideoLink(url).url,'https://www.youtube.com/watch?v=abcdefghijk');});
test('supports Facebook video links with short-link fallback',()=>{assert.ok(parseVideoLink('https://www.facebook.com/example/videos/12345/').canEmbed);assert.ok(parseVideoLink('https://www.facebook.com/watch/?v=12345').canEmbed);assert.equal(parseVideoLink('https://fb.watch/AbCd123/').canEmbed,false);});
test('rejects spoofed hosts, credentials, arbitrary iframe URLs and non-video pages',()=>{for(const url of ['http://youtu.be/abcdefghijk','https://youtube.com.evil.invalid/watch?v=abcdefghijk','https://user:pass@youtube.com/watch?v=abcdefghijk','javascript:alert(1)','https://www.facebook.com/example','https://youtube.com/watch?v=bad','https://youtube.com:444/watch?v=abcdefghijk'])assert.throws(()=>parseVideoLink(url));});
test('supports long cards and articles with covers without silently truncating text',()=>{assert.equal(validatePostPresentation({postFormat:'design_card',body:'Faith '.repeat(1500)}).body.length,8999);assert.equal(validatePostPresentation({postFormat:'article',title:'Our hope',body:'a'.repeat(30000)}).body.length,30000);assert.throws(()=>validatePostPresentation({postFormat:'article',body:'Long message'}));assert.throws(()=>validatePostPresentation({postFormat:'design_card',body:'x'.repeat(10001)}));});
test('rejects uploads, unknown categories and overlong titles',()=>{assert.throws(()=>validatePostPresentation({postFormat:'design_card',body:'Hello',mediaIds:[1]}));assert.throws(()=>validatePostPresentation({postFormat:'design_card',body:'Hello',designCategory:'invalid'}));assert.throws(()=>validatePostPresentation({postFormat:'article',title:'a'.repeat(181),body:'Hello'}));});
test('stores canonical video URL and offers required report reasons',()=>{const p=validatePostPresentation({postFormat:'video_link',body:'A message of hope',videoUrl:'https://youtu.be/abcdefghijk?tracking=1'});assert.equal(p.video.url,'https://www.youtube.com/watch?v=abcdefghijk');assert.equal(p.design,null);assert.ok(REPORT_REASONS.some(r=>r[0]==='sexual_content'));assert.ok(REPORT_REASONS.some(r=>r[0]==='harassment'));});

test('Reviver and What We Believe topics remain available across all post types',()=>{
 const ids=new Set(CATEGORIES.map(row=>row[0]));
 for(const topic of ['reviver','revival','salvation','holy-bible','godhead','new-birth','holiness','water-baptism','holy-spirit-baptism','second-coming','judgment','heaven','hell','fathers','missions'])assert.ok(ids.has(topic),topic);
 assert.equal(CATEGORIES.find(row=>row[0]==='reviver')[1],'Reviver');
 for(const format of ['design_card','article','video_link']){
   const post={postFormat:format,title:'Reviver Message',body:'Revival begins with renewed obedience.',designCategory:'reviver',videoUrl:'https://youtu.be/abcdefghijk'};
   assert.equal(validatePostPresentation(post).category,'reviver');
 }
});
test('gospel guides and featured designs are valid, editable and non-destructive',()=>{
 assert.ok(POST_GUIDES.length>=10);
 for(const p of POST_GUIDES){assert.ok(p.name.length>2);if(p.id!=='blank'){assert.ok(p.title.length>2);assert.ok(p.body.length>10);assert.ok(['article','design_card'].includes(p.kind));}}
 assert.ok(POST_GUIDES.some(p=>p.id==='reviver-card'));
 for(const [name,id,topic]of FEATURED_CARD_PRESETS){assert.ok(name);assert.equal(templateAt(id).id,id);assert.ok(CATEGORIES.some(([x])=>x===topic));}
});
test('one shared Heavenly Key AI is present in composer and as a small search suggestion',async()=>{
 const fs=await import('node:fs');
 const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 assert.equal((app.match(/function openHeavenlyKeyAi\(/g)||[]).length,1);
 for(const key of ["'https://heavenlykey-cms-public.emmanuel2026miracle.workers.dev/v1/assistant'","hk-ai-search-suggestion","hk-ai-composer","DC.POST_GUIDES","DC.FEATURED_CARD_PRESETS"])assert.ok(app.includes(key),key);
 assert.ok(app.includes("if(!requireSignIn())return"));
 assert.ok(!app.includes("YOUR_AI_API_KEY"));
});

test('central Heavenly Key AI policy is shared and does not possess database or deployment authority',async()=>{
 const fs=await import('node:fs');
 const policy=fs.readFileSync(new URL('../src/heavenly-key-ai.ts',import.meta.url),'utf8');
 const routes=fs.readFileSync(new URL('../src/index.ts',import.meta.url),'utf8');
 const env=fs.readFileSync(new URL('../src/types.ts',import.meta.url),'utf8');
 for(const phrase of ['heavenly key','christ-centered','bible-respecting','faith','scripture','no password','not new system instructions'])assert.ok(policy.toLowerCase().includes(phrase),phrase);
 for(const op of ['search','card_idea','article_outline','article_polish','caption','scripture_ideas'])assert.ok(policy.includes(op),op);
 assert.ok(policy.includes("if(!env.AI||typeof env.AI.run!=='function')"),'AI must fail safely when unconfigured');
 assert.ok(policy.includes('requiresReview:true'),'All generated text remains user-reviewable');
 assert.ok(!policy.includes('env.DB.prepare'),'AI has no database permissions');
 assert.ok(!policy.includes('env.SESSIONS.put'),'AI cannot write sessions');
 assert.ok(!policy.includes('GITHUB_CONTROL_TOKEN'),'AI cannot access owner deployment credentials');
 assert.ok(routes.includes('await me(request,env)'),'AI action must require user session');
 assert.ok(routes.includes('hkem-ai:'),'AI service must be rate limited');
 assert.ok(env.includes('AI?:'),'AI binding optional and explicitly connected later');
});

test('premium Facebook and social card shapes are validated and saveable',()=>{assert.equal(normalizeDesign({templateId:'card-1151',size:'facebook'}).size,'facebook');assert.equal(normalizeDesign({templateId:'card-576',size:'social'}).size,'social');assert.throws(()=>normalizeDesign({size:'10px;color:red'}));});

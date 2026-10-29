const test=require('node:test'),assert=require('node:assert/strict');const {ministryURL}=require('./policy.cjs');
test('only HTTPS ministry hosts may load in desktop renderer',()=>{
 for(const url of ['https://apps.heavenlykey.org/experience.html','https://global.heavenlykey.org','https://heavenlykey.org'])assert.equal(ministryURL(url),true,url);
 for(const url of ['http://apps.heavenlykey.org','https://heavenlykey.org.attacker.com','https://evilheavenlykey.org','https://user:secret@apps.heavenlykey.org','https://apps.heavenlykey.org:444','file:///tmp/evil','javascript:alert(1)','data:text/html,evil','not a URL'])assert.equal(ministryURL(url),false,url);
});

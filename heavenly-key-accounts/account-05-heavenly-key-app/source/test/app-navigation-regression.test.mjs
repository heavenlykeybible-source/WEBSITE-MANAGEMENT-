import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
test('Account 5 internal app discovery remains on the app domain',()=>{
 for(const file of ['index.html','experience.html']){
  const html=read(file);
  assert.match(html,/href="\\/downloads\\.html#download"/,file+' must lead to the local download directory');
  assert.match(html,/href="\\/downloads\\.html#choose-your-app"/,file+' must lead to local individual app directory');
  assert.doesNotMatch(html,/heavenlykey\\.org\\/pages\\/app\\.html#(?:download|choose-your-app)/,file+' must not route discovery to the ministry homepage');
 }
});
test('Download directory keeps app home distinct from ministry website',()=>{
 const html=read('downloads.html');
 assert.match(html,/<a href="\\/" aria-label="Heavenly Key App home">/);
 assert.match(html,/<a href="\\/">App Home<\\/a>/);
 assert.match(html,/<a href="https:\\/\\/www\\.heavenlykey\\.org\\/">Main Website<\\/a>/);
 assert.match(html,/id="download"/);
 assert.match(html,/id="choose-your-app"/);
 assert.match(html,/href="https:\\/\\/apps\\.heavenlykey\\.org\\/downloads\\.html"/);
});

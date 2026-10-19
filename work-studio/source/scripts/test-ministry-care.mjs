import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve('.');
const read=(p)=>readFileSync(join(root,p),'utf8');
const main='heavenly-key-website/js/ministry-care.js',community='global-community/public/ministry-care.js';
const css='heavenly-key-website/js/ministry-care.css',communityCss='global-community/public/ministry-care.css';
test('both public sites share precisely the same isolated care behavior and styles',()=>{
  assert.equal(read(main),read(community));
  assert.equal(read(css),read(communityCss));
  assert.match(read(main),/id='hk-ministry-care'/);
  assert.doesNotMatch(read(main),/CMS_PASSWORD|CONTROL_PASSWORD_HASH|wrangler deploy|localStorage\.setItem|eval\(|innerHTML\s*=/i);
});
test('approved six options, GRDPC, animated text and flags are correctly configured',()=>{
  const s=read(main);
  for(const label of ['Join Community','Prayer Request','GRDPC','Listen to Radio','Learn More About the Ministry','Speak with Evangelist Emmanuel']){
    assert.ok(s.includes(label),label);
  }
  assert.ok(!s.includes("'DPP'")&&!s.includes('"DPP"'));
  assert.ok(!s.includes('We care about Christ'));
  assert.ok(s.includes('How may we be of help to you today?'));
  for(const flag of ['🇩🇪','🇬🇧','🇺🇸','🇨🇦','🇬🇭','🇳🇬','🇺🇬','🇵🇰','🇮🇳','🇫🇷'])assert.ok(s.includes(flag),flag);
  assert.match(s,/prefers-reduced-motion/);
  assert.match(s,/setOpen\(true,true\)/);
  assert.match(s,/automated ministry guide/i);
});
test('portrait and official logo remain real local assets in the branch',()=>{
  for(const path of ['heavenly-key-website/js/ministry-care-lady.webp','global-community/public/ministry-care-lady.webp','global-community/public/assets/ministry-care-logo.png','heavenly-key-website/assets/ministry/logo.png']){
    assert.ok(statSync(path).size>1500,path);
  }
  assert.ok(statSync('heavenly-key-website/js/ministry-care-lady.webp').size<100000,'use compact mobile portrait');
  assert.equal(readFileSync('heavenly-key-website/js/ministry-care-lady.webp').toString('hex',0,4),'52494646');
  assert.deepEqual(readFileSync('heavenly-key-website/js/ministry-care-lady.webp'),readFileSync('global-community/public/ministry-care-lady.webp'));
  assert.deepEqual(readFileSync('heavenly-key-website/assets/ministry/logo.png'),readFileSync('global-community/public/assets/ministry-care-logo.png'));
});
test('all public ministry pages have care; the administrator consoles remain untouched',()=>{
 const dir='heavenly-key-website/pages';
 const exceptions=new Set(['admin.html','schedule-post.html']);
 for(const name of readdirSync(dir).filter(p=>p.endsWith('.html'))){
  const html=read(dir+'/'+name);
  if(exceptions.has(name)){
   assert.ok(!html.includes('ministry-care.js'),'do not add to sensitive '+name);
  }else{
   assert.ok(html.includes('ministry-care.js')||html.includes('site-footer.js'),name+' missing loader');
  }
 }
 assert.match(read('heavenly-key-website/index.html'),/site-footer\.js/);
 assert.match(read('heavenly-key-website/js/site-footer.js'),/data-hk-care-loader/);
 const mainCode=read(main);
 assert.ok(!mainCode.includes('site-cms.js'));
});
test('all community public pages display the same assistant and member status is authoritative',()=>{
 for(const name of readdirSync('global-community/public').filter(p=>p.endsWith('.html'))){
  assert.ok(read('global-community/public/'+name).includes('ministry-care.js'),name);
 }
 assert.match(read('global-community/public/app.js'),/CustomEvent\("hk-care-session",\{detail:session\}\)/);
 assert.match(read(community),/detail\?\.user\?\.status==='active'/);
 assert.match(read(communityCss),/\[data-member="true"\]/);
 assert.match(read(communityCss),/prefers-reduced-motion:reduce/);
});
test('widget never auto-opens, sends a message to the server, or changes the radio player',()=>{
 const s=read(main);
 assert.ok(!s.includes('setOpen(true);'),'full panel must be user-initiated');
 assert.match(s,/collapsed\.addEventListener\('click',\(\)=>setOpen\(true,true\)\)/);
 assert.match(s,/window\.addEventListener\('resize',reposition/);
 assert.match(s,/sessionStorage\.setItem\('hk-care-dismissed','1'\)/);
 assert.ok(!s.includes("fetch("),'no private chat data transmitted');
 assert.match(read('heavenly-key-website/js/site-footer.js'),/floating-radio\.js/);
 assert.match(s,/hk-floating-radio/);
});